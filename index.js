require('dotenv').config();
const fs = require('fs');
const express = require('express');
const app = express();
const http = (process.env.HTTPS === 'true' ?
    require('https').createServer({
        key: fs.readFileSync(process.env.SSL_KEY),
        cert: fs.readFileSync(process.env.SSL_CERT)
    }, app) : require('http').createServer(app));
const io = require('socket.io')(http, {pingInterval: 5000});
const mongo = require('mongodb').MongoClient;
const database = process.env.DB_URL;
const mgOpts = { "useUnifiedTopology": true };

const mongoWork = (cb) => {
    mongo.connect(database, mgOpts, function(err, client) {
        if (err) throw err;
        let db = client.db("leosight-eco");
        cb(db, client);
    });
};

console.log('Načítám moduly..');

const utils = require(__dirname + '/utils.js');
require(__dirname + '/antispam.js')(io);
require(__dirname + '/commands.js')(io);
const security = require(__dirname + '/security.js');
const account = require(__dirname + '/account.js')(security);
const discord = require(__dirname + '/discord.js');
const db = {
    users: require(__dirname + '/db/users.js')(mongoWork)
};

let players = []; // Aktuálně připojení hráči
let users = []; // Databáze uživatelů

mongoWork(function(db, client) {
    let mySort = { username: 1 };
    db.collection("users").find().sort(mySort).toArray(function(err, result) {
        if (err) throw err;
        users = result;
        client.close();
    });
});

app.use(express.static(__dirname + '/client', { dotfiles: 'allow' } ));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

http.listen(3005, () => console.log('Server spuštěn na portu 3005'));

io.on('connection', function(socket){
    let remoteIp = socket.request.connection.remoteAddress;
    let remotePort = socket.request.connection.remotePort;
    let playerData = { "username": 'Humorníček', "logged": false, "ip": remoteIp };
    let index = players.indexOf(0);
    if(index > -1){
        players[index] = playerData;
    }else{
        index = players.push( playerData ) - 1;
    }
    console.log('[CONNECT] Uživatel [' + index + '] se připojil z IP ' + remoteIp);

    socket.on('disconnect', function(){
        console.log('[DISCONNECT] Uživatel [' + index + '] se odpojil');

        if(players[index] && players[index].logged) {
            io.emit('chat', null, `[#${index}] ${players[index].username} se odpojil. 😴`, '#44cee8');
        }

        players[index] = 0;
        SendPlayerList();
    });

    socket.on('login', function(username, password){
        password = security.hash(password);
        console.log('[LOGIN] #' + index + ' se pokouší přihlásit jako "' + username + '"');
        account.login(username, password, function(success, response){
            console.log('[LOGIN] #' + index + ' - ' + response);

            if(success){
                players[index]['username'] = username;
                players[index]['logged'] = true;
                players[index]['security'] = response;

                db.users.loginUpdate(username, response);

                let userData = users.find(x => x.security === response);
                if(userData){
                    socket.emit('chat', null, `Vítej, naposledy jsi se přihlásil ${utils.date(userData.lastlogin)}`, '#44cee8');
                    userData.lastlogin = new Date().valueOf();
                }else{
                    socket.emit('chat', null, `Vítej v LeoSight Eco! Zdá se, že jsi tu poprvé, pokud potřebuješ s něčím pomoct, neváhej se obrátit na ostatní v místnosti #leosight-eco našeho Discord serveru (discord.gg/RJmtV3p).`, '#44cee8');
                    users.push( { username: username, security: response, lastlogin: new Date().valueOf() } );
                }

                io.emit('chat', null, `[#${index}] ${username} se přihlásil. 👋`, '#44cee8');
                SendPlayerList();
            }

            socket.emit('login', success, response);
        });
    });

    socket.on('chat', function(msg) {
        if (players[index] && players[index].logged && msg.length <= 255){
            let userData = users.find(x => x.security === players[index].security);

            if(msg.startsWith('/')){
                if(msg.startsWith('/color')){
                    let hex = msg.replace('/color ', '');
                    if(/^#([0-9A-F]{3}){1,2}$/i.test(hex)){
                        db.users.updateColor(userData.security, hex);
                        userData.color = hex;
                        SendPlayerList();
                    }
                }else if(msg.startsWith('/players')) {
                    SendPlayerList();
                }
            }else{
                let color = '#fff';
                if(userData && userData.color){
                    color = userData.color;
                }

                io.emit('chat', `[#${index}] ${players[index].username}`, msg, color);
                console.log(`[CHAT] [#${index}] ${players[index].username}: ${msg}`);
            }
        }
    });

    socket.on('capture', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            io.emit('capture', userData.color, x, y);
        }
    });
});

function SendPlayerList(){
    let playerList = [];
    players.forEach((value, key) => {
        if(value.logged) {
            let userData = users.find(x => x.security === value.security);
            playerList.push( { id: key, username: value.username, color: userData.color } );
        }
    });
    io.emit('players', playerList);
}
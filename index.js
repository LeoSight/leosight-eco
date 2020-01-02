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
const MongoClient = require('mongodb').MongoClient;
const database = process.env.DB_URL;

console.log('Načítám moduly..');

require(__dirname + '/antispam.js')(io);
require(__dirname + '/commands.js')(io);
const security = require(__dirname + '/security.js');
const account = require(__dirname + '/account.js')(security);

let players = [];

MongoClient.connect(database, { "useUnifiedTopology": true }, function(err, db) {
    if (err) throw err;
    let dbo = db.db("leosight-eco");

    let mySort = { name: 1 };
    dbo.collection("users").find().sort(mySort).toArray(function(err, result) {
        if (err) throw err;
        console.log(result);
        db.close();
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
            io.emit('chat', `[#${index}] ${players[index].username} se odpojil. 😴`, 'console');
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

                io.emit('chat', `[#${index}] ${username} se přihlásil. 👋`, 'console');
                SendPlayerList();
            }

            socket.emit('login', success, response);
        });
    });

    socket.on('chat', function(msg) {
        if (msg.length <= 255){
            if(msg === '!players'){
                SendPlayerList();
            }else {
                io.emit('chat', `[#${index}] ${players[index].username}: ${msg}`);
                console.log(`[CHAT] [#${index}] ${players[index].username}: ${msg}`);
            }
        }
    });
});

function SendPlayerList(){
    let playerList = [];
    players.forEach((value, key) => {
        if(value.logged) {
            playerList.push(`[#${key}] ${value.username}`);
        }
    });
    io.emit('players', playerList);
}
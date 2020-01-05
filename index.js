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
const Promise = require('bluebird');
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
const security = (process.env.LOGIN === 'API' ? require(__dirname + '/security.js') : null);
const account = (process.env.LOGIN === 'API' ? require(__dirname + '/account.js')(security) : null);
const discord = (process.env.DISCORD_TOKEN.length > 0 ? require(__dirname + '/discord.js') : null);
const db = {
    users: require(__dirname + '/db/users.js')(mongoWork),
    world: require(__dirname + '/db/world.js')(mongoWork)
};

let players = []; // Aktuálně připojení hráči
let users = []; // Databáze uživatelů
let world = []; // Informace o celém gridu

mongoWork(function(db, client) {
    db.createCollection('users');
    db.createCollection('world');

    let mySort = { username: 1 };
    db.collection("users").find().sort(mySort).toArray(function(err, result) {
        if (err) throw err;
        users = result;
        client.close();
    });
});

console.log('Načítám svět..');

db.world.loadWorld((result) => {
    world = result;
    console.log('Svět načten!');
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
    SendMap(socket);

    socket.on('disconnect', function(){
        console.log('[DISCONNECT] Uživatel [' + index + '] se odpojil');

        if(players[index] && players[index].logged) {
            io.emit('chat', null, `[#${index}] ${players[index].username} se odpojil. 😴`, '#44cee8');
        }

        let userData = users.find(x => x.security === players[index].security);
        if(userData && userData.socket){
            userData.socket = null;
        }

        players[index] = 0;
        SendPlayerList();
    });

    socket.on('login', function(username, password){
        if(process.env.LOGIN === 'API') {
            password = security.hash(password);
            console.log('[LOGIN] #' + index + ' se pokouší přihlásit jako "' + username + '"');
            account.login(username, password, function (success, response) {
                console.log('[LOGIN] #' + index + ' - ' + response);
                LoginCallback(socket, index, username, success, response);
            });
        }else{
            console.log('[LOGIN] #' + index + ' se přihlásil jako "' + username + '" (BEZ OVĚŘENÍ!)');
            LoginCallback(socket, index, username, true, username);
        }
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
            if(userData && userData.color && userData.energy) {
                if(userData.energy > 0) {
                    let cell = users.find(d => d.x === x && d.y === y);
                    if(cell){
                        cell.owner = players[index].security;
                    }else{
                        world.push({ x: x, y: y, owner: players[index].security });
                    }

                    db.world.cellUpdate(x, y, userData.security);
                    io.emit('cell', x, y, userData.username, userData.color);
                    //io.emit('capture', userData.color, x, y);

                    userData.energy -= 1;
                    socket.emit('energy', userData.energy);
                }
            }
        }
    });
});

function SendMap(socket){
    socket.emit('mapload', world.length);
    world.forEach(cell => {
        let owner = users.find(x => x.security === cell.owner);
        socket.emit('cell', cell.x, cell.y, owner.username, owner.color);
    });
}

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

function FetchUserData(socket, index){
    let userData = users.find(x => x.security === players[index].security);
    if(userData) {
        if(userData.energy){
            socket.emit('energy', userData.energy);
        }else{
            db.users.updateEnergy(userData.security, 0);
            socket.emit('energy', 0);
        }
    }else{
        console.log('[ERROR] Nepodařilo se načíst data hráči ' + players[index].username + '!');
    }
}

function LoginCallback(socket, index, username, success, response){
    if (success) {
        players[index]['username'] = username;
        players[index]['logged'] = true;
        players[index]['security'] = response;

        db.users.loginUpdate(username, response);

        let userData = users.find(x => x.security === response);
        if (userData) {
            socket.emit('chat', null, `Vítej, naposledy jsi se přihlásil ${utils.date(userData.lastlogin)}`, '#44cee8');
            userData.lastlogin = new Date().valueOf();
            userData.socket = socket;
        } else {
            socket.emit('chat', null, `Vítej v LeoSight Eco! Zdá se, že jsi tu poprvé, pokud potřebuješ s něčím pomoct, neváhej se obrátit na ostatní v místnosti #leosight-eco našeho Discord serveru (discord.gg/RJmtV3p).`, '#44cee8');
            users.push({username: username, security: response, lastlogin: new Date().valueOf(), socket: socket, color: '#fff'});
            db.users.setDefault(response);
        }

        io.emit('chat', null, `[#${index}] ${username} se přihlásil. 👋`, '#44cee8');

        SendPlayerList();
        FetchUserData(socket, index);
    }

    socket.emit('login', success, response);
}

function RestoreEnergy() {
    users.forEach(userData => {
        if(!userData.energy) userData.energy = 0;
        let newEnergy = Math.min(userData.energy + 1, 10);

        if(newEnergy !== userData.energy) {
            userData.energy = newEnergy;
            db.users.updateEnergy(userData.security, newEnergy);

            if(userData.socket) {
                userData.socket.emit('energy', newEnergy);
            }
        }
    });

    return Promise.delay(5000).then(() => RestoreEnergy());
}
RestoreEnergy();
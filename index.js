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
const builds = require(__dirname + '/builds.js');
const resources = require(__dirname + '/resources.js');
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
    let playerData = { username: 'Humorníček', logged: false, ip: remoteIp, socket: socket };
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

    socket.on('chat', (msg) => ChatHandler(msg, index));

    socket.on('capture', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if(userData && userData.color && userData.energy) {
                if(userData.energy > 0) {
                    userData.cells = CountPlayerCells(userData.security);
                    if((userData.cells === 0 && CanBuildHQ(x, y)) || CheckAdjacent(x, y, userData.security)) {
                        let energyCost = 1;
                        let resistance = false;
                        let cell = world.find(d => d.x === x && d.y === y);
                        if (cell) {
                            if(cell.build != null && userData.cells === 0) return; // Nelze vybudováním základny zbourat existující budovu
                            if(cell.build === builds.HQ) return; // Nelze zabrat HQ
                            if (cell.owner) {
                                //if(userData.cells === 0) return; // Nemůže zabrat cizí čtverec jako první tah
                                if(cell.owner === userData.security) return; // Nelze zabrat vlastní čtverec znovu

                                let oldOwner = users.find(x => x.security === cell.owner);
                                if (oldOwner) {
                                    if(userData.energy < 2) return; // Zabrání již obsazeného pole stojí 2 energie
                                    energyCost = 2;

                                    if(userData.cells === 0){
                                        io.emit('chat', null, `[#${index}] ${userData.username} vybudoval základnu odboje na území "${oldOwner.country || 'Bez názvu'}" a bojuje o nezávislost.`, '#44cee8');
                                        resistance = true;
                                    }else{
                                        if(!ProcessFight(x, y, userData, oldOwner)) { // Útok může selhat (nedostatek munice)
                                            userData.energy -= energyCost;
                                            socket.emit('info', { energy: userData.energy, ammo: userData.ammo });
                                            socket.emit('chat', null, `Armáda z "${oldOwner.country || 'Bez názvu'}" odrazila tvůj útok!`, '#e1423e');
                                            return;
                                        }
                                    }

                                    if(cell.build === builds.FORT){
                                        if(userData.energy < 10) return; // Zabrání pevnosti stojí 10 energie
                                        if(cell.level > 1){
                                            cell.level -= 1;

                                            db.world.cellUpdate(x, y, oldOwner.security, cell.build, cell.level);
                                            io.emit('cell', x, y, oldOwner.username, oldOwner.color, cell.build, cell.level);

                                            userData.energy -= 10;
                                            socket.emit('info', { energy: userData.energy });

                                            return; // Neřešit další kód pro obsazení čtverce
                                        }

                                        energyCost = 10;
                                        cell.build = null;
                                    }else if(cell.build === builds.MILITARY){
                                        if(userData.energy < 10) return; // Zabrání vojenské základny stojí 10 energie
                                        if(userData.ammo < 500) return; // Zabrání vojenské základny stojí 500 munice
                                        userData.ammo -= 500;
                                        energyCost = 10;
                                        cell.build = null;
                                    }

                                    if(oldOwner.socket) {
                                        oldOwner.cells = CountPlayerCells(oldOwner.security);
                                        oldOwner.socket.emit('info', {cells: oldOwner.cells});
                                    }
                                }
                            }

                            cell.owner = userData.security;
                            if(userData.cells === 0) cell.build = builds.HQ;
                        } else {
                            cell = { x: x, y: y, owner: userData.security };
                            if(userData.cells === 0) cell.build = builds.HQ;
                            world.push(cell);
                        }

                        if(userData.cells === 0 && !resistance){
                            io.emit('chat', null, `[#${index}] ${userData.username} právě založil nezávislý národ.`, '#44cee8');
                        }

                        db.world.cellUpdate(x, y, userData.security, cell.build, cell.level);
                        io.emit('cell', x, y, userData.username, userData.color, cell.build, cell.level);

                        userData.energy -= energyCost;
                        userData.cells += 1;

                        socket.emit('info', { energy: userData.energy, cells: userData.cells, ammo: userData.ammo });
                    }
                }
            }
        }
    });

    socket.on('movehq', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 10) {
                    let cell = world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build == null){
                        if(CanBuildHQ(x, y) && CheckAdjacentOwnAll(x, y, userData.security)) {
                            let oldHQ = world.find(d => d.build === builds.HQ && d.owner === userData.security);
                            if (oldHQ) {
                                oldHQ.build = null;
                                db.world.cellUpdate(oldHQ.x, oldHQ.y, userData.security, null);
                                io.emit('cell', oldHQ.x, oldHQ.y, userData.username, userData.color, null);
                            }

                            cell.build = builds.HQ;
                            db.world.cellUpdate(x, y, userData.security, builds.HQ);
                            io.emit('cell', x, y, userData.username, userData.color, builds.HQ);

                            userData.energy -= 10;
                            socket.emit('info', {energy: userData.energy});
                        }
                    }
                }
            }
        }
    });

    socket.on('unclaim', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if (userData && userData.energy) {
                if (userData.energy > 0) {
                    let cell = world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build !== builds.HQ){
                        cell.owner = null;
                        db.world.cellUpdate(x, y, null, cell.build);
                        io.emit('cell', x, y, null, null, cell.build);

                        userData.energy -= 1;
                        userData.cells -= 1;

                        socket.emit('info', { energy: userData.energy, cells: userData.cells });
                    }
                }
            }
        }
    });

    socket.on('build', function(x, y, building){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if (userData) {
                let cell = world.find(d => d.x === x && d.y === y);
                if(cell && cell.owner === userData.security && cell.build == null) {
                    let cost = {};
                    if (building === builds.FORT) {
                        cost = {energy: 10, stone: 100}
                    } else if (building === builds.FACTORY) {
                        cost = {energy: 10, stone: 100, iron: 200, bauxite: 300}
                    } else if (building === builds.MILITARY) {
                        cost = {energy: 10, gold: 1000, stone: 1000, iron: 1000, bauxite: 1000}
                    } else {
                        return;
                    }

                    let costMet = true;
                    Object.keys(cost).forEach((key) => {
                        if (!userData[key] || userData[key] < cost[key]) {
                            costMet = false;
                        }
                    });

                    if (costMet) {
                        cell.build = building;
                        db.world.cellUpdate(x, y, userData.security, cell.build, 1);
                        io.emit('cell', x, y, userData.username, userData.color, cell.build, 1);

                        let newMaterials = {};
                        Object.keys(cost).forEach((key) => {
                            userData[key] -= cost[key];
                            newMaterials[key] = userData[key];
                            db.users.update(userData.security, key, userData[key]);
                        });

                        socket.emit('info', newMaterials);
                    }
                }
            }
        }
    });

    socket.on('upgrade', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if (userData && userData.energy && userData.stone) {
                if (userData.energy >= 10 && userData.stone >= 500) {
                    let cell = world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build === builds.FORT){
                        let level = cell.level || 1;
                        if(level < 5){
                            level += 1;
                            cell.level = level;
                            db.world.cellUpdate(x, y, userData.security, cell.build, cell.level);
                            io.emit('cell', x, y, userData.username, userData.color, cell.build, cell.level);

                            userData.energy -= 10;
                            userData.stone -= 500;

                            socket.emit('info', { energy: userData.energy, stone: userData.stone });
                        }
                    }
                }
            }
        }
    });

    socket.on('destroy', function(x, y){
        if (players[index] && players[index].logged) {
            let userData = users.find(x => x.security === players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 1) {
                    userData.cells = CountPlayerCells(userData.security);
                    let cell = world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && (cell.build in [builds.FORT, builds.FACTORY, builds.MILITARY] || (cell.build === builds.HQ && userData.cells <= 1))){
                        if(cell.build === builds.HQ){
                            cell.owner = null;
                            cell.build = null;

                            db.world.cellUpdate(x, y, null, null);
                            io.emit('cell', x, y, null, null, null);

                            userData.energy -= 1;
                            userData.cells -= 1;

                            socket.emit('info', {energy: userData.energy, cells: userData.cells});
                        }else{
                            cell.build = null;
                            db.world.cellUpdate(x, y, userData.security, null);
                            io.emit('cell', x, y, userData.username, userData.color, null);

                            userData.energy -= 1;

                            socket.emit('info', {energy: userData.energy});
                        }
                    }
                }
            }
        }
    });
});

function ChatHandler(msg, index) {
    if (players[index] && players[index].logged && msg.length <= 255){
        let userData = users.find(x => x.security === players[index].security);

        if(msg.startsWith('/')){
            let args = msg.split(' ');
            let cmd = args[0].substr(1);

            if(cmd === 'color') {
                let hex = msg.replace('/color ', '');
                if (/^#([0-9A-F]{3}){1,2}$/i.test(hex)) {
                    db.users.update(userData.security, 'color', hex);
                    userData.color = hex;
                    SendPlayerList();
                    UpdatePlayerCells(userData.security);
                }else{
                    players[index].socket.emit('chat', null, `SYNTAX: /color [Barva v HEX kódu]`, '#e8b412');
                }
            }else if(cmd === 'w' || cmd === 'pm'){
                if(!isNaN(args[1]) && args[2]){
                    let targetIndex = parseInt(args[1]);
                    let target = players[targetIndex];
                    if(target && target.socket){
                        args.shift(); args.shift(); // Už nepotřebujeme příkaz a ID, zajímá nás pouze zpráva
                        let whisper = `[#${index}] ${players[index].username} > [#${targetIndex}] ${target.username}: ${args.join(' ')}`;
                        players[index].socket.emit('chat', null, whisper, '#c78bf1');
                        target.socket.emit('chat', null, whisper, '#c78bf1');
                        console.log(`[WHISPER] ${whisper}`);
                    }else{
                        players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                    }
                }else{
                    players[index].socket.emit('chat', null, `SYNTAX: /pm [ID] [Zpráva]`, '#e8b412');
                }
            }else if(cmd === 'pay') {
                if (!isNaN(args[1]) && !isNaN(args[2])) {
                    let targetIndex = parseInt(args[1]);
                    let amount = parseInt(args[2]);
                    let target = players[targetIndex];
                    if(target){
                        let targetData = users.find(x => x.security === target.security);
                        if (target && target.socket && targetData) {
                            if(amount > 0) {
                                if (userData.money >= amount) {
                                    let playerMoney = userData.money;
                                    playerMoney -= amount;
                                    userData.money = playerMoney;
                                    db.users.update(userData.security, 'money', playerMoney);
                                    userData.socket.emit('info', {money: playerMoney});

                                    let targetMoney = targetData.money;
                                    targetMoney += amount;
                                    targetData.money = targetMoney;
                                    db.users.update(targetData.security, 'money', targetMoney);
                                    targetData.socket.emit('info', {money: targetMoney});

                                    players[index].socket.emit('chat', null, `Poslal jsi 💰${amount} hráči [#${targetIndex}] ${target.username}.`, '#44cee8');
                                    target.socket.emit('chat', null, `[#${index}] ${players[index].username} ti poslal 💰${amount}.`, '#44cee8');
                                    console.log(`[PAY] [#${index}] ${players[index].username} > [#${targetIndex}] ${target.username}: ${amount}`);

                                } else {
                                    players[index].socket.emit('chat', null, `Nemáš dostatek peněz!`, '#e1423e');
                                }
                            }else{
                                players[index].socket.emit('chat', null, `Částka musí být kladné číslo!`, '#e1423e');
                            }
                        }else{
                            players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                        }
                    } else {
                        players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                    }
                } else {
                    players[index].socket.emit('chat', null, `SYNTAX: /pay [ID] [Částka]`, '#e8b412');
                }
            }else if(cmd === 'send') {
                if (!isNaN(args[1]) && args[2] && args[2].toUpperCase() in resources && !isNaN(args[3])) {
                    let targetIndex = parseInt(args[1]);
                    let amount = parseInt(args[3]);
                    let material = args[2].toLowerCase();
                    let target = players[targetIndex];
                    if(target){
                        let targetData = users.find(x => x.security === target.security);
                        if (target && target.socket && targetData) {
                            if(amount > 0) {
                                if (userData[material] && userData[material] >= amount) {
                                    let playerValue = userData[material] || 0;
                                    playerValue -= amount;
                                    userData[material] = playerValue;
                                    db.users.update(userData.security, material, playerValue);
                                    userData.socket.emit('info', {[material]: playerValue});

                                    let targetValue = targetData[material] || 0;
                                    targetValue += amount;
                                    targetData[material] = targetValue;
                                    db.users.update(targetData.security, material, targetValue);
                                    targetData.socket.emit('info', {[material]: targetValue});

                                    players[index].socket.emit('chat', null, `Poslal jsi ${amount}x "${material}" hráči [#${targetIndex}] ${target.username}.`, '#44cee8');
                                    target.socket.emit('chat', null, `[#${index}] ${players[index].username} ti poslal ${amount}x "${material}".`, '#44cee8');
                                    console.log(`[SEND] [#${index}] ${players[index].username} > [#${targetIndex}] ${target.username}: ${amount}x ${material}`);

                                } else {
                                    players[index].socket.emit('chat', null, `Nemáš dostatek tohoto materiálu!`, '#e1423e');
                                }
                            }else{
                                players[index].socket.emit('chat', null, `Počet musí být kladné číslo!`, '#e1423e');
                            }
                        }else{
                            players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                        }
                    } else {
                        players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                    }
                } else {
                    players[index].socket.emit('chat', null, `SYNTAX: /send [ID] [Materiál] [Počet]<br>Platné názvy materiálů jsou: ${Object.keys(resources).join(', ')}`, '#e8b412', true);
                }
            }else if(cmd === 'country') {
                if (args[1]) {
                    args.shift();
                    let country = args.join(' ').replace(/(<([^>]+)>)/ig,"");
                    db.users.update(userData.security, 'country', country);
                    userData.country = country;
                    SendPlayerList();
                    io.emit('chat', null, `[#${index}] ${players[index].username} přejmenoval své území na "${country}"`, '#44cee8');
                }else{
                    players[index].socket.emit('chat', null, `SYNTAX: /country [Název státu]`, '#e8b412');
                }
            }else if(cmd === 'players') {
                SendPlayerList();
            }else if(cmd === 'help'){
                players[index].socket.emit('chat', null, `Seznam příkazu:<br>/color - Změna barvy<br>/pm /w - Šeptání hráči<br>/pay - Poslat peníze<br>/send - Poslat materiál<br>/country - Nastavit název státu`, '#e8b412', true);
            }else{
                players[index].socket.emit('chat', null, `Neznámý příkaz! Seznam příkazů najdeš pod příkazem /help`, '#e1423e');
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
}

/**
 * @return {number}
 */
function CountPlayerCells(security){
    let i = 0;
    world.forEach(cell => {
        if(cell.owner === security) {
            i++;
        }
    });
    return i;
}

function UpdatePlayerCells(security){
    world.forEach(cell => {
        if(cell.owner === security) {
            let owner = users.find(x => x.security === security);
            io.emit('cell', cell.x, cell.y, owner.username, owner.color, cell.build);
        }
    });
}

/**
 * @return {number}
 */
function GetDistance(x1, y1, x2, y2){
    return Math.round(Math.sqrt(Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2)));
}

/**
 * @return {null|Object}
 */
function NearestBuilding(x, y, build, owner, maxDistance){
    let nearest = null;
    maxDistance = maxDistance || 1000;

    world.filter(x => (Array.isArray(build) ? x.build in build : x.build === build)).forEach(cell => {
        if(!owner || cell.owner === owner){
            let dist = GetDistance(x, y, cell.x, cell.y);
            if(dist < maxDistance){
                nearest = cell;
                maxDistance = dist;
            }
        }
    });

    return nearest;
}

function GetAdjacent(x, y){
    let adjacent = [];
    let adj_left = world.find(d => d.x === x - 1 && d.y === y);
    let adj_right = world.find(d => d.x === x + 1 && d.y === y);
    let adj_top = world.find(d => d.x === x && d.y === y - 1);
    let adj_bottom = world.find(d => d.x === x && d.y === y + 1);

    adj_left && adjacent.push(adj_left);
    adj_right && adjacent.push(adj_right);
    adj_top && adjacent.push(adj_top);
    adj_bottom && adjacent.push(adj_bottom);
    return adjacent;
}

/**
 * @return {boolean}
 */
function CheckAdjacent(x, y, security){
    let adjacent = GetAdjacent(x, y);
    let r = false;
    adjacent.forEach(d => {
        if(d.owner === security){
            r = true;
        }
    });
    return r;
}

/**
 * @return {boolean}
 */
function CheckAdjacentOwnAll(x, y, security){
    let adjacent = GetAdjacent(x, y);
    let r = true;
    adjacent.forEach(d => {
        if(d.owner !== security){
            r = false;
        }
    });
    return r;
}

/**
 * @return {boolean}
 */
function CheckAdjacentBuilding(x, y, building){
    let adjacent = GetAdjacent(x, y);
    let r = false;
    adjacent.forEach(d => {
        if(Array.isArray(building)){
            if(building.includes(d.build)){
                r = true;
            }
        }else if(d.build === building){
            r = true;
        }
    });
    return r;
}

/**
 * @return {boolean}
 */
function CanBuildHQ(x, y){
    return !CheckAdjacentBuilding(x, y, [builds.HQ, builds.GOLD, builds.COAL, builds.OIL, builds.IRON, builds.BAUXITE, builds.LEAD, builds.SULFUR, builds.NITER, builds.STONE]);
}

/**
 * @return {boolean}
 */
function ProcessFight(x, y, userData, targetData){
    let nearHQ = NearestBuilding(x, y, [builds.HQ, builds.MILITARY], targetData.security, 5);
    if(nearHQ) {
        let userAmmo = userData.ammo || 0;
        let targetAmmo = targetData.ammo || 0;
        userData.ammo = Math.max(0, userAmmo - Math.min(targetAmmo, 50));
        targetData.ammo = Math.max(0, targetAmmo - Math.min(userAmmo, 50));
        db.users.update(userData.security, 'ammo', userData.ammo);
        db.users.update(targetData.security, 'ammo', targetData.ammo);
        return userAmmo > targetAmmo;
    }else{
        return true;
    }
}

function SendMap(socket){
    socket.emit('mapload', world.length);
    world.forEach(cell => {
        let owner = users.find(x => x.security === cell.owner);
        if(owner) {
            socket.emit('cell', cell.x, cell.y, owner.username, (owner.color || '#fff'), cell.build, cell.level);
        }else{
            socket.emit('cell', cell.x, cell.y, null, null, cell.build);
        }
    });
}

function SendPlayerList(){
    let playerList = [];
    users.forEach(userData => {
        let index = Object.keys(players).find(key => players[key].security === userData.security) || -1;
        playerList.push( { id: index, username: userData.username, color: userData.color, country: userData.country } );
    });
    io.emit('players', playerList);
}

function FetchUserData(socket, security){
    let info = {};
    let userData = users.find(x => x.security === security);
    if(userData) {
        if(userData.energy){
            info.energy = userData.energy;
        }else{
            db.users.update(userData.security, 'energy', 0);
            info.energy = 0;
        }

        Object.keys(resources).forEach((key) => {
            info[key.toLowerCase()] = userData[key.toLowerCase()] || 0;
        });

        info.money = userData.money || 0;
        info.cells = CountPlayerCells(userData.security);

        socket.emit('info', info);
    }else{
        console.log('[ERROR] Nepodařilo se načíst data hráče "' + security + '"!');
    }
}

function LoginCallback(socket, index, username, success, response){
    if (success) {
        let existingPlayer = players.find(x => x.security === response);
        if(existingPlayer && existingPlayer.logged){
            socket.emit('login', false, 'Tento účet je již ve hře!');
            return;
        }

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
        FetchUserData(socket, response);
    }

    socket.emit('login', success, response);
}

function GainResource(build, res, gain){
    world.filter(x => x.build === build).forEach(cell => {
        if(cell.owner){
            let userData = users.find(x => x.security === cell.owner);
            if(userData){
                let value = userData[res] || 0;
                value += gain;
                userData[res] = value;
                db.users.update(userData.security, res, value);

                if(userData.socket){
                    userData.socket.emit('info', {[res]: value});
                }
            }
        }
    });
}

function ProcessFactories(){
    world.filter(x => x.build === builds.FACTORY).forEach(cell => {
        if(cell.owner){
            let userData = users.find(x => x.security === cell.owner);
            if(userData){
                let newMaterials = {};

                let niter = userData.niter || 0;
                let sulfur = userData.sulfur || 0;
                let gunpowder = userData.gunpowder || 0;
                let lead = userData.lead || 0;
                let iron = userData.iron || 0;
                let ammo = userData.ammo || 0;

                if(niter >= 5 && sulfur >= 2){
                    newMaterials.niter = niter - 5;
                    newMaterials.sulfur = sulfur - 2;
                    newMaterials.gunpowder = gunpowder + 4;
                }
                if(gunpowder >= 3 && lead >= 1 && iron >= 3){
                    newMaterials.gunpowder = gunpowder - 3;
                    newMaterials.lead = lead - 1;
                    newMaterials.iron = iron - 3;
                    newMaterials.ammo = ammo + 3;
                }

                Object.keys(newMaterials).forEach((key) => {
                    userData[key] = newMaterials[key];
                    db.users.update(userData.security, key, newMaterials[key]);
                });

                if(userData.socket){
                    userData.socket.emit('info', newMaterials);
                }
            }
        }
    });
}

function Periodic5s() {
    users.forEach(userData => {
        if(!userData.energy) userData.energy = 0;
        let newEnergy = Math.min(userData.energy + 1, 10);

        if(newEnergy !== userData.energy) {
            userData.energy = newEnergy;
            db.users.update(userData.security, 'energy', newEnergy);

            if(userData.socket) {
                userData.socket.emit('info', {energy: newEnergy});
            }
        }
    });

    return Promise.delay(5000).then(() => Periodic5s());
}
Periodic5s();

function Periodic15s(){
    GainResource(builds.GOLD, 'gold', 5);
    GainResource(builds.COAL, 'coal', 5);
    GainResource(builds.OIL, 'oil', 5);
    GainResource(builds.IRON, 'iron', 5);
    GainResource(builds.BAUXITE, 'bauxite', 5);
    GainResource(builds.LEAD, 'lead', 5);
    GainResource(builds.SULFUR, 'sulfur', 5);
    GainResource(builds.NITER, 'niter', 5);
    GainResource(builds.STONE, 'stone', 5);
    ProcessFactories();

    return Promise.delay(15000).then(() => Periodic15s());
}
Periodic15s();

function Periodic60s(){
    users.forEach(userData => {
        if(!userData.ammo) userData.ammo = 0;
        userData.cells = CountPlayerCells(userData.security);
        let military = world.filter(x => x.owner === userData.security && x.build === builds.MILITARY).length;
        let spending = Math.round(userData.cells / 200) + military;
        let newAmmo = Math.max(0, userData.ammo - spending);

        if(newAmmo !== userData.ammo) {
            userData.ammo = newAmmo;
            db.users.update(userData.security, 'ammo', newAmmo);

            if(userData.socket) {
                userData.socket.emit('info', {ammo: newAmmo, ammoSpending: spending});
            }
        }
    });

    return Promise.delay(60000).then(() => Periodic60s());
}
Periodic60s();
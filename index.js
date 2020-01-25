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

const utils = require(__dirname + '/utils.js')(io);
require(__dirname + '/antispam.js')(io);
const security = (process.env.LOGIN === 'API' ? require(__dirname + '/security.js') : null);
const account = (process.env.LOGIN === 'API' ? require(__dirname + '/account.js')(security) : null);
const discord = (process.env.DISCORD_TOKEN.length > 0 ? require(__dirname + '/discord.js') : null);
const builds = require(__dirname + '/builds.js');
const resources = require(__dirname + '/resources.js');
const db = {
    users: require(__dirname + '/db/users.js')(mongoWork),
    world: require(__dirname + '/db/world.js')(mongoWork),
    market: require(__dirname + '/db/market.js')(mongoWork)
};
const market = require(__dirname + '/market.js')(db.market);
const master = require(__dirname + '/master.js');
const global = require(__dirname + '/global.js');
const chat = require(__dirname + '/chat.js')(io, db);
require(__dirname + '/commands.js')(io, db, discord);
require(__dirname + '/events.js')(db, master);

const serverName = process.env.SERVERNAME;
const version = utils.version;
const codebase = process.env.CODEBASE;

mongoWork(function(db, client) {
    db.createCollection('users');
    db.createCollection('world');
    db.createCollection('market');

    let mySort = { username: 1 };
    db.collection("users").find().sort(mySort).toArray(function(err, result) {
        if (err) throw err;
        global.users = result;
        client.close();
    });
});

// Propočteme všechny maxima surovin (neukládají se do databáze)
global.users.forEach(userData => {
    utils.updatePlayerMaxResources(userData);
});

console.log('Načítám svět..');

db.world.loadWorld((result) => {
    global.world = result;
});

market.init();

app.use(express.static(__dirname + '/client', { dotfiles: 'allow' } ));

app.get('/stats', (req, res) => {
    let allowedOrigins = ['https://leosight.cz', 'https://leosight.cz:3005', 'https://eco.leosight.cz', 'https://guard.leosight.cz', 'http://127.0.0.1:3005', 'http://localhost:3005'];
    let origin = req.headers.origin;
    if(allowedOrigins.indexOf(origin) > -1){
        res.header('Access-Control-Allow-Origin', origin);
    }
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

    res.json({ online: global.players.filter(x => x.logged).length, servername: serverName });
});

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

http.listen(3005, () => console.log('Server spuštěn na portu 3005'));

io.on('connection', function(socket){
    let remoteIp = socket.request.connection.remoteAddress;
    let remotePort = socket.request.connection.remotePort;
    let playerData = { username: 'Humorníček', logged: false, ip: remoteIp, socket: socket };
    let index = global.players.indexOf(0);
    if(index > -1){
        global.players[index] = playerData;
    }else{
        index = global.players.push( playerData ) - 1;
    }

    console.log('[CONNECT] Uživatel [' + index + '] se připojil z IP ' + remoteIp);
    socket.emit('serverinfo', serverName, version, codebase);
    SendMap(socket);

    socket.on('disconnect', function(){
        console.log('[DISCONNECT] Uživatel [' + index + '] se odpojil');

        if(global.players[index] && global.players[index].logged) {
            io.emit('chat', null, `[#${index}] ${global.players[index].username} se odpojil. 😴`, '#44cee8');
        }

        let userData = global.users.find(x => x.security === global.players[index].security);
        if(userData && userData.socket){
            userData.socket = null;
        }

        global.players[index] = 0;
        utils.sendPlayerList();
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

    socket.on('chat', (msg) => chat.process(msg, index));

    socket.on('capture', function(x, y){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if(userData && userData.color && userData.energy) {
                if(userData.energy > 0) {
                    userData.cells = utils.countPlayerCells(userData.security);
                    if((userData.cells === 0 && utils.canBuildHQ(x, y)) || utils.checkAdjacent(x, y, userData.security)) {
                        let energyCost = 1;
                        let resistance = false;
                        let cell = global.world.find(d => d.x === x && d.y === y);
                        if (cell) {
                            if(cell.build != null && userData.cells === 0) return; // Nelze vybudováním základny zbourat existující budovu
                            //if(cell.build === builds.HQ) return; // Nelze zabrat HQ
                            if (cell.owner) {
                                if(cell.owner === userData.security) return; // Nelze zabrat vlastní čtverec znovu

                                let oldOwner = global.users.find(x => x.security === cell.owner);
                                if (oldOwner) {
                                    if(userData.energy < 2) return; // Zabrání již obsazeného pole stojí 2 energie
                                    energyCost = 2;

                                    if(userData.cells === 0){
                                        if(oldOwner.ammo > 0) { // Nemůže zabrat jako první tah čtverec někoho kdo má munici
                                            userData.energy -= energyCost;
                                            socket.emit('info', { energy: userData.energy });
                                            socket.emit('chat', null, `Armáda z "${oldOwner.country || 'Bez názvu'}" se ubránila tvému pokusu o vybudování základny odboje.`, '#e1423e');
                                            return;
                                        }
                                        io.emit('chat', null, `[#${index}] ${userData.username} vybudoval základnu odboje na území "${oldOwner.country || 'Bez názvu'}" a bojuje o nezávislost.`, '#44cee8');
                                        if(discord) {
                                            discord.broadcast(`${userData.username} vybudoval základnu odboje na území "${oldOwner.country || 'Bez názvu'}" a bojuje o nezávislost.`);
                                        }
                                        resistance = true;
                                    }else{
                                        if(!ProcessFight(x, y, userData, oldOwner)) { // Útok může selhat (nedostatek munice)
                                            if(oldOwner.socket){
                                                oldOwner.socket.emit('info', { ammo: oldOwner.ammo });
                                            }
                                            let estimate = Math.pow(10, (oldOwner.ammo - userData.ammo).toString().length - 1);
                                            userData.energy -= energyCost;
                                            socket.emit('info', { energy: userData.energy, ammo: userData.ammo });
                                            socket.emit('chat', null, `Armáda z "${oldOwner.country || 'Bez názvu'}" odrazila tvůj útok! Odhadovaná palebná převaha nepřítele je v řádech ${estimate} munice.`, '#e1423e');
                                            return;
                                        }

                                        if(oldOwner.socket){ // Zatím duplicitní, ale je potřeba opravit bug s odčítáním na klientu
                                            oldOwner.socket.emit('info', { ammo: oldOwner.ammo });
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
                                        io.emit('chat', null, `[#${index}] ${userData.username} právě zničil vojenskou základnu "${oldOwner.country || 'Bez názvu'}"!`, '#44cee8');
                                        if(discord) {
                                            discord.broadcast(`${userData.username} právě zničil vojenskou základnu "${oldOwner.country || 'Bez názvu'}"!`);
                                        }
                                    }else if(cell.build === builds.HQ){
                                        if(userData.energy < 10) return; // Zabrání hlavní základny stojí 10 energie
                                        if(userData.ammo < 500) return; // Zabrání hlavní základny stojí 500 munice
                                        if(!utils.checkAdjacentOwnAll(x, y, userData.security)) return; // Musí vlastnit všechny okolní pole
                                        userData.ammo -= 500;
                                        energyCost = 10;
                                        cell.build = null;
                                        io.emit('chat', null, `[#${index}] ${userData.username} právě dobyl hlavní základnu "${oldOwner.country || 'Bez názvu'}"!`, '#44cee8');
                                        if(discord) {
                                            discord.broadcast(`${userData.username} právě dobyl hlavní základnu "${oldOwner.country || 'Bez názvu'}"!`);
                                        }
                                        oldOwner.ammo = oldOwner.ammo || 0;
                                        socket.emit('chat', null, `Ukořistil jsi ${oldOwner.ammo} munice.`, '#44cee8');
                                        userData.ammo += oldOwner.ammo;
                                        oldOwner.ammo = 0;
                                        if(oldOwner.socket){
                                            oldOwner.socket.emit('info', { ammo: oldOwner.ammo });
                                        }
                                    }else if(cell.build === builds.FACTORY){
                                        cell.working = false;
                                        db.world.update(x, y, 'working', false);
                                        io.emit('cell-data', x, y, 'working', false);
                                    }else if(cell.build === builds.WAREHOUSE){
                                        cell.owner = userData.security; // Musíme přepsat již nyní, aby se správně propočetla nová maxima skladu
                                        utils.updatePlayerMaxResources(oldOwner);
                                    }

                                    if(oldOwner.socket) {
                                        oldOwner.cells = utils.countPlayerCells(oldOwner.security);
                                        oldOwner.socket.emit('info', {cells: oldOwner.cells});
                                    }
                                }
                            }

                            cell.owner = userData.security;
                            if(userData.cells === 0) cell.build = builds.HQ;
                        } else {
                            cell = { x: x, y: y, owner: userData.security };
                            if(userData.cells === 0) cell.build = builds.HQ;
                            global.world.push(cell);
                        }

                        if(userData.cells === 0 && !resistance){
                            io.emit('chat', null, `[#${index}] ${userData.username} právě založil nový nezávislý národ.`, '#44cee8');
                            if(discord) {
                                discord.broadcast(`${userData.username} právě založil nový nezávislý národ.`);
                            }
                        }

                        db.world.cellUpdate(x, y, userData.security, cell.build, cell.level);
                        io.emit('cell', x, y, userData.username, userData.color, cell.build, cell.level);

                        userData.energy -= energyCost;
                        userData.cells += 1;

                        socket.emit('info', { energy: userData.energy, cells: userData.cells, ammo: userData.ammo });

                        if(cell.build === builds.WAREHOUSE){
                            utils.updatePlayerMaxResources(userData);
                        }
                    }
                }
            }
        }
    });

    socket.on('movehq', function(x, y){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 10) {
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build == null){
                        if(utils.canBuildHQ(x, y) && utils.checkAdjacentOwnAll(x, y, userData.security)) {
                            let oldHQ = global.world.find(d => d.build === builds.HQ && d.owner === userData.security);
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
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy) {
                if (userData.energy > 0) {
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build !== builds.HQ){
                        cell.owner = null;
                        db.world.cellUpdate(x, y, null, cell.build, cell.level);
                        io.emit('cell', x, y, null, null, cell.build, cell.level);

                        userData.energy -= 1;
                        userData.cells = utils.countPlayerCells(userData.security);

                        socket.emit('info', { energy: userData.energy, cells: userData.cells });

                        if(cell.build === builds.WAREHOUSE){
                            utils.updatePlayerMaxResources(userData);
                        }
                    }
                }
            }
        }
    });

    socket.on('build', function(x, y, building){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData) {
                let cell = global.world.find(d => d.x === x && d.y === y);
                if(cell && cell.owner === userData.security && cell.build == null) {
                    let cost = {};
                    if (building === builds.FORT) {
                        cost = {energy: 10, stone: 100}
                    } else if (building === builds.FACTORY) {
                        cost = {energy: 10, stone: 100, iron: 200, bauxite: 300}
                    } else if (building === builds.MILITARY) {
                        if (!utils.checkAdjacentOwnAll(x, y, userData.security)) return; // Musí vlastnit všechna přilehlá pole
                        cost = {energy: 10, gold: 1000, stone: 1000, iron: 1000, bauxite: 1000}
                    } else if (building === builds.FIELD) {
                        cost = {energy: 5, stone: 50}
                    } else if (building === builds.WAREHOUSE) {
                        cost = {energy: 10, iron: 800, aluminium: 500}
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

                        // CBs/kontroly po výstavbě
                        if(building === builds.WAREHOUSE){
                            utils.updatePlayerMaxResources(userData);
                        }else if(building === builds.FACTORY){
                            let type = 'aluminium';
                            cell.type = type;
                            db.world.update(x, y, 'type', type);
                            io.emit('cell-data', x, y, 'type', type);
                        }
                    }
                }
            }
        }
    });

    socket.on('upgrade', function(x, y){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy && userData.stone) {
                if (userData.energy >= 10 && userData.stone >= 500) {
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build){
                        let cost = {};
                        let maxLevel = 5;
                        if (cell.build === builds.FORT) {
                            cost = {energy: 10, stone: 500}
                        } else if (cell.build === builds.WAREHOUSE) {
                            cost = {energy: 10, iron: 800, aluminium: 500}
                        } else {
                            return;
                        }

                        let costMet = true;
                        Object.keys(cost).forEach((key) => {
                            if (!userData[key] || userData[key] < cost[key]) {
                                costMet = false;
                            }
                        });

                        let level = cell.level || 1;
                        if (costMet && level < maxLevel) {
                            level += 1;
                            cell.level = level;
                            db.world.cellUpdate(x, y, userData.security, cell.build, cell.level);
                            io.emit('cell', x, y, userData.username, userData.color, cell.build, cell.level);

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
        }
    });

    socket.on('destroy', function(x, y){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 1) {
                    userData.cells = utils.countPlayerCells(userData.security);
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && ([builds.FORT, builds.FACTORY, builds.MILITARY, builds.FIELD, builds.WAREHOUSE].includes(cell.build) || (cell.build === builds.HQ && userData.cells <= 1))){
                        let oldBuild = cell.build;
                        if(cell.build === builds.HQ){
                            cell.owner = null;
                            cell.build = null;

                            db.world.cellUpdate(x, y, null, null, null);
                            io.emit('cell', x, y, null, null, null, null);

                            userData.energy -= 1;
                            userData.cells -= 1;

                            socket.emit('info', {energy: userData.energy, cells: userData.cells});
                        }else{
                            cell.build = null;
                            db.world.cellUpdate(x, y, userData.security, null, null);
                            io.emit('cell', x, y, userData.username, userData.color, null, null);

                            userData.energy -= 1;

                            socket.emit('info', {energy: userData.energy});

                            if(oldBuild === builds.WAREHOUSE){
                                utils.updatePlayerMaxResources(userData);
                            }
                        }
                    }
                }
            }
        }
    });

    socket.on('switch', function(x, y){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 1) {
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build === builds.FACTORY){
                        let working = cell.working || false;
                        working = !working;
                        cell.working = working;
                        db.world.update(x, y, 'working', working);
                        io.emit('cell-data', x, y, 'working', working);
                        userData.energy -= 1;
                        socket.emit('info', {energy: userData.energy});
                    }
                }
            }
        }
    });

    socket.on('retype', function(x, y, type){
        if (global.players[index] && global.players[index].logged) {
            let userData = global.users.find(x => x.security === global.players[index].security);
            if (userData && userData.energy) {
                if (userData.energy >= 1) {
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell && cell.owner === userData.security && cell.build){
                        type = type.toLowerCase();
                        let valid = false;
                        if(cell.build === builds.FACTORY && ['aluminium','gunpowder','ammo'].includes(type)){
                            valid = true;
                        }else if(cell.build === builds.WAREHOUSE && Object.keys(resources).includes(type.toUpperCase())){
                            valid = true;
                        }

                        if(valid) {
                            cell.type = type;
                            db.world.update(x, y, 'type', type);
                            io.emit('cell-data', x, y, 'type', type);
                            userData.energy -= 1;
                            socket.emit('info', {energy: userData.energy});

                            if(cell.build === builds.WAREHOUSE){
                                utils.updatePlayerMaxResources(userData);
                            }
                        }
                    }
                }
            }
        }
    });
});

/**
 * @return {boolean}
 */
function ProcessFight(x, y, userData, targetData){
    let nearHQ = utils.nearestBuilding(x, y, [builds.HQ, builds.MILITARY], targetData.security, 5);
    if(nearHQ) {
        let userAmmo = userData.ammo || 0;
        let targetAmmo = targetData.ammo || 0;
        if(targetAmmo === 0) return true;
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
    socket.emit('mapload', global.world.length);
    global.world.forEach(cell => {
        let owner = global.users.find(x => x.security === cell.owner);
        if(owner) {
            socket.emit('cell', cell.x, cell.y, owner.username, (owner.color || '#fff'), cell.build, cell.level);

            if(cell.working){
                socket.emit('cell-data', cell.x, cell.y, 'working', cell.working);
            }
            if(cell.type){
                socket.emit('cell-data', cell.x, cell.y, 'type', cell.type);
            }
        }else{
            socket.emit('cell', cell.x, cell.y, null, null, cell.build);
        }
    });
}

function FetchUserData(socket, security){
    let info = {};
    let userData = global.users.find(x => x.security === security);
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
        info.cells = utils.countPlayerCells(userData.security);

        socket.emit('info', info);

        utils.updatePlayerMaxResources(userData);
    }else{
        console.log('[ERROR] Nepodařilo se načíst data hráče "' + security + '"!');
    }
}

function LoginCallback(socket, index, username, success, response){
    if (success) {
        let existingPlayer = global.players.find(x => x.security === response);
        if(existingPlayer && existingPlayer.logged){
            socket.emit('login', false, 'Tento účet je již ve hře!');
            return;
        }

        global.players[index]['username'] = username;
        global.players[index]['logged'] = true;
        global.players[index]['security'] = response;

        db.users.loginUpdate(username, response);

        let userData = global.users.find(x => x.security === response);
        if (userData) {
            socket.emit('chat', null, `Vítej, naposledy jsi se přihlásil ${utils.date(userData.lastlogin)}`, '#44cee8');
            userData.lastlogin = new Date().valueOf();
            userData.socket = socket;
        } else {
            socket.emit('chat', null, `Vítej v LeoSight Eco! Zdá se, že jsi tu poprvé, pokud potřebuješ s něčím pomoct, neváhej se obrátit na ostatní v místnosti #leosight-eco našeho Discord serveru (discord.gg/RJmtV3p).`, '#44cee8');
            global.users.push({username: username, security: response, lastlogin: new Date().valueOf(), socket: socket, color: '#fff'});
            db.users.setDefault(response);
        }

        io.emit('chat', null, `[#${index}] ${username} se přihlásil. 👋`, '#44cee8');

        utils.sendPlayerList();
        FetchUserData(socket, response);
    }

    socket.emit('login', success, response);
}
const Promise = require('bluebird');
const utils = require(__dirname + '/utils.js')();
const builds = require(__dirname + '/builds.js');
const resources = require(__dirname + '/resources.js');
const global = require(__dirname + '/global.js');
let io, db, master;

module.exports = function(_io, _db, _master) {
    io = _io;
    db = _db;
    master = _master;

    Periodic5s();
    Periodic15s();
    Periodic60s();
};

function GainResource(build, res, gain){
    global.world.filter(x => x.build === build).forEach(cell => {
        if(cell.owner){
            let userData = global.users.find(x => x.security === cell.owner);
            if(userData){
                let value = userData[res] || 0;
                value += gain;

                // Pokud jsou současné zásoby + zisk větší než maximum skladu, nepřičítáme surovinu
                // TODO: V budoucnu upravit na agresivnější styl (ubírání surovin přes limit) - zatím však dejme hráčům možnost se přizpůsobit novým změnám
                let max = userData[res+'Max'] || 0;
                if(value > max && value - gain < max) value = max; // Pokud jsme těsně pod limitem, zafixujeme se na něj
                if(value <= max) {

                    userData[res] = value;
                    db.users.update(userData.security, res, value);

                    if (userData.socket) {
                        userData.socket.emit('info', {[res]: value});
                    }

                }
            }
        }
    });
}

function ProcessFactories(){
    global.world.filter(x => x.build === builds.FACTORY).forEach(cell => {
        if(cell.owner && cell.working){
            let userData = global.users.find(x => x.security === cell.owner);
            if(userData){
                let newMaterials = {};
                let current = {};
                let max = {};

                Object.keys(resources).forEach(res => {
                    current[res.toLowerCase()] = userData[res.toLowerCase()] || 0;
                    max[res.toLowerCase()] = userData[res.toLowerCase()+'Max'] || 0;
                });

                if(current.wheat >= 1) {
                    newMaterials.wheat = current.wheat - 1;
                }else{
                    return;
                }

                if(current.coal >= 1) {
                    newMaterials.coal = current.coal - 1;
                }else if(cell.type !== 'coal'){
                    return;
                }

                switch(cell.type) {
                    case 'coal':
                        if(current.wood >= 5 && max.coal > current.coal){
                            newMaterials.wood = current.wood - 5;
                            newMaterials.coal = current.coal + 4;
                        }
                        break;
                    case 'gunpowder':
                        if(current.niter >= 5 && current.sulfur >= 2 && max.gunpowder > current.gunpowder){
                            newMaterials.niter = current.niter - 5;
                            newMaterials.sulfur = current.sulfur - 2;
                            newMaterials.gunpowder = current.gunpowder + 4;
                        }
                        break;
                    case 'ammo':
                        if (current.gunpowder >= 3 && current.lead >= 1 && current.iron >= 3 && max.ammo > current.ammo) {
                            newMaterials.gunpowder = current.gunpowder - 3;
                            newMaterials.lead = current.lead - 1;
                            newMaterials.iron = current.iron - 3;
                            newMaterials.ammo = current.ammo + 3;
                        }
                        break;
                    case 'aluminium':
                    default:
                        if (current.bauxite >= 5 && max.aluminium > current.aluminium){
                            newMaterials.bauxite = current.bauxite - 5;
                            newMaterials.aluminium = current.aluminium + 3;
                        }
                        break;
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

function GrowTrees(){
    global.world.filter(x => x.build === builds.FOREST).forEach(cell => {
        if (cell.level && cell.level < 5) {
            cell.level += 1;

            let userData = global.users.find(x => x.security === cell.owner);
            if(userData) {
                db.world.cellUpdate(cell.x, cell.y, userData.security, cell.build, cell.level);
                io.emit('cell', cell.x, cell.y, userData.username, userData.color, cell.build, cell.level);
            }else{
                db.world.cellUpdate(cell.x, cell.y, null, cell.build, cell.level);
                io.emit('cell', cell.x, cell.y, null, null, cell.build, cell.level);
            }
        }
    });
}

function MakeMoney(){
    global.world.filter(x => x.build === builds.MINT).forEach(cell => {
        if(cell.owner && cell.working) {
            let userData = global.users.find(x => x.security === cell.owner);
            if (userData) {
                let gold = userData.gold || 0;
                let money = userData.money || 0;
                if (gold >= 1) {
                    userData.gold = gold - 1;
                    userData.money = money + 1;

                    db.users.update(userData.security, 'gold', userData.gold);
                    db.users.update(userData.security, 'money', userData.money);

                    if(userData.socket) {
                        userData.socket.emit('info', {gold: userData.gold, money: userData.money});
                    }
                }
            }
        }
    });
}

function Periodic5s() {
    global.users.forEach(userData => {
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
    MakeMoney();

    return Promise.delay(15000).then(() => Periodic15s());
}

function Periodic60s(){
    GainResource(builds.FIELD, 'wheat', 1);
    GrowTrees();

    global.users.forEach(userData => {
        if(!userData.ammo) userData.ammo = 0;
        userData.cells = utils.countPlayerCells(userData.security);
        let military = global.world.filter(x => x.owner === userData.security && x.build === builds.MILITARY).length;
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

    // Odeslání aktuálních dat pro master server
    master.update(process.env.SERVERNAME, global.players.filter(x => x.logged).length, process.env.LOGIN !== 'API', utils.version, utils.codebase);

    return Promise.delay(60000).then(() => Periodic60s());
}
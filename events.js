const Promise = require('bluebird');
const utils = require(__dirname + '/utils.js')();
const builds = require(__dirname + '/builds.js');
const resources = require(__dirname + '/resources.js');
const global = require(__dirname + '/global.js');
let db, master;

module.exports = function(_db, _master) {
    db = _db;
    master = _master;

    Periodic5s();
    Periodic15s();
    Periodic60s();
};

//console.log(utils.getDistance(2,1,3,4));

function GainResource(build, res, gain){
    global.world.filter(x => x.build === build).forEach(cell => {
        if(cell.owner){
            let userData = global.users.find(x => x.security === cell.owner);
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
    global.world.filter(x => x.build === builds.FACTORY).forEach(cell => {
        if(cell.owner && cell.working){
            let userData = global.users.find(x => x.security === cell.owner);
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

    return Promise.delay(15000).then(() => Periodic15s());
}

function Periodic60s(){
    GainResource(builds.FIELD, 'wheat', 1);

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
    master.update(process.env.SERVERNAME, global.players.filter(x => x.socket).length, process.env.LOGIN !== 'API', utils.version, utils.codebase);

    return Promise.delay(60000).then(() => Periodic60s());
}
const fs = require('fs');
const global = require(__dirname + '/global.js');
const builds = require(__dirname + '/builds.js');
const resources = require(__dirname + '/resources.js');
let io;

module.exports = function(_io) {
    if(!io && _io) {
        io = _io;
    }

    return {
        sendPlayerList: SendPlayerList,
        countPlayerCells: CountPlayerCells,
        updatePlayerCells: UpdatePlayerCells,
        getDistance: GetDistance,
        date: GetDate,
        version: fs.readFileSync('.revision').toString().trim(),
        codebase: process.env.CODEBASE,
        nearestBuilding: NearestBuilding,
        getAdjacent: GetAdjacent,
        checkAdjacent: CheckAdjacent,
        checkAdjacentOwnAll: CheckAdjacentOwnAll,
        checkAdjacentBuilding: CheckAdjacentBuilding,
        canBuildHQ: CanBuildHQ,
        updatePlayerMaxResources: UpdatePlayerMaxResources,
    }
};

/**
 * @return {string}
 */
function GetDate(time){
    let date = time && new Date(time) || new Date();
    return date.getDate() + '.' + (date.getMonth() + 1) + '.' + date.getFullYear() + ' ' + ('0' + date.getHours()).slice(-2) + ':' + ('0' + date.getMinutes()).slice(-2);
}

function SendPlayerList(){
    let playerList = [];
    global.users.forEach(userData => {
        let index = Object.keys(global.players).find(key => global.players[key].security === userData.security) || -1;
        playerList.push( { id: index, username: userData.username, color: userData.color, country: userData.country } );
    });
    io.emit('players', playerList);
}

/**
 * @return {number}
 */
function CountPlayerCells(security){
    let i = 0;
    global.world.forEach(cell => {
        if(cell.owner === security) {
            i++;
        }
    });
    return i;
}

function UpdatePlayerMaxResources(userData){
    let newMax = {};

    Object.keys(resources).forEach((key) => {
        newMax[`${key.toLowerCase()}Max`] = userData[`${key.toLowerCase()}Max`] = 5000;
    });

    global.world.filter(x => x.owner === userData.security && x.build === builds.WAREHOUSE).forEach(cell => {
        newMax[`${cell.type}Max`] = userData[`${cell.type}Max`] += cell.level * 10000;
    });

    if(userData.socket){
        userData.socket.emit('info', newMax);
    }
}

function UpdatePlayerCells(security){
    global.world.forEach(cell => {
        if(cell.owner === security) {
            let owner = global.users.find(x => x.security === security);
            io.emit('cell', cell.x, cell.y, owner.username, owner.color, cell.build, cell.level);
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

    global.world.filter(x => (Array.isArray(build) ? build.includes(x.build) : x.build === build)).forEach(cell => {
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
    let adj_left = global.world.find(d => d.x === x - 1 && d.y === y);
    let adj_right = global.world.find(d => d.x === x + 1 && d.y === y);
    let adj_top = global.world.find(d => d.x === x && d.y === y - 1);
    let adj_bottom = global.world.find(d => d.x === x && d.y === y + 1);

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
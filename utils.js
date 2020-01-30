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
        hexColorDelta: HexColorDelta,
        checkColors: CheckColors,
        shortestTradePath: ShortestTradePath,
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

            if(cell.working) io.emit('cell-data', cell.x, cell.y, 'working', cell.working);
            if(cell.type) io.emit('cell-data', cell.x, cell.y, 'type', cell.type);
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
function NearestBuilding(x, y, build, owner, maxDistance, returnDistance){
    let nearest = null;
    maxDistance = maxDistance || 1000;
    returnDistance = returnDistance || false;

    global.world.filter(x => (Array.isArray(build) ? build.includes(x.build) : x.build === build)).forEach(cell => {
        if(!owner || cell.owner === owner){
            let dist = GetDistance(x, y, cell.x, cell.y);
            if(dist < maxDistance){
                nearest = cell;
                maxDistance = dist;
            }
        }
    });

    return (returnDistance ? (nearest ? maxDistance : null) : nearest);
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

/**
 * @return {number}
 */
function HexColorDelta(hex1, hex2) {
    hex1 = hex1.replace('#','');
    hex2 = hex2.replace('#','');
    if (hex1.length === 3) hex1 = `${hex1}${hex1}`;
    if (hex2.length === 3) hex2 = `${hex2}${hex2}`;
    const r1 = parseInt(hex1.substring(0, 2), 16);
    const g1 = parseInt(hex1.substring(2, 4), 16);
    const b1 = parseInt(hex1.substring(4, 6), 16);
    const r2 = parseInt(hex2.substring(0, 2), 16);
    const g2 = parseInt(hex2.substring(2, 4), 16);
    const b2 = parseInt(hex2.substring(4, 6), 16);
    let r = 255 - Math.abs(r1 - r2);
    let g = 255 - Math.abs(g1 - g2);
    let b = 255 - Math.abs(b1 - b2);
    r /= 255;
    g /= 255;
    b /= 255;
    return (r + g + b) / 3;
}

/**
 * @return {boolean}
 */
function CheckColors(hex){
    let result = true;
    global.users.forEach(x => {
        if(x.color) {
            if (HexColorDelta(hex, x.color) > 0.92) {
                result = false;
            }
        }
    });
    return result;
}

function ShortestTradePath(player1, player2){
    let distance = 1000;

    global.world.filter(x => [builds.MARKET, builds.EXPORT].includes(x.build)).forEach(cell => {
        if(cell.owner === player1){
            const dist = NearestBuilding(cell.x, cell.y, [builds.MARKET, builds.EXPORT], player2, (cell.build === builds.MARKET ? 5 : 1000), true);
            if(dist && dist < distance){
                distance = dist;
            }
        }
    });

    return distance < 1000 ? distance : null;
}
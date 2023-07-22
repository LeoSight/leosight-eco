const global = require(__dirname + '/global.js');
const builds = require(__dirname + '/builds.js');
const utils = require(__dirname + '/utils.js')();

module.exports = function(io, db, discord) {
    const readline = require('readline'),
        rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: false});

    rl.setPrompt('');
    rl.prompt();

    rl.on('line', function (line) {
        let cmd = line.trim().split(' ');
        switch (cmd[0]) {
            case 'say':
                if(cmd.length === 1) {
                    console.log(`SYNTAX: say [Text]`);
                    break;
                }
                cmd.shift();
                io.emit('chat', null, cmd.join(' '), '#44cee8');
                console.log('[CHAT] Console: ' + cmd.join(' '));
                break;
            case 'discord':
                if(cmd.length === 1) {
                    console.log(`SYNTAX: discord [Text]`);
                    break;
                }
                cmd.shift();
                discord.broadcast(cmd.join(' '));
                console.log('[DISCORD] Bot: ' + cmd.join(' '));
                break;
            case 'update':
                io.emit('announce-update');
                console.log('Odeslána informace o aktualizaci! Do 5s spusť server!');
                rl.close();
                break;
            case 'build':
                let buildString = cmd[1];
                let x = parseInt(cmd[2]);
                let y = parseInt(cmd[3]);

                if(buildString && buildString.toUpperCase() in builds && !isNaN(x) && !isNaN(y)){
                    let build = builds[buildString.toUpperCase()];
                    let owner, username, color = null;
                    let cell = global.world.find(d => d.x === x && d.y === y);
                    if(cell){
                        cell.build = build;
                        owner = cell.owner;
                        let ownerData = global.users.find(x => x.security === owner);
                        if(ownerData) {
                            username = ownerData.username;
                            color = ownerData.color;
                        }
                    }else{
                        global.world.push({ x: x, y: y, owner: null, build: build });
                    }

                    db.world.cellUpdate(x, y, owner, build, 1);
                    io.emit('cell', x, y, username, color, build, 1);
                    console.log(`Budova "${buildString.toUpperCase()}" postavena na X: ${x}, Y: ${y}`);
                }else{
                    console.log(`SYNTAX: build [Budova] [X] [Y]\nPlatné názvy budov jsou: ${Object.keys(builds).join(', ')}`);
                }
                break;
            case 'players':
                Object.keys(global.players).forEach((key) => {
                    console.log(`[#${key}] ${global.players[key].username}`);
                });
                break;
            case 'kick':
                if(cmd.length === 1 || isNaN(parseInt(cmd[1]))) {
                    console.log(`SYNTAX: kick [ID]`);
                    break;
                }
                const kickPlayer = global.players[cmd[1]];
                if(kickPlayer) {
                    kickPlayer.socket.emit('kick');
                    kickPlayer.socket.disconnect();
                    console.log('[KICK] Hráč [#'+cmd[1]+'] byl vyhozen!');
                }else{
                    console.log('[KICK] Hráč s tímto ID nebyl nalezen!');
                }
                break;
            case 'ban':
                if(cmd.length === 1) {
                    console.log(`SYNTAX: ban [Jméno]`);
                    break;
                }
                const banPlayer = global.users.find(x => x.username === cmd[1]);
                if(banPlayer){
                    banPlayer.ban = true;
                    db.users.update(banPlayer.security, 'ban', true);
                    if(banPlayer.socket){
                        banPlayer.socket.emit('kick', 'Byl jsi zabanován!');
                        banPlayer.socket.disconnect();
                    }
                    console.log('[BAN] Hráč "' + cmd[1] + '" byl zabanován!');
                }else{
                    console.log('[BAN] Hráč s tímto jménem nebyl nalezen!');
                }
                break;
            case 'unban':
                if(cmd.length === 1) {
                    console.log(`SYNTAX: unban [Jméno]`);
                    break;
                }
                const unbanPlayer = global.users.find(x => x.username === cmd[1]);
                if(unbanPlayer){
                    unbanPlayer.ban = undefined;
                    db.users.update(unbanPlayer.security, 'ban', undefined);
                    if(unbanPlayer.socket){
                        unbanPlayer.socket.emit('kick').close();
                    }
                    console.log('[UNBAN] Hráč "' + cmd[1] + '" byl odbanován!');
                }else{
                    console.log('[UNBAN] Hráč s tímto jménem nebyl nalezen!');
                }
                break;
            case 'mute':
                if(cmd.length === 1) {
                    console.log(`SYNTAX: mute [Jméno]`);
                    break;
                }
                const mutePlayer = global.users.find(x => x.username === cmd[1]);
                if(mutePlayer){
                    mutePlayer.mute = true;
                    console.log('[MUTE] Hráč "' + cmd[1] + '" byl ztlumen!');
                }else{
                    console.log('[MUTE] Hráč s tímto jménem nebyl nalezen!');
                }
                break;
            case 'wipe':
                db.mongoWork(function (db) {
                    db.collection("world").deleteMany();

                    const worldWidth = 50;
                    const worldHeight = 40;
                    const borderOffset = 4;

                    for(let i = 0; i < 250; i++){
                        db.collection("world").insertOne({
                            x: utils.random(-worldWidth + borderOffset, worldWidth - borderOffset),
                            y: utils.random(-worldHeight + borderOffset, worldHeight - borderOffset),
                            build: builds.FOREST
                        });
                    }

                    const mines = [builds.GOLD, builds.COAL, builds.OIL, builds.IRON, builds.BAUXITE, builds.LEAD, builds.SULFUR, builds.NITER, builds.STONE];
                    mines.forEach(buildId => {
                        for(let i = 0; i < 10; i++) {
                            let x = utils.random(-worldWidth + borderOffset, worldWidth - borderOffset);
                            let y = utils.random(-worldHeight + borderOffset, worldHeight - borderOffset);
                            while ( utils.nearestBuilding(x, y, mines, false, 7, true)
                                 || utils.nearestBuilding(x, y, buildId, false, 20, true) ) {
                                x = utils.random(-worldWidth + borderOffset, worldWidth - borderOffset);
                                y = utils.random(-worldHeight + borderOffset, worldHeight - borderOffset);
                            }

                            const cell = {x: x, y: y, build: buildId}
                            db.collection("world").insertOne(cell);
                            global.world.push(cell);
                        }
                    });

                    console.log('[WIPE] Svět byl úspěšně restartován!');
                    rl.close();
                });
                break;
            case 'help':
                console.log('Seznam příkazů:');
                console.log('say - Odeslat zprávu do chatu');
                console.log('discord - Odeslat zprávu na Discord');
                console.log('update - Aktualizovat server');
                console.log('build - Postavit budovu');
                console.log('players - Seznam aktuálně připojených hráčů');
                console.log('kick - Vykopnutí hráče ze serveru');
                console.log('ban - Zabanování hráče');
                console.log('unban - Zrušení banu');
                console.log('mute - Zablokování chatu');
                console.log('wipe - Restart světa (vymaže vše na mapě)');
                console.log('exit - Vypnout server');
                break;
            case 'exit':
                rl.close();
                break;
            default:
                console.log('');
                break;
        }
        rl.prompt();
    }).on('close', function () {
        io.emit('chat', null, 'Server se vypíná!', '#44cee8');
        if(discord) {
            discord.broadcast('Server se vypíná!');
        }
        console.log('Vypínám server..');
        setTimeout(() => {
            process.exit(0);
        }, 500);
    });
};

const global = require(__dirname + '/global.js');
const resources = require(__dirname + '/resources.js');

module.exports = function(io, db, discord, builds) {
    const readline = require('readline'),
        rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: false});

    rl.setPrompt('');
    rl.prompt();

    rl.on('line', function (line) {
        let cmd = line.trim().split(' ');
        switch (cmd[0]) {
            case 'say':
            	if(cmd.length == 1) {
                    console.log(`SYNTAX: say [Text]`); 
                    break;
                }
                cmd.shift();
                io.emit('chat', null, cmd.join(' '), '#44cee8');
                console.log('[CHAT] Console: ' + cmd.join(' '));
                break;
            case 'discord':
            	if(cmd.length == 1) {
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
                    let budovy = [];
                    Object.keys(builds).forEach((key) => {
                        budovy.push(`${key} (${builds[key]})`);
                    });
                    console.log(`SYNTAX: build [Budova] [X] [Y]\nPlatné názvy budov jsou: ${budovy.join(', ')}`);
                }
                break;
            case 'help':
                console.log('Seznam příkazů:')
                console.log('say - Zpráva do hry')
                console.log('discord - Zpráva na discord')
                console.log('update - Aktualizace hry')
                console.log('build - Postavení budovy')
                console.log('exit - Vypne server')
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

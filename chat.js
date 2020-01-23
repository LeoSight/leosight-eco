const global = require(__dirname + '/global.js');
const utils = require(__dirname + '/utils.js')();
const resources = require(__dirname + '/resources.js');

module.exports = function(io, db) {
    return {
        process: (msg, index) => {
            if (global.players[index] && global.players[index].logged && msg.length <= 255) {
                let userData = global.users.find(x => x.security === global.players[index].security);

                if (msg.startsWith('/')) {
                    let args = msg.split(' ');
                    let cmd = args[0].substr(1);

                    if (cmd === 'color') {
                        let hex = msg.replace('/color ', '');
                        if (/^#([0-9A-F]{3}){1,2}$/i.test(hex)) {
                            db.users.update(userData.security, 'color', hex);
                            userData.color = hex;
                            utils.sendPlayerList();
                            utils.updatePlayerCells(userData.security);
                        } else {
                            global.players[index].socket.emit('chat', null, `SYNTAX: /color [Barva v HEX kódu]`, '#e8b412');
                        }
                    } else if (cmd === 'w' || cmd === 'pm') {
                        if (!isNaN(args[1]) && args[2]) {
                            let targetIndex = parseInt(args[1]);
                            let target = global.players[targetIndex];
                            if (target && target.socket) {
                            	if (index !== targetIndex) {

	                                args.shift();
	                                args.shift(); // Už nepotřebujeme příkaz a ID, zajímá nás pouze zpráva
	                                let whisper = `[#${index}] ${global.players[index].username} > [#${targetIndex}] ${target.username}: ${args.join(' ')}`;
	                                global.players[index].socket.emit('chat', null, whisper, '#c78bf1');
	                                target.socket.emit('chat', null, whisper, '#c78bf1');
	                                console.log(`[WHISPER] ${whisper}`);
	                            
		                        } else {
	                                global.players[index].socket.emit('chat', null, `Nemůžeš odeslat sám sobě zprávu!`, '#e1423e');
	                            }
                            } else {
                                global.players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                            }
                        } else {
                            global.players[index].socket.emit('chat', null, `SYNTAX: /${cmd} [ID] [Zpráva]`, '#e8b412');
                        }
                    } else if (cmd === 'pay') {
                        if (!isNaN(args[1]) && !isNaN(args[2])) {
                            let targetIndex = parseInt(args[1]);
                            let amount = parseInt(args[2]);
                            let target = global.players[targetIndex];
                            if (target) {
                                let targetData = global.users.find(x => x.security === target.security);
                                if (target && target.socket && targetData) {
                                    if (amount > 0) {
                                    	if (index !== targetIndex) {
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

	                                            global.players[index].socket.emit('chat', null, `Poslal jsi 💰${amount} hráči [#${targetIndex}] ${target.username}.`, '#44cee8');
	                                            target.socket.emit('chat', null, `[#${index}] ${global.players[index].username} ti poslal 💰${amount}.`, '#44cee8');
	                                            console.log(`[PAY] [#${index}] ${global.players[index].username} > [#${targetIndex}] ${target.username}: ${amount}`);

	                                        } else {
	                                            global.players[index].socket.emit('chat', null, `Nemáš dostatek peněz!`, '#e1423e');
	                                        }
	                                    } else {
	                                		global.players[index].socket.emit('chat', null, `Nemůžeš poslat sám sobě peníze!`, '#e1423e');
	                            		}
                                    } else {
                                        global.players[index].socket.emit('chat', null, `Částka musí být kladné číslo!`, '#e1423e');
                                    }
                                } else {
                                    global.players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                                }
                            } else {
                                global.players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                            }
                        } else {
                            global.players[index].socket.emit('chat', null, `SYNTAX: /pay [ID] [Částka]`, '#e8b412');
                        }
                    } else if (cmd === 'send') {
                        if (!isNaN(args[1]) && args[2] && args[2].toUpperCase() in resources && !isNaN(args[3])) {
                            let targetIndex = parseInt(args[1]);
                            let amount = parseInt(args[3]);
                            let material = args[2].toLowerCase();
                            let target = global.players[targetIndex];
                            if (target) {
                                let targetData = global.users.find(x => x.security === target.security);
                                if (target && target.socket && targetData) {
                                    if (amount > 0) {
                                    	if (index !== targetIndex) {
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

	                                            global.players[index].socket.emit('chat', null, `Poslal jsi ${amount}x ${resources[material.toUpperCase()]} hráči [#${targetIndex}] ${target.username}.`, '#44cee8');
	                                            target.socket.emit('chat', null, `[#${index}] ${global.players[index].username} ti poslal ${amount}x ${resources[material.toUpperCase()]}.`, '#44cee8');
	                                            console.log(`[SEND] [#${index}] ${global.players[index].username} > [#${targetIndex}] ${target.username}: ${amount}x ${material}`);

	                                        } else {
	                                            global.players[index].socket.emit('chat', null, `Nemáš dostatek tohoto materiálu!`, '#e1423e');
	                                        }
	                                    } else {
	                                		global.players[index].socket.emit('chat', null, `Nemůžeš poslat sám sobě suroviny!`, '#e1423e');
	                            		}
                                    } else {
                                        global.players[index].socket.emit('chat', null, `Počet musí být kladné číslo!`, '#e1423e');
                                    }
                                } else {
                                    global.players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                                }
                            } else {
                                global.players[index].socket.emit('chat', null, `Hráč s tímto ID nebyl nalezen!`, '#e1423e');
                            }
                        } else {
                            let materials = [];
                            Object.keys(resources).forEach((key) => {
                                materials.push(`${key} (${resources[key]})`);
                            });
                            global.players[index].socket.emit('chat', null, `SYNTAX: /send [ID] [Materiál] [Počet]<br>Platné názvy materiálů jsou: ${materials.join(', ')}`, '#e8b412', true);
                        }
                    } else if (cmd === 'country') {
                        if (args[1]) {
                            args.shift();
                            let country = args.join(' ').replace(/(<([^>]+)>)/ig, "");
                            db.users.update(userData.security, 'country', country);
                            userData.country = country;
                            utils.sendPlayerList();
                            io.emit('chat', null, `[#${index}] ${global.players[index].username} přejmenoval své území na "${country}"`, '#44cee8');
                        } else {
                            global.players[index].socket.emit('chat', null, `SYNTAX: /country [Název státu]`, '#e8b412');
                        }
                    } else if (cmd === 'players') {
                        utils.sendPlayerList();
                    } else if (cmd === 'help') {
                        global.players[index].socket.emit('chat', null, `Seznam příkazu:<br>/color - Změna barvy<br>/pm /w - Šeptání hráči<br>/pay - Poslat peníze<br>/send - Poslat materiál<br>/country - Nastavit název státu`, '#e8b412', true);
                    } else {
                        global.players[index].socket.emit('chat', null, `Neznámý příkaz! Seznam příkazů najdeš pod příkazem /help`, '#e1423e');
                    }
                } else {
                    let color = '#fff';
                    if (userData && userData.color) {
                        color = userData.color;
                    }

                    io.emit('chat', `[#${index}] ${global.players[index].username}`, msg, color);
                    console.log(`[CHAT] [#${index}] ${global.players[index].username}: ${msg}`);
                }
            }
        }
    };
};
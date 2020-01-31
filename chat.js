const global = require(__dirname + '/global.js');
const utils = require(__dirname + '/utils.js')();
const resources = require(__dirname + '/resources.js');

module.exports = function(io, db, market) {
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
                            if(utils.checkColors(hex)) {
                                db.users.update(userData.security, 'color', hex);
                                userData.color = hex;
                                utils.sendPlayerList();
                                utils.updatePlayerCells(userData.security);
                            }else{
                                global.players[index].socket.emit('chat', null, `Někdo již používá velice podobnou barvu, zvol si prosím jinou.`, '#e1423e');
                            }
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
                                    global.players[index].socket.emit('chat', null, `Nemůžeš odeslat zprávu sám sobě!`, '#e1423e');
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
                                		    global.players[index].socket.emit('chat', null, `Nemůžeš poslat peníze sám sobě!`, '#e1423e');
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
                                                let distance = utils.shortestTradePath(userData.security, target.security);
                                                if(distance) {
                                                    let transportFuel = Math.ceil(amount / 1000 * distance);
                                                    let currentFuel = userData.fuel || 0;
                                                    if(distance <= 5 || currentFuel >= transportFuel) {
                                                        if ((targetData[material] || 0) + amount <= targetData[material + 'Max']) {
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

                                                            global.players[index].socket.emit('chat', null, `Poslal jsi ${amount}x [RES:${material.toUpperCase()}] hráči [#${targetIndex}] ${target.username}.`, '#44cee8', true);
                                                            target.socket.emit('chat', null, `[#${index}] ${global.players[index].username} ti poslal ${amount}x [RES:${material.toUpperCase()}].`, '#44cee8', true);
                                                            console.log(`[SEND] [#${index}] ${global.players[index].username} > [#${targetIndex}] ${target.username}: ${amount}x ${material}`);

                                                            if(distance > 5){
                                                                userData.fuel = currentFuel - transportFuel;
                                                                db.users.update(userData.security, 'fuel', userData.fuel);
                                                                userData.socket.emit('info', {fuel: userData.fuel});

                                                                global.players[index].socket.emit('chat', null, `Přeprava surovin na vzdálenost ${distance} polí tě stála ${transportFuel}x [RES:FUEL]`, '#44cee8', true);
                                                            }
                                                        } else {
                                                            global.players[index].socket.emit('chat', null, `Hráč [#${targetIndex}] ${target.username} nemůže uskladnit tolik materiálu!`, '#e1423e');
                                                        }
                                                    }else{
                                                        global.players[index].socket.emit('chat', null, `Nemáš dostatek paliva! Tento obchod tě budě stát ${transportFuel}x [RES:FUEL]`, '#e1423e', true);
                                                    }
                                                }else{
                                                    global.players[index].socket.emit('chat', null, `Nemáš s hráčem žádnou možnou obchodní cestu! Vybudujte si blízko sebe tržiště, nebo použijte exportní sklady.`, '#e1423e');
                                                }
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
                    } else if (cmd === 'destroy') {
                        if (args[1] && args[1].toUpperCase() in resources && !isNaN(args[2])) {
                            let amount = parseInt(args[2]);
                            let material = args[1].toLowerCase();
                            if (amount > 0) {
                                if (userData[material] && userData[material] >= amount) {
                                    let playerValue = userData[material] || 0;
                                    playerValue -= amount;
                                    userData[material] = playerValue;
                                    db.users.update(userData.security, material, playerValue);
                                    userData.socket.emit('info', {[material]: playerValue});

                                    global.players[index].socket.emit('chat', null, `Zničil jsi ${amount}x [RES:${material.toUpperCase()}]`, '#44cee8', true);
                                    console.log(`[DESTROY] [#${index}] ${global.players[index].username}: ${amount}x ${material}`);
                                } else {
                                    global.players[index].socket.emit('chat', null, `Nemáš dostatek tohoto materiálu!`, '#e1423e');
                                }
                            } else {
                                global.players[index].socket.emit('chat', null, `Počet musí být kladné číslo!`, '#e1423e');
                            }
                        } else {
                            let materials = [];
                            Object.keys(resources).forEach((key) => {
                                materials.push(`${key} (${resources[key]})`);
                            });
                            global.players[index].socket.emit('chat', null, `SYNTAX: /destroy [Materiál] [Počet]<br>Platné názvy materiálů jsou: ${materials.join(', ')}`, '#e8b412', true);
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
                    } else if (cmd === 'offer') { // /offer [Nabízím] [Poptávám] [1:X] [Maximum]
                        if (args[1] && (args[1].toUpperCase() in resources || args[1].toUpperCase() === "MONEY") && args[2] && (args[2].toUpperCase() in resources || args[2].toUpperCase() === "MONEY") && !isNaN(args[3]) && !isNaN(args[4])) {
                            if(args[1].toUpperCase() !== args[2].toUpperCase()) {
                                if (market.updateOffer(userData.security, args[1], args[2], parseFloat(args[3]), parseInt(args[4]), 0)) {
                                    global.players[index].socket.emit('chat', null, `Nabídka úspěšně přidána na veřejný trh.`, '#44cee8');
                                } else {
                                    global.players[index].socket.emit('chat', null, `Nabídku se nepodařilo přidat na veřejný trh!`, '#e1423e');
                                }
                            }else{
                                global.players[index].socket.emit('chat', null, `Nemůžeš nabízet i poptávat stejnou surovinu!`, '#e1423e');
                            }
                        } else {
                            let materials = [];
                            Object.keys(resources).forEach((key) => {
                                materials.push(`${key} (${resources[key]})`);
                            });
                            global.players[index].socket.emit('chat', null, `SYNTAX: /offer [Nabízím] [Poptávám] [Poměr] [Maximum]<br>Do polí nabídky a poptávky vypiš názvy materiálů, do poměru napiš číslo reprezentující násobek poptávaného materiálu vůči 1 kusu nabízeného materiálu, do maxima pak celkové maximum, které chceš pro obchod vymezit.<br>Platné názvy materiálů jsou: ${materials.join(', ')}`, '#e8b412', true);
                        }
                    } else if (cmd === 'offers') {
                        let list = "Platné obchodní nabídky:";
                        market.getData().forEach(d => {
                            if(!d.username) {
                                const sellerData = global.users.find(e => e.security === d.user);
                                if (sellerData) {
                                    d.username = sellerData.username;
                                }
                            }

                            list += `<br>[RES:${d.sell.toUpperCase()}] 1 : <strong>${d.ratio}</strong> [RES:${d.buy.toUpperCase()}] | ${d.username} (/buy ${d.username} [Počet] ${d.sell} ${d.buy})`;
                        });
                        global.players[index].socket.emit('chat', null, list, '#d8e871', true);
                    } else if (cmd === 'deloffer') { // /deloffer [Nabídka] [Poptávka]
                        if (args[1] && (args[1].toUpperCase() in resources || args[1].toUpperCase() === "MONEY") && args[2] && (args[2].toUpperCase() in resources || args[2].toUpperCase() === "MONEY")) {
                            if (market.deleteOffer(userData.security, args[1], args[2])) {
                                global.players[index].socket.emit('chat', null, `Nabídka úspěšně stažena z veřejného trhu.`, '#44cee8');
                            } else {
                                global.players[index].socket.emit('chat', null, `Taková nabídka nebyla na veřejném trhu nalezena!`, '#e1423e');
                            }
                        } else {
                            let materials = [];
                            Object.keys(resources).forEach((key) => {
                                materials.push(`${key} (${resources[key]})`);
                            });
                            global.players[index].socket.emit('chat', null, `SYNTAX: /deloffer [Nabídka] [Poptávka]<br>Platné názvy materiálů jsou: ${materials.join(', ')}`, '#e8b412', true);
                        }
                    } else if (cmd === 'buy') { // /buy [Hráč] [Poptávaný počet] [Poptávka] [Nabídka]
                        if (args[1] && args[2] && !isNaN(args[2]) && args[3] && (args[3].toUpperCase() in resources || args[3].toUpperCase() === "MONEY") && args[4] && (args[4].toUpperCase() in resources || args[4].toUpperCase() === "MONEY")) {
                            if(args[1] !== userData.username) {
                                market.acceptOffer(userData, args[1], args[3].toLowerCase(), args[4].toLowerCase(), parseInt(args[2]));
                            }else{
                                global.players[index].socket.emit('chat', null, `Nemůžeš uzavřít obchod sám se sebou!`, '#e1423e');
                            }
                        } else {
                            let materials = [];
                            Object.keys(resources).forEach((key) => {
                                materials.push(`${key} (${resources[key]})`);
                            });
                            global.players[index].socket.emit('chat', null, `SYNTAX: /buy [Hráč] [Poptávaný počet] [Poptávka] [Nabídka]<br>Platné názvy materiálů jsou: ${materials.join(', ')}`, '#e8b412', true);
                        }
                    } else if (cmd === 'help') {
                        global.players[index].socket.emit('chat', null, `Seznam příkazu:<br>/color - Změna barvy<br>/pm /w - Šeptání hráči<br>/pay - Poslat peníze<br>/send - Poslat materiál<br>/offer - Přidat obchodní nabídku<br>/offers - Seznam obchodních nabídek<br>/deloffer - Odstranit obchodní nabídku<br>/buy - Přijmout obchodní nabídku<br>/destroy - Zničit materiál<br>/country - Nastavit název státu`, '#e8b412', true);
                    } else {
                        global.players[index].socket.emit('chat', null, `Neznámý příkaz! Seznam příkazů najdeš pod příkazem /help`, '#e1423e');
                    }
                } else {
                    if(userData.mute){
                        global.players[index].socket.emit('chat', null, `Jsi ztlumen!`, '#e1423e');
                        return;
                    }

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
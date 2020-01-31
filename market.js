const global = require(__dirname + '/global.js');
const utils = require(__dirname + '/utils.js')();

let db;
let data = []; // Všechny nabídky

module.exports = function(_db) {
    return {
        getData: () => {
            return data;
        },
        init: () => {
            db = _db;
            console.log('Načítám trh..');
            db.market.loadMarket((result) => {
                data = result;
                data.forEach(d => {
                    const sellerData = global.users.find(e => e.security === d.user);
                    if(sellerData){
                        d.username = sellerData.username;
                    }
                });
            });
        },
        updateOffer: UpdateOffer,
        deleteOffer: DeleteOffer,
        acceptOffer: (userData, seller, buy, sell, amount) => {
            const targetData = global.users.find(d => d.username === seller);
            if(targetData) {
                const offer = data.find(d => d.user === targetData.security && d.sell === buy && d.buy === sell);
                if (offer) {
                    if (offer.sold + amount <= offer.max) {
                        let sendAmount = Math.ceil(amount * offer.ratio);
                        let distance = utils.shortestTradePath(userData.security, targetData.security);
                        if (distance) {
                            let transportFuel = Math.ceil(amount / 1000 * distance);
                            let currentFuel = userData.fuel || 0;
                            let targetFuel = targetData.fuel || 0;
                            if (currentFuel >= transportFuel) {
                                if(targetFuel >= transportFuel) {
                                    let playerValue = userData[sell] || 0;
                                    let targetValue = targetData[buy] || 0;
                                    let playerGainMaterial = userData[buy] || 0;
                                    let targetGainMaterial = targetData[sell] || 0;
                                    if (playerValue >= sendAmount) {
                                        if (targetValue >= amount) {
                                            let playerMax = userData[buy+'Max'] || 5000;
                                            let targetMax = targetData[sell+'Max'] || 5000;
                                            if(playerGainMaterial + amount <= playerMax || buy === 'money'){
                                                if(targetGainMaterial + sendAmount <= targetMax || sell === 'money'){
                                                    userData.fuel = currentFuel - transportFuel;
                                                    db.users.update(userData.security, 'fuel', userData.fuel);

                                                    targetData.fuel = targetFuel - transportFuel;
                                                    db.users.update(targetData.security, 'fuel', targetData.fuel);

                                                    playerValue -= sendAmount;
                                                    playerGainMaterial += amount;
                                                    userData[sell] = playerValue;
                                                    userData[buy] = playerGainMaterial;
                                                    db.users.update(userData.security, sell, playerValue);
                                                    db.users.update(userData.security, buy, playerValue);

                                                    targetValue -= amount;
                                                    targetGainMaterial += sendAmount;
                                                    targetData[buy] = targetValue;
                                                    targetData[sell] = targetGainMaterial;
                                                    db.users.update(targetData.security, buy, targetValue);
                                                    db.users.update(targetData.security, sell, targetValue);

                                                    if(offer.sold + amount >= offer.max){
                                                        DeleteOffer(offer.user, offer.sell, offer.buy);
                                                    }else {
                                                        UpdateOffer(offer.user, offer.sell, offer.buy, offer.ratio, offer.max, offer.sold + amount);
                                                    }

                                                    userData.socket.emit('info', {[buy]: playerGainMaterial, [sell]: playerValue, fuel: userData.fuel});
                                                    userData.socket.emit('chat', null, `Obchod s hráčem ${seller} úspěšně uzavřen!<br>Obdržel jsi ${amount}x [RES:${buy.toUpperCase()}]<br>Odeslal jsi ${sendAmount}x [RES:${sell.toUpperCase()}]<br>Přeprava tě stála ${transportFuel}x [RES:FUEL]`, '#44cee8', true);

                                                    if (targetData.socket) {
                                                        targetData.socket.emit('info', {[buy]: targetValue, [sell]: targetGainMaterial, fuel: userData.fuel});
                                                        targetData.socket.emit('chat', null, `Hráč ${userData.username} s tebou právě uzavřel obchod!<br>Obdržel jsi ${sendAmount}x [RES:${sell.toUpperCase()}]<br>Odeslal jsi ${amount}x [RES:${buy.toUpperCase()}]<br>Přeprava tě stála ${transportFuel}x [RES:FUEL]`, '#44cee8', true);
                                                    }
                                                }else{
                                                    userData.socket.emit('chat', null, `Druhá strana bohužel nemá dostatek místa k uskladnění tohoto množství materiálu. O této skutečnosti byl hráč upozorněn.`, '#e1423e');

                                                    if(targetData.socket){
                                                        targetData.socket.emit('chat', null, `Hráč ${userData.username} chtěl s tebou uzavřít obchod, nemáš však místo k uskladnění materiálu! Bylo by potřeba uskladnit ${sendAmount}x [RES:${sell.toUpperCase()}]`, '#e1423e', true);
                                                    }
                                                }
                                            }else{
                                                userData.socket.emit('chat', null, `Nemáš dostatek místa pro uskladnění tohoto množství materiálu!`, '#e1423e');
                                            }
                                        }else{
                                            userData.socket.emit('chat', null, `Druhá strana bohužel nemá dostatek materiálu k uzavření tohoto obchodu. O této skutečnosti byl hráč upozorněn.`, '#e1423e');

                                            if(targetData.socket){
                                                targetData.socket.emit('chat', null, `Hráč ${userData.username} chtěl s tebou uzavřít obchod, nemáš však dostatek materiálu! Tento obchod by tě stál ${amount}x [RES:${buy.toUpperCase()}]`, '#e1423e', true);
                                            }
                                        }
                                    }else{
                                        userData.socket.emit('chat', null, `Nemáš dostatek materiálu k uzavření tohoto obchodu!`, '#e1423e');
                                    }
                                }else{
                                    userData.socket.emit('chat', null, `Druhá strana bohužel nemá dostatek paliva na uzavření obchodu. O této skutečnosti byl hráč upozorněn.`, '#e1423e', true);

                                    if(targetData.socket){
                                        targetData.socket.emit('chat', null, `Hráč ${userData.username} chtěl s tebou uzavřít obchod, nemáš však dostatek paliva! Tento obchod by tě stál ${transportFuel}x [RES:FUEL]`, '#e1423e', true);
                                    }
                                }
                            } else {
                                userData.socket.emit('chat', null, `Nemáš dostatek paliva! Tento obchod tě budě stát ${transportFuel}x [RES:FUEL]`, '#e1423e', true);
                            }
                        } else {
                            userData.socket.emit('chat', null, `Nemáš s hráčem žádnou možnou obchodní cestu! Vybudujte si blízko sebe tržiště, nebo použijte exportní sklady.`, '#e1423e');
                        }
                    } else {
                        userData.socket.emit('chat', null, `Tato nabídka nyní povoluje maximální transakci o velikosti <strong>${offer.max - offer.sold}</strong>!`, '#e1423e', true);
                    }
                } else {
                    userData.socket.emit('chat', null, `Nabídku se nepodařilo nalézt!`, '#e1423e');
                }
            }else{
                userData.socket.emit('chat', null, `Hráč s tímto jménem nebyl nalezen!`, '#e1423e');
            }
        }
    }
};

/**
 * @return {boolean}
 */
function UpdateOffer(user, sell, buy, ratio, max, sold) {
    const userData = global.users.find(e => e.security === user);
    if(userData) {
        const offer = data.find(d => d.user === user && d.sell === sell && d.buy === buy);
        if (offer) {
            offer.ratio = ratio;
            offer.max = max;
            offer.sold = sold;
        } else {
            data.push({
                user: user,
                sell: sell,
                buy: buy,
                ratio: ratio,
                max: max,
                sold: sold,
                username: userData.username
            });
        }

        db.market.updateOffer(user, sell, buy, ratio, max, sold);
        return true;
    }else {
        return false;
    }
}

/**
 * @return {boolean}
 */
function DeleteOffer(user, sell, buy){
    const offer = data.find(d => d.user === user && d.sell === sell && d.buy === buy);
    if(offer) {
        data = data.filter(d => d.user !== user || d.sell !== sell || d.buy !== buy);
        db.market.deleteOffer(user, sell, buy);
        return true;
    }else{
        return false;
    }
}
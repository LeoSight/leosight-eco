module.exports = function(mongoWork) {
    return {
        loadMarket: (cb) => {
            mongoWork(function(db, client) {
                db.collection("market").find().toArray(function(err, result) {
                    if (err) throw err;
                    cb(result);
                    //client.close();
                });
            });
        },
        updateOffer: (user, sell, buy, ratio, max, sold) => {
            mongoWork(function (db, client) {
                db.collection("market").updateOne({
                    user: user,
                    sell: sell,
                    buy: buy
                }, { $set: {
                    ratio: ratio,
                    max: max,
                    sold: sold
                } }, {upsert: true}, function (err) {
                    if (err) throw err;
                    //client.close();
                });
            });
        },
        deleteOffer: (user, sell, buy) => {
            mongoWork(function (db, client) {
                db.collection("market").deleteOne({
                    user: user,
                    sell: sell,
                    buy: buy
                }, function (err) {
                    if (err) throw err;
                    //client.close();
                });
            });
        },
    }
};

module.exports = function(mongoWork) {
    return {
        loadMarket: (cb) => {
            mongoWork(function(db, client) {
                db.collection("market").find().toArray(function(err, result) {
                    if (err) throw err;
                    cb(result);
                    client.close();
                });
            });
        },
        update: (id, key, value) => {
            mongoWork(function (db, client) {
                db.collection("market").updateOne( { 'id': id }, { $set: {
                        [key]: value
                    } }, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        },
    }
};

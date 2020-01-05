module.exports = function(mongoWork) {
    return {
        loadWorld: (cb) => {
            mongoWork(function(db, client) {
                db.collection("world").find().toArray(function(err, result) {
                    if (err) throw err;
                    cb(result);
                    client.close();
                });
            });
        },
        cellUpdate: (x, y, owner, hq) => {
            mongoWork(function (db, client) {
                db.collection("world").updateOne( {'x': x, 'y': y }, { $set: {
                        owner: owner,
                        lastchange: new Date().valueOf(),
                        hq: hq
                    } }, {upsert: true}, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        }
    }
};
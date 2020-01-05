module.exports = function(mongoWork) {
    return {
        loginUpdate: (username, security) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                    username: username,
                    lastlogin: new Date().valueOf()
                } }, {upsert: true}, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        },
        setDefault: (security) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                        color: '#fff',
                        energy: 0
                    } }, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        },
        updateColor: (security, color) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                    color: color
                } }, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        },
        updateEnergy: (security, energy) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                        energy: energy
                    } }, function (err) {
                    if (err) throw err;
                    client.close();
                });
            });
        }
    }
};
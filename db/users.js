module.exports = function(mongoWork) {
    return {
        loginUpdate: (username, security) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                    username: username,
                    lastlogin: new Date().valueOf()
                } }, {upsert: true}, function (err) {
                    if (err) throw err;
                    //client.close();
                });
            });
        },
        setDefault: (security) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                    color: '#fff',
                    energy: 0,
                    money: 0
                } }, function (err) {
                    if (err) throw err;
                    //client.close();
                });
            });
        },
        update: (security, key, value) => {
            mongoWork(function (db, client) {
                db.collection("users").updateOne( {'security': security}, { $set: {
                        [key]: value
                    } }, function (err) {
                    if (err) throw err;
                    //client.close();
                });
            });
        },
    }
};
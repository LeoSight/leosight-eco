const log = console.log;
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {pingInterval: 5000});
const MongoClient = require('mongodb').MongoClient;
const database = "mongodb://localhost:27017/";

log('Načítám moduly..');

require(__dirname + '/antispam.js')(io);
require(__dirname + '/commands.js')(io);

let players = [];

/*
MongoClient.connect(database, {useUnifiedTopology: true}, function(err, db) {
    if (err) throw err;
    let dbo = db.db("leosight-eco");

    let mySort = { name: 1 };
    dbo.collection("users").find().sort(mySort).toArray(function(err, result) {
        if (err) throw err;
        console.log(result);
        db.close();
    });
});
*/

app.use(express.static(__dirname + '/client'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/client/index.html');
});

http.listen(3005, () => console.log('Server spuštěn na portu 3005'));

io.on('connection', function(socket){
    let remoteIp = socket.request.connection.remoteAddress;
    let remotePort = socket.request.connection.remotePort;
    let index = players.push( { "ip": remoteIp } ) - 1;
    console.log('User [' + index + '] connected from ' + remoteIp);

    socket.on('disconnect', function(){
        players.splice(index);
        console.log('User [' + index + '] disconnected');
    });

    socket.on('chat', function(msg) {
        if (msg.length <= 255){
            io.emit('chat', '#' + index + ': ' + msg);
            console.log('[CHAT] #' + index + ': ' + msg);
        }
    });
});
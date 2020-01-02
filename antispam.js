module.exports = function(io) {
    const SocketAntiSpam  = require('socket-anti-spam');

    const socketAntiSpam = new SocketAntiSpam({
        banTime:            30,         // Ban time in minutes
        kickThreshold:      10,         // User gets kicked after this many spam score
        kickTimesBeforeBan: 3,          // User gets banned after this many kicks
        banning:            true,       // Uses temp IP banning after kickTimesBeforeBan
        io:                 io,         // Bind the socket.io variable
    });

    socketAntiSpam.event.on('kick', (socket, data) => {
        socket.emit('chat', null, 'Byl jsi vyhozen za spam!', '#e1423e');
        console.log('[KICK] Spam: ' + socket.ip);
    });

    socketAntiSpam.event.on('ban', (socket, data) => {
        socket.emit('chat', null, 'Byl jsi zabanován za spam!', '#e1423e');
        console.log('[BAN] Spam: ' + socket.ip);
    });

    return socketAntiSpam;
};
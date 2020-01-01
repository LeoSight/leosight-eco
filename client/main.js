$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;

    socket.on('pong', function(ms) {
        latency = ms;
        $('#ping').html('Ping: ' + latency + ' ms');
    });

    socket.on('disconnect', function() {
        $('#ping').html('Spojení se serverem ztraceno!');
    });

    // CHAT

    $('#chat form').submit(function(e){
        e.preventDefault();
        socket.emit('chat', $('#msg').val());
        $('#msg').val('');
        return false;
    });

    socket.on('chat', function(msg, classes){
        classes = classes || '';
        messages.append($('<li>').text(msg).addClass(classes));
        messages.animate({ scrollTop: messages.prop("scrollHeight")}, 500);
    });
});
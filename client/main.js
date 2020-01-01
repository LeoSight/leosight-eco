$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;

    socket.on('pong', function(ms) {
        latency = ms;
        $('#ping').html('Ping: ' + latency + ' ms');
    });

    socket.on('disconnect', function() {
        $('#ping').html('Spojení ztraceno!');
        AddChatMessage('Spojení se serverem bylo ztraceno!', 'red');
    });

    // CHAT

    function AddChatMessage(msg, classes){
        classes = classes || '';
        messages.append($('<li>').text(msg).addClass(classes));
        messages.animate({ scrollTop: messages.prop("scrollHeight")}, 500);
    }

    $('#chat form').submit(function(e){
        e.preventDefault();
        if($('#msg').val().length > 0) {
            socket.emit('chat', $('#msg').val());
            $('#msg').val('');
            return false;
        }
    });

    socket.on('chat', AddChatMessage);
});
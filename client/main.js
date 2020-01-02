$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;

    socket.on('pong', function(ms) {
        latency = ms;
        $('#ping').html('Ping: ' + latency + ' ms');
    });

    socket.on('connect', function() {
        $('#ping').html('Připojení navázáno!');
        AddChatMessage('Navázáno připojení k serveru!', 'green');
        $('#login').show();
    });

    socket.on('disconnect', function() {
        $('#ping').html('Spojení ztraceno!');
        AddChatMessage('Spojení se serverem bylo ztraceno!', 'red');
    });

    socket.on('players', function(playerList) {
        $('#players').html('<p>Hráči online:</p><ul><li>' + playerList.join('</li><li>') + '</li></ul>');
    });

    // LOGIN

    $('#login form').submit(function(e){
        e.preventDefault();
        socket.emit('login', $('#username').val(), $('#password').val());
    });

    socket.on('login', function(success, response){
        if(success) {
            $('#login').hide();
            console.log('Přihlášení úspěšné (' + response + ')');
        }else{
            $('#login .title').fadeOut(100).html(response).fadeIn(100);
        }
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
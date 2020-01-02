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

    // MAPA

    const map = $('#map');
    const move = $('#main');

    function CreateMap(){
        const w = 50, h = 20;

        for (let i = -h; i <= h; i++) {
            let row = $('<div class="row"></div>').appendTo(map);
            for (let j = -w; j <= w; j++) {
                $('<div class="cell">' + i + '<br>' + j + '</div>').appendTo(row);
            }
        }

        let x, y;
        let scroll = false;
        move.mousemove(function(event) {
            if (scroll) {
                move.scrollTop(move.scrollTop() + (y - event.pageY));
                move.scrollLeft(move.scrollLeft() + (x - event.pageX));
            }
            x = event.pageX;
            y = event.pageY;
        });
        move.mousedown(function() { scroll = true; return false; });
        move.mouseup(function() { scroll = false; return false; });

        move.scrollTop( move.height() / 2 );
        move.scrollLeft( move.width() / 2 );
    }
    CreateMap();

    // KLÁVESOVÉ ZKRATKY

    $(window).keypress(function(e) {
        if ( $('input:focus').length > 0 ) {  return; }
        if (e.which === 32) {
            if($('#chat').is(':visible')) {
                $('#chat,#players,#ping,#version').fadeOut(200);
                $('#tip').html('Zobrazit HUD můžeš opět stisknutím mezerníku').fadeIn(100).delay(2000).fadeOut(100);
            }else{
                $('#chat,#players,#ping,#version').fadeIn(200);
                $('#tip').html('');
            }
        }
    });

});
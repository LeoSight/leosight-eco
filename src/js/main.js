$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;
    let info = { username: '', energy: 0, cells: 0 };
    let selection = { x: 0, y: 0 };

    socket.on('pong', function(ms) {
        latency = ms;
        $('#ping').html('Ping: ' + latency + ' ms');
    });

    socket.on('connect', function() {
        $('#ping').html('Připojení navázáno!');
        AddChatMessage(null, 'Navázáno připojení k serveru!', '#45b70a');
        $('#login').show();
    });

    socket.on('disconnect', function() {
        $('#ping').html('Spojení ztraceno!');
        AddChatMessage(null, 'Spojení se serverem bylo ztraceno!', '#e1423e');
    });

    socket.on('players', function(playerList) {
        $('#players').html('<p>Hráči online:</p><ul></ul>');
        playerList.forEach( player => $('#players > ul').append('<li style="color:' + player.color + '">[#' + player.id + '] ' + player.username + '</li>') );
    });

    // LOGIN

    $('#login form').submit(function(e){
        e.preventDefault();
        info.username = $('#username').val();
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

    function AddChatMessage(username, msg, color){
        color = color || '#fff';

        let newline = $('<li>').appendTo(messages);
        if(typeof(username) == 'string' && username.length > 0) {
            $('<span class="username">').text(username + ': ').css('color', color).appendTo(newline);
            $('<span class="text">').text(msg).appendTo(newline);
        }else{
            $('<span class="text">').text(msg).css('color', color).appendTo(newline);
        }

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
    const w = 30, h = 20;

    function CreateMap(){
        for (let i = -h; i <= h; i++) {
            let row = $('<div class="row"></div>').appendTo(map);
            for (let j = -w; j <= w; j++) {
                $('<div class="cell">').data('x', j).data('y', i).appendTo(row);
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
        move.mousedown(function(e) { if(e.which === 1){ scroll = true; return false; } });
        move.mouseup(function(e) { if(e.which === 1){ scroll = false; return false; } });

        move.scrollTop( move.height() / 2 );
        move.scrollLeft( move.width() / 2 );

        /*$('.cell').click(function() {
            socket.emit('capture', $(this).data('x'), $(this).data('y'));
        });*/

        move.oncontextmenu = function(){ return false; };

        $('#map .cell').on('contextmenu', function(e) {
            selection.x = $(this).data('x');
            selection.y = $(this).data('y');
            selection.owner = $(this).data('owner');
            selection.isHQ = $(this).data('hq');
            DrawSelection();
        });

        $.contextMenu({
            selector: ".cell",
            build: function($trigger, e) {
                const x = $trigger.data('x');
                const y = $trigger.data('y');
                const owner = $trigger.data('owner');
                const hq = $trigger.data('hq');

                return {
                    items: {
                        info: { name: "X: " + x + ", Y: " + y, disabled: true },
                        owner: { name: "Vlastník: " + (owner || 'Nikdo'), disabled: true },
                        capture: { name: (info.cells === 0 ? "Vybudovat základnu (⚡1)" : "Obsadit pole (⚡1)"), callback: CaptureCell, disabled: function(){
                            return !( info.energy > 0 && (CheckAdjacent(x, y) || info.cells === 0) && owner !== info.username && !hq );
                        } },
                        moveHQ: { name: "Přesunout základnu (⚡10)", callback: MoveHQ, disabled: function(){
                            return !( info.energy >= 10 && info.cells > 0 && owner === info.username && !hq );
                        } }
                    }
                };
            }
        });
    }
    CreateMap();

    /**
     * @return {boolean}
     */
    function CheckAdjacent(x, y){
        const mapRows = $('#map .row');
        const adj_left = mapRows.eq(h + y).find('.cell').eq(w + x - 1);
        const adj_right = mapRows.eq(h + y).find('.cell').eq(w + x + 1);
        const adj_top = mapRows.eq(h + y - 1).find('.cell').eq(w + x);
        const adj_bottom = mapRows.eq(h + y + 1).find('.cell').eq(w + x);

        return (adj_left && adj_left.data('owner') === info.username) ||
            (adj_right && adj_right.data('owner') === info.username) ||
            (adj_top && adj_top.data('owner') === info.username) ||
            (adj_bottom && adj_bottom.data('owner') === info.username);
    }

    function CaptureCell(){
        socket.emit('capture', $(this).data('x'), $(this).data('y'));
    }

    function MoveHQ(){
        socket.emit('movehq', $(this).data('x'), $(this).data('y'));
    }

    function DrawSelection(){
        $('#selection').html(`X: ${selection.x}<br>Y: ${selection.y}<br>Vlastník: ${selection.owner || 'Nikdo'}<br>${selection.isHQ ? 'HQ!' : ''}`);
    }

    socket.on('mapload', function(size){
        console.log('Načítám svět: ' + size);
    });

    socket.on('cell', function(x, y, username, color, isHQ){
        let cell = $('#map .row').eq(h + y).find('.cell').eq(w + x);
        cell.data('owner', username).css('background', color);

        if(isHQ){
            cell.data('hq', true).text('HQ');
        }else{
            cell.data('hq', false).text('');
        }
    });

    socket.on('info', function(newInfo){
        Object.keys(newInfo).forEach((key) => {
            info[key] = newInfo[key];
        });

        $('#energy > span').text(info.energy);
        $('#cells > span').text(info.cells);
    });

    socket.on('capture', function(color, x, y){
        $('#map .row').eq(h + y).find('.cell').eq(w + x).css('background', color);
    });

    // KLÁVESOVÉ ZKRATKY

    $(window).keypress(function(e) {
        if ( $('input:focus').length > 0 ) {  return; }
        if (e.which === 32) {
            if($('#chat').is(':visible')) {
                $('#chat,#players,#serverinfo,#playerinfo,#selection').fadeOut(200);
                $('#tip').html('Zobrazit HUD můžeš opět stisknutím mezerníku').fadeIn(100).delay(2000).fadeOut(100);
            }else{
                $('#chat,#players,#serverinfo,#playerinfo,#selection').fadeIn(200);
                $('#tip').html('');
            }
        }
    });

});
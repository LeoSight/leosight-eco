$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;
    let info = { username: '', energy: 0, money: 0, cells: 0 };
    let selection = { };

    const builds = {
        HQ: 1,
        GOLD: 2,
        COAL: 3,
        OIL: 4,
        IRON: 5,
        BAUXITE: 6,
        FORT: 7,
    };

    const builds_info = [
        { title: 'Pozemek' },
        { title: 'Základna', abbr: 'HQ' },
        { title: 'Zlatý důl', abbr: 'Z' },
        { title: 'Uhelný důl', abbr: 'U' },
        { title: 'Ropný vrt', abbr: 'R' },
        { title: 'Železný důl', abbr: 'Ž' },
        { title: 'Bauxitový důl', abbr: 'B' },
        { title: 'Pevnost', abbr: 'P' },
    ];

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

    socket.on('announce-update', function() {
        $('#login').html('<h2>Probíhá aktualizace!</h2>').show();
        setTimeout(function(){ window.location.reload(); }, 5000);
        AddChatMessage(null, 'Probíhá aktualizace klienta!', '#44cee8');
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
        let scroll = (messages.scrollTop() + messages.height() > messages.prop("scrollHeight") - 40);

        let newline = $('<li>').appendTo(messages);
        if(typeof(username) == 'string' && username.length > 0) {
            $('<span class="username">').text(username + ': ').css('color', color).appendTo(newline);
            $('<span class="text">').text(msg).appendTo(newline);
        }else{
            $('<span class="text">').text(msg).css('color', color).appendTo(newline);
        }

        if(scroll){
            messages.animate({scrollTop: messages.prop("scrollHeight")}, 500);
        }
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

        move.oncontextmenu = function(){ return false; };

        $('#map .cell').on('contextmenu', function(e) {
            selection.x = $(this).data('x');
            selection.y = $(this).data('y');
            selection.owner = $(this).data('owner');
            selection.build = $(this).data('build');
            DrawSelection();
        });

        $.contextMenu({
            selector: ".cell",
            build: function($trigger, e) {
                const x = $trigger.data('x');
                const y = $trigger.data('y');
                const owner = $trigger.data('owner');
                const build = $trigger.data('build');

                let items = {
                    info: { name: "X: " + x + ", Y: " + y, disabled: true },
                    owner: { name: "Vlastník: " + (owner || 'Nikdo'), disabled: true },
                    type: { name: "Typ: " + (builds_info[build] ? builds_info[build].title : 'Pozemek'), disabled: true },
                };

                if(build !== builds.HQ) {
                    if (owner === info.username) {
                        items.unclaim = {
                            name: "Zrušit obsazení (⚡1)", callback: UnclaimCell, disabled: function () {
                                return !(info.energy > 0);
                            }
                        };

                        if(build == null) {
                            if(!AdjacentMine(x, y)) {
                                items.moveHQ = {
                                    name: "Přesunout základnu (⚡10)", callback: MoveHQ, disabled: function () {
                                        return !(info.energy >= 10 && info.cells > 0);
                                    }
                                };
                            }

                            if(info.cells > 0) {
                                items.buildFort = {
                                    name: "Postavit pevnost (⚡10+💰100)", callback: BuildFort, disabled: function () {
                                        return !(info.energy >= 10 && info.money >= 100);
                                    }
                                };
                            }
                        }
                    } else {
                        if(owner == null) {
                            items.capture = {
                                name: (info.cells === 0 ? "Vybudovat základnu (⚡1)" : "Obsadit pole (⚡1)"),
                                callback: CaptureCell,
                                disabled: function () {
                                    return !(info.energy >= 1 && (CheckAdjacent(x, y) || (info.cells === 0 && !AdjacentMine(x, y))));
                                }
                            };
                        }else{
                            if(build === builds.FORT && info.cells > 0){
                                items.capture = {
                                    name: "Dobýt pevnost (⚡10)",
                                    callback: CaptureCell,
                                    disabled: function () {
                                        return !(info.energy >= 10 && CheckAdjacent(x, y));
                                    }
                                };
                            }else{
                                items.capture = {
                                    name: (info.cells === 0 ? "Vybudovat základnu (⚡2)" : "Obsadit pole (⚡2)"),
                                    callback: CaptureCell,
                                    disabled: function () {
                                        return !(info.energy >= 2 && (CheckAdjacent(x, y) || (info.cells === 0 && !AdjacentMine(x, y))));
                                    }
                                };
                            }
                        }
                    }
                }

                return {
                    items: items
                };
            }
        });
    }
    CreateMap();

    function GetAdjacent(x, y){
        const mapRows = $('#map .row');
        const adj_left = mapRows.eq(h + y).find('.cell').eq(w + x - 1);
        const adj_right = mapRows.eq(h + y).find('.cell').eq(w + x + 1);
        const adj_top = mapRows.eq(h + y - 1).find('.cell').eq(w + x);
        const adj_bottom = mapRows.eq(h + y + 1).find('.cell').eq(w + x);
        return [adj_left, adj_right, adj_top, adj_bottom];
    }

    /**
     * @return {boolean}
     */
    function CheckAdjacent(x, y){
        let adjacent = GetAdjacent(x, y);
        let r = false;
        adjacent.forEach(d => {
            if(d.data('owner') === info.username){
                r = true;
            }
        });
        return r;
    }

    /**
     * @return {boolean}
     */
    function AdjacentMine(x, y){
        let adjacent = GetAdjacent(x, y);
        let r = false;
        adjacent.forEach(d => {
            if(d.data('build') === builds.GOLD){
                r = true;
            }
        });
        return r;
    }

    function CaptureCell(){
        socket.emit('capture', $(this).data('x'), $(this).data('y'));
    }

    function UnclaimCell(){
        socket.emit('unclaim', $(this).data('x'), $(this).data('y'));
    }

    function MoveHQ(){
        socket.emit('movehq', $(this).data('x'), $(this).data('y'));
    }

    function BuildFort(){
        socket.emit('build', $(this).data('x'), $(this).data('y'), builds.FORT);
    }

    function DrawSelection(){
        $('#selection').html(`X: ${selection.x}<br>Y: ${selection.y}<br>Vlastník: ${selection.owner || 'Nikdo'}<br>Typ: ${builds_info[selection.build] ? builds_info[selection.build].title : 'Pozemek'}`);
    }

    /**
     * @return {string}
     */
    function HexToBackground(hex){
        hex = hex.replace('#','');
        let r = parseInt(hex.substring(0,2), 16);
        let g = parseInt(hex.substring(2,4), 16);
        let b = parseInt(hex.substring(4,6), 16);
        return `rgba(${r}, ${g}, ${b}, .5)`;
    }

    socket.on('mapload', function(size){
        console.log('Načítám svět: ' + size);
    });

    socket.on('cell', function(x, y, username, color, build){
        let cell = $('#map .row').eq(h + y).find('.cell').eq(w + x);
        if(username) {
            cell.data('owner', username).data('build', build).css('background', HexToBackground(color));
        }else{
            cell.data('owner', null).css('background', '');
        }

        if(builds_info[build] && builds_info[build].abbr) {
            cell.text(builds_info[build].abbr);
        }else{
            cell.text('');
        }
    });

    socket.on('info', function(newInfo){
        Object.keys(newInfo).forEach((key) => {
            info[key] = newInfo[key];
        });

        $('#energy > span').text(info.energy);
        $('#money > span').text(info.money);
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
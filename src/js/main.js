$(function () {
    const socket = io();
    const messages = $('#messages');
    let latency = 0;
    let info = { username: '', energy: 0, money: 0, cells: 0 };
    let myHQ = {};
    let playerData = [];

    console.log('Copak tu hledáš? 🤨');

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
        socket.disconnect();
        socket.off();
    });

    socket.on('players', function(playerList) {
        playerData = playerList;
        $('#players').html('<p>Hráči online:</p><ul></ul>');
        playerList.forEach(player => {
            if(player.id >= 0){
                $('#players > ul').append('<li style="color:' + player.color + '">[#' + player.id + '] ' + player.username + '</li>');
            }
        });
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

    function AddChatMessage(username, msg, color, isHtml){
        color = color || '#fff';
        isHtml = isHtml || false;
        let scroll = (messages.scrollTop() + messages.height() > messages.prop("scrollHeight") - 40);

        let newline = $('<li>').appendTo(messages);
        if(typeof(username) == 'string' && username.length > 0) {
            $('<span class="username">').text(username + ': ').css('color', color).appendTo(newline);
            $('<span class="text">').text(msg).appendTo(newline);
        }else{
            if(isHtml){
                $('<span class="text">').html(msg).css('color', color).appendTo(newline);
            }else{
                $('<span class="text">').text(msg).css('color', color).appendTo(newline);
            }
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

        /*
        $('#map .cell').on('contextmenu', function(e) {
            selection.x = $(this).data('x');
            selection.y = $(this).data('y');
            selection.owner = $(this).data('owner');
            selection.build = $(this).data('build');

            selection.country = null;
            if(selection.owner) {
                let ownerData = playerData.find(x => x.username === selection.owner);
                if(ownerData && ownerData.country) {
                    selection.country = ownerData.country;
                }
            }

            DrawSelection();
        });
        */

        $.contextMenu({
            selector: ".cell",
            build: function($trigger, e) {
                const x = $trigger.data('x');
                const y = $trigger.data('y');
                const owner = $trigger.data('owner');
                const build = $trigger.data('build');
                const level = $trigger.data('level') || 1;

                let items = {};

                if(owner) {
                    let ownerData = playerData.find(x => x.username === owner);
                    if(ownerData) {
                        items.name = {name: `<strong>${ownerData.country || 'Bez názvu'}</strong>`, isHtmlName: true, disabled: true };
                    }
                }

                items.info = { name: "X: " + x + ", Y: " + y, disabled: true };
                items.owner = { name: "Vlastník: " + (owner || 'Nikdo'), disabled: true };
                items.type = { name: "Typ: " + (builds_info[build] ? builds_info[build].title : 'Pozemek'), disabled: true };

                if(build !== builds.HQ) {
                    if (owner === info.username) {
                        items.unclaim = {
                            name: "Zrušit obsazení (⚡1)", callback: UnclaimCell, disabled: function () {
                                return !(info.energy > 0);
                            }
                        };

                        if(build == null) {
                            if(!CheckAdjacentBuilding(x, y, [builds.GOLD, builds.HQ])) {
                                items.moveHQ = {
                                    name: "Přesunout základnu (⚡10)", callback: MoveHQ, disabled: function () {
                                        return !(info.energy >= 10 && info.cells > 0 && CheckAdjacentOwnAll(x, y));
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
                        }else if(build === builds.FORT){
                            items.destroy = {
                                name: "Zničit pevnost (⚡1)",
                                callback: DestroyBuilding,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };

                            if(level < 5){
                                items.upgrade = {
                                    name: "Vylepšit pevnost (⚡10+💰500)",
                                    callback: UpgradeBuilding,
                                    disabled: function () {
                                        return !(info.energy >= 10 && info.money >= 500);
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
                                    return !(info.energy >= 1 && (CheckAdjacent(x, y) || (info.cells === 0 && build == null && !CheckAdjacentBuilding(x, y, [builds.GOLD, builds.HQ]))));
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
                                        return !(info.energy >= 2 && (CheckAdjacent(x, y) || (info.cells === 0 && build == null && !CheckAdjacentBuilding(x, y, [builds.GOLD, builds.HQ]))));
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
        let adjacent = [];
        const mapRows = $('#map .row');
        const adj_left = mapRows.eq(h + y).find('.cell').eq(w + x - 1);
        const adj_right = mapRows.eq(h + y).find('.cell').eq(w + x + 1);
        const adj_top = mapRows.eq(h + y - 1).find('.cell').eq(w + x);
        const adj_bottom = mapRows.eq(h + y + 1).find('.cell').eq(w + x);

        adj_left && adjacent.push(adj_left);
        adj_right && adjacent.push(adj_right);
        adj_top && adjacent.push(adj_top);
        adj_bottom && adjacent.push(adj_bottom);
        return adjacent;
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
    function CheckAdjacentOwnAll(x, y){
        let adjacent = GetAdjacent(x, y);
        let r = true;
        adjacent.forEach(d => {
            if(d.data('owner') !== info.username){
                r = false;
            }
        });
        return r;
    }

    /**
     * @return {boolean}
     */
    function CheckAdjacentBuilding(x, y, building){
        let adjacent = GetAdjacent(x, y);
        let r = false;
        adjacent.forEach(d => {
            if(Array.isArray(building)){
                if(building.includes(d.data('build'))){
                    r = true;
                }
            }else if(d.data('build') === building){
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

    function UpgradeBuilding(){
        socket.emit('upgrade', $(this).data('x'), $(this).data('y'));
    }

    function DestroyBuilding(){
        socket.emit('destroy', $(this).data('x'), $(this).data('y'));
    }

    /*
    function DrawSelection(){
        $('#selection').html(`<strong>${selection.country || 'Nepojmenované území'}</strong><br>X: ${selection.x}<br>Y: ${selection.y}<br>Vlastník: ${selection.owner || 'Nikdo'}<br>Typ: ${builds_info[selection.build] ? builds_info[selection.build].title : 'Pozemek'}`);
    }
    */

    /**
     * @return {string}
     */
    function GenerateBackground(hex, build, level){
        hex = hex.replace('#','');
        if(hex.length === 3){ hex = `${hex}${hex}`; }
        let r = parseInt(hex.substring(0,2), 16);
        let g = parseInt(hex.substring(2,4), 16);
        let b = parseInt(hex.substring(4,6), 16);

        if(build){
            if(level && level > 1){
                return `url('../images/builds/${build}_${level}.png'), rgba(${r}, ${g}, ${b}, .5)`;
            }else {
                return `url('../images/builds/${build}.png'), rgba(${r}, ${g}, ${b}, .5)`;
            }
        }else {
            return `rgba(${r}, ${g}, ${b}, .5)`;
        }
    }

    socket.on('mapload', function(size){
        console.log('Načítám svět: ' + size);
    });

    socket.on('cell', function(x, y, username, color, build, level){
        let cell = $('#map .row').eq(h + y).find('.cell').eq(w + x);
        level = level || 1;

        if(username) {
            cell.data('owner', username).data('build', build).data('level', level).css('background', GenerateBackground(color, build, level));

            if(username === info.username && build === builds.HQ){
                myHQ = { x: x, y: y };
            }
        }else{
            cell.data('owner', null).css('background', '');
        }

        if(builds_info[build] && builds_info[build].abbr) {
            if(level && level > 1){
                cell.html(`${builds_info[build].abbr}<sub>${level}</sub>`);
            }else{
                cell.text(builds_info[build].abbr);
            }
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
                $('#chat,#players,#serverinfo,#playerinfo').fadeOut(200);
                $('#tip').html('Zobrazit HUD můžeš opět stisknutím mezerníku').fadeIn(100).delay(2000).fadeOut(100);
            }else{
                $('#chat,#players,#serverinfo,#playerinfo').fadeIn(200);
                $('#tip').html('');
            }
        }
    });

});

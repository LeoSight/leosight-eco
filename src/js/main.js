let gfs = [];

$(function () {
    const socket = io();
    const messages = $('#messages');
    let logged = false;
    let menuActive = false;
    let latency = 0;
    let info = {
        username: '',
        energy: 0,
        cells: 0,
        money: 0
    };
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
        LEAD: 8,
        SULFUR: 9,
        NITER: 10,
        FACTORY: 11,
        MILITARY: 12,
        STONE: 13,
        EXPORT: 14,
        FARM: 15,
        FIELD: 16,
        WAREHOUSE: 17,
        FOREST: 18,
    };

    const builds_info = [
        { title: 'Pozemek' },
        { title: 'Hlavní základna', abbr: 'HQ' },
        { title: 'Zlatý důl', abbr: 'Z' },
        { title: 'Uhelný důl', abbr: 'U' },
        { title: 'Ropný vrt', abbr: 'R' },
        { title: 'Železný důl', abbr: 'Ž' },
        { title: 'Bauxitový důl', abbr: 'B' },
        { title: 'Pevnost', abbr: '-' },
        { title: 'Olověný důl', abbr: 'O' },
        { title: 'Sírový důl', abbr: 'S' },
        { title: 'Ledkový důl', abbr: 'L' },
        { title: 'Továrna', abbr: '' },
        { title: 'Vojenská základna', abbr: 'V' },
        { title: 'Kamenolom', abbr: 'K' },
        { title: 'Exportní sklad', abbr: 'E' },
        { title: 'Farma', abbr: 'F' },
        { title: 'Pšeničné pole', abbr: '' },
        { title: 'Sklad', abbr: '-' },
        { title: 'Les', abbr: '' },
    ];

    const resources = {
        GOLD: 'Zlato',
        COAL: 'Uhlí',
        OIL: 'Ropa',
        IRON: 'Železo',
        BAUXITE: 'Bauxit',
        LEAD: 'Olovo',
        SULFUR: 'Síra',
        NITER: 'Ledek',
        GUNPOWDER: 'Střelný prach',
        AMMO: 'Munice',
        STONE: 'Kámen',
        WHEAT: 'Pšenice',
        ALUMINIUM: 'Hliník',
    };

    socket.on('pong', function(ms) {
        latency = ms;
        $('#ping').html('Ping: ' + latency + ' ms');
    });

    socket.on('connect', function() {
        $('#ping').html('Připojení navázáno!');
        AddChatMessage(null, 'Navázáno připojení k serveru!', '#45b70a');
        $('#login').show();
    });

    socket.on('serverinfo', function(serverName, serverVersion, codebase) {
        $('#login .current').html(`Právě jsi připojen k serveru: <strong>${serverName}</strong><br><small>Verze serveru: r${serverVersion} (${codebase})</small>`);
        $('.version').html(`Verze: r${serverVersion}`);

        $('#serverlist').empty();

        $.getJSON('https://eco.leosight.cz/servers.php', function(servers) {
            servers.forEach(server => {
                $.getJSON('https://' + server.address + ':3005/stats', function(conn){
                    $('#serverlist').append(`<option value="https://${server.address}"${server.servername === serverName ? ' selected' : ''}>${conn.servername} (${conn.online})</option>`);
                });
            });
        });

        $.getJSON('http://127.0.0.1:3005/stats', function(conn){
            $('#serverlist').append(`<option value="http://127.0.0.1"${conn.servername === serverName ? ' selected' : ''}>${conn.servername} (${conn.online}) - lokální</option>`);
        });
    });

    $('#serverlist').change(function() {
        window.location.href = $(this).val() + ':3005';
    });

    socket.on('disconnect', function() {
        $('#ping').html('Spojení ztraceno!');
        AddChatMessage(null, 'Spojení se serverem bylo ztraceno!', '#e1423e');
        logged = false;
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
            logged = true;
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
                msg = msg.replace(/\[RES:([A-Z]+)]/gi, (_, res) => Resource(res.toLowerCase()));
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
    const w = 50, h = 40;

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

        move.scrollTop( map.height() / 2 - move.height() / 2 );
        move.scrollLeft( map.width() / 2 - move.width() / 2 );

        move.oncontextmenu = function(){ return false; };

        /*
        let zoom = 1.0;
        move.bind('wheel mousewheel', function(e){
            e.preventDefault();
            let delta;

            if (e.originalEvent.wheelDelta !== undefined)
                delta = e.originalEvent.wheelDelta;
            else
                delta = e.originalEvent.deltaY * -1;

            zoom += (delta > 0 ? 0.1 : -0.1);
            zoom = Math.max(Math.min(zoom, 1.5), 0.5);
            map.css('transform', 'scale('+zoom+')');
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
                const working = $trigger.data('working') || false;
                const type = $trigger.data('type') || null;

                let items = {};

                if(owner) {
                    let ownerData = playerData.find(x => x.username === owner);
                    if(ownerData) {
                        items.name = {name: `<strong>${ownerData.country || 'Bez názvu'}</strong>`, isHtmlName: true, disabled: true };
                    }
                }

                items.info = { name: "X: " + x + ", Y: " + y, disabled: true };
                items.owner = { name: "Vlastník: " + (owner || 'Nikdo'), disabled: true };
                items.type = { name: "Typ: " + (builds_info[build] ? builds_info[build].title : 'Pozemek') + (type ? ' (' + type + ')' : ''), isHtmlName: true, disabled: true };

                if(build === builds.HQ) {
                    if (owner === info.username) {
                        items.destroy = {
                            name: "Zničit základnu (⚡1)",
                            callback: DestroyBuilding,
                            disabled: function () {
                                return !(info.energy >= 1 && info.cells === 1);
                            }
                        };
                    }else{
                        items.capture = {
                            name: `Dobýt hlavní základnu (⚡10+${Resource('ammo')}500)`,
                            isHtmlName: true,
                            callback: CaptureCell,
                            disabled: function () {
                                return !(info.energy >= 10 && info.ammo >= 500 && CheckAdjacentOwnAll(x, y));
                            }
                        };
                    }
                }else{
                    if (owner === info.username) {
                        items.unclaim = {
                            name: "Zrušit obsazení (⚡1)", callback: UnclaimCell, disabled: function () {
                                return !(info.energy > 0);
                            }
                        };

                        if(build == null) {
                            if(CanBuildHQ(x, y)) {
                                items.moveHQ = {
                                    name: `Přesunout základnu (⚡10)`, callback: MoveHQ, disabled: function () {
                                        return !(info.energy >= 10 && info.cells > 0 && CheckAdjacentOwnAll(x, y));
                                    }
                                };
                            }

                            if(info.cells > 0) {
                                items.buildArmy = {
                                    name: 'Vojenské budovy',
                                    items: {
                                        buildFort: {
                                            name: `Pevnost (⚡10+${Resource('stone')}100)`, isHtmlName: true, callback: () => Build(x, y, builds.FORT), disabled: function () {
                                                return !(info.energy >= 10 && info.stone >= 100);
                                            }
                                        },
                                        buildMilitary: {
                                            name: `Vojenská základna (⚡10+${Resource('gold')}1000+${Resource('stone')}1000+${Resource('iron')}1000+${Resource('bauxite')}1000)`, isHtmlName: true, callback: () => Build(x, y, builds.MILITARY), disabled: function () {
                                                return !(info.energy >= 10 && info.gold >= 1000 && info.stone >= 1000 && info.iron >= 1000 && info.bauxite >= 1000 && CheckAdjacentOwnAll(x, y));
                                            }
                                        }
                                    }
                                };

                                items.buildCivil = {
                                    name: 'Civilní stavby',
                                    items: {
                                        buildField: {
                                            name: `Pole (⚡5+${Resource('stone')}50)`, isHtmlName: true, callback: () => Build(x, y, builds.FIELD), disabled: function () {
                                                return !(info.energy >= 5 && info.stone >= 50);
                                            }
                                        },
                                        buildFactory: {
                                            name: `Továrna (⚡10+${Resource('stone')}100+${Resource('iron')}200+${Resource('bauxite')}300)`, isHtmlName: true, callback: () => Build(x, y, builds.FACTORY), disabled: function () {
                                                return !(info.energy >= 10 && info.stone >= 100 && info.iron >= 200 && info.bauxite >= 300);
                                            }
                                        },
                                        buildWarehouse: {
                                            name: `Sklad (⚡10+${Resource('iron')}800+${Resource('aluminium')}500)`, isHtmlName: true, callback: () => Build(x, y, builds.WAREHOUSE), disabled: function () {
                                                return !(info.energy >= 10 && info.iron >= 800 && info.aluminium >= 500);
                                            }
                                        },
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
                                    name: `Vylepšit pevnost (⚡10+${Resource('stone')}500)`,
                                    isHtmlName: true,
                                    callback: UpgradeBuilding,
                                    disabled: function () {
                                        return !(info.energy >= 10 && info.stone >= 500);
                                    }
                                };
                            }
                        }else if(build === builds.WAREHOUSE){
                            items.destroy = {
                                name: "Zničit sklad (⚡1)",
                                callback: DestroyBuilding,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };

                            if(level < 5){
                                items.upgrade = {
                                    name: `Vylepšit sklad (⚡10+${Resource('iron')}800+${Resource('aluminium')}500)`,
                                    isHtmlName: true,
                                    callback: UpgradeBuilding,
                                    disabled: function () {
                                        return !(info.energy >= 10 && info.iron >= 800 && info.aluminium >= 500);
                                    }
                                };
                            }

                            items.retype = {
                                name: 'Změnit skladovanou surovinu (⚡1)',
                                disabled: () => { return !(info.energy >= 1); },
                                items: {}
                            };

                            Object.keys(resources).forEach(res => {
                                items.retype.items[res.toLowerCase()] = {
                                    name: Resource(res.toLowerCase()) + ' ' + resources[res],
                                    isHtmlName: true,
                                    callback: () => RetypeBuilding(x, y, res.toLowerCase()),
                                    disabled: () => { return !(info.energy >= 1); }
                                }
                            });
                        }else if(build === builds.FACTORY){
                            items.destroy = {
                                name: "Zničit továrnu (⚡1)",
                                callback: DestroyBuilding,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };

                            items.switch = {
                                name: (working ? "Vypnout továrnu (⚡1)" : "Zapnout továrnu (⚡1)"),
                                callback: SwitchFactory,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };

                            items.retype = {
                                name: 'Nastavit výrobu (⚡1)',
                                disabled: () => { return !(info.energy >= 1); },
                                items: {
                                    aluminium: {
                                        name: Resource('aluminium') + ' Hliník',
                                        isHtmlName: true,
                                        callback: () => RetypeBuilding(x, y, 'aluminium'),
                                        disabled: () => { return !(info.energy >= 1); }
                                    },
                                    gunpowder: {
                                        name: Resource('gunpowder') + ' Střelný prach',
                                        isHtmlName: true,
                                        callback: () => RetypeBuilding(x, y, 'gunpowder'),
                                        disabled: () => { return !(info.energy >= 1); }
                                    },
                                    ammo: {
                                        name: Resource('ammo') + ' Munice',
                                        isHtmlName: true,
                                        callback: () => RetypeBuilding(x, y, 'ammo'),
                                        disabled: () => { return !(info.energy >= 1); }
                                    }
                                }
                            };
                        }else if(build === builds.MILITARY){
                            items.destroy = {
                                name: "Zničit vojenskou základnu (⚡1)",
                                callback: DestroyBuilding,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };
                        }else if(build === builds.FIELD){
                            items.destroy = {
                                name: "Zničit pole (⚡1)",
                                callback: DestroyBuilding,
                                disabled: function () {
                                    return !(info.energy >= 1);
                                }
                            };
                        }
                    } else {
                        if(owner == null) {
                            items.capture = {
                                name: (info.cells === 0 ? "Vybudovat základnu (⚡1)" : "Obsadit pole (⚡1)"),
                                callback: CaptureCell,
                                disabled: function () {
                                    return !(info.energy >= 1 && (CheckAdjacent(x, y) || (info.cells === 0 && build == null && CanBuildHQ(x, y))));
                                }
                            };
                        }else{
                            if(build === builds.FORT && info.cells > 0) {
                                items.capture = {
                                    name: "Dobýt pevnost (⚡10)",
                                    callback: CaptureCell,
                                    disabled: function () {
                                        return !(info.energy >= 10 && CheckAdjacent(x, y));
                                    }
                                };
                            }else if(build === builds.MILITARY && info.cells > 0){
                                items.capture = {
                                    name: `Dobýt vojenskou základnu (⚡10+${Resource('ammo')}500)`,
                                    isHtmlName: true,
                                    callback: CaptureCell,
                                    disabled: function () {
                                        return !(info.energy >= 10 && CheckAdjacent(x, y));
                                    }
                                };
                            }else{
                                items.capture = {
                                    name: (info.cells === 0 ? "Vybudovat základnu (⚡2)" : "Obsadit pole (⚡2)"),
                                    isHtmlName: true,
                                    callback: CaptureCell,
                                    disabled: function () {
                                        return !(info.energy >= 2 && (CheckAdjacent(x, y) || (info.cells === 0 && build == null && CanBuildHQ(x, y))));
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

        adj_left.length > 0 && adjacent.push(adj_left);
        adj_right.length > 0 && adjacent.push(adj_right);
        adj_top.length > 0 && adjacent.push(adj_top);
        adj_bottom.length > 0 && adjacent.push(adj_bottom);
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

    /**
     * @return {boolean}
     */
    function CanBuildHQ(x, y){
        return !CheckAdjacentBuilding(x, y, [builds.HQ, builds.GOLD, builds.COAL, builds.OIL, builds.IRON, builds.BAUXITE, builds.LEAD, builds.SULFUR, builds.NITER, builds.STONE]);
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

    function Build(x, y, building){
        socket.emit('build', x, y, building);
    }

    function UpgradeBuilding(){
        socket.emit('upgrade', $(this).data('x'), $(this).data('y'));
    }

    function DestroyBuilding(){
        socket.emit('destroy', $(this).data('x'), $(this).data('y'));
    }

    function SwitchFactory(){
        socket.emit('switch', $(this).data('x'), $(this).data('y'));
    }

    function RetypeBuilding(x, y, type){
        socket.emit('retype', x, y, type);
    }

    gfs.changeColor = function(){
        let color = $('#newColor').val();
        socket.emit('chat', '/color ' + color);
    };

    /**
     * @return {string}
     */
    function Resource(key){
        return `<img src="../images/resources/${key}.png" alt="${resources[key.toUpperCase()]}" title="${resources[key.toUpperCase()]}">`;
    }

    /**
     * @return {string}
     */
    function GenerateBackground(hex, build, level){
        let color = 'rgba(51, 51, 51, 0.2)';
        if(hex) {
            hex = hex.replace('#', '');
            if (hex.length === 3) hex = `${hex}${hex}`;
            let r = parseInt(hex.substring(0, 2), 16);
            let g = parseInt(hex.substring(2, 4), 16);
            let b = parseInt(hex.substring(4, 6), 16);
            color = `rgba(${r}, ${g}, ${b}, .5)`;
        }

        if(build){
            if(level && level > 1 && build !== builds.WAREHOUSE){
                return `url('../images/builds/${build}_${level}.png') center center, ${color}`;
            }else {
                return `url('../images/builds/${build}.png') center center, ${color}`;
            }
        }else {
            return color;
        }
    }

    socket.on('mapload', function(size){
        console.log('Načítám svět: ' + size);
    });

    socket.on('cell', function(x, y, username, color, build, level){
        let cell = $('#map .row').eq(h + y).find('.cell').eq(w + x);
        level = level || 1

        if(username) {
            cell.data('owner', username).data('build', build).data('level', level).css('background', GenerateBackground(color, build, level));

            if(username === info.username && build === builds.HQ){
                myHQ = { x: x, y: y };
            }
        }else{
            cell.data('owner', null).data('build', build).data('level', level).css('background', GenerateBackground(null, build, level));
        }

        if(builds_info[build] && builds_info[build].abbr !== undefined) {
            if(level && builds_info[build].abbr === '-'){
                cell.html(level);
            }else if(level && level > 1){
                cell.html(`${builds_info[build].abbr}<sub>${level}</sub>`);
            }else{
                cell.text(builds_info[build].abbr);
            }
        }else{
            cell.text('');
        }
    });

    socket.on('cell-data', function(x, y, key, value){
        let cell = $('#map .row').eq(h + y).find('.cell').eq(w + x);
        let build = cell.data('build') || null;

        if(key === 'working' && build === builds.FACTORY){
            cell.data('working', value);
            if(value){
                cell.html(builds_info[build].abbr + '<span class="smoke"></span>');
            }else{
                cell.html(builds_info[build].abbr);
            }
        }else if(key === 'type' && [builds.FACTORY, builds.WAREHOUSE].includes(build)){
            value = resources[value.toUpperCase()] ? Resource(value) + ' ' + resources[value.toUpperCase()] : value;
            cell.data('type', value);
        }
    });

    socket.on('info', function(newInfo){
        Object.keys(newInfo).forEach((key) => {
            info[key] = newInfo[key];
        });

        $('#energy > span').text(info.energy);
        $('#money > span').text(info.money);
        $('#cells > span').text(info.cells);

        let res = $('#resources').text('');
        Object.keys(info).forEach((key) => {
            if (key.toUpperCase() in resources) {
                $('<p>').html(`${info[key+'Spending'] ? '('+(-info[key+'Spending'])+') ' : ''}${info[key]}${info[key+'Max'] ? ' / '+(info[key+'Max']) : ''} ${Resource(key)}`).appendTo(res);
            }
        });

        // Refresh disabled v kontextovém menu
        let $el = $('.context-menu-root');
        if($el && $el.data()) {
            let contextMenuRoot = $el.data().contextMenu;
            $.contextMenu.op.update.call($el, contextMenuRoot);
        }
    });

    socket.on('capture', function(color, x, y){
        $('#map .row').eq(h + y).find('.cell').eq(w + x).css('background', color);
    });

    // MODÁLOVÁ OKNA

    MicroModal.init({ awaitCloseAnimation: true });

    // KLÁVESOVÉ ZKRATKY

    $(window).keyup(function(e) {
        if(!logged) return;
        if (e.which === 27) {
            if($('#modal-menu').is(':hidden')){
                $('#modal-menu').fadeIn(1);
                MicroModal.show('modal-menu', {
                    onClose: () => { menuActive = false; }
                });
            }else{
                MicroModal.close('modal-menu');
                $('#modal-menu').fadeOut(1);
            }
        }

        if ( $('input:focus').length > 0 ) {  return; } // Není aktivní psaní do chatu

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
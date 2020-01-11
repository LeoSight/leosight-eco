module.exports = function(io, discord) {
    const readline = require('readline'),
        rl = readline.createInterface({input: process.stdin, output: process.stdout, terminal: false});

    rl.setPrompt('');
    rl.prompt();

    rl.on('line', function (line) {
        let cmd = line.trim().split(' ');
        switch (cmd[0]) {
            case 'say':
                cmd.shift();
                io.emit('chat', null, cmd.join(' '), '#44cee8');
                console.log('[CHAT] Console: ' + cmd.join(' '));
                break;
            case 'discord':
                cmd.shift();
                discord.broadcast(cmd.join(' '));
                console.log('[DISCORD] Bot: ' + cmd.join(' '));
                break;
            case 'update':
                io.emit('announce-update');
                console.log('Odeslána informace o aktualizaci! Do 5s spusť server!');
                rl.close();
                break;
            case 'exit':
                rl.close();
                break;
            default:
                console.log('');
                break;
        }
        rl.prompt();
    }).on('close', function () {
        io.emit('chat', null, 'Server se vypíná!', '#44cee8');
        discord.broadcast('Server se vypíná!');
        console.log('Vypínám server..');
        setTimeout(() => {
            process.exit(0);
        }, 500);
    });
};
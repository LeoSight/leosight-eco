module.exports = function(io) {
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
        console.log('Vypínám server..');
        process.exit(0);
    });
};
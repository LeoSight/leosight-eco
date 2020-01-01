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
                io.emit('chat', cmd.join(' '), 'console');
                console.log('[CHAT] Console: ' + cmd.join(' '));
                break;
            case 'exit':
                rl.close();
                break;
            default:
                console.log('Neznámý příkaz: `' + line.trim() + '`');
                break;
        }
        rl.prompt();
    }).on('close', function () {
        io.emit('chat', 'Server se vypíná!', 'console');
        console.log('Vypínám server..');
        process.exit(0);
    });
};
const https = require('https');

exports.update = (serverName, players, test, version, codebase) => {
    let data = 'server='+serverName+'&players='+players+'&test='+(+test)+'&address='+(process.env.ADDRESS || 'default')+'&version='+version+'&codebase='+codebase;
    const options = {
        hostname: 'eco.leosight.cz',
        port: 443,
        path: '/master.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    };

    const req = https.request(options, (res) => {
        let d = '';

        res.on('data', (chunk) => {
            d += chunk;
        });

        res.on('end', () => {
            d = d.trim();

            if (d !== 'OK') {
                console.log('[ERROR] ' + d);
            }
        });
    });

    req.on('error', (err) => {
        console.log('[ERROR] ' + err.message);
    });

    req.write(data);
    req.end();
};
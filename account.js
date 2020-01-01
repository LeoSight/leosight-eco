const https = require('https');

module.exports = function(security) {
    return {
        login: (username, password, cb) => {
            let data = 'username='+username+'&password='+password+'&hashed=1';
            const options = {
                hostname: 'leosight.cz',
                port: 443,
                path: security.loginUri,
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

                    if (d === 'BAD') {
                        cb(false, 'Špatné jméno nebo heslo');
                    } else if (d === 'BANNED') {
                        cb(false, 'Účet je zabanován');
                    } else if (d.length === 10) {
                        cb(true, d);
                    } else {
                        cb(false, 'Neznámá chyba');
                        console.log('[ERROR]' + d);
                    }
                });
            });

            req.on('error', (err) => {
                cb(false, 'Nepodařilo se spojit s API');
                console.log('[ERROR]' + err.message);
            });

            req.write(data);
            req.end();
        }
    };
};
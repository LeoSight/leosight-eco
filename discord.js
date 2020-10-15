console.log('Spouštím Discord integraci..');

const utils = require(__dirname + '/utils.js')();
const Discord = require('discord.js');
const discordClient = new Discord.Client();
let loaded = false;

discordClient.on("ready", () => {
    if(!loaded) {
        discordClient.user.setActivity("LeoSight Eco", {type: "PLAYING"});
        discordClient.channels.cache.get("661926637453180958").setTopic(`Diskuze a vývoj herního projektu: https://eco.leosight.cz/ | Poslední aktualizace: ${utils.date()} | Aktuální verze: ${utils.version} | GitHub: https://github.com/${process.env.CODEBASE}`);
        broadcast('Server je online! https://eco.leosight.cz');
        loaded = true;
    }
});

discordClient.login(process.env.DISCORD_TOKEN);

const broadcast = (message) => {
    discordClient.channels.cache.get("661926637453180958").send(message);
};

exports.broadcast = broadcast;
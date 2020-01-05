console.log('Spouštím Discord integraci..');

const utils = require(__dirname + '/utils.js');
const Discord = require('discord.js');
const discordClient = new Discord.Client();

discordClient.on("ready", () => {
    discordClient.user.setActivity("LeoSight Eco", { type: "PLAYING"});
    discordClient.channels.get("661926637453180958").setTopic("Diskuze a vývoj herního projektu: https://eco.leosight.cz/ | Poslední aktualizace: " + utils.date());
});

discordClient.login(process.env.DISCORD_TOKEN);

const broadcast = (message) => {
    discordClient.channels.get("661926637453180958").send(message);
};

exports.broadcast = broadcast;
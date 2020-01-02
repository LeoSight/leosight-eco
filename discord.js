console.log('Spouštím Discord integraci..');

const Discord = require('discord.js');
const discordClient = new Discord.Client();

discordClient.on("ready", () => {
    let now = new Date().toLocaleString();
    discordClient.user.setActivity("LeoSight Eco", { type: "PLAYING"});
    discordClient.channels.get("661926637453180958").setTopic("Diskuze a vývoj herního projektu: http://eco.leosight.cz/ | Poslední aktualizace: " + now);
});

discordClient.login(process.env.DISCORD_TOKEN);

const broadcast = (message) => {
    discordClient.channels.get("661926637453180958").send(message);
};

exports.broadcast = broadcast;
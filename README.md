[![GitHub last commit](https://img.shields.io/github/last-commit/RatajVaver/leosight-eco.svg?style=flat)](https://github.com/RatajVaver/leosight-eco/commits/master)
[![Discord](https://img.shields.io/discord/172025101963755520.svg?label=discord)](https://discord.gg/RJmtV3p)
[![Donate](https://img.shields.io/badge/$-support-12a0df.svg?style=flat)](https://leosight.cz/donate) 

<h1><img width="24" height="24" src="http://i.imgur.com/MnkSnOQ.png"> LeoSight Eco</h1>

**Co je LeoSight Eco?**

Jedná se o projekt komunity LeoSight.cz, LeoSight Eco je geopolitická a ekonomická hra.

**Jak mohu přispět?**

Existuje spousta možností, jak můžeš vývoji pomoct:
* Podílej se přímo na vývoji (nejvíc projektu pomůžeš, když naprogramuješ novou feature a odešleš ji do pull requestu)
* Odhaluj chyby ve hře nebo v kódu (nahlaš nám je do Issues)
* Podpoř finančně provoz serveru (pošli donate na LeoSight.cz)
* Podpoř finančně autory (kontaktuj konkrétního kontributora a pošli mu nějaké peníze, nebo ho pozvi na :coffee:)
* Navrhni nové funkce (jestli máš zajímavý nápad, jak hru vylepšit, určitě se o něj poděl v Issues nebo na našem Discordu)

**Chci se podílet na vývoji, jak začít?**

V první řadě budeš potřebovat [NodeJS + NPM](https://nodejs.org/en/) a [MongoDB](https://www.mongodb.com/download-center/community).
Doporučujeme také [MongoDB Compass](https://www.mongodb.com/download-center/compass) pro prohlížení databáze.
Jako vývojové prostředí můžeš použít třeba [Atom](https://atom.io/).
Pro jednoduchou práci s Gitem si nainstaluj ještě například [TortoiseGit](https://tortoisegit.org/), nebo podobný program.

Pokud máš vše nainstalované, je na čase si připravit adresář pro projekt a stáhnout repositář - pokud máš v plánu přispívat kódem, rovnou si klikni nahoře na tlačítko Fork a postupuj dál se svojí kopií repositáře.

Klikni nahoře na tlačítko Clone or download a zkopíruj si URL adresu repositáře.
Ten si stáhni do nového adresáře pomocí funkce Git Clone (např. TortoiseGit tuto možnost přidává při pravém kliknutí na adresář).

V adresáři se ti objeví stejné soubory, jako můžeš vidět zde v repositáři. Otevři příkazovou řádku (ideálně uvnitř vývojového prostředí) a spusť příkaz `npm install`

Chvilku to bude trvat, tak si zatím jdi pro sušenku - zasloužíš si ji.

Jakmile jsou nainstalovány všechny potřebné balíčky, je potřeba vytvořit soubor s názvem `.env` - nepůjde vytvořit normálně přes Windows rozhraní, protože začíná tečkou, můžeš jej vytvořit z vývojového prostředí a nebo z příkazové řádky pomocí příkazu `echo "" > .env`

Obsah souboru `.env` bude vypadat nějak takto:
```
DB_URL = "mongodb://localhost:27017"
SSL_KEY = ""
SSL_CERT = ""
HTTPS = "false"
DISCORD_TOKEN = ""
LOGIN = "NONE"
SERVERNAME = "Test"
```

Následně se ujisti, že je spuštěna MongoDB a příkazem `node .` spusť server.

Pokud jsi přivítán zprávou "Server spuštěn na portu 3005" pak se ti podařilo úspěšně spustit server. Připojit se na něj můžeš z [eco.leosight.cz](https://eco.leosight.cz) a přepnutím na lokální test server (neměj strach, ostatní jej s výchozím nastavením neuvidí).

Jakékoliv problémy a dotazy určitě směřuj na Discord, ostatní kontributoři ti moc rádi pomohou.

Další informace (o odesílání samotných pull requestů) najdeš v souboru CONTRIBUTING.md, mnoho zdaru!
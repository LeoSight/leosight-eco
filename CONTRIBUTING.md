# Kontribuce

Chceš se podílet na vývoji projektu LeoSight Eco? To je super! :heart:

Tento dokument by ti měl pomoct s celým procesem. Pokud si ale s něčím nevíš rady, neboj se zeptat na našem Discordu.

Stejně tak na Discordu prober s ostatními tvůrci změnu, kterou bys rád provedl. Ještě než se do něčeho pustíš, je dobré vědět, zda podobnou funkci ve hře vlastně chtějí hráči mít a jestli na stejné funkci už nepracuje někdo jiný.

## Proces kontribuce

1. Prober s ostatními na Discordu co chceš v projektu upravit.

2. Vytvoř si tzv. Fork a odešli pull request například podle tohoto českého návodu: https://blog.tomasfejfar.cz/jak-udelat-pullrequest/#jak-na-to

3. Po odeslání pull requestu můžeš opět napsat na Discord a upozornit na něj správce projektu.

Úpravy vždy dělej od nejnovější verze originálního repositáře! Nezapomeň si svůj Fork aktualizovat!

Nezapomeň ve svém commitu vždy zvednout číslo revize v souboru .revision o 1 nebo příslušný počet commitů. Ideálně si nastav pre-commit hook na následující skript a ten to udělá za tebe automaticky:

```
#!/bin/sh
git log master --pretty=oneline | wc -l > .revision
git add .revision
```

## Co se bude dít dál?

Správce projektu zkontroluje tvůj pull request a udělá tzv. code review. Pokud je všechno v pořádku, přidá tvůj kód do hlavního repositáře (této akci se říká merge).

A s příští aktualizací serveru se tebou vytvořené změny projeví ve hře.

## Jak si aktualizovat vlastní Fork?

1. Klikněte pravým tlačítkem na složku ve které máte nainstalován repositár a v TortoiseGit zvolte **Fetch**

2. V okně **Fetch** nastavte Remote na **upstream** a stiskněte OK

3. Následně klikněte znovu na složku s repositářem a v TortoiseGit zvolte **Merge**

4. V okně **Merge** nastavte Branch na **remotes / upstream / master**

5. Následně klikněte znovu na složku s repositářem a v TortoiseGit zvolte **Push**

6. V okně **Push** a v oblasti Ref nastavte Local a Remote na **master**, v oblasti Destination nastavte Remote na **origin**

7. Zkontrolujte váš Fork a měli byste najít informaci **This branch is even with LeoSight:master**, pokud tuto informaci najdete, znamená to že váš Fork byl úspěšně aktualizován
# Shut the Box – Bakken trekken

Een mobiele webapp (PWA) van het dobbelspel **Shut the Box**, bedoeld als drankspel voor een groep vrienden. Volledig in het Nederlands, gemaakt voor landschapsstand op de telefoon, zonder backend en zonder build-stap. Alles draait lokaal in de browser; scores en spelers worden in `localStorage` bewaard.

## Spelidee

- Elke speler speelt één beurt per potje. Tegels 1 t/m 9 beginnen open.
- Gooi met 2 dobbelstenen en sluit 1 of 2 open tegels waarvan de som precies je worp is. Combinaties van 3 of meer tegels tellen niet.
- Is er maximaal 5 op het bord, dan kies je vóór elke worp: 1 of 2 dobbelstenen.
- Ben je vast na een worp met 1 dobbelsteen, dan mag je de 2e dobbelsteen er tegenaan gooien (slepen of tikken). Bij een botsing veranderen beide dobbelstenen van waarde.
- Sluit je alle tegels, dan is dat een **Shut the Box**: restscore 0 en de shutteller gaat omhoog.
- Na alle beurten verliest de speler met de hoogste restscore. Bij gelijkspel volgt een beslisworp (laagste verliest, herhaal bij opnieuw gelijk).
- De verliezer trekt **1 bak + 1 per shut** in het potje.

## Publiceren op GitHub Pages

1. **Repository maken**
   - Ga naar [github.com](https://github.com) en log in.
   - Klik rechtsboven op **+** → **New repository**.
   - Geef een naam, bijvoorbeeld `shut-the-box`, kies **Public** en klik **Create repository**.

2. **Bestanden uploaden**
   - Klik op de pagina van je nieuwe repository op **uploading an existing file** (of **Add file** → **Upload files**).
   - Sleep alle bestanden en mappen uit deze map erin (dus: `index.html`, `style.css`, `app.js`, `game-logic.js`, `sw.js`, `manifest.webmanifest`, de map `icons/` met de drie png's, en eventueel deze `README.md`).
   - Klik onderaan op **Commit changes**.

3. **GitHub Pages aanzetten**
   - Ga in je repository naar **Settings** → links in het menu **Pages**.
   - Kies bij **Build and deployment** → **Source**: **Deploy from a branch**.
   - Kies bij **Branch**: **main** en map **/(root)**, klik **Save**.
   - Na ongeveer een minuut staat de site live op:
     `https://<jouw-gebruikersnaam>.github.io/shut-the-box/`
     (de exacte link verschijnt ook bovenaan de Pages-instellingen).

4. **Delen**
   - Deel die link met je vrienden. Iedereen met de link kan de app openen en spelen; er is geen account of installatie nodig.

## Op het beginscherm zetten

**iPhone (iOS):**
1. Open de link in **Safari**.
2. Tik op de **Deel**-knop (vierkant met pijl omhoog).
3. Kies **Zet op beginscherm** en tik op **Voeg toe**.
4. De app opent nu voortaan volledig scherm, zonder browserbalk.

**Android:**
1. Open de link in **Chrome**.
2. Tik op het **menu** (drie puntjes).
3. Kies **Toevoegen aan startscherm** (of **App installeren**) en bevestig.
4. De app verschijnt als icoontje op je beginscherm.

Draai je telefoon horizontaal: de app speelt alleen in landschapsstand. In portretstand verschijnt de melding "Draai je telefoon".

## Offline gebruik

Bij het eerste bezoek slaat de service worker (`sw.js`) alle bestanden in de cache. Daarna werkt de app ook zonder internet. De cache heeft een versienummer (`stb-cache-v3`): verander je later iets aan de app, verhoog dan dat versienummer in `sw.js` zodat iedereen de nieuwe versie binnenkrijgt.

## Bestanden

| Bestand | Wat het is |
|---|---|
| `index.html` | De app zelf: alle schermen |
| `style.css` | Donker thema met houten tegels |
| `app.js` | Spelstaat, schermen, undo, fysica van de 2e dobbelsteen, geluid (Web Audio API) |
| `game-logic.js` | Pure spellogica (combinaties, restscore, verliezer, beslisworp, bakken) |
| `test-logic.js` | Tests voor de spellogica, draai met `node test-logic.js` |
| `sw.js` | Service worker voor offline gebruik (geversioneerde cache) |
| `manifest.webmanifest` | PWA-manifest (naam, iconen, landscape) |
| `icons/` | App-iconen 192×192, 512×512 en 512×512-maskable |
| `maak-iconen.py` | Script waarmee de iconen zijn gegenereerd (niet nodig voor de site) |
| `README.md` | Dit bestand |

## Technische aantekeningen

- **Opslag:** alles staat onder de sleutel `stb_v1` in `localStorage` (versienummerd, zodat latere wijzigingen niets breken). Een lopend potje wordt na elke zet opgeslagen; bij het opnieuw openen van de app biedt het menu "Doorgaan met potje".
- **Ongedaan maken:** een geschiedenisstapel van staat-snapshots binnen het huidige potje. Na undo wordt een eerder gegooide worp opgeslagen (`pendingRoll`) en nooit opnieuw gerold, dus teruggaan en "beter gooien" kan niet. Undo werkt ook terug over een spelersgrens (bijvoorbeeld een shut of afgeronde beurt ongedaan maken), maar niet tijdens de beslisworp en niet nadat het potje is afgerekend.
- **Tweede dobbelsteen:** vrije beweging met wrijving, stuiteren tegen de rand en botsingsdetectie. Tikken werkt ook (automatische lancering). Geen raak binnen ~5 seconden of tot stilstand gekomen? Dan mag je gewoon opnieuw gooien.
- **Geluid en trillen:** gemaakt met de Web Audio API (geen audiobestanden). De AudioContext start pas na de eerste tik (vereiste van iOS). Trillen gebruikt `navigator.vibrate` met een veilige check; iOS ondersteunt trillen niet en valt dan stilletjes terug. Aan/uit-schakelaars staan in het menu onder Instellingen.
- **Scherm aan:** de Screen Wake Lock API houdt het scherm wakker tijdens een potje; waar die niet bestaat (o.a. oudere iOS), gebeurt gewoon niets.
- **Paden:** alle verwijzingen zijn relatief, dus de app werkt vanuit een submap zoals `https://<gebruikersnaam>.github.io/<repo-naam>/`.

## Testverslag

Zelf getest in Chrome met mobiele landschap-viewports 844×390 en 667×375:

- Scenario 1 (normaal potje, restscores 12 en 7, verliezer trekt 1 bak): geslaagd.
- Scenario 2 (shut + vastlopen op 9, verliezer trekt 2 bakken, shut-speler heeft 0): geslaagd.
- Scenario 3 (gelijkspel, beslisworp, laagste verliest; ook herhaling bij gelijke beslisworp): geslaagd.
- Scenario 4 (worp 6 met open tegels 1,2,3: 1+2+3 geblokkeerd met melding "Maximaal 2 nummers per worp"; logica ook getest in `test-logic.js`): geslaagd.
- Scenario 5 (worp 12: alleen 3+9, 4+8, 5+7): geslaagd via `test-logic.js`.
- Scenario 6 (som ≤ 5: keuze 1/2 dobbelstenen verschijnt; 2e dobbelsteen slepen en tikken; botsing verandert beide waarden): geslaagd.
- Scenario 7 (undo na worp en na sluiten; worp wordt niet opnieuw gerold): geslaagd.
- Scenario 8 (app sluiten en heropenen midden in een potje; "Doorgaan met potje"): geslaagd.
- Scenario 9 (scorebord resetten met bevestiging; spelers blijven, stats weg): geslaagd.
- Scenario 10 (portretstand: melding "Draai je telefoon"): geslaagd.
- Scenario 11 (relatieve paden): gecontroleerd; geen absolute paden in code of manifest. Service worker cachet alle 9 bestanden (geverifieerd in de browser).

Niet kunnen testen:

- **Echte aanraking op een telefoon.** Slepen is getest met muis-pointer-events; touch volgt dezelfde pointer events, maar is niet op een echt apparaat gevoeld.
- **Trillen op iOS/Android** (`navigator.vibrate`) en de **scherm-volledig-standalone PWA-modus** op een echt toestel.
- **Screen Wake Lock** op een echt toestel (alleen de aanwezigheid van de nette fallback is getest).
- **Geluid** is in code opgebouwd met de Web Audio API en start pas na een gebruikerstik; in de headless testbrowser is niet gehoord of het op een telefoon goed klinkt.

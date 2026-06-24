# Kiipeily Treeni Appi

Kiipeilyn harjoittelusovellus — treenipäiväkirja boulderointiin ja köysikiipeilyyn.

## Kuvaus

Sovellus kiipeilytreenien seurantaan. Nykyisten kiipeilypäiväkirjojen suurin puute on,
ettei toistettuja nousuja tai yritysten määriä saa kirjattua kunnolla. Tämä sovellus
korjaa sen: treenin aikana voit napauttaa vaikeusasteen ja kirjata **send**in (myös
toistot, esim. 3× 6B), tai vaihtaa **projecting**-tilaan ja laskea yritykset
keskeneräiseen nousuun. Projekti voidaan lähettää samassa sessiossa tai sen yritykset
voivat kertyä useamman session yli, kunnes se lähtee.

Sessiot tallennetaan päivämäärällä ja niitä selataan timelinellä, mukana perustilastot
(grade pyramid + volyymi). Myös oheisharjoittelu (voima/kestävyys) voidaan kirjata
toissijaisena ominaisuutena.

## Tila

**MVP toteutettu** — sovellus on rakennettu suunnitelman mukaan, kääntyy/bundlaantuu ja
siitä saadaan rakennettua asennettava **Android-APK** (debug-allekirjoitettu, sideload).
Katso **[PLAN.md](PLAN.md)** koko suunnitelma (tietomalli, näkymät, toteutusvaiheet ja
verifiointi), **[CLAUDE.md](CLAUDE.md)** tekninen stack + projektin rakenne ja
**[BUILD.md](BUILD.md)** ajo-/buildausohjeet (mm. APK ja JDK 17 -vaatimus).

### Keskeiset päätökset

- **Alusta:** React Native ([Expo](https://expo.dev), managed) + TypeScript — natiivi mobiilisovellus.
- **Tallennus:** vain laitteella, **offline-first**, yksi laite, ei pilveä eikä tilejä.
- **Lajit:** boulderointi ensin, lisäksi ranskalainen sport-kiipeily.
- **Asteikot:** Font ja V (Font oletuksena), Font↔V-muunnos; sportissa ranskalainen asteikko.
- **Kieli:** suomenkielinen käyttöliittymä, kiipeilytermit englanniksi (projecting, flash, send).

### MVP

- Sendien kirjaus vaikeusasteen mukaan (+ toistot)
- Projecting-tila ja yritysten laskenta
- Sessiot + timeline
- Perustilastot (grade pyramid, volyymi)
- Oheisharjoittelu
- Muokkaus/undo
- JSON-vienti/-tuonti (varmuuskopiointi)

## Kehitys

Stack: **Expo (managed) + TypeScript**, expo-router, expo-sqlite + drizzle-orm, zustand.

```sh
npm install            # asenna riippuvuudet
npx expo start         # käynnistä, avaa Expo Go -sovelluksella tai simulaattorissa
npm test               # yksikkötestit (asteikot + tilastot)
npm run typecheck      # tsc --noEmit
```

Android-APK:n rakentaminen ja asennus puhelimeen: katso **[BUILD.md](BUILD.md)**
(huomaa **JDK 17 -vaatimus** — buildi kaatuu JDK 23:lla).

> Huom: jos `npm`/`npx` valittaa puuttuvasta `package.json`:sta, käytä etuliitettä
> `npm_config_workspaces=false` (globaali `~/.npmrc` asettaa `workspaces=true`).

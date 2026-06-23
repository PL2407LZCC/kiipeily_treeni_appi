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

**Suunnitteluvaihe** — toteutusta ei ole vielä aloitettu. Vaatimukset ja tekninen
suunnitelma on lyöty lukkoon; katso **[PLAN.md](PLAN.md)** koko suunnitelma (tietomalli,
näkymät, toteutusvaiheet ja verifiointi).

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

Tekninen stack ja ajokomennot tarkennetaan, kun projekti on skaffattu (ks. PLAN.md,
toteutusvaihe 1). Suunniteltu ajo: `npx expo start` ja avaus Expo Go ‑sovelluksella.

# Jak se zadávají mapy – předávka pro kolegu

Výcuc z reálných zadání map, která reportéři posílají do sdílené schránky grafiky zpravodajství TV Nova (`grafikatn@nova.cz`).

**Z čeho to je:** asi 45 zadání map a jejich oprav z období 3.–24. 11. 2026 (hledáno „mapa“ / „mapu“). U části jsem četl celý mail, u části jen úvodní výpis. Otevřel jsem tři přílohy (referenční obrázky). Starší pošta než 3. 11. do vzorku nevstoupila. Kde něco jen odhaduji, je to označeno *(odhad)*.

**Rozsah:** jen mapy na zakázku. Šablonové mapy počasí (srážková, teplotní) jsou jiná rutina a tady nejsou.

---

## 1. Jak zadání vypadá

Volný text v mailu, žádný formulář. Bývá krátké (2–8 řádků), často z mobilu, bez diakritiky, s překlepy. Typická kostra:

```
Prosím o mapu <území>, vyznačit <co>.
Název: <titulek grafiky>
Zdroj: <zdroj dat>
Nick / Zkratka / Uložit pod: <3 písmena reportéra>
```

| Pole | Jak ho píšou | Poznámka |
|---|---|---|
| **Titulek** | „Název:“, „Nadpis:“, „nadpis může být…“ | Chybí asi ve třetině zadání. Grafik se doptává („Pošli mi prosím ještě nadpis“). Reportér ho někdy dodá dalším mailem sám. |
| **Zdroj** | „Zdroj:“, „zdroj;“ | Jen u datových map (ŘSD, MZd, SZÚ, GIE AGSI…). U lokalizačních map obvykle není. |
| **Nick** | „Nick: cze“, „Zkratka stu“, „Uložit pod AKO“, „pod maj“, jen podpis „pev“ | 3 písmena, pod kterými se grafika ukládá. Někdy jen v předmětu mailu. |
| **Pořad** | „do TN“, „do večerních TN“, „do Střepin“, v předmětu „PN“, „PTN“ | Často jen v předmětu. |
| **Území** | „mapu ČR“, „mapu Evropy“, „mapu světa“, „mapu Polska“, „mapy části Prahy“ | Někdy chybí a plyne jen ze seznamu míst. |
| **Co vyznačit** | seznam míst, hodnoty, úseky, tučně zvýrazněná slova | Viz typy níže. |
| **Statická / nájezd** | „jen statický přehled bez nájezdu“, „najížděcí mapu“, „takovou tu přibližovací mapu“ | Když to reportér neřekne, není to ze zadání poznat. |
| **Podklad** | příloha, odkaz na Google Maps / mapy.com / článek / datový web | „viz příloha“ je časté – bez přílohy zadání nejde splnit. |
| **Kontext** | „K textu:“, „Bude popisovat:“, „potřebuji to k tomuto asynchronu:“ + věta z reportáže | Říká, co má mapa divákovi ukázat. Někdy je to jediné zadání. |

**Předmět mailu nese informaci a nedá se ignorovat.** Příklady: `MAPA tn maj`, `pic-tn-mapa-polsko`, `Střepiny, pev, mapa`, `grafika do TN, pok`, `mapa pro klm do TN`, `jaz nvs parkovani prosim prekreslit tuto mapu i s` (zadání začíná už v předmětu). Některé maily předmět nemají vůbec.

### Zkratky pořadů
- **TN** – Televizní noviny (večerní, „večerky“)
- **PTN** – Polední Televizní noviny
- **OTN** – Odpolední Televizní noviny
- **NVS** – Na vaší straně
- **Střepiny** (`str`), **Víkend** (`vik`) – zkratky v názvech souborů *(odhad)*
- `PN`, `za512`, `oiw` – ve vzorku se objevují, význam neznám

---

## 2. Typy map, které chodí

### A) Lokalizační mapa – body na mapě
Nejčastější typ. Území + seznam míst.

- „Na mapě prosím vyznačit tyto místa: Ostrava, Litvínov, Praha“ (titulek až na dotaz)
- „mapu Vietnamu a tam vyznačit dva parky“
- „mapu Polska a zakreslení těchto míst, kam dopadly rakety/drony“ + ikona ohně u míst
- „železniční mapu… vyznačit důležité železniční uzly“
- „mapy části Prahy a dvou poboček České pošty na ní“ (adresy)
- pobočky agentury z webu: „stačí mapa, nějaké body a názvy míst – stačí město, stát nemusí být“

Místa bývají malé obce a cizí názvy (Branžež, Mołodycz, Ostrowiec Świętokrzyski) – geokódovat, ne hádat.

### B) Datová mapa – čísla ve státech, krajích, městech
- hodnoty u států: „Česko: 26,6 / Slovensko: 43,5 / Rakousko: 52 …“
- kraje ČR s čísly z fotky v příloze a s ručně předepsanými barvami („Olomoucký tmavě rudou, sytě červenou…, žlutou Prahu a Plzeňský, vše ostatní oranžovou“)
- „mapu ČR, aby u každého města bylo číslo viz příloha“
- **jen barevná škála, čísla jen u vybraných zemí:** „Hodnoty bych chtěla znázornit pouze tou barevnou škálou, konkrétní čísla prosím jen u ČR, Německa, Slovenska a Ukrajiny“ (data: odkaz na web)
- **škála s legendou po pásmech:** „aby nebylo v mapě příliš mnoho čísel, prosím o legendu s barevnou škálou od: méně než 2 % …“

Doplňující přání: odstíny („v červených odstínech“), jednotky u čísel místo v titulku.

### C) Zvýraznění území
- „mapu ČR, na ní zvýraznit kraje: Praha, Jihočeský a Jihomoravský“ + ikony ke krajům (památky, příroda, víno)
- „dva kraje zmiňované v asynchronu… zvýrazněné, např. červeně obkreslenou hranicí“
- „mapu Česka s vyznačením Moravskoslezského kraje a dva vyskakující sloupce z něj“ (dvě hodnoty v Kč) – mapa + graf
- mapa světa: „VB zbarvit jako vlajku VB, ostatní státy červeně a doprostřed korunku“ (seznam států odkazem na obrázek)
- **volební mapy USA:** státy podle výsledku, odkaz na mapu CNN / ABC; později doplnit do rohu počty za strany, „státy, kde se nevolilo, šedě, nerozhodnuto žlutě a přidat popisek“

### D) Liniové prvky – silnice, tratě, ulice
- dálnice: „celou trasu dálnice krajem s již hotovými úseky a ty úseky, o kterých budeme mluvit, zvýraznit… a datum k tomu“ + seznam úseků s termíny, Název, Zdroj
- železnice: „železniční mapu ČR… a tam vyznačit“ + seznam tratí
- ulice ve městě: „dvě ulice v Brně… bude tam výluka tramvají“
- trasy průvodů Prahou – několik linií, které se mají spojit

### E) Toky a šipky mezi místy
- „zakreslíme Německo, Rakousko, Řecko, Dánsko a Nizozemsko. Z nich povedou čáry s obrázkem lidí do Rwandy“
- „mapu světa, dvě místa – Fidži a Madagaskar. Z nich půjdou šipky do Česka, přesněji do obce Chotovice“

### F) Trasa
- dvě města spojit „trasou auta s údajem 150 km“
- trasa přes oceán s lodičkou a délkou v km (referenční mapa v příloze)
- vstup a výstup osoby ve městě (dvě ulice), podklad v příloze
- **vzdušná čára vs. skutečná trasa:** první zadání chtělo „vzdálenost (leteckou trasu)“, oprava pak „znázornění skutečné trasy (pěšmo)“ + piktogram pošťačky. Tohle je dobré si ujasnit předem.

### G) Nájezd / zoom (animace)
- „mapu, která by ukazovala Pobaltí a pak by se přiblížila k Narvě… může tam být i název města na druhé straně“
- „mapu Polska a najet na toto náměstí“
- „mapu ČR a nájezd na Valašské Meziříčí… v druhém kroku…“ (vícekroková animace)
- „zoom-in na mapách Google. Vyznačit území Ukrajiny a poté špendlíkem označit…“
- zoom na budovu v Praze, „klidně i 3D street model“, „mohou trvat klidně 15 sekund“
- „ke každému městu zvlášť mapu, kde bude nájezd… jako jingle“ – 6 měst = 6 výstupů
- **jen věta z reportáže:** „takovou tu přibližovací mapu… k tomuto asynchronu: vodní nádrž Švihov…“ – místo je potřeba vyčíst z textu

Jedno zadání může kombinovat statickou mapu a nájezd jako dva kusy.

### H) Překreslení dodané mapy
- „Mapka, název: …, viz příloha“
- „prosím překreslit tuto mapu i s…“ + tabulka
- odkaz na článek cizího média: „potřebovala bych ji zpracovat… vyznačit důrazně, co je uzavřené“
- reportérka si mapu vyrobila sama (v názvu výstupu `infogram`) a chce jen doplnit zvýraznění

### I) Mapa jako součást jiné grafiky
- grafika do stand-upu: název klipu + timecode („turismus-stup-cze, čas 00:38“), mapa do volného místa
- mapa jako jeden bod číslovaného seznamu vedle jinglů, schémat a printscreenů – **jeden mail = víc grafik**
- položka v seznamu podkladů do pořadu („případně mapu sucha“ + odkaz)

---

## 3. Co je v přílohách

Otevřel jsem tři referenční obrázky. Co z nich plyne:

- **Příloha bývá hotová mapa, ne surová data.** Dvě ze tří vypadaly jako čistě vygenerované mapy ČR: jedna s třemi body a popisky (obec + okres + poznámka), druhá kartogram krajů s procenty.
- **Titulek a zdroj mohou být jen v obrázku.** Kartogram měl nadpis i „Zdroj:“ přímo v sobě; mail říkal jen „viz příloha včetně nadpisů a zdroje“. Text mailu sám nestačí.
- **Hodnoty je nutné opsat z obrázku** (14 krajů × číslo). To je místo, kde vzniká chyba – po opsání zkontrolovat proti obrázku.
- **Reference může být cizí grafika** v jiném stylu a jazyce (francouzské popisky, výřez s detailem cíle). Slouží „orientačně“: převzít obsah, ne vzhled, a popisky počeštit.

---

## 4. Co se děje po zadání

1. **Chybí titulek** → grafik se ptá. Nejčastější dotaz.
2. **Reportér změní zadání** po první verzi: zúžení, jiný titulek, přepsaná čísla, jiná logika (vzdušná čára → skutečná trasa). Předměty typu `ZMĚNA - …`, `TN DOPLNENI …`, `Oprava mapy`, `prosím o opravu grafiky mapy`.
3. **Oprava odkazuje na název souboru** první verze („prosím o opravu této mapy: mapa-jkr-gfx-261116“).
4. **Úpravy vzhledu:** jiná škála, jednotky k číslům, přidat mezikrok, doplnit počitadlo do rohu, piktogram.
5. **Pravopis a názvy:** „Kavčí hory s malým h“, „Vratislavi s měkkým i“. Část zadání jde v kopii na `korektor@nova.cz`.
6. **Znovupoužití:** „tuhle mapu i do TN, jen trochu rychlejší“ – stejná mapa pro jiný pořad s jiným tempem.
7. **Věcná kontrola od grafika:** když zadání nedává smysl, grafik se ptá (která budova, jaký údaj).
8. **Označení AI:** u grafiky vytvořené pomocí AI se řešilo logo AI a soubor dostal prefix `AI-`. Jestli to platí i pro mapy, ve vzorku není *(odhad: ano)*.

Hotovou grafiku grafik hlásí odpovědí, ve které je jen **název souboru**; reportér si ji najde ve střižně.

---

## 5. Pojmenování výstupů

```
mapa-potok-Maj-gfx-261122
mapa-vietnam-cze-gfx-261121
mapa-KAP-procenta-gfx-opr-261121
mapa-hagibor-kap-gfx-str-261121
mapa-parkovani-gfx-nvs-jaz-261123
mapa-OPR-jkr-gfx-261117
mapa-kanal-BRZ-gfx-261107
mapa-svet-brz-GFX-261106   /   mapa-svet-2-brz-GFX-261106
Opr-mapa2-apr-gfx-tn-261104
zeleznice-klm-uzly-gfx-261118
dalnice-brz-useky-gfx-261118
```

Části (pořadí ani velikost písmen nejsou pevné):

- `mapa` nebo téma (`zeleznice`, `dalnice`)
- krátký popis (`potok`, `kanal`, `svet`), u více kusů číslo (`-2`)
- **nick reportéra** – 3 písmena
- `gfx`
- někdy pořad: `tn`, `nvs`, `str`, `vik`
- `opr` / `OPR` u opravené verze
- datum `RRMMDD` na konci

---

## 6. Doporučený postup při čtení zadání

1. **Přečíst předmět i tělo.** Nick, pořad nebo začátek zadání bývají jen v předmětu.
2. **Rozdělit mail na jednotlivé grafiky.** Mapy řešit, zbytek předat dál.
3. **Určit typ** (A–I). Vodítka: „vyznačit místa“ → A; čísla, škála, legenda → B; „zvýraznit kraj/stát“ → C; úseky, tratě, ulice → D; „šipky“, „čáry do“ → E; „trasa“, km → F; „nájezd“, „přiblížit“, „zoom“ → G; „překreslit“, „viz příloha“ → H.
4. **Vytáhnout pole:** území, položky (+ hodnoty, barvy, ikony, data), titulek, zdroj, nick, pořad, statická/nájezd, délka, podklady.
5. **Otevřít přílohy a odkazy.** Titulek, zdroj i data mohou být jen tam.
6. **Ověřit úplnost a doptat se**, když chybí: titulek; data, na která zadání odkazuje; nick (není-li ani v předmětu); u trasy, jestli vzdušnou čarou, nebo po cestě; statická, nebo nájezd.
7. **Nedomýšlet fakta.** Čísla, názvy, barvy jen ze zadání a podkladů. Co si má grafik dohledat sám (odkaz na katalog, web), poslat reportérovi k potvrzení.
8. **Hlídat pravopis** místních názvů (diakritika, cizí názvy, česká exonyma) a jednotek.
9. **Počítat s druhým kolem.** Zachovat nick, přidat `opr`, odkazovat na název první verze.

---

## 7. Co dalšího je ve schránce k mapám

- **Interní nástroj „TN mapa“:** 12. 11. 2026 poslal vedoucí grafiky zpravodajství grafikům odkaz na „novou TN mapu“ (`tnmap.pages.dev`) s instruktážním videem; připomínky se mají psát do Teams. Nástroj jsem neotvíral – co umí a které typy map pokrývá, je potřeba zjistit u něj.
- V jedné odpovědi grafička zmiňuje, že tým „už testuje Clauda AI“.

## 8. Co ve vzorku není a je potřeba ověřit

- Vizuální standard map (barvy, font, podklad) – ze zadání neplyne.
- Technický formát výstupu (v názvech se objevuje `.mxf`, víc nevím).
- Význam `PN`, `za512`, `oiw`, a přípony `x` v názvu souboru.
- Jak se rozhoduje statická vs. animovaná mapa, když to reportér neřekne.
- Období před 3. 11. 2026 a zadání, která slovo „mapa“/„mapu“ neobsahují (např. jen „mapka“, „nájezd na…“).

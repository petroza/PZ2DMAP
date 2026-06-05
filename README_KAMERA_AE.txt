PZ MAP — keyframy kamery + export do After Effects
====================================================

ZMĚNA: AE export je teď JEDNO zaškrtávátko u tlačítka Export video
------------------------------------------------------------------
Samostatné tlačítko "AE skript" je pryč (svádělo k tomu zapomenout
vyrenderovat video). Nově:

  Záložka Export → zaškrtni "Také skript pro After Effects (.jsx)"
  → klikni "Export video".

Video i .jsx skript se vyrobí NAJEDNOU a dostanou STEJNÝ název, takže si
v After Effects video samo najde. Oba soubory spadnou do složky Stažené.

JAK NAPOJIT VIDEO V AFTER EFFECTS
---------------------------------
1. Dej .jsx i video do JEDNÉ složky (po stažení jsou obě v Downloads se
   stejným názvem — nech je tam, nebo je přesuň spolu).
2. AE → File > Scripts > Run Script File... → vyber .jsx.
3. Skript video automaticky naimportuje. Kdyby ho nenašel (jiný název/složka),
   POŽÁDÁ TĚ o jeho výběr v dialogu — vyber soubor a je to.
   (Když ani pak nic nevybereš, vloží placeholder, který nahradíš ručně.)

POZN. k formátu: když prohlížeč neumí MP4 napřímo, export udělá místo videa
ZIP s PNG sekvencí (+ ffmpeg skript). To není přehrávatelný soubor — buď
z něj nejdřív sestav MP4 (přiloženým ffmpeg skriptem) a ten pak ve výběrovém
dialogu vyber, nebo zvol formát WebM (ten vždy vznikne jako jeden soubor).

CO SKRIPT V AE VYTVOŘÍ
----------------------
- Kompozici v rozlišení a FPS exportu, s tvým videem jako spodní vrstvou.
- 3D kameru "MAP_CAM" (volitelná).
- Trackovací NULL "MAP_TRACK_CAR" — přesně kopíruje objekt po trase:
  POZICE (kudy jede po obraze), NATOČENÍ (kam míří), MĚŘÍTKO (jak se přibližuje).
- Pro každou ikonu na mapě další NULL "MAP_TRACK_1, 2, ...".

Napojení vlastního 3D autíčka (GLB):
1. Naimportuj GLB do Elementu 3D (Video Copilot) na nové vrstvě, nebo použij
   nativní 3D vrstvu.
2. Tuto vrstvu PARENTUJ na "MAP_TRACK_CAR" (sloupec Parent & Link).
3. Objekt jede po cestě, otáčí se podle směru a zvětšuje se s přiblížením mapy.
   Dle výchozí orientace modelu případně přidej konstantní offset k natočení.

MANUÁLNÍ ANIMACE KAMERY (KEYFRAMY) — beze změny
-----------------------------------------------
Animace → Kamera → režim "Manuální": najeď na záběr, "Přidat klíč", opakuj.
Kamera klíči po spuštění plynule prolétne, rovnoměrně po délce animace.
Režimy Přelet a Zoom (start + cíl) fungují dál. Vše se ukládá do projektu.

OVĚŘENÍ / OMEZENÍ
-----------------
- Trackovací data jsou počítaná ze stejné projekce jako render videa => NULL
  sedí na pixel přesně tam, kde je objekt ve videu (i při zoomu/náklonu/otočení).
- NULL je 2D (poloha na obraze). Pro mapy shora ideální; u silně nakloněné mapy
  je poloha přesná, dokonalou 3D perspektivu modelu doladíš v Elementu 3D.
- Skript je syntakticky ověřený, ale spuštění v AE vyzkoušej na krátké animaci
  (chování pluginů se liší dle verze AE).

NASAZENÍ NA FTP (jen aktualizace)
---------------------------------
Stačí nahradit index.html a TN_map. map_data/ NEPŘEPISUJ, pokud máš na
serveru novější uložené projekty.

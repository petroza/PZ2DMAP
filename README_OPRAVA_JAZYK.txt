PZ MAP — oprava: popisky mapy v češtině hned po načtení
========================================================

CO BYLO ŠPATNĚ
--------------
Po otevření mapy byla sice nastavená čeština (a česká vlajka), ale popisky na
mapě byly anglické (např. "Prague" místo "Praha"). Spravilo se to až po
kliknutí na českou vlajku.

PŘÍČINA
-------
Jazyk popisků se nastavoval jen hned po startu a ještě jednou po 120 ms.
Při pomalejším (studeném) načtení mapy po síti ale podklad nebyl do 120 ms
hotový, takže se nastavení "propadlo" a popisky zůstaly výchozí (anglické).
Kliknutí na vlajku zavolalo nastavení později, kdy už byla mapa hotová.

OPRAVA
------
Jazyk popisků se teď sám dotáhne ve chvíli, kdy je mapa skutečně připravená
(událost "idle"), nezávisle na rychlosti sítě. Navíc se aplikuje i pro výchozí
češtinu hned po startu. Takže "Praha" je správně už při prvním zobrazení,
bez nutnosti klikat na vlajku.

(Ostatní funkce — keyframy kamery i AE export — beze změny.)

NASAZENÍ
--------
Nahraď index.html a TN_map. map_data/ nech být, pokud máš na serveru novější data.

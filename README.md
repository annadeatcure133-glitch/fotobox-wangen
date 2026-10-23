# fotobox-wangen.de

Die Website der Fotobox-Vermietung von Janis Schorer (Ad-Motion) in
Wangen im Allgaeu. Eine einzelne statische Seite, kein Framework,
kein Bauschritt.

    index.html   die komplette Seite: Markup, Stile und Skript in einer Datei
    img/         Bilder, Video und Logo
    LIESMICH.txt Aenderungsstand und Hinweise zum Veroeffentlichen

## Veroeffentlichen

Dieses Repository haengt am Vercel-Projekt `fotobox-live`. Jeder Push
auf `main` loest eine Produktionsveroeffentlichung aus; die Domains
www.fotobox-wangen.de und fotobox-wangen.de bleiben dabei unberuehrt.

Vercel darf hier nichts bauen: Framework-Voreinstellung "Other", kein
Build Command, Output Directory leer. Die Seite wird so ausgeliefert,
wie sie hier liegt.

## Externe Bestandteile

Die Seite laedt drei Bibliotheken von cdnjs (three.js, GSAP,
ScrollTrigger) und die Schrift IBM Plex Mono von Google Fonts. Beides
ist in Punkt 4 der Datenschutzerklaerung genannt. Laedt eines davon
nicht, faellt die Seite auf eine ruhige Fassung zurueck: Impressum,
Datenschutzerklaerung und AGB haengen dann als aufklappbare Abschnitte
vor dem Footer, und Anrufen, WhatsApp und Anfragen bleiben erreichbar.
Wer daran etwas aendert, prueft diesen Rueckfallweg mit.

## Was beim Aendern zu beachten ist

Die Rechtstexte stehen genau einmal im Quelltext, in der Konstante
`LEGAL` in index.html. Die Schubladen und der Rueckfallweg lesen beide
daraus. Nie eine zweite Abschrift anlegen.

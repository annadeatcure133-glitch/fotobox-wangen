# fotobox-wangen.de

Die Website der Fotobox-Vermietung von Janis Schorer (Ad-Motion) in
Wangen im Allgaeu. Eine einzelne statische Seite, kein Framework,
kein Bauschritt.

    index.html       die komplette Seite: Markup, Stile und Skript in einer Datei
    img/             Bilder, Video und Logo
    api/anfrage.js   nimmt das Formular entgegen und verschickt die Mail
    vercel.json      haelt die Funktion in Frankfurt
    LIESMICH.txt     Aenderungsstand und Hinweise zum Veroeffentlichen

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


## Das Anfrageformular

Das Formular schickt an `/api/anfrage`. Die Funktion meldet sich bei
`smtp.strato.de` (Port 465, SSL/TLS) mit dem Postfach
anfrage@fotobox-wangen.de an und legt die Anfrage dort ab. Der Besucher
braucht kein Mailprogramm mehr.

Dafuer muessen in Vercel unter Settings - Environment Variables zwei
Werte stehen, fuer Production, Preview und Development:

    MAIL_BENUTZER   anfrage@fotobox-wangen.de
    MAIL_PASSWORT   das Postfach-Passwort

Optional `MAIL_AN`, falls die Anfragen woandershin sollen als an das
Postfach, ueber das verschickt wird.

Fehlt MAIL_PASSWORT, antwortet die Funktion mit einem Fehler und die
Seite faellt auf den alten Weg zurueck: WhatsApp und Mailprogramm,
beides fertig ausgefuellt. Es geht also nie etwas verloren -- aber der
bequeme Weg fehlt, bis der Wert gesetzt ist.

`vercel.json` haelt die Funktion mit `"regions": ["fra1"]` in
Frankfurt. Ohne diese Zeile laeuft sie in Washington, und dann stimmt
Punkt 3 der Datenschutzerklaerung nicht mehr. Nicht entfernen.

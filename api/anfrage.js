/**
 * Nimmt eine Anfrage vom Formular entgegen und legt sie in Janis' Postfach.
 *
 * Warum es diese Funktion gibt
 * ----------------------------
 * Vorher baute die Seite einen mailto:-Link. Der reicht alles an das
 * Mailprogramm weiter, das auf dem Geraet als Standard eingetragen ist --
 * und ist keines eingetragen, passiert nichts. Kein Fehler, keine Meldung.
 * Am Rechner trifft das jeden, der seine Mail im Browser liest. Die Anfrage
 * verschwand lautlos, und der Besucher dachte, er haette abgeschickt.
 *
 * Jetzt verschickt der Server. Angemeldet wird sich bei smtp.strato.de mit
 * genau dem Postfach, das es ohnehin gibt (anfrage@fotobox-wangen.de) --
 * es ist also kein weiterer Dienstleister beteiligt, und am Datenfluss in
 * der Datenschutzerklaerung aendert sich nichts Grundsaetzliches.
 *
 * Wichtig: Der Absender MUSS das angemeldete Postfach sein. STRATO weist
 * Mails zurueck, deren Absender nicht zum Konto gehoert. Die Adresse des
 * Anfragenden steht deshalb im Antwort-An, nicht im Von.
 *
 * Die Funktion laeuft in Frankfurt, nicht in Washington -- siehe
 * vercel.json. Ohne diese Zeile liefe sie in den USA, und das waere etwas
 * anderes, als in der Datenschutzerklaerung steht.
 */

import nodemailer from 'nodemailer'

const POSTFACH = process.env.MAIL_BENUTZER || 'anfrage@fotobox-wangen.de'
const PASSWORT = process.env.MAIL_PASSWORT
const AN = process.env.MAIL_AN || POSTFACH

/* STRATO empfiehlt fuer Mailprogramme ausdruecklich 465 mit SSL/TLS;
   587 ist dort fuer Server-Relay gedacht. Nachgesehen am 23.10.2026:
   strato.de/faq/mail/e-mailserver-adressen-ports-ssl-tls/ */
const SERVER = { host: 'smtp.strato.de', port: 465, secure: true }

/* Eine einfache Bremse. Serverlos lebt das nur, solange die Instanz warm
   ist -- gegen einen entschlossenen Angreifer hilft das nicht, gegen die
   Bots, die offene Formulare absuchen, sehr wohl. Mehr Aufwand waere fuer
   diese Seite nicht angemessen. */
const zuletzt = new Map()
const SPERRE_MS = 20000
const GEDAECHTNIS = 500

function zuSchnell(ip) {
  const jetzt = Date.now()
  if (zuletzt.size > GEDAECHTNIS) {
    for (const [k, t] of zuletzt) if (jetzt - t > SPERRE_MS) zuletzt.delete(k)
  }
  const vorher = zuletzt.get(ip)
  zuletzt.set(ip, jetzt)
  return vorher !== undefined && jetzt - vorher < SPERRE_MS
}

const kurz = (w, max) => String(w ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max)

function antwort(daten, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') return antwort({ ok: false, grund: 'methode' }, 405)

    let d
    try { d = await request.json() } catch { return antwort({ ok: false, grund: 'format' }, 400) }

    /* Das Feld "webseite" ist im Formular unsichtbar. Menschen fuellen es
       nicht aus, Bots fuellen alles aus. Wer es ausfuellt, bekommt ein
       freundliches Ja und seine Mail wird nicht verschickt -- ein "Nein"
       wuerde dem Bot nur verraten, wie er es beim naechsten Mal besser
       macht. */
    if (kurz(d.webseite, 40)) return antwort({ ok: true })

    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unbekannt'
    if (zuSchnell(ip)) return antwort({ ok: false, grund: 'zu-schnell' }, 429)

    const name = kurz(d.name, 80)
    const kontakt = kurz(d.kontakt, 120)
    if (!name || !kontakt) return antwort({ ok: false, grund: 'pflichtfeld' }, 400)
    if (d.agb !== true) return antwort({ ok: false, grund: 'agb' }, 400)

    const paket = kurz(d.paket, 60) || 'noch offen'
    const anlass = kurz(d.anlass, 40) || 'eure Feier'
    const datum = kurz(d.datum, 40) || 'noch offen'
    const ort = kurz(d.ort, 80) || '–'
    const nachricht = kurz(d.nachricht, 2000)

    if (!PASSWORT) {
      console.error('[anfrage] MAIL_PASSWORT fehlt — in Vercel unter Settings › Environment Variables eintragen')
      return antwort({ ok: false, grund: 'nicht-eingerichtet' }, 500)
    }

    const text =
      'Neue Anfrage über fotobox-wangen.de\n\n' +
      'Anlass:   ' + anlass + '\n' +
      'Paket:    ' + paket + '\n' +
      'Datum:    ' + datum + '\n' +
      'Ort:      ' + ort + '\n' +
      'Name:     ' + name + '\n' +
      'Kontakt:  ' + kontakt + '\n' +
      (nachricht ? '\nNachricht:\n' + nachricht + '\n' : '') +
      '\n— Diese Mail hat das Formular auf fotobox-wangen.de verschickt.\n' +
      'Antworten geht direkt: die Adresse des Anfragenden steht im Antwort-An.\n'

    try {
      const post = nodemailer.createTransport({
        ...SERVER,
        auth: { user: POSTFACH, pass: PASSWORT },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      })
      await post.sendMail({
        from: { name: 'Fotobox Wangen — Anfrage', address: POSTFACH },
        to: AN,
        /* Nur eine echt aussehende Adresse ins Antwort-An. Stand da eine
           Telefonnummer, waere die Mail unzustellbar. */
        replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kontakt) ? kontakt : undefined,
        subject: 'Fotobox-Anfrage – ' + anlass + (datum !== 'noch offen' ? ' am ' + datum : ''),
        text,
      })
      return antwort({ ok: true })
    } catch (err) {
      /* Kein Passwort und keine Besucherdaten ins Protokoll. */
      console.error('[anfrage] Versand fehlgeschlagen:', err && err.code, err && err.responseCode)
      return antwort({ ok: false, grund: 'versand' }, 502)
    }
  },
}

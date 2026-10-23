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

/* Rundherum abgeschnitten. Beim Einfuegen in ein Eingabefeld haengt
   schnell ein Leerzeichen oder ein Zeilenumbruch hinten dran, und STRATO
   antwortet darauf mit demselben 535 wie auf ein falsches Passwort --
   man sucht dann stundenlang am falschen Ende. Ein Passwort, das
   absichtlich auf ein Leerzeichen endet, waere ohnehin keines. */
const sauber = (w) => String(w ?? '').trim()

const POSTFACH = sauber(process.env.MAIL_BENUTZER) || 'anfrage@fotobox-wangen.de'
const PASSWORT = sauber(process.env.MAIL_PASSWORT)
const AN = sauber(process.env.MAIL_AN) || POSTFACH

/* Zwei Anlaeufe, in dieser Reihenfolge.
   STRATO nennt 465 (SSL/TLS) den Weg fuer gewoehnliche Mailprogramme und
   587 (STARTTLS) den fuer Server-Relay -- und genau ein Relay sind wir
   hier. Welcher von beiden eine Anmeldung aus einem Rechenzentrum
   durchlaesst, steht nirgends; am 23.10.2026 scheiterte 465 im ersten
   Versuch. Also wird der Reihe nach probiert, und der erste, der traegt,
   gewinnt. Mit MAIL_PORT laesst sich einer davon festnageln, sobald klar
   ist welcher.
   Nachgesehen: strato.de/faq/mail/e-mailserver-adressen-ports-ssl-tls/ */
const HOST = process.env.MAIL_HOST || 'smtp.strato.de'
const WEGE = process.env.MAIL_PORT
  ? [{ host: HOST, port: Number(process.env.MAIL_PORT), secure: Number(process.env.MAIL_PORT) === 465 }]
  : [{ host: HOST, port: 465, secure: true },
     { host: HOST, port: 587, secure: false, requireTLS: true }]

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

    const brief = {
      from: { name: 'Fotobox Wangen — Anfrage', address: POSTFACH },
      to: AN,
      /* Nur eine echt aussehende Adresse ins Antwort-An. Stand da eine
         Telefonnummer, waere die Mail unzustellbar. */
      replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(kontakt) ? kontakt : undefined,
      subject: 'Fotobox-Anfrage – ' + anlass + (datum !== 'noch offen' ? ' am ' + datum : ''),
      text,
    }

    const pannen = []
    for (const weg of WEGE) {
      try {
        const post = nodemailer.createTransport({
          ...weg,
          auth: { user: POSTFACH, pass: PASSWORT },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })
        await post.sendMail(brief)
        console.log('[anfrage] verschickt über Port', weg.port)
        return antwort({ ok: true })
      } catch (err) {
        /* Kein Passwort und keine Besucherdaten ins Protokoll -- nur die
           Kennung, die sagt, woran es lag. */
        const kennung = (err && err.code) || 'unbekannt'
        console.error('[anfrage] Port ' + weg.port + ' gescheitert:', kennung, err && err.responseCode)
        pannen.push(weg.port + ':' + kennung + (err && err.responseCode ? '/' + err.responseCode : ''))
      }
    }
    /* Die Kennungen stehen bewusst in der Antwort: sie verraten nichts
       Schuetzenswertes, ersparen aber das Suchen im Protokoll. */
    /* Die Adresse steht ohnehin im Impressum -- sie hier zu nennen
       verraet nichts und zeigt sofort, ob in MAIL_BENUTZER das Richtige
       steht. Das Passwort selbstverstaendlich nie, auch nicht seine
       Laenge. */
    return antwort({ ok: false, grund: 'versand', wege: pannen, benutzer: POSTFACH }, 502)
  },
}

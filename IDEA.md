# Seconda app: album prog e ascolto su YouTube

Promemoria scritto il 15 novembre 2026 alla fine del lavoro su "Cerca e Guarda" (cartella `..\prima app`), per far partire informata la nuova sessione di Claude Code.

## Chi la usa
Mauro: principiante, scrive in italiano, vuole istruzioni passo passo. Usa l'app su Android, sia da Chrome sia da Brave (in Brave non c'è pubblicità). La userà anche la figlia.

## L'idea
1. L'utente sceglie i filtri: nazione (es. Italia), anni (es. 1970–1990), quanti album (fino a 200), e magari sottogenere e voto minimo.
2. L'app mostra la classifica degli album prog di **ProgArchives** con quei filtri, ognuno con il suo voto (rating).
   - Pagina di partenza: https://www.progarchives.com/top-prog-albums.asp?salbumtypes=1
   - Esempio con la Germania: https://www.progarchives.com/top-prog-albums.asp?ssubgenres=&syears=&salbumtypes=1&scountries=77&sminratings=0&smaxratings=0&sminavgratings=0&smaxresults=100&x=54&y=10#list
3. Tocchi un album e vedi la scaletta dei brani (dalla pagina dell'album su ProgArchives).
4. Tocchi un brano: ricerca mirata su YouTube ("artista – brano") e ascolto dentro l'app.

## Il problema tecnico già verificato
- Il browser **blocca** la lettura diretta delle pagine di ProgArchives (CORS: verificato, "Failed to fetch"). L'app gira solo nel browser, senza server.
- **Strada scelta (A):** far leggere le pagine a Claude tramite l'API (strumento server *web fetch*, che legge dai server di Anthropic) e farsi restituire i dati in forma ordinata (JSON). Si usa la chiave di Claude che ognuno mette nelle Impostazioni, come in Cerca e Guarda.
  - Modello voluto da Mauro: **Haiku 5.5** (`claude-haiku-5-5`). **Da verificare** che Haiku 5.5 supporti il web fetch. Se non lo supporta: Sonnet 5.5, che costa di più (chiedere a Mauro), oppure la strada C.
  - Il web fetch non ha costi a parte, si pagano solo i token. Salvare in memoria (cache) i risultati già scaricati per non pagarli due volte.
- **Prima di costruire:** controllare le regole d'uso di ProgArchives (terms of use / robots.txt). Uso personale e poche richieste.
- **Alternativa (C):** archivi aperti con CORS, come MusicBrainz (`musicbrainz.org/ws/2/...`, verificato che non è bloccato, massimo 1 richiesta al secondo, serve uno User-Agent generico) o Discogs. Non hanno i voti di ProgArchives.
- Scartata (B): un server proprio (Cloudflare Worker). Troppo complicato per Mauro.

## Verifiche fatte il 15 novembre 2026
- **Haiku 5.5 supporta il web fetch** (è nella lista ufficiale dei modelli). Nessun costo a parte, solo token.
- **Ma ProgArchives è protetto da Cloudflare** con una pagina di controllo anti-robot ("Just a moment..."): anche il robots.txt risponde 403 a qualsiasi programma. Il web fetch di Anthropic non esegue JavaScript, quindi quasi certamente verrà bloccato allo stesso modo. Aggirare quel controllo non si fa: il sito chiede di non essere letto in automatico. La strada A va probabilmente scartata.
- MusicBrainz: la ricerca per nazione + anni + tag "progressive rock" dà pochi risultati e poco precisi (es. 13 album italiani anni '70, con dentro i Caravan inglesi). Utilizzabile solo come aiuto, non come classifica.
- Idea alternativa: Mauro apre la classifica di ProgArchives nel suo browser e la **incolla** nell'app (o condivide la pagina), e l'app la legge da lì. Nessun robot, dati veri di ProgArchives.

## Strada scelta: incollare la classifica (15 novembre 2026)
- Mauro apre ProgArchives nel browser, sceglie i filtri lì, copia tutta la pagina e la incolla nell'app ("Ascolta il Prog").
- Lettura del testo: Claude Haiku 5.5 se c'è la chiave (legge anche `chiave_claude` di Cerca e Guarda), altrimenti un lettore semplice in `app.js` (`leggiClassificaDaSolo`) scritto **senza aver visto il testo vero**: da sistemare con un esempio reale.
- Scaletta: MusicBrainz (edizione ufficiale più vecchia), poi Claude a memoria se MusicBrainz non la conosce.
- Brano → ricerca YouTube (4 risultati, salvati per non ripagare la quota) → player con Successivo / passaggio automatico.
- Il contatore della quota usa la stessa chiave `quota_youtube` di Cerca e Guarda (la quota è condivisa).
- Da sapere: il `sw.js` di Cerca e Guarda cancella tutte le cache con un nome diverso dal suo, quindi anche `prog-…`. Online non cambia niente; per l'uso offline andrebbe corretto in `prima app/sw.js`.

## Da riusare da "Cerca e Guarda" (`..\prima app`)
- **Lettore YouTube** incorporato (iframe con enablejsapi, comandi via postMessage), schermo intero e rotazione, contatore delle unità di YouTube: tutto in `app.js` / `style.css`.
- **Stessa chiave di YouTube** (`CHIAVE_PREDEFINITA` in `prima app/app.js`, ristretta al dominio `maurocapoleoni-wq.github.io`): vale anche per la seconda app. Ogni ricerca costa 100 unità su 10.000 al giorno, quota condivisa con Cerca e Guarda.
- **Chiave di Claude**: si inserisce nelle Impostazioni (mai nel codice pubblico). La chiamata è un fetch diretto ad `api.anthropic.com` con l'header `anthropic-dangerous-direct-browser-access: true` (vedi `prima app/claude.js`).
- **Copia di sicurezza** Esporta/Importa (in `prima app/app.js`).
- Stile scuro e app installabile (PWA: `manifest.json` + `sw.js`, network-first).

## Pubblicazione
- Repository GitHub già creato: **maurocapoleoni-wq/seconda-app** (Public, ancora vuoto). Indirizzo futuro: https://maurocapoleoni-wq.github.io/seconda-app/
- Mauro carica i file a mano. **Nella guida spiegare sempre dove cliccare:**
  1. In Chrome aprire github.com/maurocapoleoni-wq/seconda-app, con l'account GitHub già entrato.
  2. Repository vuoto: nel riquadro azzurro "Quick setup", nella frase "Get started by creating a new file or **uploading an existing file**", cliccare le parole blu "uploading an existing file". Repository non vuoto: pulsante **Add file** (accanto al pulsante verde **Code**) → **Upload files**.
  3. Trascinare file e cartelle nel riquadro grande, poi **Commit changes** in fondo.
  4. **Settings** (in alto) → **Pages** (a sinistra) → Branch **main** e **/ (root)** → **Save**. Dopo qualche minuto l'app è online.
  5. Dopo ogni modifica: dire quali file ricaricare e alzare `CACHE` in `sw.js`.
- **Attenzione:** le app su `maurocapoleoni-wq.github.io` condividono il localStorage. Usare **nomi di chiavi diversi** da Cerca e Guarda (es. prefisso `prog_`).
- Serve un QR code nuovo con l'indirizzo della seconda app.

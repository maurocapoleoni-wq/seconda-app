// ---------- Claude: legge la classifica incollata e, se serve, ricorda la scaletta di un album ----------
// La chiave di Claude la inserisce ognuno in Impostazioni: resta solo su quel telefono,
// non è mai scritta nel codice (che su GitHub è pubblico).
// Se è già stata messa in Cerca e Guarda (stesso indirizzo github.io), la usa anche questa app.

const CHIAVE_CLAUDE = 'prog_chiave_claude';
const CHIAVE_CLAUDE_PRIMA_APP = 'chiave_claude';
const MODELLO_CLAUDE = 'claude-haiku-5-5'; // il più economico: basta per leggere e ordinare testo

function leggiChiaveClaude() {
  try { return localStorage.getItem(CHIAVE_CLAUDE) || localStorage.getItem(CHIAVE_CLAUDE_PRIMA_APP) || ''; } catch { return ''; }
}

// Una richiesta a Claude (fetch diretto: l'app è JavaScript semplice nel browser, senza programmi di build)
async function chiamaClaude(corpo) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': leggiChiaveClaude(),
      'anthropic-version': '2026-10-21',
      'anthropic-dangerous-direct-browser-access': 'true', // la chiamata parte dal telefono, con la chiave di chi usa l'app
    },
    body: JSON.stringify({ model: MODELLO_CLAUDE, ...corpo }),
  });
  let dati = {};
  try { dati = await r.json(); } catch {}
  if (!r.ok) {
    const tipo = dati.error?.type || '';
    const messaggio = dati.error?.message || '';
    if (r.status === 401) throw new Error('La chiave di Claude non è valida: controllala in ⚙️ Impostazioni.');
    if (r.status === 402 || tipo === 'billing_error' || /credit/i.test(messaggio)) throw new Error('Il credito di Claude è finito: ricaricalo sul sito della console di Anthropic.');
    if (r.status === 403) throw new Error('Questa chiave non ha il permesso di usare Claude.');
    if (r.status === 429) throw new Error('Troppe richieste in poco tempo: riprova tra un minuto.');
    if (r.status >= 500) throw new Error('Claude in questo momento è sovraccarico: riprova tra poco.');
    const err = new Error(`Errore di Claude (${r.status}): ${messaggio || 'richiesta rifiutata'}`);
    err.status = r.status;
    throw err;
  }
  if (dati.stop_reason === 'refusal') throw new Error('Claude non ha voluto leggere questo testo.');
  return dati;
}

const testoRisposta = (d) => (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');

// Prende il JSON dalla risposta (anche se Claude ci avesse messo del testo intorno)
function jsonDaRisposta(t) {
  try { return JSON.parse(t); } catch {}
  const inizio = t.indexOf('{'), fine = t.lastIndexOf('}');
  if (inizio >= 0 && fine > inizio) {
    try { return JSON.parse(t.slice(inizio, fine + 1)); } catch {}
  }
  return null;
}

// Chiede a Claude una risposta in JSON che rispetta lo schema.
// Se il modello non accetta lo schema obbligatorio, riprova chiedendo il JSON solo a parole.
async function chiediJson(sistema, testo, schema, maxToken) {
  const base = { max_tokens: maxToken, system: sistema, messages: [{ role: 'user', content: testo }] };
  let d;
  try {
    d = await chiamaClaude({ ...base, output_config: { effort: 'low', format: { type: 'json_schema', schema } } });
  } catch (err) {
    if (err.status !== 400) throw err;
    d = await chiamaClaude({ ...base, output_config: { effort: 'low' } });
  }
  if (d.stop_reason === 'max_tokens') throw new Error('La classifica è troppo lunga da leggere tutta in una volta: incollane una parte (es. 100 album).');
  const json = jsonDaRisposta(testoRisposta(d));
  if (!json) throw new Error('Claude non ha restituito dati leggibili: riprova.');
  return json;
}

const SCHEMA_CLASSIFICA = {
  type: 'object',
  additionalProperties: false,
  required: ['album'],
  properties: {
    album: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['posizione', 'titolo', 'artista', 'sottogenere', 'anno', 'voto', 'numero_voti'],
        properties: {
          posizione: { type: 'integer' },
          titolo: { type: 'string' },
          artista: { type: 'string' },
          sottogenere: { type: 'string' },
          anno: { type: 'integer' },
          voto: { type: 'number' },
          numero_voti: { type: 'integer' },
        },
      },
    },
  },
};

// Testo incollato dalla pagina "Top Prog Albums" → elenco di album
async function leggiClassificaConClaude(testo) {
  const sistema = 'Ricevi il testo copiato da una pagina di classifica di ProgArchives (Top Prog Albums). '
    + 'Estrai TUTTI gli album della classifica, nell\'ordine in cui compaiono, senza saltarne e senza inventarne. '
    + 'Per ognuno: posizione in classifica, titolo dell\'album, artista, sottogenere (es. Symphonic Prog, Rock Progressivo Italiano), '
    + 'anno, voto medio (es. 4.65) e numero di voti. Usa 0 o una stringa vuota per ciò che non c\'è. '
    + 'Scrivi titoli e nomi come nel testo, ma con le maiuscole normali (non tutto maiuscolo). '
    + 'Ignora menu, pubblicità e altre parti della pagina. Rispondi solo con il JSON {"album": [...]}.';
  const json = await chiediJson(sistema, testo, SCHEMA_CLASSIFICA, 32000);
  return (json.album || []).map((a, i) => ({
    pos: a.posizione || i + 1,
    titolo: String(a.titolo || '').trim(),
    artista: String(a.artista || '').trim(),
    genere: String(a.sottogenere || '').trim(),
    anno: a.anno || null,
    voto: a.voto || null,
    voti: a.numero_voti || null,
  })).filter((a) => a.titolo && a.artista);
}

const SCHEMA_SCALETTA = {
  type: 'object',
  additionalProperties: false,
  required: ['conosciuto', 'brani'],
  properties: {
    conosciuto: { type: 'boolean' },
    brani: { type: 'array', items: { type: 'string' } },
  },
};

// Scaletta dalla memoria di Claude: solo quando MusicBrainz non conosce l'album
async function scalettaDaClaude(album) {
  const sistema = 'Conosci la musica progressive. Ti viene chiesta la scaletta originale di un album. '
    + 'Se conosci con sicurezza l\'album, rispondi conosciuto=true e i titoli dei brani nell\'ordine del disco originale, senza durate né numeri. '
    + 'Se non lo conosci o non sei sicuro, rispondi conosciuto=false e brani vuoto: non inventare.';
  const json = await chiediJson(sistema, `Album: "${album.titolo}" di ${album.artista}${album.anno ? ` (${album.anno})` : ''}`, SCHEMA_SCALETTA, 2000);
  return json.conosciuto ? (json.brani || []).map((t) => String(t).trim()).filter(Boolean) : [];
}

// ---------- Ascolta il Prog ----------
// 1. Incolli una classifica copiata da ProgArchives  2. tocchi un album e vedi i brani (da MusicBrainz)
// 3. tocchi un brano: l'app lo cerca su YouTube e lo suona.
// Tutti i dati salvati hanno il prefisso "prog_": le app su maurocapoleoni-wq.github.io
// condividono la stessa memoria del browser, così non si mescolano con Cerca e Guarda.

const $ = (id) => document.getElementById(id);

// Chiave di YouTube condivisa con Cerca e Guarda (ristretta al dominio maurocapoleoni-wq.github.io)
const CHIAVE_PREDEFINITA = 'AIzaSyBw5xRFHaI4rOFhDdMMcF8ZM6WMEksPCR0';
const CHIAVE_YT = 'prog_yt_api_key';

function getKey() {
  try { return localStorage.getItem(CHIAVE_YT) || CHIAVE_PREDEFINITA; } catch { return CHIAVE_PREDEFINITA; }
}

// Lettura e scrittura sicure della memoria del browser
function leggi(k, def) {
  try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? def; } catch { return def; }
}
function scrivi(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; }
}

// ---------- Schermate ----------
const viste = ['home', 'incolla', 'vista-album', 'player', 'impostazioni'];
function mostra(nome, nuova = true) {
  viste.forEach((v) => $(v).classList.toggle('hidden', v !== nome));
  window.scrollTo(0, 0);
  if (nuova && nome !== 'home') history.pushState({ v: nome }, '');
}

// Il tasto indietro del telefono (e la freccia ←) tornano alla schermata precedente
document.querySelectorAll('.indietro').forEach((b) => b.addEventListener('click', () => history.back()));
window.addEventListener('popstate', (e) => {
  const verso = e.state?.v || 'home';
  if (!$('player').classList.contains('hidden') && verso !== 'player') fermaVideo();
  mostra(verso, false);
});

// ---------- Classifiche salvate ----------
// prog_liste: [{ id, nome, creata, album: [{ pos, titolo, artista, genere, anno, voto, voti }] }]
const leggiListe = () => leggi('prog_liste', []);
const scriviListe = (l) => scrivi('prog_liste', l);
let idListaAttiva = leggi('prog_lista_attiva', null);

function listaAttiva() {
  const liste = leggiListe();
  return liste.find((l) => l.id === idListaAttiva) || liste[0] || null;
}

function mostraHome() {
  const liste = leggiListe();
  const attiva = listaAttiva();
  $('sezione-liste').classList.toggle('hidden', !attiva);
  // i filtri per una nuova classifica stanno sempre in cima: aperti se non c'è ancora nessuna classifica,
  // chiusi (basta toccare il titolo) quando ce n'è già una
  if (!attiva) $('guida-apri').open = true;
  else if (!mostraHome.giaAperta) $('guida-apri').open = false;
  mostraHome.giaAperta = true;

  const box = $('chips-liste');
  box.innerHTML = '';
  for (const l of liste) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (l.id === attiva?.id ? ' attiva' : '');
    b.textContent = `${l.nome} (${l.album.length})`;
    b.addEventListener('click', () => { idListaAttiva = l.id; scrivi('prog_lista_attiva', l.id); mostraHome(); });
    box.append(b);
  }
  const nuova = document.createElement('button');
  nuova.type = 'button';
  nuova.className = 'chip nuova';
  nuova.textContent = '+ Nuova classifica';
  nuova.addEventListener('click', () => {
    $('guida-apri').open = true;
    $('guida').scrollIntoView({ behavior: 'smooth' });
  });
  box.append(nuova);
  mostraAlbum();
}

// ---------- Filtri ----------
const filtri = leggi('prog_filtri', { da: '', a: '', voto: '0', votoMax: '0', quanti: '250', testo: '' });
if (!['25', '50', '100', '250'].includes(filtri.quanti)) filtri.quanti = '250';
$('f-da').value = filtri.da;
$('f-a').value = filtri.a;
$('f-voto').value = filtri.voto;
$('f-voto-max').value = filtri.votoMax || '0';
$('f-quanti').value = filtri.quanti;
for (const [id, k] of [['f-da', 'da'], ['f-a', 'a'], ['f-voto', 'voto'], ['f-voto-max', 'votoMax'], ['f-quanti', 'quanti'], ['f-testo', 'testo']]) {
  $(id).addEventListener('input', () => {
    filtri[k] = $(id).value;
    if (k !== 'testo') scrivi('prog_filtri', { ...filtri, testo: '' });
    mostraAlbum();
  });
}

const minuscolo = (s) => (s || '').toLocaleLowerCase('it').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const fmtVoto = (v) => (v ? Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

function mostraAlbum() {
  const lista = listaAttiva();
  const ul = $('album');
  ul.innerHTML = '';
  if (!lista) return;
  const da = Number(filtri.da) || 0, a = Number(filtri.a) || 9999, voto = Number(filtri.voto) || 0, votoMax = Number(filtri.votoMax) || 0;
  const cerca = minuscolo(filtri.testo);
  const scelti = lista.album.filter((x) => (!x.anno || (x.anno >= da && x.anno <= a))
    && (!voto || (x.voto || 0) >= voto)
    && (!votoMax || !x.voto || x.voto <= votoMax)
    && (!cerca || minuscolo(x.titolo + ' ' + x.artista).includes(cerca)));
  const mostrati = scelti.slice(0, Number(filtri.quanti) || 250);
  $('stato-lista').textContent = scelti.length === lista.album.length
    ? `${lista.album.length} album in questa classifica`
    : `${scelti.length} album su ${lista.album.length} con questi filtri`;
  for (const x of mostrati) {
    const li = document.createElement('li');
    const pos = document.createElement('span');
    pos.className = 'pos';
    pos.textContent = x.pos;
    const meta = document.createElement('div');
    meta.className = 'meta';
    const t = document.createElement('p');
    t.className = 'title';
    t.textContent = x.titolo;
    const c = document.createElement('p');
    c.className = 'channel';
    c.textContent = [x.artista, x.genere, x.anno].filter(Boolean).join(' · ');
    meta.append(t, c);
    li.append(pos, meta);
    if (x.voto) {
      const v = document.createElement('span');
      v.className = 'voto';
      v.innerHTML = '';
      v.append('★ ' + fmtVoto(x.voto));
      if (x.voti) {
        const n = document.createElement('small');
        n.textContent = x.voti.toLocaleString('it-IT') + ' voti';
        v.append(n);
      }
      li.append(v);
    }
    li.addEventListener('click', () => apriAlbum(x));
    ul.append(li);
  }
}

$('btn-elimina').addEventListener('click', () => {
  const l = listaAttiva();
  if (!l || !confirm(`Eliminare la classifica "${l.nome}" da questo telefono?`)) return;
  scriviListe(leggiListe().filter((x) => x.id !== l.id));
  idListaAttiva = null;
  mostraHome();
});

$('btn-rinomina').addEventListener('click', () => {
  const l = listaAttiva();
  if (!l) return;
  const nome = prompt('Nuovo nome della classifica:', l.nome);
  if (!nome?.trim()) return;
  scriviListe(leggiListe().map((x) => (x.id === l.id ? { ...x, nome: nome.trim() } : x)));
  mostraHome();
});

// ---------- Link di ProgArchives con i filtri ----------
// Il modulo dei filtri di ProgArchives sul telefono non funziona: l'app costruisce lo stesso indirizzo.
// Esempio (Germania, 2000–2020, 100 album):
//   top-prog-albums.asp?ssubgenres=&syears=2020&…&syears=2000&salbumtypes=1&scountries=77&…&smaxresults=100#list
// Numeri delle nazioni come li usa ProgArchives (elenco completo raccolto da Mauro il 15/11/2026).
// Nel menu vengono messe in ordine alfabetico; "Tutte" resta per prima.
const NAZIONI_PA = [['', 'Tutte'], ...[
  ['4', 'Algeria'], ['6', 'Andorra'], ['1', 'Argentina'], ['11', 'Armenia'], ['13', 'Australia'],
  ['14', 'Austria'], ['18', 'Bahrein'], ['22', 'Belgio'], ['21', 'Bielorussia'], ['27', 'Bolivia'],
  ['108', 'Brasile'], ['32', 'Bulgaria'], ['37', 'Canada'], ['42', 'Cile'], ['43', 'Cina'],
  ['46', 'Colombia'], ['50', 'Costa Rica'], ['52', 'Croazia'], ['53', 'Cuba'], ['55', 'Repubblica Ceca'],
  ['56', 'Danimarca'], ['61', 'Egitto'], ['65', 'Estonia'], ['70', 'Finlandia'], ['71', 'Francia'],
  ['76', 'Georgia'], ['77', 'Germania'], ['80', 'Grecia'], ['91', 'Ungheria'], ['92', 'Islanda'],
  ['93', 'India'], ['94', 'Indonesia'], ['95', 'Iran'], ['96', 'Iraq'], ['97', 'Irlanda'],
  ['98', 'Israele'], ['99', 'Italia'], ['101', 'Giappone'], ['103', 'Kazakistan'], ['106', 'Corea del Sud'],
  ['109', 'Kuwait'], ['112', 'Lettonia'], ['113', 'Libano'], ['118', 'Lituania'], ['119', 'Lussemburgo'],
  ['220', 'Macedonia'], ['121', 'Madagascar'], ['123', 'Malesia'], ['126', 'Malta'], ['132', 'Messico'],
  ['134', 'Moldavia'], ['135', 'Monaco'], ['219', 'Montenegro'], ['210', 'Multinazionale'], ['145', 'Olanda'],
  ['147', 'Nuova Zelanda'], ['148', 'Nicaragua'], ['153', 'Norvegia'], ['155', 'Pakistan'], ['222', 'Palestina'],
  ['157', 'Panama'], ['160', 'Perù'], ['161', 'Filippine'], ['162', 'Polonia'], ['163', 'Portogallo'],
  ['164', 'Porto Rico'], ['167', 'Romania'], ['168', 'Russia'], ['218', 'Serbia'], ['176', 'Singapore'],
  ['211', 'Slovacchia'], ['212', 'Slovenia'], ['215', 'Sudafrica'], ['207', 'Spagna'], ['178', 'Svezia'],
  ['179', 'Svizzera'], ['180', 'Siria'], ['181', 'Taiwan'], ['184', 'Tailandia'], ['189', 'Tunisia'],
  ['190', 'Turchia'], ['194', 'Ucraina'], ['195', 'Emirati Arabi'], ['206', 'Inghilterra (UK)'], ['197', 'Stati Uniti'],
  ['198', 'Uruguay'], ['199', 'Uzbekistan'], ['140', 'Varie'], ['200', 'Venezuela'], ['203', 'Jugoslavia'],
].sort((x, y) => x[1].localeCompare(y[1], 'it'))];

const sceltaPA = leggi('prog_filtri_pa', { nazione: '77', da: '', a: '', quanti: '100', voto: '0', votoMax: '0' });
for (const [num, nome] of NAZIONI_PA) $('pa-nazione').append(new Option(nome, num));
$('pa-nazione').value = NAZIONI_PA.some(([n]) => n === sceltaPA.nazione) ? sceltaPA.nazione : '';
$('pa-da').value = sceltaPA.da;
$('pa-a').value = sceltaPA.a;
$('pa-quanti').value = sceltaPA.quanti;
$('pa-voto').value = sceltaPA.voto || '0';
$('pa-voto-max').value = sceltaPA.votoMax || '0';

function linkProgArchives() {
  const p = new URLSearchParams();
  p.append('ssubgenres', '');
  const da = Number($('pa-da').value) || 0;
  const a = Number($('pa-a').value) || 0;
  if (da || a) {
    const fine = a || new Date().getFullYear();
    for (let anno = fine; anno >= (da || fine); anno--) p.append('syears', anno);
  } else {
    p.append('syears', '');
  }
  p.append('salbumtypes', '1');
  p.append('scountries', $('pa-nazione').value);
  p.append('sminratings', '0');
  p.append('smaxratings', '0');
  p.append('sminavgratings', $('pa-voto').value); // voto medio minimo (0 = nessun limite)
  p.append('smaxresults', $('pa-quanti').value); // ProgArchives arriva al massimo a 250
  return 'https://www.progarchives.com/top-prog-albums.asp?' + p + '#list';
}

// Nome proposto per la classifica, es. "Germania 2000–2020"
function nomeDaFiltri() {
  const nazione = $('pa-nazione').selectedOptions[0]?.text || '';
  const da = $('pa-da').value, a = $('pa-a').value;
  const anni = da && a ? `${da}–${a}` : da ? `dal ${da}` : a ? `fino al ${a}` : '';
  const max = Number($('pa-voto-max').value) ? `voto fino a ${fmtVoto($('pa-voto-max').value)}` : '';
  return [nazione === 'Tutte' ? 'Tutte le nazioni' : nazione, anni, max].filter(Boolean).join(' ');
}

function aggiornaLinkPA() {
  $('link-progarchives').href = linkProgArchives();
  scrivi('prog_filtri_pa', { nazione: $('pa-nazione').value, da: $('pa-da').value, a: $('pa-a').value, quanti: $('pa-quanti').value, voto: $('pa-voto').value, votoMax: $('pa-voto-max').value });
  $('nota-voto-max').classList.toggle('hidden', $('pa-voto-max').value === '0');
}
['pa-nazione', 'pa-da', 'pa-a', 'pa-quanti', 'pa-voto', 'pa-voto-max'].forEach((id) => $(id).addEventListener('input', aggiornaLinkPA));
aggiornaLinkPA();

// ---------- Incolla la classifica ----------
function apriIncolla() {
  $('testo-incollato').value = '';
  $('nome-lista').value = nomeDaFiltri();
  $('stato-incolla').textContent = leggiChiaveClaude() ? ''
    : 'Senza la chiave di Claude l\'app prova a leggere la classifica da sola: se non ci riesce, aggiungi la chiave in ⚙️ Impostazioni.';
  mostra('incolla');
}
$('btn-incolla').addEventListener('click', apriIncolla);

$('btn-appunti').addEventListener('click', async () => {
  try {
    const t = await navigator.clipboard.readText();
    if (!t.trim()) { $('stato-incolla').textContent = 'Negli appunti non c\'è niente: prima copia la pagina di ProgArchives.'; return; }
    $('testo-incollato').value = t;
    $('stato-incolla').textContent = 'Testo incollato. Ora dai un nome e tocca "Leggi la classifica".';
  } catch {
    $('stato-incolla').textContent = 'Il telefono non lascia leggere gli appunti: tieni il dito nel riquadro e scegli Incolla.';
  }
});

// Lettura senza Claude: cerca le righe col voto ("4.65 | 3456 ratings") e prende le righe prima di ognuna
const SOTTOGENERI = ['Canterbury Scene', 'Crossover Prog', 'Eclectic Prog', 'Experimental/Post Metal', 'Heavy Prog',
  'Indo-Prog/Raga Rock', 'Jazz Rock/Fusion', 'Krautrock', 'Neo-Prog', 'Post Rock/Math Rock', 'Prog Folk',
  'Progressive Electronic', 'Progressive Metal', 'Psychedelic/Space Rock', 'RIO/Avant-Prog', 'Rock Progressivo Italiano',
  'Symphonic Prog', 'Tech/Extreme Prog Metal', 'Zeuhl', 'Proto-Prog', 'Prog Related', 'Various Genres'];
const eSottogenere = (s) => SOTTOGENERI.some((g) => minuscolo(g) === minuscolo(s));

// Ogni album, nel testo copiato da ProgArchives, è fatto così (una cosa per riga):
//   2 · Precambrian · The Ocean · Experimental/Post Metal · Studio, 2007 · 4.25 | 129 ratings · QWR = 4.1517
// A volte titolo e gruppo arrivano come link: [Precambrian](https://www.progarchives.com/album.asp?id=19045)
function leggiClassificaDaSolo(testo) {
  const idAlbum = {}; // titolo → numero dell'album su ProgArchives (per il link alla sua pagina)
  const righe = testo.split(/\r?\n/).flatMap((r) => r.split('\t'))
    .map((r) => r.trim().replace(/\[([^\]]*)\]\(([^)\s]*)\)/g, (_, nome, url) => {
      const id = url.match(/album\.asp\?id=(\d+)/);
      if (id) idAlbum[nome.trim()] = id[1];
      return nome;
    }).trim())
    .filter((r) => r && !/^QWR\s*=/i.test(r));
  const reVoto = /^(\d[.,]\d{1,2})\s*\|?\s*(?:([\d.,]+)\s*ratings?)?$/i;
  const reAnno = /^(?:[A-Za-z][\w .'/-]*,\s*)?((?:19|20)\d{2})$/; // "2007" oppure "Studio, 2007"
  const album = [];
  let inizio = 0;
  righe.forEach((r, i) => {
    const m = r.match(reVoto);
    if (!m) return;
    // il numero di voti può stare sulla stessa riga o su quella dopo
    const dopo = !/ratings?/i.test(r) && righe[i + 1]?.match(/^([\d.,]+)\s*ratings?$/i);
    if (!/ratings?/i.test(r) && !dopo) return;
    if (dopo) m[2] = dopo[1];
    const blocco = righe.slice(Math.max(inizio, i - 7), i);
    inizio = i + (dopo ? 2 : 1);
    const rigaAnno = blocco.find((x) => reAnno.test(x));
    let genere = blocco.find(eSottogenere);
    const pos = blocco.find((x) => /^\d{1,3}$/.test(x));
    const resto = blocco.filter((x) => x !== rigaAnno && x !== genere && x !== pos && !/^\d+$/.test(x));
    // sottogenere che l'app non conosce: è la riga dopo il gruppo
    if (!genere && resto.length >= 3) genere = resto.pop();
    if (resto.length < 2) return;
    const [titolo, artista] = resto.slice(-2);
    album.push({
      pos: Number(pos) || album.length + 1,
      titolo, artista, genere: genere || '',
      anno: rigaAnno ? Number(rigaAnno.match(reAnno)[1]) : null,
      voto: Number(m[1].replace(',', '.')),
      voti: m[2] ? Number(m[2].replace(/[.,]/g, '')) : null,
      ...(idAlbum[titolo] && { pa: idAlbum[titolo] }),
    });
  });
  return album;
}

$('btn-leggi').addEventListener('click', async () => {
  const testo = $('testo-incollato').value.trim();
  const stato = $('stato-incolla');
  if (testo.length < 50) { stato.textContent = 'Prima incolla il testo della classifica.'; return; }
  const btn = $('btn-leggi');
  btn.disabled = true;
  let album = [];
  try {
    // prima prova da sola (gratis e immediato); Claude solo se il testo ha una forma diversa dal solito
    album = leggiClassificaDaSolo(testo);
    if (album.length < 3 && leggiChiaveClaude()) {
      stato.textContent = 'Claude sta leggendo la classifica… (può volerci fino a un minuto)';
      album = await leggiClassificaConClaude(testo);
    }
  } catch (err) {
    stato.textContent = err instanceof TypeError ? 'Nessuna connessione: controlla internet e riprova.' : err.message;
    btn.disabled = false;
    return;
  }
  btn.disabled = false;
  // ProgArchives non filtra per voto massimo: lo fa l'app qui
  const votoMax = Number($('pa-voto-max').value) || 0;
  const tolti = votoMax ? album.filter((x) => x.voto > votoMax).length : 0;
  if (tolti && tolti === album.length) {
    stato.textContent = `Tutti gli album hanno un voto sopra ${fmtVoto(votoMax)}. Scegli 250 album su ProgArchives, oppure togli il voto massimo.`;
    return;
  }
  if (tolti) album = album.filter((x) => !(x.voto > votoMax));
  if (!album.length) {
    stato.textContent = leggiChiaveClaude()
      ? 'Non ho trovato album in questo testo. Hai copiato la pagina della classifica?'
      : 'Non riesco a leggere la classifica da solo. Aggiungi la chiave di Claude in ⚙️ Impostazioni e riprova.';
    return;
  }
  const lista = {
    id: Date.now().toString(36),
    nome: $('nome-lista').value.trim() || 'Classifica del ' + new Date().toLocaleDateString('it-IT'),
    creata: new Date().toISOString(),
    album,
  };
  if (!scriviListe([...leggiListe(), lista])) { stato.textContent = 'Memoria del telefono piena: elimina una classifica vecchia.'; return; }
  idListaAttiva = lista.id;
  scrivi('prog_lista_attiva', lista.id);
  history.back(); // torna alla home, che mostra la nuova classifica
  mostraHome();
});

// ---------- Album: scaletta dei brani ----------
// Le scalette già trovate restano salvate: prog_scalette = { "artista|titolo": { brani: [...], fonte } }
let albumAperto = null;
let braniAperti = [];
const chiaveAlbum = (a) => minuscolo(a.artista + '|' + a.titolo);

async function apriAlbum(a) {
  albumAperto = a;
  braniAperti = [];
  $('album-titolo').textContent = a.titolo;
  $('album-info').textContent = [a.artista, a.genere, a.anno, a.voto ? '★ ' + fmtVoto(a.voto) : ''].filter(Boolean).join(' · ');
  $('brani').innerHTML = '';
  $('fonte-brani').textContent = '';
  $('btn-ascolta-tutto').disabled = true;
  $('link-album-pa').classList.toggle('hidden', !a.pa);
  if (a.pa) $('link-album-pa').href = 'https://www.progarchives.com/album.asp?id=' + encodeURIComponent(a.pa);
  mostra('vista-album');
  const salvata = leggi('prog_scalette', {})[chiaveAlbum(a)];
  if (salvata) { mostraBrani(salvata); return; }
  $('stato-album').textContent = 'Cerco i brani…';
  let scaletta = null;
  try {
    const brani = await scalettaDaMusicBrainz(a);
    if (brani.length) scaletta = { brani, fonte: 'MusicBrainz' };
  } catch { /* si prova con Claude */ }
  if (!scaletta && leggiChiaveClaude()) {
    try {
      $('stato-album').textContent = 'MusicBrainz non lo conosce: chiedo a Claude…';
      const brani = await scalettaDaClaude(a);
      if (brani.length) scaletta = { brani, fonte: 'Claude (a memoria: controlla che sia giusta)' };
    } catch { /* niente scaletta */ }
  }
  if (albumAperto !== a) return; // nel frattempo l'utente ha aperto un altro album
  if (!scaletta) {
    $('stato-album').textContent = 'Non ho trovato i brani di questo album. Puoi cercare l\'album intero su YouTube.';
    return;
  }
  const tutte = leggi('prog_scalette', {});
  tutte[chiaveAlbum(a)] = scaletta;
  scrivi('prog_scalette', tutte);
  mostraBrani(scaletta);
}

function mostraBrani(s) {
  braniAperti = s.brani;
  $('stato-album').textContent = 'Tocca un brano per ascoltarlo';
  $('fonte-brani').textContent = 'Brani da ' + s.fonte;
  $('btn-ascolta-tutto').disabled = false;
  const ol = $('brani');
  ol.innerHTML = '';
  s.brani.forEach((t, i) => {
    const li = document.createElement('li');
    li.textContent = t;
    li.addEventListener('click', () => suonaBrano(i));
    ol.append(li);
  });
}

// MusicBrainz: cerca le edizioni dell'album, sceglie la più vecchia e ne legge i brani.
// MusicBrainz chiede al massimo una richiesta al secondo: tra le due richieste si aspetta un attimo.
const aspetta = (ms) => new Promise((r) => setTimeout(r, ms));
const virgolette = (s) => '"' + s.replace(/["\\]/g, ' ') + '"';

// Se MusicBrainz risponde "troppe richieste" (503), aspetta e riprova fino a 3 volte
async function chiediMusicBrainz(percorso) {
  for (let tentativo = 0; ; tentativo++) {
    const r = await fetch('https://musicbrainz.org/ws/2/' + percorso);
    if (r.ok) return r.json();
    if (r.status !== 503 || tentativo >= 3) throw new Error('MusicBrainz ' + r.status);
    await aspetta(1500 * (tentativo + 1));
  }
}

async function scalettaDaMusicBrainz(a) {
  const q = `release:${virgolette(a.titolo)} AND artist:${virgolette(a.artista)}`;
  const edizioni = ((await chiediMusicBrainz('release?fmt=json&limit=25&query=' + encodeURIComponent(q))).releases || [])
    .filter((x) => x.score >= 90 && x['track-count'] > 0)
    .sort((x, y) => (x.status === 'Official' ? 0 : 1) - (y.status === 'Official' ? 0 : 1)
      || (x.date || '9999').localeCompare(y.date || '9999'));
  if (!edizioni.length) return [];
  await aspetta(1100);
  const d = await chiediMusicBrainz(`release/${edizioni[0].id}?fmt=json&inc=recordings`);
  return (d.media || []).flatMap((m) => m.tracks || []).map((t) => t.title).filter(Boolean);
}

$('btn-ascolta-tutto').addEventListener('click', () => suonaBrano(0));
$('btn-album-intero').addEventListener('click', () => {
  if (!albumAperto) return;
  suonaRicerca(`${albumAperto.artista} ${albumAperto.titolo} full album`, `${albumAperto.titolo} (album intero)`, -1);
});

// ---------- Ricerca su YouTube ----------
// Conteggio della quota: stesso contatore di Cerca e Guarda, perché la chiave e la quota sono le stesse.
const QUOTA_GIORNO = 10000;
const COSTO_RICERCA = 100;
const giornoPacifico = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });

function leggiQuota() {
  const q = leggi('quota_youtube', null);
  return q && q.giorno === giornoPacifico() ? q : { giorno: giornoPacifico(), unita: 0 };
}
function contaQuota(u) {
  const q = leggiQuota();
  q.unita += u;
  scrivi('quota_youtube', q);
  aggiornaQuota();
}
function aggiornaQuota() {
  const u = leggiQuota().unita;
  const ricerche = Math.round(u / COSTO_RICERCA);
  document.querySelectorAll('.quota').forEach((el) => {
    el.textContent = `YouTube oggi, da questo telefono: ${ricerche} ${ricerche === 1 ? 'ricerca' : 'ricerche'} su ${QUOTA_GIORNO / COSTO_RICERCA} (insieme a Cerca e Guarda)`;
    el.classList.toggle('quota-alta', u >= QUOTA_GIORNO * 0.8);
  });
}

const testoHtml = (s) => new DOMParser().parseFromString(s || '', 'text/html').body.textContent;

// Le ricerche già fatte restano salvate (prog_ricerche_yt): riascoltare un brano non consuma quota
async function cercaYouTube(query) {
  const cache = leggi('prog_ricerche_yt', {});
  if (cache[query]) return cache[query].v;
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '4', q: query, key: getKey(),
  });
  contaQuota(COSTO_RICERCA);
  const r = await fetch(url);
  const data = await r.json();
  if (!r.ok) {
    const motivo = data?.error?.errors?.[0]?.reason;
    if (motivo === 'quotaExceeded' || motivo === 'dailyLimitExceeded') throw new Error('Limite giornaliero di YouTube raggiunto: riprova dopo le 9 del mattino.');
    throw new Error(data?.error?.message || 'Errore di YouTube ' + r.status);
  }
  const video = (data.items || []).map((it) => ({
    id: it.id.videoId,
    title: testoHtml(it.snippet.title),
    channel: testoHtml(it.snippet.channelTitle),
    thumb: it.snippet.thumbnails?.medium?.url || it.snippet.thumbnails?.default?.url,
  }));
  // tiene le 300 ricerche più recenti
  cache[query] = { v: video, t: Date.now() };
  const chiavi = Object.keys(cache).sort((x, y) => cache[y].t - cache[x].t);
  chiavi.slice(300).forEach((k) => delete cache[k]);
  scrivi('prog_ricerche_yt', cache);
  return video;
}

// ---------- Player ----------
let branoCorrente = -1; // posizione nella scaletta; -1 = album intero

function suonaBrano(i) {
  if (!albumAperto || i < 0 || i >= braniAperti.length) return;
  suonaRicerca(`${albumAperto.artista} ${braniAperti[i]}`, braniAperti[i], i);
}

async function suonaRicerca(query, etichetta, i) {
  branoCorrente = i;
  $('player-titolo').textContent = etichetta;
  $('player-brano').textContent = i >= 0 ? `Brano ${i + 1} di ${braniAperti.length} · ${albumAperto.artista} – ${albumAperto.titolo}` : albumAperto.artista;
  $('btn-precedente').disabled = i <= 0;
  $('btn-successivo').disabled = i < 0 || i >= braniAperti.length - 1;
  $('altri-video').innerHTML = '';
  impostaFrame(null);
  if ($('player').classList.contains('hidden')) mostra('player');
  try {
    const video = await cercaYouTube(query);
    if (branoCorrente !== i) return; // nel frattempo è stato scelto un altro brano
    if (!video.length) { $('player-brano').textContent = 'Nessun video trovato per questo brano.'; return; }
    apriVideo(video[0]);
    mostraAltriVideo(video);
  } catch (err) {
    $('player-brano').textContent = err instanceof TypeError ? 'Nessuna connessione: controlla internet e riprova.' : err.message;
  }
}

function mostraAltriVideo(video) {
  const ul = $('altri-video');
  ul.innerHTML = '';
  for (const v of video) {
    const li = document.createElement('li');
    const img = document.createElement('img');
    img.src = v.thumb || '';
    img.alt = '';
    const meta = document.createElement('div');
    meta.className = 'meta';
    const t = document.createElement('p');
    t.className = 'title';
    t.textContent = v.title;
    const c = document.createElement('p');
    c.className = 'channel';
    c.textContent = v.channel;
    meta.append(t, c);
    li.append(img, meta);
    li.addEventListener('click', () => { apriVideo(v); mostraAltriVideo(video); });
    if ($('yt-frame').src.includes(v.id)) li.classList.add('in-onda');
    ul.append(li);
  }
}

// Ogni video in un riquadro nuovo: cambiare indirizzo al riquadro aggiungerebbe passi
// alla cronologia, e il tasto indietro del telefono tornerebbe al video prima invece che all'album.
function impostaFrame(url) {
  const vecchio = $('yt-frame');
  const nuovo = vecchio.cloneNode(false);
  nuovo.removeAttribute('src');
  if (url) {
    nuovo.src = url;
    // il player, se glielo chiedi, manda dei messaggi (es. quando il video finisce)
    nuovo.addEventListener('load', () => {
      nuovo.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
    });
  }
  vecchio.replaceWith(nuovo);
}

// enablejsapi=1: l'app riceve dal player quando il video finisce (per passare al brano dopo)
function apriVideo(v) {
  impostaFrame('https://www.youtube.com/embed/' + v.id
    + '?autoplay=1&playsinline=1&rel=0&enablejsapi=1&hl=it&origin=' + encodeURIComponent(location.origin));
  $('open-yt').href = linkAppYouTube(v.id);
  $('open-yt').target = /Android/i.test(navigator.userAgent) ? '_self' : '_blank';
}

function fermaVideo() {
  impostaFrame(null);
  branoCorrente = -2;
}

function comandoPlayer(func) {
  $('yt-frame').contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args: [] }), '*');
}

// Apre il video nell'app YouTube, dove c'è il tasto per trasmettere alla TV
function linkAppYouTube(id) {
  const web = 'https://www.youtube.com/watch?v=' + id;
  if (!/Android/i.test(navigator.userAgent)) return web;
  return 'intent://www.youtube.com/watch?v=' + id
    + '#Intent;package=com.google.android.youtube;scheme=https;'
    + 'S.browser_fallback_url=' + encodeURIComponent(web) + ';end';
}
$('open-yt').addEventListener('click', () => comandoPlayer('pauseVideo'));

// Messaggi del player: playerState 0 = video finito
window.addEventListener('message', (e) => {
  try {
    if (!/(^|\.)youtube\.com$/.test(new URL(e.origin).hostname)) return;
    const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    if (d?.info?.playerState === 0 && $('auto-avanti').checked && branoCorrente >= 0
      && branoCorrente < braniAperti.length - 1) suonaBrano(branoCorrente + 1);
  } catch { /* messaggio non nostro */ }
});

$('auto-avanti').checked = leggi('prog_auto_avanti', true);
$('auto-avanti').addEventListener('change', (e) => scrivi('prog_auto_avanti', e.target.checked));
$('btn-successivo').addEventListener('click', () => suonaBrano(branoCorrente + 1));
$('btn-precedente').addEventListener('click', () => suonaBrano(branoCorrente - 1));

// ---------- Impostazioni ----------
function aggiornaImpostazioni() {
  $('chiave-claude').value = '';
  $('chiave-claude').placeholder = leggiChiaveClaude() ? '•••••••• (chiave salvata)' : 'sk-ant-...';
  let yt = '';
  try { yt = localStorage.getItem(CHIAVE_YT) || ''; } catch {}
  $('chiave-yt').value = yt;
}
$('btn-settings').addEventListener('click', () => { aggiornaImpostazioni(); mostra('impostazioni'); });

$('btn-salva-claude').addEventListener('click', () => {
  const k = $('chiave-claude').value.trim();
  if (!k) {
    if (!leggiChiaveClaude() || !confirm('Cancellare la chiave di Claude da questa app?')) return;
    try { localStorage.removeItem(CHIAVE_CLAUDE); } catch {}
    $('info-claude').textContent = leggiChiaveClaude() ? 'Cancellata. Resta quella di Cerca e Guarda, che si toglie da lì.' : 'Chiave di Claude cancellata.';
  } else {
    try { localStorage.setItem(CHIAVE_CLAUDE, k); } catch {}
    $('info-claude').textContent = 'Chiave di Claude salvata su questo telefono.';
  }
  aggiornaImpostazioni();
});

$('btn-salva-yt').addEventListener('click', () => {
  const k = $('chiave-yt').value.trim();
  try { k ? localStorage.setItem(CHIAVE_YT, k) : localStorage.removeItem(CHIAVE_YT); } catch {}
  history.back();
});

// ---------- Copia di sicurezza (Esporta / Importa) ----------
// Solo i dati dell'utente: niente chiavi e niente contatore del giorno.
const DATI_BACKUP = ['prog_liste', 'prog_lista_attiva', 'prog_filtri', 'prog_scalette', 'prog_auto_avanti'];
const infoBackup = (t) => { $('info-backup').textContent = t; };
const riepilogo = (dati) => {
  let n = 0;
  try { n = JSON.parse(dati.prog_liste || '[]').length; } catch {}
  return `${n} ${n === 1 ? 'classifica' : 'classifiche'}`;
};

$('btn-esporta').addEventListener('click', async () => {
  const dati = {};
  for (const k of DATI_BACKUP) {
    let v = null;
    try { v = localStorage.getItem(k); } catch {}
    if (v !== null) dati[k] = v;
  }
  const oggi = new Date().toISOString().slice(0, 10);
  const nome = `ascolta-il-prog-backup-${oggi}.json`;
  const file = new File([JSON.stringify({ app: 'ascolta-il-prog', versione: 1, creato: new Date().toISOString(), dati })], nome, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Copia di sicurezza Ascolta il Prog' });
      infoBackup(`Copia creata (${riepilogo(dati)}).`);
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  infoBackup(`File "${nome}" scaricato (${riepilogo(dati)}). Lo trovi nei Download.`);
});

$('btn-importa').addEventListener('click', () => $('file-importa').click());
$('file-importa').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  let copia = null;
  try { copia = JSON.parse(await file.text()); } catch {}
  if (copia?.app !== 'ascolta-il-prog' || typeof copia.dati !== 'object' || !copia.dati) {
    infoBackup('Questo file non è una copia di sicurezza di Ascolta il Prog.');
    return;
  }
  if (!confirm(`Ripristinare la copia (${riepilogo(copia.dati)})? Le classifiche ora su questo telefono verranno sostituite.`)) return;
  for (const k of DATI_BACKUP) {
    const v = copia.dati[k];
    try { typeof v === 'string' ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {}
  }
  alert("Dati ripristinati. L'app ora si ricarica.");
  location.reload();
});

// ---------- Avvio ----------
history.replaceState({ v: 'home' }, '');
aggiornaQuota();
mostraHome();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

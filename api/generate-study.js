// /api/generate-study.js — Étude 28 rubriques (dynamiques) + fallback propre
// - Contrat: toujours 200 (GET = hint, POST = { study:{sections:[28]} ... })
// - Compatible front existant (id, title, description, content)

//////////////////////////// HTTP utils ////////////////////////////
async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1 } = {}) {
  const once = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const txt = await r.text();
      let json;
      if (ct.includes('json')) {
        try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
      } else {
        json = { raw: txt };
      }
      if (!r.ok) {
        const msg = json?.error?.message || `HTTP ${r.status}`;
        const e = new Error(msg); e.status = r.status; e.details = json; throw e;
      }
      return json;
    } finally { clearTimeout(tid); }
  };
  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await once(); }
    catch (e) { last = e; if (i === retries) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
  throw last;
}

function send200(ctx, data) {
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type', 'application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control', 'no-store');
    ctx.res.end(payload);
    return;
  }
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

async function readBody(ctx) {
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  await new Promise((res, rej) => {
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', res); req.on('error', rej);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

//////////////////////////// Constantes ////////////////////////////
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_VERSION_ID = { LSG: '93', PDV: '201', S21: '377', BFC: '75', JND: '64' };

const CLEAN = s => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s([;:,.!?…])/g, '$1')
  .trim();

function linkRef(book, chap, vv, version = 'LSG') {
  const code = USFM[book] || 'GEN';
  const verId = YV_VERSION_ID[(version || 'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version || 'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}

//////////////////////////// Fetch chapitre ////////////////////////////
async function fetchChapter(book, chap) {
  if (!KEY || !BIBLE_ID || !USFM[book]) {
    return { ok: false, usedApi: false, verses: [], content: '' };
  }
  const headers = { accept: 'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // 1) Contenu texte du chapitre
  const jChap = await fetchJson(
    `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeNotes=false&includeTitles=false`,
    { headers, timeout: 12000, retries: 1 }
  );
  const content = CLEAN(jChap?.data?.content || jChap?.data?.text || '');

  // 2) Liste des versets
  const jVerses = await fetchJson(
    `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`,
    { headers, timeout: 10000, retries: 1 }
  );
  const items = Array.isArray(jVerses?.data) ? jVerses.data : [];

  // 3) Parse simple à partir du contenu si possible
  let verses = [];
  if (content) {
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s => s.trim());
    verses = split1.map(s => {
      const m = s.match(/^(\d{1,3})\s+(.*)$/);
      return m ? { v: +m[1], text: CLEAN(m[2]) } : null;
    }).filter(Boolean);

    if (verses.length < Math.max(2, Math.floor(items.length / 3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) { arr.push({ v: +m[1], text: CLEAN(m[2]) }); }
      if (arr.length) verses = arr;
    }
  }

  // 4) Fallback sur data de la liste
  if (!verses.length && items.length) {
    verses = items.map(it => {
      const ref = String(it?.reference || '');
      const m = ref.match(/:(\d{1,3})$/);
      return { v: m ? +m[1] : undefined, text: CLEAN(it?.text || '') };
    }).filter(x => Number.isFinite(x.v) && x.text);
  }

  return { ok: !!(content || verses.length), usedApi: true, verses, content };
}

//////////////////////////// Analyse enrichie ////////////////////////////
function enrichFromText(book, chap, verses, content) {
  const raw = verses?.length ? verses.map(v => v.text).join(' ') : (content || '');
  const text = (raw || '').toLowerCase();

  const count = (re) => (text.match(re) || []).length;
  const cEt = count(/\bet\b/g);
  const cPuis = count(/\bpuis\b/g);
  const cAlors = count(/\balors\b/g);
  const cRefrain = count(/\bil y (eut|eu) soir(?:,)? et (?:il y )?(?:eut|eu) matin\b/g);
  const cParal = count(/\b(l'un|l’autre|tantôt|encore|de nouveau)\b/g);

  let structureDetected = [];
  if (cRefrain >= 2) structureDetected.push(`Refrain liturgique repérable (${cRefrain}×) — “il y eut soir et il y eut matin”.`);
  if (cEt + cPuis + cAlors >= 8) structureDetected.push(`Chaîne narrative avec connecteurs (“et / puis / alors” ≈ ${cEt + cPuis + cAlors}).`);
  if (cParal >= 2) structureDetected.push(`Présence de parallélismes/échos (${cParal} indices).`);
  if (!structureDetected.length) structureDetected.push(`Progression linéaire sans refrain dominant.`);

  // Thème doctrinal
  let theme = 'révélation et seigneurie de Dieu';
  if (/\bcr[eé]a|cr[eé]ation|cr[eé]ateur|parole\b/.test(text)) theme = 'création par la Parole efficace de Dieu';
  else if (/\blumi[eè]re\b/.test(text)) theme = 'lumière, ordre et mise en forme du chaos';
  else if (/\balliance\b/.test(text)) theme = 'alliance et fidélité divine';
  else if (/\bfoi|croire\b/.test(text)) theme = 'foi et promesse';
  else if (/\bgr[aâ]ce|mis[eé]ricorde|pardon\b/.test(text)) theme = 'grâce et restauration';

  const doctrinalThread =
    theme === 'création par la Parole efficace de Dieu'
      ? `Dieu crée et ordonne par sa Parole; la création dépend, vit et subsiste en lui.`
      : theme === 'lumière, ordre et mise en forme du chaos'
      ? `Dieu sépare, nomme et ordonne: de la confusion naît un monde habitable sous sa lumière.`
      : theme === 'alliance et fidélité divine'
      ? `Dieu s’engage envers son peuple, promet et garde sa parole à travers l’histoire.`
      : theme === 'foi et promesse'
      ? `La Parole appelle la confiance; la foi reçoit et suit la promesse de Dieu.`
      : theme === 'grâce et restauration'
      ? `Dieu fait grâce aux pécheurs: pardon, relèvement, vie nouvelle en Christ.`
      : `Dieu se révèle souverainement; sa Parole fonde la foi et l’obéissance.`;

  // Parallèles canoniques
  const parallels = [];
  const pushRef = (b, c, v) => parallels.push(linkRef(b, c, v));
  if (theme.includes('création')) { pushRef('Psaumes', 33, '6'); pushRef('Jean', 1, '1–3'); pushRef('Hébreux', 11, '3'); }
  if (theme.includes('lumière')) { pushRef('2 Corinthiens', 4, '6'); pushRef('Jean', 8, '12'); }
  if (theme.includes('foi')) { pushRef('Romains', 10, '17'); pushRef('Hébreux', 11, '1'); }
  if (theme.includes('grâce')) { pushRef('Éphésiens', 2, '8–9'); pushRef('Tite', 3, '4–7'); }
  if (theme.includes('alliance')) { pushRef('Genèse', 15, '1–6'); pushRef('Luc', 22, '20'); }

  // Verset clé
  const keyVerse = verses && verses.length ? verses.reduce((best, v) => {
    const t = v.text.toLowerCase();
    let s = 0;
    if (/\bdieu|seigneur|christ|j[eé]sus|esprit\b/.test(t)) s += 3;
    if (/\bfoi|gr[aâ]ce|parole|vie|v[ée]rit[eé]\b/.test(t)) s += 2;
    if (v.text.length >= 40 && v.text.length <= 180) s += 2;
    return (s > best.s) ? { v: v.v, t: v.text, s } : best;
  }, { v: null, t: '', s: -1 }) : null;

  // Réponses auto (Rubrique 3)
  const answers = {
    thread: doctrinalThread,
    tensions:
      theme.includes('création')
        ? `Lecture théologique vs chronologie stricte ; refrain liturgique ; portée universelle du message.`
        : theme.includes('alliance')
        ? `Signe et portée de l’alliance ; condition/prome sse ; continuité AT/NT.`
        : theme.includes('foi')
        ? `Foi/œuvres ; épreuve et persévérance ; assurance.`
        : theme.includes('grâce')
        ? `Gratuité et transformation ; grâce et responsabilité.`
        : `Lettre/esprit ; sens littéral/figuratif ; transposition aujourd’hui.`,
    parallels: parallels.slice(0, 3),
    application:
      theme.includes('création')
        ? `Recevoir le monde comme don ; travailler et garder avec reconnaissance.`
        : theme.includes('lumière')
        ? `Rejeter les œuvres des ténèbres ; rechercher clarté et vérité dans nos choix.`
        : theme.includes('foi')
        ? `Écouter la Parole chaque jour ; répondre par la prière et l’obéissance.`
        : theme.includes('grâce')
        ? `Accueillir le pardon ; pratiquer la miséricorde envers le prochain.`
        : `Connaitre Dieu ; vivre sobrement, justement et pieusement.`
  };

  return {
    title: `### ${book} ${chap} — fil conducteur\n*Référence :* ${linkRef(book, chap)}\n\nLecture du chapitre en recherchant le **fil doctrinal** et les **échos canoniques**.`,
    structureDetected: '• ' + structureDetected.join('\n• '),
    theme,
    doctrinalThread,
    keyVerse,
    parallels: answers.parallels,
    answers
  };
}

//////////////////////////// Sections ////////////////////////////
function sec(id, content, title, description = '') {
  return { id, title: title || '', description, content: String(content || '') };
}

function buildSections(book, chap, verses, content) {
  const info = enrichFromText(book, chap, verses, content);
  const titles = {
    1: 'Prière d’ouverture', 2: 'Canon et testament', 3: 'Questions du chapitre précédent',
    4: 'Titre du chapitre', 5: 'Contexte historique', 6: 'Structure littéraire',
    7: 'Genre littéraire', 8: 'Auteur et généalogie', 9: 'Verset-clé doctrinal',
    10: 'Analyse exégétique', 11: 'Analyse lexicale', 12: 'Références croisées',
    13: 'Fondements théologiques', 14: 'Thème doctrinal', 15: 'Fruits spirituels',
    16: 'Types bibliques', 17: 'Appui doctrinal', 18: 'Comparaison interne',
    19: 'Parallèle ecclésial', 20: 'Verset à mémoriser', 21: 'Enseignement pour l’Église',
    22: 'Enseignement pour la famille', 23: 'Enseignement pour enfants',
    24: 'Application missionnaire', 25: 'Application pastorale', 26: 'Application personnelle',
    27: 'Versets à retenir', 28: 'Prière de fin'
  };

  const out = [];

  // 1 — Prière d’ouverture
  out.push(sec(1,
`### Prière d’ouverture

*Référence :* ${book} ${chap}

Père des lumières, nous venons à toi dans la dépendance de ton Esprit. Ouvre nos cœurs à ta Parole en ${book} ${chap}. Donne l’intelligence spirituelle et conduis-nous de la compréhension à l’obéissance. Au nom de Jésus-Christ. Amen.`,
    titles[1]));

  // 2 — Canon et testament
  out.push(sec(2,
`### Canon et testament

*Référence :* ${book} ${chap}

L’Écriture interprète l’Écriture : ${book} ${chap} s’inscrit dans l’unité de la révélation, orientée vers le Christ. Les passages clairs éclairent les plus obscurs ; la progression canonique ne se contredit pas.`,
    titles[2]));

  // 3 — Questions + RÉPONSES
  out.push(sec(3,
`### Questions du chapitre précédent

*Référence :* ${book} ${chap}

1) **Fil doctrinal dégagé**  
   → ${info.answers.thread}

2) **Tensions ou interrogations ouvertes**  
   → ${info.answers.tensions}

3) **Échos canoniques à vérifier**  
   → ${info.parallels.length ? info.parallels.join(' ; ') : 'À compléter avec une concordance.'}

4) **Application restée incomplète à reprendre cette semaine**  
   → ${info.answers.application}`,
    titles[3]));

  // 4 — Titre du chapitre
  out.push(sec(4,
`### Titre du chapitre

*Référence :* ${book} ${chap}

${info.theme.charAt(0).toUpperCase() + info.theme.slice(1)}.`,
    titles[4]));

  // 5 — Contexte historique
  out.push(sec(5,
`### Contexte historique

*Référence :* ${book} ${chap}

Cadre et portée : repérer destinataires, situation et visée théologique du chapitre ; lire le passage comme histoire du salut, non comme chronique exhaustive.`,
    titles[5]));

  // 6 — Structure littéraire (détectée)
  out.push(sec(6,
`### Structure littéraire

*Référence :* ${book} ${chap}

${info.structureDetected}`,
    titles[6]));

  // 7 — Genre littéraire
  out.push(sec(7,
`### Genre littéraire

*Référence :* ${book} ${chap}

Indications de genre implicites/explicites pour guider l’interprétation (narratif, poétique, prophétique, épistolaire…).`,
    titles[7]));

  // 8 — Auteur et généalogie
  out.push(sec(8,
`### Auteur et généalogie

*Référence :* ${book} ${chap}

Auteur humain inspiré par Dieu ; fiabilité du témoignage ; place dans l’histoire du canon.`,
    titles[8]));

  // 9 — Verset-clé doctrinal
  const vkey = info.keyVerse;
  out.push(sec(9,
`### Verset-clé doctrinal

*Référence :* ${book} ${chap}

${vkey ? `**${book} ${chap}:${vkey.v}** — ${vkey.t}` : `Choisir un verset pivot pour la doctrine et la mémoire (longueur moyenne, clarté doctrinale).`}`,
    titles[9]));

  // 10 — Analyse exégétique
  out.push(sec(10,
`### Analyse exégétique

*Référence :* ${book} ${chap}

Contexte littéral et historique ; logique du passage ; liens proches et lointains ; éviter les sur-lectures.`,
    titles[10]));

  // 11 — Analyse lexicale
  out.push(sec(11,
`### Analyse lexicale

*Référence :* ${book} ${chap}

Termes-clés du chapitre à observer (racines, champs sémantiques, parallèles).`,
    titles[11]));

  // 12 — Références croisées
  out.push(sec(12,
`### Références croisées

*Référence :* ${book} ${chap}

Échos suggérés : ${info.parallels.length ? info.parallels.join(' ; ') : 'à compléter selon le thème.'}`,
    titles[12]));

  // 13 — Fondements théologiques
  out.push(sec(13,
`### Fondements théologiques

*Référence :* ${book} ${chap}

Attributs de Dieu, création, alliance, rédemption, providence, sainteté… selon l’accent du chapitre.`,
    titles[13]));

  // 14 — Thème doctrinal
  out.push(sec(14,
`### Thème doctrinal

*Référence :* ${book} ${chap}

${info.doctrinalThread}`,
    titles[14]));

  // 15 — Fruits spirituels
  out.push(sec(15,
`### Fruits spirituels

*Référence :* ${book} ${chap}

Foi, espérance, amour ; humilité, justice, miséricorde ; vie de prière et d’adoration.`,
    titles[15]));

  // 16 — Types bibliques
  out.push(sec(16,
`### Types bibliques

*Référence :* ${book} ${chap}

Typologie prudente (création/recréation, exode, roi/serviteur, temple, alliance).`,
    titles[16]));

  // 17 — Appui doctrinal
  out.push(sec(17,
`### Appui doctrinal

*Référence :* ${book} ${chap}

Textes concordants qui confirment l’interprétation sans forcer le sens.`,
    titles[17]));

  // 18 — Comparaison interne
  out.push(sec(18,
`### Comparaison interne

*Référence :* ${book} ${chap}

Harmoniser les péricopes du livre ; noter les progressions et répétitions.`,
    titles[18]));

  // 19 — Parallèle ecclésial
  out.push(sec(19,
`### Parallèle ecclésial

*Référence :* ${book} ${chap}

Usage ecclésial : catéchèse, liturgie, mission, discipline spirituelle.`,
    titles[19]));

  // 20 — Verset à mémoriser
  out.push(sec(20,
`### Verset à mémoriser

*Référence :* ${book} ${chap}

${vkey ? `**${book} ${chap}:${vkey.v}** — à apprendre par cœur.` : `Choisir un verset clair, bref, doctrinalement solide.`}`,
    titles[20]));

  // 21 — Enseignement pour l’Église
  out.push(sec(21,
`### Enseignement pour l’Église

*Référence :* ${book} ${chap}

Doctrine, culte, gouvernement, discipline ; l’Église reçoit et obéit à la Parole.`,
    titles[21]));

  // 22 — Enseignement pour la famille
  out.push(sec(22,
`### Enseignement pour la famille

*Référence :* ${book} ${chap}

Transmission intergénérationnelle : lecture, prière, pratique quotidienne de la justice et de la miséricorde.`,
    titles[22]));

  // 23 — Enseignement pour enfants
  out.push(sec(23,
`### Enseignement pour enfants

*Référence :* ${book} ${chap}

Expliquer avec simplicité, raconter fidèlement, prier ensemble, mémoriser.`,
    titles[23]));

  // 24 — Application missionnaire
  out.push(sec(24,
`### Application missionnaire

*Référence :* ${book} ${chap}

Témoignage, service, hospitalité ; contextualiser sans trahir le message.`,
    titles[24]));

  // 25 — Application pastorale
  out.push(sec(25,
`### Application pastorale

*Référence :* ${book} ${chap}

Consoler, avertir, encourager ; accompagner les consciences par l’Écriture.`,
    titles[25]));

  // 26 — Application personnelle
  out.push(sec(26,
`### Application personnelle

*Référence :* ${book} ${chap}

Prier, confesser, décider un pas concret cette semaine (lecture, réconciliation, service).`,
    titles[26]));

  // 27 — Versets à retenir
  out.push(sec(27,
`### Versets à retenir

*Référence :* ${book} ${chap}

Sélection pour la prière et le partage : ${linkRef(book, chap)}`,
    titles[27]));

  // 28 — Prière de fin
  out.push(sec(28,
`### Prière de fin

*Référence :* ${book} ${chap}

Nous te rendons grâce pour ${book} ${chap}. Scelle cette Parole dans nos cœurs ; fais-nous vivre pour ta gloire. Amen.`,
    titles[28]));

  return out;
}

//////////////////////////// Fallback ////////////////////////////
function buildFallbackStudy(book, chap) {
  const titles = [
    'Prière d’ouverture','Canon et testament','Questions du chapitre précédent','Titre du chapitre',
    'Contexte historique','Structure littéraire','Genre littéraire','Auteur et généalogie','Verset-clé doctrinal',
    'Analyse exégétique','Analyse lexicale','Références croisées','Fondements théologiques','Thème doctrinal',
    'Fruits spirituels','Types bibliques','Appui doctrinal','Comparaison interne','Parallèle ecclésial',
    'Verset à mémoriser','Enseignement pour l’Église','Enseignement pour la famille','Enseignement pour enfants',
    'Application missionnaire','Application pastorale','Application personnelle','Versets à retenir','Prière de fin'
  ];
  const sections = [];
  for (let i = 1; i <= 28; i++) {
    sections.push({
      id: i,
      title: titles[i - 1],
      description: '',
      content: `### ${titles[i - 1]}\n\n*Référence :* ${book} ${chap}\n\nContenu de base (fallback). Développer selon le chapitre.`
    });
  }
  return { sections };
}

//////////////////////////// Build principal ////////////////////////////
function parsePassage(p) {
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p || '').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2], 10) : 1 };
}

async function buildStudy(passage, _length, version = 'LSG') {
  const { book, chap } = parsePassage(passage || 'Genèse 1');

  try {
    const data = await fetchChapter(book, chap);
    if (data.ok) {
      const sections = buildSections(book, chap, data.verses, data.content);
      return {
        study: { sections },
        metadata: {
          book, chapter: chap, version,
          generatedAt: new Date().toISOString(),
          usedApiBible: data.usedApi === true,
          verseCount: data.verses?.length || 0
        }
      };
    }
    // Fallback si pas OK
    return {
      study: buildFallbackStudy(book, chap),
      metadata: {
        book, chapter: chap, version,
        generatedAt: new Date().toISOString(),
        emergency: true, error: 'no_api_or_empty'
      }
    };
  } catch (e) {
    // Fallback sur erreur API
    return {
      study: buildFallbackStudy(book, chap),
      metadata: {
        book, chapter: chap, version,
        generatedAt: new Date().toISOString(),
        emergency: true, error: String(e?.message || e)
      }
    };
  }
}

//////////////////////////// Handler ////////////////////////////
async function core(ctx) {
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return send200(ctx, {
      ok: true,
      route: '/api/generate-study',
      method: 'GET',
      hint: 'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques.',
      requires: { API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }

  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();

    try {
      const result = await buildStudy(passage, body?.options?.length, version);
      return send200(ctx, result);
    } catch (e) {
      return send200(ctx, {
        study: { sections: [] },
        metadata: { emergency: true, error: String(e?.message || e) }
      });
    }
  }

  // Autres méthodes → hint
  return send200(ctx, { ok: true, route: '/api/generate-study', hint: 'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res) {
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    const payload = { study: { sections: [] }, metadata: { emergency: true, fatal: true, error: String(e?.message || e) } };
    if (res && typeof res.status === 'function') {
      res.status(200);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }
}

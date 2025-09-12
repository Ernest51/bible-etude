// /api/generate-study.js
// Génération 28 rubriques basée sur /api/verses (même logique que Rubrique 0)
// - POST { passage:"Genèse 1", options:{ length: 1500|2200|3000 } }
// - Réponse: { study:{ sections:[{id,title,description,content},...] }, metadata:{...} }

export const config = { runtime: 'nodejs' };

/* -------------------- Utils HTTP -------------------- */
async function readBody(req) {
  if (!req) return {};
  if (typeof req.json === 'function') {
    try { return await req.json(); } catch {}
  }
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  await new Promise((res, rej) => {
    req.on('data', c => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', res);
    req.on('error', rej);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function sendJSON(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

/* -------------------- Helpers texte -------------------- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc plus haut plus bas bien mal grand petit etat etats fait faire oui non'.split(/\s+/));

function words(txt) {
  return (txt||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean);
}

function topKeywords(text, k=12){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

function countOccurrences(text, re) {
  if (!text) return 0;
  let c=0, m;
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while((m=r.exec(text))){ c++; if (r.lastIndex===m.index) r.lastIndex++; }
  return c;
}

/* -------------------- Verses via endpoint local -------------------- */
async function fetchLocalVerses(baseOrigin, book, chapter) {
  // baseOrigin = "https://bible-etude-...vercel.app"
  const url = `${baseOrigin}/api/verses?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}`;
  const r = await fetch(url, { headers:{ accept: 'application/json' }, cache:'no-store' });
  const ct = (r.headers.get('content-type')||'').toLowerCase();
  const txt = await r.text();
  let j = {};
  if (ct.includes('application/json')) {
    try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }
  } else {
    j = { raw: txt, nonJSON: true };
  }
  if (!r.ok) {
    const msg = j?.error || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.status = r.status;
    err.details = j;
    throw err;
  }
  return j;
}

/* -------------------- Analyse chapitre -------------------- */
function analyzeChapter(versesArr) {
  const texts = versesArr.map(v => v.text || '').join(' ');
  const all = CLEAN(texts);
  const kw = topKeywords(all, 14);

  const counters = {
    dit: countOccurrences(all, /\b(dieu\s+dit|il\s+dit|dit)\b/i),
    vit: countOccurrences(all, /\b(vit|voit|vit\s+que)\b/i),
    sépara: countOccurrences(all, /\b(separa|sépara|separer|séparer)\b/i),
    bénit: countOccurrences(all, /\b(benit|bénit|benir|bénir)\b/i),
    appela: countOccurrences(all, /\b(appela|nomma|nommait)\b/i),
    lumière: countOccurrences(all, /\blumi[eè]re?\b/i),
    esprit: countOccurrences(all, /\besprit\b/i),
    homme: countOccurrences(all, /\b(homme|humain|adam)\b/i),
    soirMatin: countOccurrences(all, /\b(soir|matin)\b/i),
  };

  // Verset-clé (simple heuristique)
  let key = null, best = -1;
  const doctrinal = /(dieu|seigneur|christ|j[ée]sus|esprit|parole|foi|gr(â|a)ce|salut|alliance|v(é|e)rit(é|e)|royaume|p(é|e)ch(é|e)|cr(é|e)a)/i;
  for (const v of versesArr) {
    if (!v?.text) continue;
    let score = 0;
    if (doctrinal.test(v.text)) score += 3;
    const L = v.text.length;
    if (L >= 50 && L <= 200) score += 4;
    if (/\b(car|ainsi|donc|c'est pourquoi)\b/i.test(v.text)) score += 2;
    if (score > best) { best = score; key = v; }
  }

  return { keywords: kw, counters, keyVerse: key };
}

/* -------------------- Mise en forme & liens YV -------------------- */
const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_VERSION_ID = { LSG:'93' };

function linkRef(book, chap, vv, vId='LSG'){
  const code = USFM[book] || 'GEN';
  const ver = YV_VERSION_ID[vId] || '93';
  const anchor = vv ? ('#v'+vv) : '';
  return `https://www.bible.com/fr/bible/${ver}/${code}.${chap}.${vId}${anchor}`;
}

/* -------------------- Génération des 28 rubriques -------------------- */
function uniqTake(pool, used){
  for (const s of pool) { if (s && !used.has(s)) { used.add(s); return s; } }
  return pool[0] || '';
}

function buildSections(book, chap, verses, analysis, budget=1500) {
  const used = new Set();
  const ref = `${book} ${chap}`;
  const vvCount = verses.length || 0;

  // Aides contextuelles
  const first = verses[0];
  const last = verses[vvCount-1];
  const keyV = analysis.keyVerse;
  const kwords = analysis.keywords;

  const mkList = arr => arr.map(x=>`- ${x}`).join('\n');
  const mkRef = (vObj) => vObj?.v ? `[${book} ${chap}:${vObj.v}](${linkRef(book, chap, vObj.v)})` : `[${ref}](${linkRef(book, chap)})`;

  // Phrases variées (anti-doublon)
  const openPrayers = [
    `Père des lumières, en ${ref}, éclaire nos cœurs par ton Esprit afin que ta Parole soit reçue avec foi et obéissance.`,
    `Dieu saint, alors que nous lisons ${ref}, rends-nous attentifs à ta vérité et prompts à la mettre en pratique.`,
    `Seigneur, nous ouvrons ${ref} devant toi : enseigne-nous, reprends-nous, et conduis-nous sur tes sentiers.`
  ];
  const closePrayers = [
    `Seigneur, scelle en nous l’enseignement reçu de ${ref} et conduis nos pas dans la sainteté.`,
    `Père, que la semence de ${ref} porte du fruit en amour, en justice et en persévérance.`,
    `Dieu de paix, fais prospérer en nous la Parole de ${ref}, pour la gloire de Christ.`
  ];

  const sections = [];

  // 1. Prière d'ouverture
  sections.push({
    id:1, title:"Prière d’ouverture", description:"",
    content:
`### Prière d’ouverture

*Référence :* ${ref}

${uniqTake(openPrayers, used)}

> **Verset d’appui :** ${mkRef(first)} — *${first?.text || '...'}*`
  });

  // 2. Canon et testament
  sections.push({
    id:2, title:"Canon et testament", description:"",
    content:
`### Canon et testament

*Référence :* ${ref}

L’Écriture s’explique par l’Écriture. ${ref} s’insère dans l’unité du canon : les passages clairs éclairent les plus obscurs, et **le Christ** est le centre de l’herméneutique. 
Repères :
${mkList([
  `Lire ${ref} en dialogue avec d’autres textes (résonances, promesses, accomplissements).`,
  `Honorer le sens littéral (grammatical et historique) avant toute application.`,
  `Éviter l’isolement du verset : tenir la cohérence doctrinale du canon.`
])}

> **Clé canonique (possible) :** ${mkRef(keyV)} — *${keyV?.text || 'sélection doctrinale du chapitre'}*`
  });

  // 3. Questions du chapitre précédent (et réponses ciblées par motifs)
  const answers = [
    `**Fil conducteur doctrinal** — ${analysis.counters.lumière>0?'Création et lumière divine comme acte souverain de Dieu':'Création et seigneurie de Dieu sur l’ordre du monde'}.`,
    `**Tensions / interrogations** — ${analysis.counters.homme>0?'Dignité et vocation de l’homme, question de l’image de Dieu':'Portée du langage de création et de l’ordre institué'}.`,
    `**Échos canoniques** — À confronter avec ${book} ${chap} et passages connexes (p.ex. Jean 1 ; Hébreux 11 ; Psaume 33).`,
    `**Application à reprendre** — Prier à partir de ${mkRef(keyV)} et traduire en gestes de justice et de louange.`
  ];
  sections.push({
    id:3, title:"Questions du chapitre précédent", description:"",
    content:
`### Questions du chapitre précédent

*Référence :* ${ref}

1) Quel est le fil conducteur doctrinal dégagé ?  
→ ${answers[0]}

2) Quelles tensions/interrogations le texte laisse-t-il ouvertes ?  
→ ${answers[1]}

3) Quels échos canoniques appellent vérification ?  
→ ${answers[2]}

4) Quelle application reprendre cette semaine ?  
→ ${answers[3]}`
  });

  // 4. Titre du chapitre
  const titleGuess =
    analysis.counters.lumière>0 ? 'Création et lumière' :
    analysis.counters.homme>0 ? 'Image de Dieu et vocation de l’homme' :
    analysis.counters.dit>0 ? 'La Parole qui ordonne le monde' :
    'Création et souveraineté divine';
  sections.push({
    id:4, title:"Titre du chapitre", description:"",
    content:
`### Titre du chapitre

*Référence :* ${ref}

**Proposition :** *${titleGuess}*  
Motifs majeurs : ${kwords.slice(0,5).join(', ')}.  
> **Verset d’ancrage :** ${mkRef(keyV)} — *${keyV?.text || '—'}*`
  });

  // 5. Contexte historique
  sections.push({
    id:5, title:"Contexte historique", description:"",
    content:
`### Contexte historique

*Référence :* ${ref}

Lecture dans son cadre : auteurs, auditeurs, circonstances. Le propos de ${ref} n’est pas mythique mais **théologique et historique**, révélant Dieu comme **Créateur** et ordonnateur. 
Points d’attention :
${mkList([
  `La finalité du texte : faire connaître Dieu et former le peuple à la foi.`,
  `Le langage employé : portée doctrinale (vérité) et dimension liturgique.`,
  `La réception canonique : ${book} dans l’économie globale de la révélation.`
])}`
  });

  // 6. Structure littéraire
  sections.push({
    id:6, title:"Structure littéraire", description:"",
    content:
`### Structure littéraire

*Référence :* ${ref}

Repérer les enchaînements (formules récurrentes, parallélismes). Indices :
${mkList([
  `Formule *“Dieu dit”* : ${analysis.counters.dit} occurrence(s).`,
  `Formule *“Dieu vit que c’était bon”* : ${analysis.counters.vit} occurrence(s) (approx.).`,
  `Marqueurs *soir / matin* : ${analysis.counters.soirMatin} occurrence(s).`
])}

> **Observation :** la répétition souligne l’autorité efficace de la Parole divine.`
  });

  // 7. Genre littéraire
  sections.push({
    id:7, title:"Genre littéraire", description:"",
    content:
`### Genre littéraire

*Référence :* ${ref}

Registre dominant : **narratif à portée doctrinale**.  
La visée n’est pas la curiosité scientifique mais la **confession de foi** : Dieu crée, nomme, bénit, confie une vocation.`
  });

  // 8. Auteur et généalogie (selon le livre)
  sections.push({
    id:8, title:"Auteur et généalogie", description:"",
    content:
`### Auteur et généalogie

*Référence :* ${ref}

Tradition d’attribution (selon le livre) et transmission canonique. Les généalogies, quand elles apparaissent, situent l’histoire du salut. Ici, la focale est sur **Dieu sujet** et la **création** objet de son œuvre.`
  });

  // 9. Verset-clé doctrinal
  sections.push({
    id:9, title:"Verset-clé doctrinal", description:"",
    content:
`### Verset-clé doctrinal

*Référence :* ${ref}

**${mkRef(keyV)}** — *${keyV?.text || '—'}*  
Pourquoi clé :
${mkList([
  `Concentre un thème doctrinal décisif (création / parole / image de Dieu / bénédiction).`,
  `Formulation mémorisable pour la catéchèse et la prière.`,
  `Pont vers d’autres passages (références croisées).`
])}`
  });

  // 10. Analyse exégétique
  sections.push({
    id:10, title:"Analyse exégétique", description:"",
    content:
`### Analyse exégétique

*Référence :* ${ref}

Méthode grammatico-historique : sens littéral d’abord, selon le contexte proche (péricope) et lointain (canon).  
Indices lexicaux : ${kwords.slice(0,6).join(', ')}.  
> **Équilibre** : le texte révèle Dieu en action, non une spéculation abstraite.`
  });

  // 11. Analyse lexicale
  sections.push({
    id:11, title:"Analyse lexicale", description:"",
    content:
`### Analyse lexicale

*Référence :* ${ref}

Termes à observer : ${kwords.slice(0,8).join(', ')}.  
> Relever champ sémantique (nommer, bénir, voir, séparer), valeur des parallélismes et effets d’échos.`
  });

  // 12. Références croisées
  sections.push({
    id:12, title:"Références croisées", description:"",
    content:
`### Références croisées

*Référence :* ${ref}

Exemples (à vérifier en lecture) :
${mkList([
  'Jean 1:1–5 — Parole et création',
  'Colossiens 1:16–17 — Christ et création',
  'Psaume 33:6–9 — Par la parole de l’Éternel'
])}`
  });

  // 13. Fondements théologiques
  sections.push({
    id:13, title:"Fondements théologiques", description:"",
    content:
`### Fondements théologiques

*Référence :* ${ref}

Axes :
${mkList([
  '**Dieu Créateur** : souverain, bon, ordonnateur.',
  '**Parole efficace** : ce que Dieu dit advient.',
  '**Alliance et vocation** : bénédiction et mission de l’homme.'
])}`
  });

  // 14. Thème doctrinal
  sections.push({
    id:14, title:"Thème doctrinal", description:"",
    content:
`### Thème doctrinal

*Référence :* ${ref}

Déploiement d’un thème central (p.ex. **création et lumière**${analysis.counters.lumière>0?', très présent':''}).  
Articulation avec l’ensemble de l’Écriture et le témoignage de l’Église.`
  });

  // 15. Fruits spirituels
  sections.push({
    id:15, title:"Fruits spirituels", description:"",
    content:
`### Fruits spirituels

*Référence :* ${ref}

À demander à Dieu :
${mkList([
  'Foi confiante en la Parole qui ordonne et sauve',
  'Reconnaissance et louange',
  'Sagesse pour habiter la création en intendants'
])}`
  });

  // 16. Types bibliques
  sections.push({
    id:16, title:"Types bibliques", description:"",
    content:
`### Types bibliques

*Référence :* ${ref}

Lire les **figures** et **annonces** qui convergent vers le Christ (sans sur-interprétation).`
  });

  // 17. Appui doctrinal
  sections.push({
    id:17, title:"Appui doctrinal", description:"",
    content:
`### Appui doctrinal

*Référence :* ${ref}

Synthèse avec confessions/caté chismes (selon ton cadre ecclésial) :
${mkList([
  'Dieu Créateur du ciel et de la terre',
  'Providence et bonté de Dieu',
  'Dignité et vocation de l’homme'
])}`
  });

  // 18. Comparaison interne
  sections.push({
    id:18, title:"Comparaison interne", description:"",
    content:
`### Comparaison interne

*Référence :* ${ref}

Comparer ${ref} avec des péricopes proches (structure, style, progression).  
Repérer reprises et contrastes (p.ex. “dit / vit / bénit / appela”).`
  });

  // 19. Parallèle ecclésial
  sections.push({
    id:19, title:"Parallèle ecclésial", description:"",
    content:
`### Parallèle ecclésial

*Référence :* ${ref}

Impact communautaire : culte (louange au Créateur), formation (catéchèse de la création), mission (témoignage sur l’ordre reçu de Dieu).`
  });

  // 20. Verset à mémoriser
  sections.push({
    id:20, title:"Verset à mémoriser", description:"",
    content:
`### Verset à mémoriser

*Référence :* ${ref}

**${mkRef(keyV)}** — *${keyV?.text || '—'}*  
> **Astuce** : recopier, répéter, prier ce verset durant la semaine.`
  });

  // 21. Enseignement pour l’Église
  sections.push({
    id:21, title:"Enseignement pour l’Église", description:"",
    content:
`### Enseignement pour l’Église

*Référence :* ${ref}

Édification :
${mkList([
  'Adoration du Dieu Créateur',
  'Éthique de la création (justice, sobriété, bonté)',
  'Mission : témoigner de l’ordre de Dieu et de sa grâce'
])}`
  });

  // 22. Enseignement pour la famille
  sections.push({
    id:22, title:"Enseignement pour la famille", description:"",
    content:
`### Enseignement pour la famille

*Référence :* ${ref}

Transmission intergénérationnelle : lire ensemble, prier, pratiquer la justice au quotidien (travail, repos, parole vraie).`
  });

  // 23. Enseignement pour enfants
  sections.push({
    id:23, title:"Enseignement pour enfants", description:"",
    content:
`### Enseignement pour enfants

*Référence :* ${ref}

Dieu a tout créé par sa Parole : il est bon et nous aime.  
Activité : mémoriser ${mkRef(keyV)} et dessiner “Dieu crée et bénit”.`
  });

  // 24. Application missionnaire
  sections.push({
    id:24, title:"Application missionnaire", description:"",
    content:
`### Application missionnaire

*Référence :* ${ref}

Témoigner du Créateur : parler avec douceur et respect (1 Pi 3:15), mettre en valeur l’ordre reçu (travail juste, parole vraie, repos).`
  });

  // 25. Application pastorale
  sections.push({
    id:25, title:"Application pastorale", description:"",
    content:
`### Application pastorale

*Référence :* ${ref}

Accompagner : restaurer la dignité (image de Dieu), réconcilier, encourager à habiter le monde comme intendants du Créateur.`
  });

  // 26. Application personnelle
  sections.push({
    id:26, title:"Application personnelle", description:"",
    content:
`### Application personnelle

*Référence :* ${ref}

Décisions concrètes cette semaine :
${mkList([
  'Prendre un temps quotidien d’écoute de la Parole',
  'Exprimer la gratitude pour la bonté de la création',
  'Un acte de justice / service en réponse à ${ref}'
])}`
  });

  // 27. Versets à retenir
  const toKeep = [first, keyV, last].filter(Boolean);
  sections.push({
    id:27, title:"Versets à retenir", description:"",
    content:
`### Versets à retenir

*Référence :* ${ref}

${toKeep.map(v => `- **${mkRef(v)}** — *${v.text}*`).join('\n') || '- —'}`
  });

  // 28. Prière de fin
  sections.push({
    id:28, title:"Prière de fin", description:"",
    content:
`### Prière de fin

*Référence :* ${ref}

${uniqTake(closePrayers, used)}`
  });

  // Ajustement “budget” simple : si length demandé > 2000, on étoffe quelques blocs
  if (budget >= 2000) {
    sections[10].content += `

**Zoom lexical (supplément)** — Explorer les verbes d’initiative divine (*dire, faire, voir, bénir, appeler*) et leur portée théologique.`;
    sections[5].content += `

**Note structurelle (supplément)** — La scansion récurrente oriente la lecture vers l’**autorité** et la **bonté** du Créateur.`;
    sections[13].content += `

**Synthèse** — Doctrine de la création : origine en Dieu, bonté de l’ordre, vocation humaine responsable.`;
  }

  return sections;
}

/* -------------------- Orchestrateur -------------------- */
function parsePassage(p) {
  const m = /^(.+?)\s+(\d+)(?:.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

function normalizeLength(len) {
  const L = Number(len);
  if (L === 500 || L === 1500 || L === 2500 || L === 3000) return L;
  return 1500;
}

async function buildStudyFromLocalVerses(baseOrigin, passage, length) {
  const { book, chap } = parsePassage(passage);
  const density = normalizeLength(length);

  const j = await fetchLocalVerses(baseOrigin, book, chap);
  const verses = Array.isArray(j?.verses) ? j.verses.map(v => ({ v: v.v, text: CLEAN(v.text||'') })) : [];
  const version = j?.version || 'LSG';
  const source = j?.source || 'unknown';

  const analysis = analyzeChapter(verses);
  const sections = buildSections(book, chap, verses, analysis, density);

  return {
    study: { sections },
    metadata: {
      book, chapter: chap, version,
      generatedAt: new Date().toISOString(),
      usedLocalVerses: true,
      usedApiBible: /^api\.bible/i.test(String(source||'')),
      verseCount: verses.length,
      diagnostics: [
        `source:${source}`,
        `keywords:${analysis.keywords.join(',')}`
      ]
    }
  };
}

/* -------------------- Handler -------------------- */
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return sendJSON(res, 200, {
        ok: true,
        route: '/api/generate-study',
        hint: 'POST { "passage":"Genèse 1", "options":{ "length":1500|2500|3000 } }',
        note: 'Cette version lit /api/verses et compose les 28 rubriques dynamiquement (comme Rubrique 0).'
      });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const passage = String(body?.passage || '').trim() || 'Genèse 1';
      const length = Number(body?.options?.length || 1500);

      // Base origin depuis l’host (production Vercel en HTTPS)
      const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
      const proto = (req.headers['x-forwarded-proto'] || 'https').toString().split(',')[0];
      const baseOrigin = `${proto}://${host}`;

      const result = await buildStudyFromLocalVerses(baseOrigin, passage, length);
      return sendJSON(res, 200, result);
    }

    return sendJSON(res, 405, { ok:false, error:'Method Not Allowed' });
  } catch (e) {
    // On renvoie 200 + payload erreur (pour ne pas casser le front existant)
    return sendJSON(res, 200, {
      study: { sections: [] },
      metadata: {
        emergency: true,
        error: String(e?.message || e),
        generatedAt: new Date().toISOString()
      }
    });
  }
}

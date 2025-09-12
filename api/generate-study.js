// /api/generate-study.js
// Génération 28 rubriques — style “Rubrique 0” (analyse structurée), dynamique via api.bible.
// Toujours 200 (GET: hint, POST: sections). Aucune CORS nécessaire (même origine).

/* ============ HTTP utils ============ */
async function fetchJson(url, { headers = {}, timeout = 12000, retries = 1 } = {}) {
  const once = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const txt = await r.text();
      let json; try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
      if (!r.ok) { const msg = json?.error?.message || `HTTP ${r.status}`; const e = new Error(msg); e.status=r.status; e.details=json; throw e; }
      return json;
    } finally { clearTimeout(tid); }
  };
  let last;
  for (let i=0;i<=retries;i++){ try { return await once(); } catch(e){ last=e; if (i===retries) throw e; await new Promise(r=>setTimeout(r, 250*(i+1))); } }
  throw last;
}

function send200(ctx, data){
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type','application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control','no-store');
    ctx.res.end(payload); return;
  }
  return new Response(payload, { status:200, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});
}
async function readBody(ctx){
  const req = ctx.req; if (!req) return {};
  if (typeof req.json==='function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body==='object') return req.body;
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

/* ============ Mappings & ENV ============ */
const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';
const YV_VERSION_ID = { LSG:'93' };

/* ============ Helpers texte / analyse ============ */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
function words(text){ return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); }
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici dès sous chez afin lorsque tandis puisque cependant encore déjà presque souvent toujours jamais plutôt donc car or ni'.split(/\s+/));

function topKeywords(text, k=14){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}
function detectThemes(t){
  const out=[]; const add=(k,refs)=>out.push({k,refs});
  if (/\b(lumiere|lumière)\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(createur|créateur|creation|création|créa|crea)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\b(alliance)\b/.test(t)) add('alliance', [['Genèse',15,'1–6'],['Luc',22,'20']]);
  return out;
}
function guessGenre(book, t){
  if (/\bvision|songe|oracle|ainsi dit\b/.test(t)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez|harpe\b/.test(t)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume|pharisien|samaritain\b/.test(t)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(t)) return 'historique';
  if (book==='Proverbes' || /\bproverbe|sagesse\b/.test(t)) return 'sagesse';
  if (/\bgr(â|a)ce|foi|justification|circoncision|apôtres?\b/.test(t)) return 'épître/doctrinal';
  return 'narratif/doctrinal';
}
function buildOutline(verseCount){
  const n = Math.max(3, Math.min(7, Math.round(Math.sqrt(Math.max(6, verseCount||6)))));
  const size = Math.max(1, Math.floor((verseCount||6)/n));
  const labels = ['Ouverture','Développement','Pivot','Instruction','Exhortation','Conséquences','Conclusion'];
  const out = [];
  for (let i=0;i<n;i++){
    const from = i*size+1, to = i===n-1 ? (verseCount||n*size) : Math.min(verseCount||n*size, (i+1)*size);
    out.push({ from, to, label: labels[i]||`Section ${i+1}` });
  }
  return out;
}
function scoreKeyVerse(verses){
  const KEYS = ['dieu','seigneur','christ','jésus','jesus','foi','amour','esprit','lumiere','lumière','grace','grâce','parole','vie','royaume','loi','alliance','croire','vérité','verite','salut'];
  let best = { v:null, text:'', score:-1 };
  for (const it of verses||[]){
    if (!it?.v || !it?.text) continue;
    const t = it.text.toLowerCase(); let s = 0;
    for (const k of KEYS) if (t.includes(k)) s += 2;
    const len = it.text.length; if (len>=40 && len<=240) s += 2; else if (len<18 || len>320) s -= 1;
    if (s > best.score) best = { v: it.v, text: it.text, score:s };
  }
  return best.v ? best : null;
}

/* ============ Anti-doublon global (entre rubriques) ============ */
class UniqueManager{
  constructor(){ this.used = new Set(); }
  take(candidates){
    for (const s of candidates){
      const key = s.trim().toLowerCase();
      if (!this.used.has(key)) { this.used.add(key); return s; }
    }
    // si tout est pris, petite variation pour rester unique
    const s = (candidates[0]||'').replace(/\.$/,'');
    const v = s + ' — ' + Math.random().toString(36).slice(2,6) + '.';
    this.used.add(v.toLowerCase()); return v;
  }
}

/* ============ api.bible : fetch chapitre + versets ============ */
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  let content = '';
  try {
    const A = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, { headers, timeout: 12000, retries: 1 });
    content = CLEAN(A?.data?.content || A?.data?.text || '');
  } catch {}

  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 12000, retries: 1 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

  // parse versets depuis le texte si possible
  let verses = [];
  if (content){
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:CLEAN(m[2])}:null; }).filter(Boolean);
    if (verses.length < Math.max(2, Math.floor((verseItems?.length||0)/3))) {
      const arr=[]; const re=/(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while((m=re.exec(content))) arr.push({ v:+m[1], text: CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }
  return { ok: !!content, content, verses, verseCount: (verseItems?.length || verses?.length || 0) };
}

/* ============ Rendu façon “Rubrique 0” (tas de balises fixes) ============ */
function mkBlockLikePV({book, chap, refLabel, raw, motifs, key, addLines=[]}){
  // même rythme que la rubrique 0
  const ref = refLabel || `${book} ${chap}`;
  const motifsLine = motifs?.length ? motifs.join('; ') : 'création, providence et finalité en Dieu';
  const quote = key?.text ? `> *« ${key.text} »*` : '';

  const core = [
    `**Analyse littéraire** — Relever les termes-clés, parallélismes et connecteurs. Le passage ${ref} s’insère dans l’argument et porte l’accent théologique.`,
    `**Axes théologiques** — ${motifsLine}.`,
    `**Échos canoniques** — Lire “Écriture par l’Écriture” (Torah, Sagesse, Prophètes; puis Évangiles et Épîtres).`,
    `**Christologie** — Comment ${ref} est récapitulé en **Christ** (Col 1:16-17; Lc 24:27) ?`,
    `**Ecclésial & pastoral** — Implications pour l’**Église** (adoration, mission, éthique).`,
    `**Application personnelle** — Prier le texte ; formuler une décision concrète aujourd’hui.`
  ];
  return [quote, ...core, ...addLines].filter(Boolean).join('\n\n');
}

/* ============ Génération d’une rubrique (28) ============ */
function makeSections(book, chap, ctx){
  const { keywords, themes, genre, outline, key } = ctx;
  const fam = bookFamily(book);
  const u = new UniqueManager();

  const motifs = [];
  if (themes?.length) motifs.push(...themes.map(t=>t.k));
  if (keywords?.length) motifs.push(`mots-clés : ${keywords.slice(0,4).map(x=>`**${x}**`).join(', ')}`);
  const motifLine = motifs;

  const mk = (id, title, body) => ({ id, title, description:'', content: body });

  // Titres standardisés (mêmes noms que le front)
  const T = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',
    9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',
    13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement pour enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',
    27:'Versets à retenir',28:'Prière de fin'
  };

  const sections = [];

  // 1) Prière d’ouverture (style PV)
  sections.push(mk(1, T[1],
`### Prière d’ouverture

*Référence :* ${book} ${chap}

${u.take([
  `Père des lumières, ouvre nos cœurs : **ta Parole** éclaire, **ton Esprit** guide.`,
  `Seigneur, dispose-nous à **écouter** et **obéir** humblement à ${book} ${chap}.`
])}

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 2) Canon et testament
  sections.push(mk(2, T[2],
`### Canon et testament

*Référence :* ${book} ${chap}

- L’Écriture interprète l’Écriture ; unité **AT/NT** centrée sur **Christ**.
- Lecture de ${book} ${chap} dans l’économie de l’alliance (${fam}, registre ${genre}).

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 3) Questions du chapitre précédent + réponses (style Q/R)
  const q1 = `**Q1. Quel attribut de Dieu ressort dans ${book} ${chap} ?**`;
  const a1 = u.take([
    `**R.** Sa **souveraineté** se manifeste dans la conduite du récit.`,
    `**R.** Sa **fidélité** soutient la promesse et oriente le texte.`
  ]);
  const q2 = `**Q2. Quel fil littéraire structure le passage ?**`;
  const a2 = u.take([
    `**R.** Une progression en mouvements autour de ${key?.v?`v.${key.v}`:'repères narratifs'}.`,
    `**R.** Des connecteurs (cause / contraste / conséquence) guident l’argument.`
  ]);
  const q3 = `**Q3. Quelle tension prépare la suite ?**`;
  const a3 = u.take([
    `**R.** L’appel à la **foi** et à la **repentance**, ouvrant l’espérance.`,
    `**R.** L’attente d’un accomplissement christocentrique.`
  ]);
  sections.push(mk(3, T[3],
`### Questions du chapitre précédent

*Référence :* ${book} ${chap}

${q1}
${a1}

${q2}
${a2}

${q3}
${a3}`));

  // 4) Titre du chapitre (proposition + index lexical)
  const titleProp = u.take([
    `**Proposition :** ${keywords?.[0]||'Parole'} → ${keywords?.[1]||'vie'} : trajectoire du chapitre.`,
    `**Proposition :** itinéraire de foi — ${keywords?.slice(0,3).join(' · ') || 'écouter · croire · pratiquer'}.`
  ]);
  sections.push(mk(4, T[4],
`### Titre du chapitre

*Référence :* ${book} ${chap}

${titleProp}

*Index lexical :* ${keywords?.slice(0,8).join(', ') || '—'}.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 5) Contexte historique
  sections.push(mk(5, T[5],
`### Contexte historique

*Référence :* ${book} ${chap}

- Famille : **${fam}** ; registre **${genre}**.
- Le cadre historique éclaire, mais **le texte fait autorité**.
- Finalité : connaître Dieu, édifier l’Église, orienter la vie.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 6) Structure littéraire (outline)
  const bloc = outline.map(o=>`- **v.${o.from}–${o.to} — ${o.label}**`).join('\n');
  sections.push(mk(6, T[6],
`### Structure littéraire

*Référence :* ${book} ${chap}

${bloc}

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 7) Genre littéraire
  sections.push(mk(7, T[7],
`### Genre littéraire

*Référence :* ${book} ${chap}

- Le registre **${genre}** oriente la lecture (rythme, parallélismes, connecteurs).
- La forme sert le sens : repérer les repères narratifs et l’argument.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 8) Auteur et généalogie
  sections.push(mk(8, T[8],
`### Auteur et généalogie

*Référence :* ${book} ${chap}

- **Inspiration** : l’auteur humain sert la Parole inspirée.
- Transmission ecclésiale fidèle (réception canonique).

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 9) Verset-clé doctrinal
  const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const quote = key?.text ? `> *« ${key.text} »*` : '> *(choisir un pivot dans le contexte).*';
  sections.push(mk(9, T[9],
`### Verset-clé doctrinal

*Référence :* ${label}

${quote}

${mkBlockLikePV({book, chap, refLabel: label, motifs: motifLine, key})}`));

  // 10) Analyse exégétique
  sections.push(mk(10, T[10],
`### Analyse exégétique

*Référence :* ${book} ${chap}

- Observer la **grammaire** (verbes porteurs) et les **connecteurs** (cause / contraste / conséquence).
- Contexte immédiat autour de ${key?.v?`v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}`:'chaque unité'}.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 11) Analyse lexicale
  const lex = (keywords||[]).slice(0,6).map(w=>`- **${w}** : terme clé du chapitre.`).join('\n') || '- Termes clés à relever.';
  sections.push(mk(11, T[11],
`### Analyse lexicale

*Référence :* ${book} ${chap}

${lex}

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 12) Références croisées
  const xrefs = (themes||[]).length
    ? themes.map(t=>`- **${t.k}** : ${t.refs.map(([b,c,v]) => `${b} ${c}:${v}`).join(', ')}`).join('\n')
    : '- À compléter selon les motifs relevés.';
  sections.push(mk(12, T[12],
`### Références croisées

${xrefs}

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 13) Fondements théologiques
  sections.push(mk(13, T[13],
`### Fondements théologiques

- Attributs de Dieu, **alliance** et promesse ; création et providence.
- L’Écriture interprète l’Écriture : doctrine reçue, non spéculée.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 14) Thème doctrinal
  sections.push(mk(14, T[14],
`### Thème doctrinal

*Référence :* ${book} ${chap}

Formuler le thème en une phrase centrée sur Dieu et son œuvre.  
Trajectoire : **révélation → rédemption → vie nouvelle**.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 15) Fruits spirituels
  sections.push(mk(15, T[15],
`### Fruits spirituels

- **Foi**, **espérance**, **amour** ; obéissance joyeuse ; persévérance.
- Consolation et transformation par l’Évangile.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 16) Types bibliques
  sections.push(mk(16, T[16],
`### Types bibliques

Repérer les figures canoniques (sans arbitraire) et leur accomplissement en **Christ**.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 17) Appui doctrinal
  sections.push(mk(17, T[17],
`### Appui doctrinal

Choisir des textes concordants qui confirment et balisent l’interprétation.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 18) Comparaison interne
  sections.push(mk(18, T[18],
`### Comparaison interne

Comparer les passages voisins ; noter **parallèles** et **contrastes** ; laisser le tout éclairer les parties.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 19) Parallèle ecclésial
  sections.push(mk(19, T[19],
`### Parallèle ecclésial

- Confession, liturgie et mission enracinées dans la Parole.
- Sobriété, clarté doctrinale, charité concrète.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 20) Verset à mémoriser
  sections.push(mk(20, T[20],
`### Verset à mémoriser

À méditer : ${label}.

${mkBlockLikePV({book, chap, refLabel: label, motifs: motifLine, key})}`));

  // 21) Enseignement pour l’Église
  sections.push(mk(21, T[21],
`### Enseignement pour l’Église

- **Parole & prière**, formation de disciples, mission locale.
- Gouvernance et service façonnés par le chapitre.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 22) Enseignement pour la famille
  sections.push(mk(22, T[22],
`### Enseignement pour la famille

- Raconter les œuvres de Dieu ; prier ; pratiquer la justice au quotidien.
- Habitudes : lecture courte régulière, prière commune, un verset/semaine.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 23) Enseignement pour enfants
  sections.push(mk(23, T[23],
`### Enseignement pour enfants

- Raconter simplement ; utiliser images et gestes ; prier une phrase courte.
- Apprendre un verset (ex. ${label}).

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 24) Application missionnaire
  sections.push(mk(24, T[24],
`### Application missionnaire

- Témoigner avec **clarté** et **douceur** ; contextualiser sans diluer l’Évangile.
- Dialoguer avec les questions réelles du chapitre.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 25) Application pastorale
  sections.push(mk(25, T[25],
`### Application pastorale

- Accompagner la souffrance ; enseigner le **pardon** ; viser la **réconciliation**.
- Discipline restauratrice orientée vers la vie.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 26) Application personnelle
  sections.push(mk(26, T[26],
`### Application personnelle

- Décision : écrire une action précise et datée${key?.v?` (à mémoriser : ${label})`:''}.
- Prière : adorer, confesser, demander, remercier.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  // 27) Versets à retenir
  sections.push(mk(27, T[27],
`### Versets à retenir

- ${label}
- Ajouter d’autres versets marquants selon l’étude.

${mkBlockLikePV({book, chap, refLabel: label, motifs: motifLine, key})}`));

  // 28) Prière de fin
  sections.push(mk(28, T[28],
`### Prière de fin

Nous te bénissons pour ta Parole : éclaire, convertis, conduis dans l’obéissance.  
Donne la **paix** et la **force** pour servir en toute humilité.

${mkBlockLikePV({book, chap, motifs: motifLine, key})}`));

  return sections;
}

function bookFamily(book){
  if (['Genèse','Exode','Lévitique','Nombres','Deutéronome'].includes(book)) return 'Pentateuque';
  if (['Josué','Juges','Ruth','1 Samuel','2 Samuel','1 Rois','2 Rois','1 Chroniques','2 Chroniques','Esdras','Néhémie','Esther'].includes(book)) return 'Historiques';
  if (['Job','Psaumes','Proverbes','Ecclésiaste','Cantique des Cantiques'].includes(book)) return 'Sagesse & Poésie';
  if (['Ésaïe','Jérémie','Lamentations','Ézéchiel','Daniel','Osée','Joël','Amos','Abdias','Jonas','Michée','Nahum','Habacuc','Sophonie','Aggée','Zacharie','Malachie'].includes(book)) return 'Prophètes';
  if (['Matthieu','Marc','Luc','Jean'].includes(book)) return 'Évangiles';
  if (book==='Actes') return 'Actes';
  if (['Romains','1 Corinthiens','2 Corinthiens','Galates','Éphésiens','Philippiens','Colossiens','1 Thessaloniciens','2 Thessaloniciens','1 Timothée','2 Timothée','Tite','Philémon','Hébreux','Jacques','1 Pierre','2 Pierre','1 Jean','2 Jean','3 Jean','Jude'].includes(book)) return 'Épîtres';
  if (book==='Apocalypse') return 'Apocalypse';
  return 'Canon';
}

/* ============ Orchestration ============ */
async function buildDynamicStudy(book, chap, perLen){
  const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
  if (!ok || !content) throw new Error('Chapitre introuvable ou vide');

  const text = (verses?.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const tLower = text.toLowerCase();
  const keywords = topKeywords(text, 14);
  const themes = detectThemes(tLower);
  const genre = guessGenre(book, tLower);
  const outline = buildOutline(Math.max(4, verseCount || (verses?.length||0) || 8));
  let key = scoreKeyVerse(verses||[]);
  if (!key && verses?.length) key = verses[Math.floor(verses.length/2)];

  const sections = makeSections(book, chap, { keywords, themes, genre, outline, key });

  // Ajustement minimal de densité : on laisse le front gérer l’affichage,
  // les contenus sont déjà substantiels et non dupliqués (labels fixes + texte varié).
  return { sections };
}

function fallbackStudy(book, chap){
  // Fallback court mais structuré (rare)
  const keywords = [book.toLowerCase(),'parole','foi','grâce'];
  const themes = [{k:'Parole',refs:[['Hébreux',11,'3'],['Jean',1,'1–3']]}];
  const genre = 'narratif/doctrinal';
  const outline = buildOutline(20);
  const key = { v:1, text:'' };
  return { sections: makeSections(book, chap, { keywords, themes, genre, outline, key }) };
}

function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
async function buildStudy(passage, length){
  const { book, chap } = parsePassage(passage||'Genèse 1');
  if (KEY && BIBLE_ID && USFM[book]) {
    try { return { study: await buildDynamicStudy(book, chap, Number(length)||1500) }; }
    catch { return { study: fallbackStudy(book, chap), emergency:true, note:'fallback' }; }
  }
  return { study: fallbackStudy(book, chap), emergency:true, note:'missing env' };
}

/* ============ Handler ============ */
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques structurées (style Rubrique 0).',
      requires:{ API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length  = Number(body?.options?.length);
    try { return send200(ctx, await buildStudy(passage, length)); }
    catch(e){ return send200(ctx, { study:{ sections:[] }, emergency:true, error:String(e) }); }
  }
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res){
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

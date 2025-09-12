// /api/generate-study.js — Génération riche, contextuelle et variée (api.bible + fallback), toujours 200

/** ----------------- HTTP utils ----------------- **/
async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1 } = {}) {
  const once = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const txt = await r.text();
      let json = {};
      try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
      if (!r.ok) {
        const msg = json?.error?.message || `HTTP ${r.status}`;
        const e = new Error(msg); e.status = r.status; e.details = json; throw e;
      }
      return json;
    } finally { clearTimeout(tid); }
  };
  let last;
  for (let i=0;i<=retries;i++){
    try { return await once(); }
    catch (e){ last = e; if (i===retries) throw e; await new Promise(r=>setTimeout(r, 250*(i+1))); }
  }
  throw last;
}
function send200(ctx, data) {
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type','application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control','no-store');
    ctx.res.end(payload);
    return;
  }
  return new Response(payload, { status: 200, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }});
}
async function readBody(ctx){
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

/** ----------------- Mappings ----------------- **/
const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_BOOK = { ...USFM };
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75' };

function linkRef(book, chap, vv, version='LSG'){
  const code = YV_BOOK[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}
function youVersionUrl(book, chap, verse, version='LSG'){
  const code = YV_BOOK[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const anchor = verse ? `#v${verse}` : '';
  return `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.LSG${anchor}`;
}

/** ----------------- ENV api.bible ----------------- **/
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

/** ----------------- Texte & analyse ----------------- **/
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc'.split(/\s+/));

function words(text){ return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); }
function topKeywords(text, k=12){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}
function detectThemes(textLower){
  const out = [];
  const add = (k, refs)=> out.push({k, refs});
  if (/\b(lumiere|lumière)\b/.test(textLower)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(textLower)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(textLower)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(textLower)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(textLower)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(createur|créateur|creation|création|créa|crea)\b/.test(textLower)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\b(alliance)\b/.test(textLower)) add('alliance', [['Genèse',15,'1–6'],['Luc',22,'20']]);
  return out;
}
function guessGenre(book, textLower){
  if (/\bvision|songe|oracle|ainsi dit\b/.test(textLower)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez|harpe\b/.test(textLower)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume|pharisien|samaritain\b/.test(textLower)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(textLower)) return 'historique';
  if (book === 'Proverbes' || /\bproverbe|sagesse\b/.test(textLower)) return 'sagesse';
  if (/\bgr(â|a)ce|foi|justification|circoncision|apôtres?\b/.test(textLower)) return 'épître/doctrinal';
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
  const KEYS = ['dieu','seigneur','christ','jésus','jesus','foi','amour','esprit','lumiere','lumière','grace','grâce','parole','vie','royaume','loi','alliance','croire'];
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

/** ----------------- Variateurs déterministes ----------------- **/
function djb2(str){ let h=5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)^str.charCodeAt(i); return h>>>0; }
function pick(arr, seed, salt){ if (!arr.length) return ''; const idx = Math.abs(djb2(String(seed)+'|'+salt)) % arr.length; return arr[idx]; }

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
function flavorFromThemes(themes){
  if (!themes || !themes.length) return null;
  const keys = themes.map(t=>t.k);
  if (keys.includes('création')) return 'création';
  if (keys.includes('lumière')) return 'lumière';
  if (keys.includes('Esprit')) return 'Esprit';
  if (keys.includes('grâce')) return 'grâce';
  if (keys.includes('foi')) return 'foi';
  if (keys.includes('Parole')) return 'Parole';
  if (keys.includes('alliance')) return 'alliance';
  return themes[0].k;
}

/** ----------------- Gabarits dynamiques (varient selon passage) ----------------- **/
function buildPrayer(book, chap, keywords, themes, genre){
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes) || (keywords[0]||'Parole');
  const openers = [
    'Père, nous nous tenons devant toi',
    'Dieu de lumière et de vérité',
    'Seigneur, ouvre nos cœurs et nos esprits',
    'Dieu vivant, parle et nous vivrons'
  ];
  const asks = [
    'donne une écoute humble et obéissante',
    'dissipe nos ténèbres et affermis notre foi',
    'éclaire nos pas et oriente notre volonté',
    'forme en nous le vouloir et le faire selon ta grâce'
  ];
  const links = [
    'que ce chapitre nous conduise à l’adoration et à l’obéissance',
    'que la compréhension devienne prière et service',
    'que l’intelligence de l’Écriture produise la vie nouvelle',
    'que la doctrine reçue fructifie en amour'
  ];

  const seed = `${book}|${chap}`;
  const op = pick(openers, seed, 'op');
  const ak = pick(asks, seed, 'ak');
  const lk = pick(links, seed, 'lk');

  const motif = {
    'création': 'Tu as tout fait par ta Parole et soutiens tout par ta puissance.',
    'lumière': 'Tu fais resplendir la lumière au cœur des ténèbres.',
    'Esprit': 'Ton Esprit plane sur les eaux du chaos et suscite la vie.',
    'grâce': 'Ta grâce précède, accompagne et achève notre chemin.',
    'foi': 'Tu suscites la foi par ta Parole efficace.',
    'Parole': 'Ta Parole ne retourne pas à toi sans effet.',
    'alliance': 'Tu gardes l’alliance et les promesses éternelles.'
  }[flav] || 'Tu te révèles et tu sauves.';

  const keyHint = keywords.length ? ` (mots-clés : ${keywords.slice(0,4).map(w=>`**${w}**`).join(', ')})` : '';

  return [
    `### Prière d’ouverture`,
    ``,
    `*Référence :* ${book} ${chap}`,
    ``,
    `${op} : **${motif}** Dans la famille **${fam}**, au registre **${genre}**, ${ak}; ${lk}.${keyHint}`
  ].join('\n');
}

function buildFamily(book, chap, themes, keywords){
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes);
  const focusByFam = {
    'Pentateuque': 'raconter les grands actes de Dieu et transmettre l’alliance dans la vie domestique',
    'Historiques': 'montrer la providence au fil des générations et apprendre de l’exemple',
    'Sagesse & Poésie': 'chanter, mémoriser, prier ensemble pour former le cœur',
    'Prophètes': 'écouter l’appel à revenir à Dieu et pratiquer la justice',
    'Évangiles': 'suivre Jésus en paroles et en actes, apprendre ses récits et ses commandements',
    'Actes': 'témoigner ensemble, ouvrir la maison, persévérer dans la prière',
    'Épîtres': 'ordonner la maison autour de l’Évangile, cultiver foi, espérance et amour',
    'Apocalypse': 'espérer la victoire de l’Agneau et persévérer'
  }[fam] || 'vivre simplement l’Évangile chaque jour';

  const habits = [
    'lecture brève et régulière',
    'prière du Notre Père',
    'un verset appris par semaine',
    'service concret du prochain',
    'parole de bénédiction quotidienne'
  ];
  const seed = `${book}|${chap}|fam`;
  const h1 = pick(habits, seed, 'h1');
  const h2 = pick(habits.filter(x=>x!==h1), seed, 'h2');

  const tag = keywords.slice(0,2).map(w=>`**${w}**`).join(', ');
  const qual = flav ? ` (accent : **${flav}**)` : '';

  return [
    `### Enseignement pour la famille`,
    ``,
    `*Référence :* ${book} ${chap}`,
    ``,
    `- Orientation : ${focusByFam}${qual}.`,
    `- Habitudes : ${h1}, ${h2}.`,
    `${tag ? `- Mots-clés à transmettre : ${tag}.` : ''}`.trim()
  ].join('\n');
}

function buildChurch(book, chap, themes){
  const flav = flavorFromThemes(themes);
  const axes = {
    'création': ['adoration du Créateur','écologie intégrale prudente','travail comme vocation'],
    'lumière': ['ministère de la Parole','discipulat clair','témoignage public'],
    'Esprit': ['prière persévérante','discernement des dons','unité dans la paix'],
    'grâce': ['accueil du pécheur','discipline restauratrice','liturgie centrée sur l’Évangile'],
    'foi': ['catéchèse solide','accompagnement des doutes','mission courageuse'],
    'Parole': ['prédication expositive','lectio communautaire','formation des responsables'],
    'alliance': ['baptême et cène bien enseignés','pastorale familiale','fidélité dans l’épreuve']
  }[flav] || ['Parole & prière', 'formation de disciples', 'mission locale'];

  return [
    `### Enseignement pour l’Église`,
    ``,
    `*Référence :* ${book} ${chap}`,
    ``,
    `- Axes : ${axes.map(x=>`**${x}**`).join(', ')}.`,
    `- Gouvernance : sobre, au service de la Parole et des sacrements.`,
    `- Mission : clarté doctrinale, douceur et respect.`
  ].join('\n');
}

function buildPersonal(book, chap, themes, keyVerse){
  const flav = flavorFromThemes(themes);
  const decisions = {
    'création': 'rendre grâce pour la création et travailler avec intégrité',
    'lumière': 'rejeter les œuvres des ténèbres et marcher dans la lumière',
    'Esprit': 'demander la conduite de l’Esprit et obéir à sa direction',
    'grâce': 'recevoir le pardon et pardonner à autrui',
    'foi': 'faire confiance dans l’épreuve et avancer par la foi',
    'Parole': 'méditer un passage chaque jour et le mettre en pratique',
    'alliance': 'renouveler ses engagements devant Dieu'
  }[flav] || 'mettre en pratique aujourd’hui ce que Dieu a montré';

  const mem = keyVerse?.v ? ` (à mémoriser : ${book} ${chap}:${keyVerse.v})` : '';
  return [
    `### Application personnelle`,
    ``,
    `*Référence :* ${book} ${chap}`,
    ``,
    `- Décision : ${decisions}.${mem}`,
    `- Prière : adorer, confesser, demander, remercier.`,
    `- Étape concrète : écrire une action précise et datée.`
  ].join('\n');
}

function ensureMinLength(s, target=800){
  let out = String(s||'').trim();
  if (out.length >= target) return out;
  const add = (t)=>{ if (out && !out.endsWith('\n')) out += '\n'; out += t; };
  while (out.length < target){
    add('— La révélation appelle la foi ; la foi devient obéissance ; l’obéissance se nourrit à nouveau de la Parole.');
    add('— Lire l’Écriture par l’Écriture garde l’unité et l’équilibre des doctrines.');
    add('— Recevons ce texte dans la prière et la simplicité du service.');
    if (out.length > target) break;
  }
  return out;
}
function bullets(arr){ return arr.filter(Boolean).map(x=>`- ${x}`).join('\n'); }

/** ----------------- Récup chapitre via api.bible ----------------- **/
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // texte du chapitre
  let content = '';
  try {
    const A = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, { headers, timeout: 10000, retries: 0 });
    content = CLEAN(A?.data?.content || A?.data?.text || '');
  } catch {}

  if (!content) {
    try {
      const B = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}`, { headers, timeout: 10000, retries: 0 });
      content = CLEAN(B?.data?.content || B?.data?.text || '');
    } catch {}
  }

  // liste des versets (IDs) — utile pour score verse clé
  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 0 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

  // parse naïf versets
  let verses = [];
  if (content) {
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:m[2]}:null; }).filter(Boolean);
    if (verses.length < Math.max(2, Math.floor((verseItems?.length||0)/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) arr.push({ v:+m[1], text: CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }

  return { ok: !!content, content, verses, verseCount: (verseItems?.length || verses?.length || 0) };
}

/** ----------------- Sections (beaucoup plus contextuelles) ----------------- **/
const mdRef = (b,c,v)=> v ? `${b} ${c}:${v}` : `${b} ${c}`;

function secTitle(book, chap, keywords){
  const candidates = [
    () => `Entre ${keywords[0]||'Parole'} et ${keywords[1]||'vie'}`,
    () => `De ${keywords[0]||'Dieu'} à ${keywords[1]||'l’homme'} : chemin du texte`,
    () => `Itinéraire de foi : ${keywords.slice(0,3).join(' · ') || 'lecture et obéissance'}`
  ];
  const seed = `${book}|${chap}|title`;
  const pickFn = [0,1,2][Math.abs(djb2(seed))%3];
  const title = candidates[pickFn]();
  return `### Titre du chapitre\n\n*Référence :* ${book} ${chap}\n\n**Proposition :** ${title}\n\n*Index lexical :* ${keywords.slice(0,8).join(', ')}.`;
}
function secContext(book, chap, genre){
  const fam = bookFamily(book);
  const lines = [
    `Famille : **${fam}** ; registre **${genre}**.`,
    `Cadre : le contexte historique et ecclésial éclaire la réception, mais **le texte lui-même fait autorité**.`,
    `Finalité : connaître Dieu, édifier l’Église, orienter la vie et la mission.`
  ];
  return `### Contexte historique\n\n*Référence :* ${book} ${chap}\n\n${bullets(lines)}`;
}
function secStructure(book, chap, outline, verseCount){
  return `### Structure littéraire\n\n*Référence :* ${book} ${chap}\n\n${outline.map(s=>`- **v.${s.from}–${s.to} — ${s.label}**`).join('\n')}\n\n*Nombre de versets estimé :* ${Math.max(verseCount||0, 1)}.`;
}
function secKeyVerse(book, chap, key, ver){
  const url = youVersionUrl(book, chap, key?.v, ver);
  const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const quote = key?.text ? `> *« ${key.text} »*` : '> *(repérer un verset pivot dans le contexte).*';
  return `### Verset-clé doctrinal\n\n*Référence :* ${label} — [Ouvrir sur YouVersion](${url})\n\n${quote}`;
}
function secLex(book, chap, keywords){
  const items = keywords.slice(0,6).map(w=>`- **${w}** — terme clé du chapitre.`).join('\n') || '- Termes clés à relever.';
  return `### Analyse lexicale\n\n*Référence :* ${book} ${chap}\n\n${items}`;
}
function secXrefs(themes){
  if (!themes?.length) return `### Références croisées\n\n- À compléter selon les motifs relevés.`;
  return `### Références croisées\n\n${themes.map(t => `- **${t.k}** : ${t.refs.map(([b,c,v]) => linkRef(b,c,v)).join(', ')}`).join('\n')}`;
}

/** ----------------- Build dynamique complet ----------------- **/
async function buildDynamicStudy(book, chap, perLen, version='LSG'){
  const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
  if (!ok || !content) throw new Error('Chapitre introuvable ou vide via api.bible');

  const text = (verses?.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const tLower = text.toLowerCase();
  const keywords = topKeywords(text, 14);
  const themes = detectThemes(tLower);
  const genre = guessGenre(book, tLower);
  const outline = buildOutline(Math.max(4, verseCount || (verses?.length||0) || 8));
  let key = scoreKeyVerse(verses||[]);
  if (!key && verses?.length) key = verses[Math.floor(verses.length/2)];

  const target = Number(perLen)||1500;
  const boost = (s) => ensureMinLength(s, Math.max(380, Math.floor(target/6)));

  const sections = [
    { id:1,  title:'Prière d’ouverture',              description:'Invocation contextualisée.',           content: boost(buildPrayer(book,chap,keywords,themes,genre)) },
    { id:2,  title:'Canon et testament',              description:'Unité AT/NT.',                         content: boost(`### Canon et testament\n\n*Référence :* ${book} ${chap}\n\nNous lisons ${linkRef(book,chap,'',version)} dans l’unité de l’**Ancien** et du **Nouveau** Testament : la révélation progresse sans se contredire et trouve son **accomplissement en Christ**.`) },
    { id:3,  title:'Questions du chapitre précédent', description:'Questions + réponses concrètes.',      content: boost(`### Questions du chapitre précédent\n\n*Référence :* ${book} ${chap}\n\n**Q1. Quel attribut de Dieu ressort ?**\n**R.** À la lumière du contexte : fidélité et souveraineté.\n\n**Q2. Quel fil littéraire ?**\n**R.** Une progression en mouvements (voir structure) avec reprises clés.\n\n**Q3. Quelles tensions ouvrent la suite ?**\n**R.** Celles qui appellent foi, repentance et espérance.`) },
    { id:4,  title:'Titre du chapitre',               description:'Formulation synthétique.',             content: boost(secTitle(book,chap,keywords)) },
    { id:5,  title:'Contexte historique',             description:'Cadre et portée.',                     content: boost(secContext(book,chap,genre)) },
    { id:6,  title:'Structure littéraire',            description:'Découpage et progression.',            content: boost(secStructure(book,chap,outline,verseCount)) },
    { id:7,  title:'Genre littéraire',                description:'Incidences herméneutiques.',           content: boost(`### Genre littéraire\n\n*Référence :* ${book} ${chap}\n\nLe registre **${genre}** oriente la lecture : repérer le rythme, les connecteurs, les parallélismes et les repères narratifs.`) },
    { id:8,  title:'Auteur et généalogie',            description:'Inspiration et réception.',            content: boost(`### Auteur et généalogie\n\n*Référence :* ${book} ${chap}\n\nL’**inspiration** fonde l’autorité du texte. Les questions d’auteur servent l’écoute, mais la **voix de Dieu** prime.`) },
    { id:9,  title:'Verset-clé doctrinal',            description:'Pivot théologique.',                    content: boost(secKeyVerse(book,chap,key,version)) },
    { id:10, title:'Analyse exégétique',              description:'Contexte et grammaire.',                content: boost(`### Analyse exégétique\n\n*Référence :* ${book} ${chap}\n\n- Contexte immédiat : ${key?.v ? `v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : `délimitation à préciser`}.\n- Observer : **verbes** porteurs, **connecteurs** (cause/conséquence/contraste), **progression argumentaire**.`) },
    { id:11, title:'Analyse lexicale',                description:'Termes clés.',                          content: boost(secLex(book,chap,keywords)) },
    { id:12, title:'Références croisées',             description:'Passages parallèles.',                  content: boost(secXrefs(themes)) },
    { id:13, title:'Fondements théologiques',         description:'Attributs, alliance, promesse.',        content: boost(`### Fondements théologiques\n\nAttributs de Dieu, création et providence ; **alliance** et promesse ; l’Écriture interprète l’Écriture.`) },
    { id:14, title:'Thème doctrinal',                 description:'Rattachement systématique.',            content: boost(`### Thème doctrinal\n\n*Référence :* ${book} ${chap}\n\nFormuler le thème en une phrase centrée sur Dieu et son œuvre : **révélation → rédemption → vie nouvelle**.`) },
    { id:15, title:'Fruits spirituels',               description:'Vertus produites.',                     content: boost(`### Fruits spirituels\n\nFoi, espérance, amour ; consolation dans l’épreuve ; obéissance joyeuse et persévérance.`) },
    { id:16, title:'Types bibliques',                 description:'Typologie canonique.',                  content: boost(`### Types bibliques\n\nRepérer les figures (ex.: Adam/Christ ; Exode/Passage) sans arbitraire : **continuité canonique**.`) },
    { id:17, title:'Appui doctrinal',                 description:'Textes concordants.',                   content: boost(`### Appui doctrinal\n\nTextes concordants qui confirment et balisent l’interprétation.`) },
    { id:18, title:'Comparaison interne',             description:'Harmonisation.',                        content: boost(`### Comparaison interne\n\nHarmoniser les passages voisins ; noter **parallèles** et **contrastes** ; laisser la **clarté du tout** éclairer les parties.`) },
    { id:19, title:'Parallèle ecclésial',             description:'Continuité dans l’Église.',             content: boost(`### Parallèle ecclésial\n\nConfession, liturgie, mission enracinées dans la Parole.`) },
    { id:20, title:'Verset à mémoriser',              description:'Formulation mémorisable.',              content: boost(`### Verset à mémoriser\n\n*Suggestion :* ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}.`) },
    { id:21, title:'Enseignement pour l’Église',      description:'Culte, mission.',                       content: boost(buildChurch(book,chap,themes)) },
    { id:22, title:'Enseignement pour la famille',    description:'Transmission.',                         content: boost(buildFamily(book,chap,themes,keywords)) },
    { id:23, title:'Enseignement pour enfants',       description:'Pédagogie.',                            content: boost(`### Enseignement pour enfants\n\n*Référence :* ${book} ${chap}\n\n- Raconter simplement.\n- Utiliser images/gestes.\n- Apprendre un verset.${key?.v ? ` (ex. ${book} ${chap}:${key.v})` : ''}`) },
    { id:24, title:'Application missionnaire',        description:'Annonce contextualisée.',               content: boost(`### Application missionnaire\n\nTémoigner avec **clarté** et **douceur** ; contextualiser sans diluer l’Évangile ; dialoguer avec les questions soulevées par ce chapitre.`) },
    { id:25, title:'Application pastorale',           description:'Accompagnement.',                       content: boost(`### Application pastorale\n\nAccompagner la souffrance et le conflit ; enseigner le **pardon** ; chercher la **réconciliation** appuyée sur l’Évangile.`) },
    { id:26, title:'Application personnelle',         description:'Décision concrète.',                    content: boost(buildPersonal(book,chap,themes,key)) },
    { id:27, title:'Versets à retenir',               description:'Sélection utile.',                      content: boost(`### Versets à retenir\n\n- ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}\n- Ajouter d’autres versets marquants selon l’étude.`) },
    { id:28, title:'Prière de fin',                   description:'Action de grâces.',                     content: boost(`### Prière de fin\n\nNous te bénissons pour ta Parole. Donne-nous la **lumière** pour comprendre, la **foi** pour recevoir, la **force** pour obéir et la **charité** pour servir.`) }
  ];

  return { sections, mode:'dynamic' };
}

/** ----------------- Fallback enrichi (si API KO) ----------------- **/
function ensureMinLenPool(base, target){
  let out = base.trim();
  if (out.length >= target) return out;
  const pool = [
    'La Bible s’explique par la Bible et garde l’unité de la foi.',
    'Le Christ accomplit la promesse et oriente l’interprétation.',
    'La Parole édifie l’Église et forme la vie quotidienne.',
    'La doctrine naît du texte reçu, non de la spéculation.',
    'La prière accompagne l’étude et ouvre à l’obéissance.'
  ];
  for (const s of pool){ out += '\n' + s; if (out.length >= target) break; }
  return ensureMinLength(out, target);
}
function genericStudy(book, chap, version, perLen){
  const titles = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',
    9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',
    13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',
    27:'Versets à retenir',28:'Prière de fin'
  };
  const linkChap = linkRef(book, chap, '', version);
  const target = Number(perLen)||1500;

  const sections = [];
  for (let i=1;i<=28;i++){
    const base = i===3
      ? `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\n**Q1. Quel attribut de Dieu ressort ?**\n**R.** Fidélité souveraine.\n\n**Q2. Quel fil littéraire ?**\n**R.** Progression avec reprises stratégiques.\n\n**Q3. Tensions ouvertes ?**\n**R.** Celles qui préparent la suite.`
      : `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title: titles[i], description:'', content: ensureMinLenPool(base, Math.max(380, Math.floor(target/6))) });
  }
  return { sections, mode:'fallback' };
}

/** ----------------- Build orchestrateur ----------------- **/
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
async function buildStudy(passage, length, version='LSG'){
  const allowed = [500,1500,2500];
  const perLen = allowed.includes(Number(length)) ? Number(length) : 1500;
  const { book, chap } = parsePassage(passage||'Genèse 1');

  if (KEY && BIBLE_ID && USFM[book]) {
    try {
      const dyn = await buildDynamicStudy(book, chap, perLen, version);
      return { study:{ sections: dyn.sections }, mode: dyn.mode };
    } catch (e) {
      const fb = genericStudy(book, chap, version, perLen);
      return { study:{ sections: fb.sections }, mode: fb.mode, emergency:true, error:String(e?.message||e) };
    }
  } else {
    const fb = genericStudy(book, chap, version, perLen);
    return { study:{ sections: fb.sections }, mode: fb.mode, emergency:true, error:'API_BIBLE non configurée' };
  }
}

/** ----------------- Handler ----------------- **/
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques enrichies et contextualisées.',
      requires: { API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length  = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    try { return send200(ctx, await buildStudy(passage, length, version)); }
    catch (e) { return send200(ctx, { ok:false, emergency:true, error:String(e), study:{ sections:[] }, mode:'fallback' }); }
  }
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}
export default async function handler(req, res){
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

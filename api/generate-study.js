// /api/generate-study.js — dynamique via api.bible + fallback, toujours 200, avec marqueur de mode

async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1 } = {}) {
  const tryOnce = async () => {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeout);
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
    } finally { clearTimeout(to); }
  };
  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await tryOnce(); }
    catch (e) { last = e; if (i === retries) throw e; await new Promise(r => setTimeout(r, 300 * (i + 1))); }
  }
  throw last;
}

function send200(ctx, data) {
  if (ctx.res) { ctx.res.status(200).setHeader('Content-Type','application/json; charset=utf-8'); ctx.res.setHeader('Cache-Control','no-store'); ctx.res.json(data); return; }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store' } });
}
async function readBody(ctx) {
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((resolve,reject)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',resolve); req.on('error',reject); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

/* ---- Mappings + YouVersion ---- */
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
function linkRef(book, chapter, verseOrRange, version='LSG') {
  const code = YV_BOOK[book] || 'GEN';
  const ver  = (version || 'LSG').toUpperCase();
  const verId= YV_VERSION_ID[ver] || '93';
  const url  = `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.${ver}`;
  const label= verseOrRange ? `${book} ${chapter}:${verseOrRange}` : `${book} ${chapter}`;
  return `[${label}](${url})`;
}
function youVersionUrl(book, chapter, verse, version='LSG'){
  const code = YV_BOOK[book] || 'GEN';
  const verId= YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const anchor = verse ? `#v${verse}` : '';
  return `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.LSG${anchor}`;
}

/* ---- ENV ---- */
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || "";

/* ---- Utils texte ---- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();

const STOP_FR = new Set(['le','la','les','de','des','du','un','une','et','en','à','au','aux','que','qui','se','ne','pas','pour','par','comme','dans','sur','avec','ce','cette','ces','il','elle','ils','elles','nous','vous','leur','leurs','son','sa','ses','mais','ou','où','donc','or','ni','car','est','été','être','sera','sont','était','étaient','fait','fut','ainsi','plus','moins','tout','tous','toutes','chaque','là','ici','deux','trois','quatre','cinq','six','sept','huit','neuf','dix']);
function topKeywords(text, k=6){
  const freq = new Map();
  for (const raw of text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/i)) {
    const w = raw.trim().replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    freq.set(w, (freq.get(w)||0) + 1);
  }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

/* ---- API Bible : chapitre + parsing ---- */
async function fetchChapter(book, chapter){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chapter}`;

  // Essai A : contentType=text (idéal)
  let content = '';
  try {
    const A = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeNotes=false&includeTitles=false`, { headers, timeout: 10000, retries: 0 });
    content = CLEAN(A?.data?.content || A?.data?.text || '');
  } catch {}

  // Essai B : sans param (certaines bibles ignorent contentType)
  if (!content) {
    try {
      const B = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}`, { headers, timeout: 10000, retries: 0 });
      content = CLEAN(B?.data?.content || B?.data?.text || '');
    } catch {}
  }

  // Liste des versets (pour le compte + ancres)
  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 0 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

  // Parsing heuristique
  let verses = [];
  if (content) {
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{ v:+m[1], text:m[2] }:null; }).filter(Boolean);
    if (verses.length < Math.max(2, Math.floor((verseItems?.length||0)/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) { arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
      if (arr.length) verses = arr;
    }
  }

  return {
    ok: !!content,
    content,
    verseCount: (verseItems?.length || verses?.length || 0),
    verses
  };
}

/* ---- Analyse simple ---- */
function detectThemes(textLower){
  const themes = [];
  if (/\b(lumiere|lumière)\b/.test(textLower)) themes.push({k:'lumière', refs:[['2 Corinthiens',4,'6'],['Jean',1,'1–5']]});
  if (/\besprit\b/.test(textLower)) themes.push({k:'Esprit', refs:[['Genèse',1,'2'],['Actes',2,'1–4']]});
  if (/\b(parole|dit)\b/.test(textLower)) themes.push({k:'Parole', refs:[['Hébreux',11,'3'],['Jean',1,'1–3']]});
  if (/\b(foi|croire|croyez)\b/.test(textLower)) themes.push({k:'foi', refs:[['Romains',10,'17'],['Hébreux',11,'1']]});
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(textLower)) themes.push({k:'grâce', refs:[['Éphésiens',2,'8–9'],['Tite',3,'4–7']]});
  return themes;
}
function guessGenre(textLower){
  if (/\bvision|songe|oracle\b/.test(textLower)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez\b/.test(textLower)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume\b/.test(textLower)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(textLower)) return 'historique';
  return 'narratif/doctrinal';
}
function buildOutline(verseCount){
  const segs = Math.max(3, Math.min(6, Math.round(Math.sqrt(Math.max(3, verseCount||6)))));
  const size = Math.max(1, Math.floor((verseCount||6) / segs));
  const out = [];
  for (let i=0;i<segs;i++){
    const from = i*size+1;
    const to = i===segs-1 ? (verseCount||segs*size) : Math.min((verseCount||segs*size), (i+1)*size);
    out.push({ from, to });
  }
  const labels = ['Ouverture','Développement','Pivot','Application','Exhortation','Conclusion'];
  return out.map((r,i)=>({ ...r, label: labels[i] || `Section ${i+1}` }));
}
function scoreKeyVerse(verses){
  const KEYS = ['dieu','seigneur','christ','jesus','foi','amour','esprit','lumiere','grace','parole','vie','royaume','loi'];
  let best = { v: null, text:'', score: -1 };
  for (const it of verses||[]) {
    if (!it?.v || !it?.text) continue;
    const t = it.text.toLowerCase(); let s = 0;
    for (const k of KEYS) if (t.includes(k)) s += 2;
    const len = it.text.length; if (len>=40 && len<=220) s += 2; else if (len<20 || len>320) s -= 1;
    if (s > best.score) best = { v: it.v, text: it.text, score: s };
  }
  return best.v ? best : null;
}

/* ---- Gabarits dynamiques ---- */
function mdRef(book, chap, vv){ return vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`; }
function r1(book, chap){ return `### Prière d’ouverture\n\n*Référence :* ${mdRef(book,chap)}\n\nPère, éclaire notre lecture : que ta Parole façonne notre intelligence et notre obéissance.`; }
function r2(book, chap, version){ return `### Canon et testament\n\n*Référence :* ${mdRef(book,chap)}\n\nLecture de ${linkRef(book,chap,'',version)} dans l’unité AT/NT, accomplie en **Christ**.`; }
function r3(book, chap){ return `### Questions du chapitre précédent\n\n*Référence :* ${mdRef(book,chap)}\n\n**Q1.** Quel attribut de Dieu ressort ?\n**R.** Sa fidélité souveraine.\n\n**Q2.** Quel fil littéraire ?\n**R.** Progression en mouvements et reprises clés.\n\n**Q3.** Quelles tensions pour la suite ?\n**R.** Celles qui appellent foi et obéissance.`; }
function r4(book, chap, keywords){ const t = keywords.slice(0,2).map(w=>w[0].toUpperCase()+w.slice(1)).join(' & ')||'Lecture et méditation'; return `### Titre du chapitre\n\n*Référence :* ${mdRef(book,chap)}\n\n**Proposition de titre :** ${t}\n\n*Index lexical :* ${keywords.slice(0,6).join(', ')}.`; }
function r5(book, chap, genre){ return `### Contexte historique\n\n*Référence :* ${mdRef(book,chap)}\n\nLe passage s’inscrit dans un registre **${genre}**.`; }
function r6(book, chap, outline){ return `### Structure littéraire\n\n*Référence :* ${mdRef(book,chap)}\n\n${outline.map(s=>`- **v.${s.from}–${s.to} — ${s.label}**`).join('\n')}`; }
function r7(book, chap, genre){ return `### Genre littéraire\n\n*Référence :* ${mdRef(book,chap)}\n\nTraits du **${genre}** qui orientent l’interprétation.`; }
function r8(book, chap){ return `### Auteur et généalogie\n\n*Référence :* ${mdRef(book,chap)}\n\nAccent sur l’**inspiration** plutôt que l’auteur humain.`; }
function r9(book, chap, key, version){ const link = youVersionUrl(book, chap, key?.v, version); const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`; const quote = key?.text ? `> *« ${key.text} »*` : '> *(verset clé à relever dans le contexte).*'; return `### Verset-clé doctrinal\n\n*Référence :* ${label} — [Ouvrir sur YouVersion](${link})\n\n${quote}`; }
function r10(book, chap, key){ const around = key?.v ? `v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : `contexte immédiat`; return `### Analyse exégétique\n\n*Référence :* ${mdRef(book,chap)}\n\n- Contexte : ${around}\n- Observations : verbes clés, connecteurs, parallélismes.`; }
function r11(book, chap, keywords){ return `### Analyse lexicale\n\n*Référence :* ${mdRef(book,chap)}\n\n${keywords.slice(0,4).map(w=>`- **${w}** — terme clé.`).join('\n') || '- Termes clés à relever.'}`; }
function r12(themes){ const lines = []; for (const t of themes) if (t.refs?.length) lines.push(`- **${t.k}** : ${t.refs.map(([b,c,v])=>linkRef(b,c,v)).join(', ')}`); return `### Références croisées\n\n${lines.join('\n')||'- À compléter selon les motifs relevés.'}`; }
const r13=()=>`### Fondements théologiques\n\nAttributs de Dieu, providence, alliance, vocation humaine.`;
const r14=(b,c)=>`### Thème doctrinal\n\n*Référence :* ${mdRef(b,c)}\n\nFormuler le thème en une phrase claire.`;
const r15=()=>`### Fruits spirituels\n\nFoi, espérance, amour ; consolation et obéissance joyeuse.`;
const r16=()=>`### Types bibliques\n\nRepérer les figures et accomplissements au fil du canon.`;
const r17=()=>`### Appui doctrinal\n\nTextes concordants qui protègent des lectures isolées.`;
const r18=()=>`### Comparaison interne\n\nHarmoniser les passages voisins ; noter les contrastes.`;
const r19=()=>`### Parallèle ecclésial\n\nContinuité dans la confession de l’Église.`;
const r20=(b,c,k)=>`### Verset à mémoriser\n\n*Suggestion :* ${k?.v ? `${b} ${c}:${k.v}` : `${b} ${c}`}`;
const r21=()=>`### Enseignement pour l’Église\n\nGouvernance, culte, mission enracinés dans la Parole.`;
const r22=()=>`### Enseignement pour la famille\n\nTransmission, prière domestique, justice au quotidien.`;
const r23=()=>`### Enseignement pour enfants\n\nRaconter simplement, images et gestes ; apprendre un verset.`;
const r24=()=>`### Application missionnaire\n\nTémoignage contextualisé, hospitalité, service.`;
const r25=()=>`### Application pastorale\n\nAccompagner : souffrance, conflit, pardon, réconciliation.`;
const r26=()=>`### Application personnelle\n\nUne décision concrète à poser aujourd’hui.`;
const r27=(b,c,k)=>`### Versets à retenir\n\n- ${k?.v ? `${b} ${c}:${k.v}` : `${b} ${c}`}`;
const r28=()=>`### Prière de fin\n\nAction de grâces pour la Parole reçue.`;

async function buildDynamicStudy(book, chap, perLen, version='LSG'){
  const { ok, content, verseCount, verses } = await fetchChapter(book, chap);
  if (!ok || !content) throw new Error('Chapitre introuvable ou vide via api.bible');

  const text = (verses?.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const textLower = text.toLowerCase();
  const keywords = topKeywords(text, 8);
  const themes = detectThemes(textLower);
  const genre = guessGenre(textLower);
  const outline = buildOutline(Math.max(3, verseCount || (verses?.length||0) || 6));
  let key = scoreKeyVerse(verses || []);
  if (!key && verses?.length) key = verses[Math.floor(verses.length/2)];

  const sections = [
    { id:1,  title:'Prière d’ouverture',            description:'Invocation du Saint-Esprit.',               content: r1(book,chap) },
    { id:2,  title:'Canon et testament',            description:'Unité AT/NT.',                             content: r2(book,chap,version) },
    { id:3,  title:'Questions du chapitre précédent', description:'Questions concrètes + réponses.',        content: r3(book,chap) },
    { id:4,  title:'Titre du chapitre',             description:'Formulation synthétique.',                  content: r4(book,chap,keywords) },
    { id:5,  title:'Contexte historique',           description:'Cadre et portée.',                          content: r5(book,chap,genre) },
    { id:6,  title:'Structure littéraire',          description:'Découpage et progression.',                 content: r6(book,chap,outline) },
    { id:7,  title:'Genre littéraire',              description:'Incidences herméneutiques.',                content: r7(book,chap,genre) },
    { id:8,  title:'Auteur et généalogie',          description:'Auteur/inspiration.',                       content: r8(book,chap) },
    { id:9,  title:'Verset-clé doctrinal',          description:'Pivot théologique.',                        content: r9(book,chap,key,version) },
    { id:10, title:'Analyse exégétique',            description:'Grammaire, contexte.',                      content: r10(book,chap,key) },
    { id:11, title:'Analyse lexicale',              description:'Termes clés.',                              content: r11(book,chap,keywords) },
    { id:12, title:'Références croisées',           description:'Passages parallèles.',                      content: r12(themes) },
    { id:13, title:'Fondements théologiques',       description:'Attributs, alliance.',                      content: r13() },
    { id:14, title:'Thème doctrinal',               description:'Rattachement systématique.',                content: r14(book,chap) },
    { id:15, title:'Fruits spirituels',             description:'Vertus produites.',                         content: r15() },
    { id:16, title:'Types bibliques',               description:'Typologie.',                                content: r16() },
    { id:17, title:'Appui doctrinal',               description:'Textes concordants.',                       content: r17() },
    { id:18, title:'Comparaison interne',           description:'Harmonisation.',                            content: r18() },
    { id:19, title:'Parallèle ecclésial',           description:'Continuité ecclésiale.',                    content: r19() },
    { id:20, title:'Verset à mémoriser',            description:'Formulation mémorisable.',                  content: r20(book,chap,key) },
    { id:21, title:'Enseignement pour l’Église',    description:'Culte, mission.',                           content: r21() },
    { id:22, title:'Enseignement pour la famille',  description:'Transmission.',                             content: r22() },
    { id:23, title:'Enseignement pour enfants',     description:'Pédagogie.',                                content: r23() },
    { id:24, title:'Application missionnaire',      description:'Annonce.',                                  content: r24() },
    { id:25, title:'Application pastorale',         description:'Accompagnement.',                           content: r25() },
    { id:26, title:'Application personnelle',       description:'Décision concrète.',                        content: r26() },
    { id:27, title:'Versets à retenir',             description:'Sélection.',                                content: r27(book,chap,key) },
    { id:28, title:'Prière de fin',                 description:'Action de grâces.',                         content: r28() },
  ];

  // Densité : extension légère
  if (perLen > 500) {
    const last = outline.at(-1)?.to || 0;
    sections[5].content += `\n\n*Nombre de versets estimé :* ${Math.max(3,last)}.`;
  }

  return { sections, mode:'dynamic' };
}

/* ---- Fallback (ancien gabarit) ---- */
function expandUnique(base, pool, targetLen) {
  const used = new Set(); let out = base.trim();
  for (const sRaw of pool) {
    const s = sRaw.trim(); if (!s || used.has(s)) continue;
    out += (out.endsWith('\n') ? '' : '\n') + s + (/[.!?]$/.test(s) ? '' : '.');
    used.add(s);
    if (out.length >= targetLen) break;
  }
  if (out.length < targetLen) {
    let i = 1;
    for (const s of pool) {
      if (used.has(s)) continue;
      out += `\n- ${s}`;
      if (++i > 999 || out.length >= targetLen) break;
    }
  }
  return out;
}
function genericStudy(book, chap, version, perLen) {
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
  const pool = [
    'La Bible s’explique par la Bible et garde l’unité de la foi',
    'Le Christ accomplit la promesse et oriente l’interprétation',
    'La Parole édifie l’Église et forme la vie quotidienne',
    'La doctrine naît du texte reçu, non de la spéculation',
    'La prière accompagne l’étude et ouvre à l’obéissance'
  ];
  const linkChap = linkRef(book, chap, '', version);
  const sections = [];
  for (let i=1;i<=28;i++) {
    const base = i===3
      ? `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\n**Q1.** Quel attribut de Dieu ressort ?\n**R.** Sa fidélité souveraine.\n\n**Q2.** Quel fil littéraire ?\n**R.** Progression et reprises stratégiques.\n\n**Q3.** Tensions ouvertes ?\n**R.** Celles qui préparent la suite.`
      : `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title: titles[i], description:'', content: expandUnique(base, pool, perLen) });
  }
  return { sections, mode:'fallback' };
}

/* ---- Build ---- */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
async function buildStudy(passage, length, version='LSG') {
  const allowed = [500,1500,2500];
  const perLen = allowed.includes(Number(length)) ? Number(length) : 1500;
  const { book, chap } = parsePassage(passage || 'Genèse 1');

  if (KEY && BIBLE_ID && USFM[book]) {
    try {
      const dyn = await buildDynamicStudy(book, chap, perLen, version);
      return { study: { sections: dyn.sections }, mode: dyn.mode };
    } catch (e) {
      const fb = genericStudy(book, chap, version, perLen);
      return { study: { sections: fb.sections }, mode: fb.mode, emergency: true, error: String(e?.message||e) };
    }
  } else {
    const fb = genericStudy(book, chap, version, perLen);
    return { study: { sections: fb.sections }, mode: fb.mode, emergency:true, error:'API_BIBLE non configurée' };
  }
}

/* ---- Handler ---- */
async function core(ctx) {
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, { ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques dynamiques.',
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
export default async function handler(req, res) {
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

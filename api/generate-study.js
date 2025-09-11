// /api/generate-study.js — dynamique via api.bible + fallback, toujours 200

/* -------------------- HTTP helpers (timeout + retry light) -------------------- */
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
    catch (e) { last = e; if (i === retries) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
  throw last;
}

/* -------------------- Low-level response helpers -------------------- */
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

/* -------------------- Mappings (FR -> codes) + YouVersion -------------------- */
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

/* -------------------- ENV -------------------- */
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || "";

/* -------------------- Utils texte -------------------- */
const CLEAN = s => String(s||'')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s([;:,.!?…])/g, '$1')
  .trim();

const STOP_FR = new Set([
  'le','la','les','de','des','du','un','une','et','en','à','au','aux','que','qui','se','ne','pas','pour','par','comme','dans','sur',
  'avec','ce','cette','ces','il','elle','ils','elles','nous','vous','leur','leurs','son','sa','ses','mais','ou','où','donc','or','ni','car',
  'est','été','être','sera','sont','était','étaient','fait','fut','ainsi','plus','moins','tout','tous','toutes','chaque','là','ici',
  'deux','trois','quatre','cinq','six','sept','huit','neuf','dix'
]);

function topKeywords(text, k=6){
  const freq = new Map();
  for (const raw of text.toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/i)) {
    const w = raw.trim().replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    freq.set(w, (freq.get(w)||0) + 1);
  }
  return [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

/* -------------------- API Bible : récupération chapitre + parsing versets -------------------- */
async function fetchChapter(book, chapter){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };

  const chapterId = `${USFM[book]}.${chapter}`;

  // A) Récupère le chapitre en "texte" (on tentera de parser les versets)
  const chapterResp = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeNotes=false&includeTitles=false`, { headers, timeout: 10000, retries: 1 });
  const content = CLEAN(chapterResp?.data?.content || chapterResp?.data?.text || '');

  // B) Liste les IDs de versets pour avoir le compte exact et les ancres
  const versesResp = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 1 });
  const verseItems = Array.isArray(versesResp?.data) ? versesResp.data : [];

  // C) Parsing heuristique du texte en {v,text}
  let verses = [];
  if (content) {
    // Essai 1 : " 1 " démarre un verset
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:m[2]}:null; }).filter(Boolean);
    // Essai 2 si trop court : "1." / "1)" / "[1]"
    if (verses.length < Math.max(2, Math.floor((verseItems?.length||0)/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
      if (arr.length) verses = arr;
    }
  }

  // D) Verset-clé : on scorera avec les textes dispos
  const verseCount = verseItems.length || verses.length;

  return {
    ok: true,
    content,
    verseCount,
    verses,       // [{v, text}] peut être partiel selon parsing
    chapterId
  };
}

async function fetchSingleVerseText(verseId){
  if (!KEY || !BIBLE_ID) return '';
  const headers = { accept:'application/json', 'api-key': KEY };
  const j = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/verses/${verseId}?contentType=text&includeNotes=false&includeTitles=false`, { headers, timeout: 10000, retries: 1 });
  const t = CLEAN(j?.data?.content || j?.data?.text || j?.data?.reference || '');
  // essaie d’ôter le numéro si présent
  const m = t.match(/^\s*(\d{1,3})\s+(.*)$/);
  return m ? (m[2]||'').trim() : t;
}

async function listVerseIds(book, chapter){
  if (!KEY || !BIBLE_ID || !USFM[book]) return [];
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chapter}`;
  const versesResp = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 1 });
  const items = Array.isArray(versesResp?.data) ? versesResp.data : [];
  // items: [{id, reference, ...}]
  return items.map(x => ({ id: x.id, ref: x.reference || '' }));
}

/* -------------------- Analyse de chapitre -------------------- */
function detectThemes(textLower){
  const themes = [];
  if (/\b(lumiere|lumière)\b/.test(textLower)) themes.push({k:'lumière', refs:[['2 Corinthiens',4,'6'],['Jean',1,'1–5']]});
  if (/\besprit\b/.test(textLower)) themes.push({k:'Esprit', refs:[['Genèse',1,'2'],['Actes',2,'1–4']]});
  if (/\b(parole|dit)\b/.test(textLower)) themes.push({k:'Parole', refs:[['Hébreux',11,'3'],['Jean',1,'1–3']]});
  if (/\b(foi|croire|croyez)\b/.test(textLower)) themes.push({k:'foi', refs:[['Romains',10,'17'],['Hébreux',11,'1']]});
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(textLower)) themes.push({k:'grâce', refs:[['Éphésiens',2,'8–9'],['Tite',3,'4–7']]});
  if (/\b(loi|commandement|ordonne|ordonna|ordonnez)\b/.test(textLower)) themes.push({k:'loi/commandement', refs:[['Psaumes',19,'8–11'],['Jean',14,'15']]});
  if (/\b(royaume|roi)\b/.test(textLower)) themes.push({k:'royaume', refs:[['Matthieu',6,'33'],['Luc',17,'20–21']]});
  if (/\b(amour|charite|charité|aimez)\b/.test(textLower)) themes.push({k:'amour', refs:[['1 Jean',4,'7–12'],['Romains',5,'5']]});
  return themes;
}

function guessGenre(textLower){
  if (/\bvision|songe|oracle\b/.test(textLower)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez\b/.test(textLower)) return 'poétique/psaume';
  if (/\bparabole|disciple|pharisien|royaume\b/.test(textLower)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|bataille|chroniques?\b/.test(textLower)) return 'historique';
  return 'narratif/doctrinal';
}

function buildOutline(verseCount){
  const segs = Math.max(3, Math.min(6, Math.round(Math.sqrt(Math.max(3, verseCount)))));
  const size = Math.max(1, Math.floor(verseCount / segs));
  const out = [];
  for (let i=0;i<segs;i++){
    const start = i*size+1;
    const end = i===segs-1 ? verseCount : Math.min(verseCount, (i+1)*size);
    out.push({ from:start, to:end });
  }
  // Des étiquettes neutres
  const labels = ['Ouverture','Développement','Pivot','Application','Exhortation','Conclusion'];
  return out.map((r,i)=>({ ...r, label: labels[i] || `Section ${i+1}` }));
}

function scoreKeyVerse(verses){
  // score simple: longueur modérée + présence de mots thématiques
  const KEYS = ['dieu','seigneur','christ','jesus','foi','amour','esprit','lumiere','grace','parole','vie','royaume','loi'];
  let best = { v: null, text:'', score: -1 };
  for (const it of verses) {
    if (!it || !it.v || !it.text) continue;
    const t = it.text.toLowerCase();
    const len = it.text.length;
    let s = 0;
    for (const k of KEYS) if (t.includes(k)) s += 2;
    if (len >= 40 && len <= 220) s += 2; else if (len < 20 || len > 300) s -= 1;
    if (s > best.score) best = { v: it.v, text: it.text, score: s };
  }
  return best.v ? best : null;
}

/* -------------------- Génération rubriques sur analyse -------------------- */
function mdRef(book, chap, vv){ return vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`; }

function r1_priere(book, chap){
  return `### Prière d’ouverture

*Référence :* ${mdRef(book,chap)}

Père, éclaire notre lecture de ${mdRef(book,chap)} : que ta Parole façonne notre intelligence et notre obéissance. Délivre-nous des idées toutes faites ; donne-nous la joie d’entendre et de mettre en pratique.`;
}

function r2_canon(book, chap, version){
  return `### Canon et testament

*Référence :* ${mdRef(book,chap)}

Lecture de ${linkRef(book,chap,'',version)} dans l’unité de l’Ancien et du Nouveau Testament : la révélation progresse sans se contredire, et trouve son accomplissement en **Christ**.`;
}

function r3_questions(book, chap){
  return `### Questions du chapitre précédent

*Référence :* ${mdRef(book,chap)}

**Q1.** Quel attribut de Dieu se manifeste dans ${mdRef(book,chap)} ?  
**R.** Sa fidélité souveraine, qui conduit l’histoire selon ses promesses.

**Q2.** Quel fil littéraire structure le passage (progression, mots-clés) ?  
**R.** Une progression en plusieurs mouvements : repérer les verbes directeurs et les reprises stratégiques.

**Q3.** Quelles tensions le chapitre laisse-t-il ouvertes pour la suite ?  
**R.** Celles qui appellent une réponse (foi, obéissance) et préparent le chapitre suivant.

**Q4.** Quels échos canoniques éclairent ${mdRef(book,chap)} ?  
**R.** Parallèles dans la Loi/Prophètes/Sagesse et reprise christologique dans l’Évangile/Épîtres.

**Q5.** Application : quelle décision concrète aujourd’hui ?  
**R.** Formuler une prière précise et un pas d’obéissance mesurable (relation, justice, service).`;
}

function r4_titre(book, chap, keywords){
  const t = keywords.slice(0,2).map(w=>w[0].toUpperCase()+w.slice(1)).join(' & ') || 'Lecture et méditation';
  return `### Titre du chapitre

*Référence :* ${mdRef(book,chap)}

**Proposition de titre :** ${t}

*Indice lexical :* ${keywords.slice(0,6).join(', ')}.`;
}

function r5_contexte(book, chap, genre){
  return `### Contexte historique

*Référence :* ${mdRef(book,chap)}

Lecture située dans la tradition ${genre}. On relèvera le cadre narratif, les acteurs, et la portée théologique qui émerge du texte.`;
}

function r6_structure(book, chap, outline){
  const lines = outline.map(s=>`- **v.${s.from}–${s.to} — ${s.label}**`).join('\n');
  return `### Structure littéraire

*Référence :* ${mdRef(book,chap)}

Proposition d’articulation :

${lines}`;
}

function r7_genre(genre, book, chap){
  return `### Genre littéraire

*Référence :* ${mdRef(book,chap)}

Le chapitre présente des traits **${genre}** : cela oriente la lecture (attentes rhétoriques, images, manière de convaincre/exhorter).`;
}

function r8_auteur(book, chap){
  return `### Auteur et généalogie

*Référence :* ${mdRef(book,chap)}

L’accent porte moins sur l’auteur humain que sur l’**inspiration** : le texte fait autorité parce que Dieu s’y révèle pour son peuple.`;
}

function r9_versetCle(book, chap, key, version){
  const link = youVersionUrl(book, chap, key?.v, version);
  const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const quote = key?.text ? `> *« ${key.text} »*` : `> *(verset clé à relever dans le contexte).*`;
  return `### Verset-clé doctrinal

*Référence :* ${label} — [Ouvrir sur YouVersion](${link})

${quote}

Ce verset concentre le mouvement théologique du chapitre et sert d’axe pour la méditation.`;
}

function r10_exegese(book, chap, key){
  const around = key?.v ? `v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : `contexte immédiat`;
  return `### Analyse exégétique

*Référence :* ${mdRef(book,chap)}

- Contexte : ${around}.  
- Observations : sujet/verbes clés, connecteurs logiques, parallélismes.  
- Mise en intrigue : ce que le texte **fait** en disant (promet, ordonne, console, avertit).`;
}

function r11_lexicale(keywords, book, chap){
  const list = keywords.slice(0,4).map(w=>`- **${w}** — terme clé du chapitre, à situer dans l’ensemble biblique.`).join('\n');
  return `### Analyse lexicale

*Référence :* ${mdRef(book,chap)}

${list || '- Termes clés à relever dans la lecture.'}`;
}

function r12_cross(themes){
  const lines = [];
  for (const t of themes) {
    if (!t.refs || !t.refs.length) continue;
    const refs = t.refs.map(([b,c,v]) => linkRef(b,c,v)).join(', ');
    lines.push(`- **${t.k}** : ${refs}`);
  }
  return `### Références croisées

${lines.length ? lines.join('\n') : '- À compléter selon motifs dominants relevés dans le chapitre.'}`;
}

function r13_fondements(){ return `### Fondements théologiques

Attributs de Dieu, providence, fidélité à l’alliance ; place de l’humain et finalité en Dieu.`; }
function r14_theme(book, chap){ return `### Thème doctrinal

*Référence :* ${mdRef(book,chap)}

Formuler le thème en une phrase claire (ce que Dieu révèle et ce à quoi il appelle).`; }
function r15_fruits(){ return `### Fruits spirituels

Foi, espérance, amour ; consolation, repentance, obéissance joyeuse.`; }
function r16_types(){ return `### Types bibliques

Figures/échos : repérer les préfigurations et accomplissements au fil du canon.`; }
function r17_appui(){ return `### Appui doctrinal

Textes concordants qui renforcent l’interprétation et protègent des lectures isolées.`; }
function r18_comparaison(){ return `### Comparaison interne

Harmoniser les passages voisins et relever les contrastes rhétoriques.`; }
function r19_parallel(){ return `### Parallèle ecclésial

Continuité dans la confession de l’Église (culte, catéchèse, mission).`; }
function r20_memoriser(book, chap, key){
  const vv = key?.v ? `${chap}:${key.v}` : `${chap}`;
  return `### Verset à mémoriser

*Suggestion :* ${book} ${vv}`; }
function r21_eglise(){ return `### Enseignement pour l’Église

Gouvernance, culte, discipline, enraciner les pratiques dans la Parole.`; }
function r22_famille(){ return `### Enseignement pour la famille

Transmission de la foi, prière domestique, consolation et justice au quotidien.`; }
function r23_enfants(){ return `### Enseignement pour enfants

Raconter le texte simplement, images et gestes, apprendre un verset.`; }
function r24_mission(){ return `### Application missionnaire

Témoignage contextualisé, hospitalité, service des fragiles.`; }
function r25_pastorale(){ return `### Application pastorale

Accompagner : souffrance, conflit, pardon, réconciliation.`; }
function r26_personnelle(){ return `### Application personnelle

Une décision concrète à poser aujourd’hui (prière, relation, service).`; }
function r27_retenir(book, chap, key){
  const pick = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  return `### Versets à retenir

- ${pick}`; }
function r28_fin(){ return `### Prière de fin

Action de grâces pour la Parole reçue ; demander la force de la mettre en pratique.`; }

/* -------------------- Génération complète d’une étude -------------------- */
async function buildDynamicStudy(book, chap, perLen, version='LSG'){
  // 1) Récupération depuis l’API
  const { ok, content, verseCount, verses } = await fetchChapter(book, chap);
  const text = (verses && verses.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const textLower = text.toLowerCase();

  // 2) Analyse
  const keywords = topKeywords(text, 8);
  const themes = detectThemes(textLower);
  const genre = guessGenre(textLower);
  const outline = buildOutline(Math.max(3, verseCount|| (verses?.length||0) || 6));

  // 3) Verset-clé (si parsing versets OK, sinon heuristique)
  let key = scoreKeyVerse(verses || []);
  if (!key && verses && verses.length) key = verses[Math.floor(verses.length/2)];

  // 4) Rubriques
  const sections = [];
  sections.push({ id:1,  title:'Prière d’ouverture',            description:'Invocation du Saint-Esprit pour éclairer la lecture.', content: r1_priere(book, chap) });
  sections.push({ id:2,  title:'Canon et testament',            description:'Place dans l’unité biblique, AT/NT.',                   content: r2_canon(book, chap, version) });
  sections.push({ id:3,  title:'Questions du chapitre précédent', description:'Questions concrètes + réponses.',                    content: r3_questions(book, chap) });
  sections.push({ id:4,  title:'Titre du chapitre',             description:'Formulation doctrinale synthétique.',                  content: r4_titre(book, chap, keywords) });
  sections.push({ id:5,  title:'Contexte historique',           description:'Cadre narratif et portée.',                           content: r5_contexte(book, chap, genre) });
  sections.push({ id:6,  title:'Structure littéraire',          description:'Découpage et progression.',                            content: r6_structure(book, chap, outline) });
  sections.push({ id:7,  title:'Genre littéraire',              description:'Incidences herméneutiques.',                           content: r7_genre(genre, book, chap) });
  sections.push({ id:8,  title:'Auteur et généalogie',          description:'Auteur humain / inspiration.',                         content: r8_auteur(book, chap) });
  sections.push({ id:9,  title:'Verset-clé doctrinal',          description:'Pivot théologique du chapitre.',                       content: r9_versetCle(book, chap, key, version) });
  sections.push({ id:10, title:'Analyse exégétique',            description:'Grammaire, syntaxe, contexte.',                        content: r10_exegese(book, chap, key) });
  sections.push({ id:11, title:'Analyse lexicale',              description:'Termes clés et portée.',                               content: r11_lexicale(keywords, book, chap) });
  sections.push({ id:12, title:'Références croisées',           description:'Passages parallèles.',                                 content: r12_cross(themes) });
  sections.push({ id:13, title:'Fondements théologiques',       description:'Attributs de Dieu, alliance…',                         content: r13_fondements() });
  sections.push({ id:14, title:'Thème doctrinal',               description:'Rattachement systématique.',                           content: r14_theme(book, chap) });
  sections.push({ id:15, title:'Fruits spirituels',             description:'Vertus produites.',                                    content: r15_fruits() });
  sections.push({ id:16, title:'Types bibliques',               description:'Typologie et symboles.',                                content: r16_types() });
  sections.push({ id:17, title:'Appui doctrinal',               description:'Textes concordants.',                                  content: r17_appui() });
  sections.push({ id:18, title:'Comparaison interne',           description:'Harmonisation interne.',                               content: r18_comparaison() });
  sections.push({ id:19, title:'Parallèle ecclésial',           description:'Continuité dans l’Église.',                            content: r19_parallel() });
  sections.push({ id:20, title:'Verset à mémoriser',            description:'Formulation à mémoriser.',                             content: r20_memoriser(book, chap, key) });
  sections.push({ id:21, title:'Enseignement pour l’Église',    description:'Gouvernance, culte, mission.',                         content: r21_eglise() });
  sections.push({ id:22, title:'Enseignement pour la famille',  description:'Transmission et consolation.',                         content: r22_famille() });
  sections.push({ id:23, title:'Enseignement pour enfants',     description:'Pédagogie adaptée.',                                   content: r23_enfants() });
  sections.push({ id:24, title:'Application missionnaire',      description:'Annonce et contextualisation.',                        content: r24_mission() });
  sections.push({ id:25, title:'Application pastorale',         description:'Conseil et consolation.',                              content: r25_pastorale() });
  sections.push({ id:26, title:'Application personnelle',       description:'Repentance, foi, obéissance.',                         content: r26_personnelle() });
  sections.push({ id:27, title:'Versets à retenir',             description:'Sélection utile à retenir.',                           content: r27_retenir(book, chap, key) });
  sections.push({ id:28, title:'Prière de fin',                 description:'Action de grâces et bénédiction.',                     content: r28_fin() });

  // Ajuste la longueur globale de la réponse (densité)
  function expandToLen(s){ if (!s) return s; if (perLen <= 500) return s;
    // allonge légèrement certaines rubriques avec infos analysées
    return s + (s.includes('### Structure') ? `\n\n*Nombre de versets estimé :* ${Math.max(3, outline.at(-1)?.to || 0)}.` : '');
  }
  for (const sec of sections) sec.content = expandToLen(sec.content);

  return sections;
}

/* -------------------- Fallback “ancien” si API KO -------------------- */
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
      ? `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\n**Q1.** Quel attribut de Dieu ressort ?\n\n**R.** Sa fidélité souveraine.\n\n**Q2.** Quel fil littéraire ?\n\n**R.** Progression et reprises stratégiques.\n\n**Q3.** Tensions ouvertes ?\n\n**R.** Celles qui préparent la suite.\n\n**Q4.** Échos canoniques ?\n\n**R.** Lois/Prophètes/Sagesse et reprise christologique.\n\n**Q5.** Application ?\n\n**R.** Une prière et un pas d’obéissance.`
      : `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title: titles[i], description:'', content: expandUnique(base, pool, perLen) });
  }
  return sections;
}

/* -------------------- Entrée principale -------------------- */
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
      const sections = await buildDynamicStudy(book, chap, perLen, version);
      return { study: { sections } };
    } catch (e) {
      // Fallback si l’API échoue
      const sections = genericStudy(book, chap, version, perLen);
      return { study: { sections }, emergency: true, error: String(e?.message||e) };
    }
  } else {
    const sections = genericStudy(book, chap, version, perLen);
    return { study: { sections }, emergency:true, error:'API_BIBLE non configurée' };
  }
}

async function core(ctx) {
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST JSON { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques dynamiques.'
    });
  }
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length  = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    try { return send200(ctx, await buildStudy(passage, length, version)); }
    catch (e) { return send200(ctx, { ok:false, emergency:true, error:String(e), study:{ sections:[] } }); }
  }
  // autres méthodes → hint GET-like (200)
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res) {
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

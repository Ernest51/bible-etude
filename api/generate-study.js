// /api/generate-study.js — génération riche et doctrinale (dynamique via api.bible + fallback), toujours 200

/** ---------- Utils HTTP ---------- **/
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

/** ---------- Mappings + URL YouVersion ---------- **/
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

/** ---------- ENV api.bible ---------- **/
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

/** ---------- Utils texte & enrichissement ---------- **/
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();

const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin afin que lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc donc'.split(/\s+/));

function words(text){ return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); }
function topKeywords(text, k=10){
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
  if (/\b(parole|dit|d(ie|é)clare)\b/.test(textLower)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(textLower)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(textLower)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(creation|cr(é|e)e|cr(é|e)a|crea)\b/.test(textLower)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
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

/** ---------- Enrichisseurs (densité) ---------- **/
function ensureMinLength(s, target=800){
  let out = String(s||'').trim();
  if (out.length >= target) return out;

  // Ajoute des phrases de transition doctrinale et d’application
  const add = (t)=>{ if (out && !out.endsWith('\n')) out += '\n'; out += t; };
  while (out.length < target){
    add('— ');
    add('Cette lecture articule révélation et réponse : Dieu parle, l’Église écoute, puis l’obéissance se met en marche.');
    add('La cohérence canonique préserve des lectures isolées et éclaire la doctrine au service de la vie chrétienne.');
    add('Recevons ce texte dans la prière : discerner, croire, agir et transmettre humblement.');
    if (out.length > target) break;
  }
  return out;
}

function bullets(arr){ return arr.map(x=>`- ${x}`).join('\n'); }

function enrichContext(book, genre){
  // Contexte historique par grandes familles, sans spéculation périlleuse
  const fam = (()=> {
    if (['Genèse','Exode','Lévitique','Nombres','Deutéronome'].includes(book)) return 'Pentateuque (AT)';
    if (['Josué','Juges','Ruth','1 Samuel','2 Samuel','1 Rois','2 Rois','1 Chroniques','2 Chroniques','Esdras','Néhémie','Esther'].includes(book)) return 'Historiques (AT)';
    if (['Job','Psaumes','Proverbes','Ecclésiaste','Cantique des Cantiques'].includes(book)) return 'Sagesse & Poésie (AT)';
    if (['Ésaïe','Jérémie','Lamentations','Ézéchiel','Daniel','Osée','Joël','Amos','Abdias','Jonas','Michée','Nahum','Habacuc','Sophonie','Aggée','Zacharie','Malachie'].includes(book)) return 'Prophètes (AT)';
    if (['Matthieu','Marc','Luc','Jean'].includes(book)) return 'Évangiles (NT)';
    if (book==='Actes') return 'Actes des Apôtres (NT)';
    if (['Romains','1 Corinthiens','2 Corinthiens','Galates','Éphésiens','Philippiens','Colossiens','1 Thessaloniciens','2 Thessaloniciens','1 Timothée','2 Timothée','Tite','Philémon','Hébreux','Jacques','1 Pierre','2 Pierre','1 Jean','2 Jean','3 Jean','Jude'].includes(book)) return 'Épîtres (NT)';
    if (book==='Apocalypse') return 'Apocalypse (NT)';
    return 'Canon biblique';
  })();

  const lines = [
    `Famille : **${fam}** ; registre **${genre}**.`,
    `Cadre : contexte culturel et ecclésial éclairent la réception, mais **le texte lui-même fait autorité**.`,
    `Finalité : connaître Dieu, édifier l’Église, orienter la vie et la mission.`
  ];
  return bullets(lines);
}

function enrichCrossRefs(themes){
  if (!themes?.length) return '- À compléter selon les motifs relevés.';
  return themes.map(t => `- **${t.k}** : ${t.refs.map(([b,c,v]) => linkRef(b,c,v)).join(', ')}`).join('\n');
}

function expandSection(base, targetLen){
  // Ajoute transitions + un petit "À retenir" pour densifier proprement
  let s = base.trim();
  if (!s.includes('**À retenir**')) {
    s += `\n\n**À retenir**\n${bullets([
      'Lire l’Écriture par l’Écriture (cohérence canonique).',
      'L’herméneutique sert la vie d’Église et l’éthique personnelle.',
      'La prière accompagne compréhension et obéissance.'
    ])}`;
  }
  return ensureMinLength(s, targetLen);
}

/** ---------- Récup chapitre via api.bible ---------- **/
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // Try text mode first
  let content = '';
  try {
    const A = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, { headers, timeout: 10000, retries: 0 });
    content = CLEAN(A?.data?.content || A?.data?.text || '');
  } catch {}

  // Fallback generic
  if (!content) {
    try {
      const B = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}`, { headers, timeout: 10000, retries: 0 });
      content = CLEAN(B?.data?.content || B?.data?.text || '');
    } catch {}
  }

  // Verses list
  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 0 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

  // Parse naive → {v,text}
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

/** ---------- Gabarits RICHES pour 28 rubriques ---------- **/
const mdRef = (b,c,v)=> v ? `${b} ${c}:${v}` : `${b} ${c}`;
const sec1 = (b,c)=> `### Prière d’ouverture\n\n*Référence :* ${mdRef(b,c)}\n\nPère, ouvre nos yeux et nos cœurs. Que ta **Parole** nous éclaire, que ton **Esprit** nous conduise, afin que nous recevions ce chapitre avec foi et obéissance.`;
const sec2 = (b,c,ver)=> `### Canon et testament\n\n*Référence :* ${mdRef(b,c)}\n\nNous lisons ${linkRef(b,c,'',ver)} dans l’unité de l’**Ancien** et du **Nouveau** Testament : la révélation progresse sans se contredire et trouve son **accomplissement en Christ**.`;
const sec3 = (b,c)=> `### Questions du chapitre précédent\n\n*Référence :* ${mdRef(b,c)}\n\n**Q1. Quel attribut de Dieu ressort ?**\n**R.** Sa fidélité souveraine.\n\n**Q2. Quel fil littéraire ?**\n**R.** Une progression en mouvements avec reprises clés.\n\n**Q3. Quelles tensions ouvrent la suite ?**\n**R.** Celles qui appellent foi, repentance et espérance.`;
const sec4 = (b,c,keywords)=> {
  const t = keywords.slice(0,2).map(w=>w[0].toUpperCase()+w.slice(1)).join(' & ') || 'Lecture et méditation';
  return `### Titre du chapitre\n\n*Référence :* ${mdRef(b,c)}\n\n**Proposition de titre :** ${t}\n\n*Index lexical :* ${keywords.slice(0,8).join(', ')}.`;
};
const sec5 = (b,c,genre)=> `### Contexte historique\n\n*Référence :* ${mdRef(b,c)}\n\n${enrichContext(b, genre)}`;
const sec6 = (b,c,outline)=> `### Structure littéraire\n\n*Référence :* ${mdRef(b,c)}\n\n${outline.map(s=>`- **v.${s.from}–${s.to} — ${s.label}**`).join('\n')}`;
const sec7 = (b,c,genre)=> `### Genre littéraire\n\n*Référence :* ${mdRef(b,c)}\n\nLe registre **${genre}** oriente la lecture : repérer le rythme, les connecteurs, les parallélismes et les repères narratifs.`;
const sec8 = (b,c)=> `### Auteur et généalogie\n\n*Référence :* ${mdRef(b,c)}\n\nL’**inspiration** du texte fonde l’autorité. Les questions d’auteur servent l’écoute mais la **voix de Dieu** prime.`;
const sec9 = (b,c,key,ver)=> {
  const url = youVersionUrl(b,c,key?.v,ver);
  const label = key?.v ? `${b} ${c}:${key.v}` : `${b} ${c}`;
  const quote = key?.text ? `> *« ${key.text} »*` : '> *(verset pivot à relever dans le contexte).*';
  return `### Verset-clé doctrinal\n\n*Référence :* ${label} — [Ouvrir sur YouVersion](${url})\n\n${quote}`;
};
const sec10 = (b,c,key)=> {
  const around = key?.v ? `v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : `contexte immédiat`;
  return `### Analyse exégétique\n\n*Référence :* ${mdRef(b,c)}\n\n- Contexte : ${around}\n- Observer : le **champ lexical**, les **verbes** porteurs, les **connecteurs** (cause, conséquence, contraste), la **progression**.`;
};
const sec11 = (b,c,keywords)=> `### Analyse lexicale\n\n*Référence :* ${mdRef(b,c)}\n\n${keywords.slice(0,6).map(w=>`- **${w}** — terme clé du chapitre.`).join('\n') || '- Termes clés à relever.'}`;
const sec12 = (themes)=> `### Références croisées\n\n${enrichCrossRefs(themes)}`;
const sec13 = ()=> `### Fondements théologiques\n\nAttributs de Dieu, création et providence, **alliance** et promesse ; l’Écriture interprète l’Écriture.`;
const sec14 = (b,c)=> `### Thème doctrinal\n\n*Référence :* ${mdRef(b,c)}\n\nFormuler le thème en une phrase claire, centrée sur Dieu et son œuvre : **révélation → rédemption → vie nouvelle**.`;
const sec15 = ()=> `### Fruits spirituels\n\nFoi, espérance, amour ; consolation dans l’épreuve ; obéissance joyeuse et persévérance.`;
const sec16 = ()=> `### Types bibliques\n\nRepérer les figures (ex.: Adam/Christ ; Exode/Passage) en évitant l’arbitraire : **continuité canonique**.`;
const sec17 = ()=> `### Appui doctrinal\n\nTextes concordants qui confirment et balisent l’interprétation, pour ne pas isoler un verset de son horizon biblique.`;
const sec18 = ()=> `### Comparaison interne\n\nHarmoniser les passages voisins ; noter les **parallèles** et **contrastes** ; laisser la **clarté du tout** éclairer les parties.`;
const sec19 = ()=> `### Parallèle ecclésial\n\nContinuité dans la confession de l’Église : **adoration**, **sacrements**, **mission** enracinés dans la Parole.`;
const sec20 = (b,c,k)=> `### Verset à mémoriser\n\n*Suggestion :* ${k?.v ? `${b} ${c}:${k.v}` : `${b} ${c}`}.`;
const sec21 = ()=> `### Enseignement pour l’Église\n\nGouvernance sobre, ministère de la Parole et de la prière, témoignage et diaconie.`;
const sec22 = ()=> `### Enseignement pour la famille\n\nTransmission intergénérationnelle : lire, prier, pratiquer la justice au quotidien.`;
const sec23 = ()=> `### Enseignement pour enfants\n\nRaconter simplement ; utiliser images et gestes ; apprendre un verset.`;
const sec24 = ()=> `### Application missionnaire\n\nTémoigner avec clarté, douceur et respect ; contextualiser sans diluer l’Évangile.`;
const sec25 = ()=> `### Application pastorale\n\nAccompagner : souffrance, conflit, pardon, réconciliation ; l’Évangile réconcilie et relève.`;
const sec26 = ()=> `### Application personnelle\n\nFormuler **une décision concrète** aujourd’hui (adorer, demander pardon, réparer, servir).`;
const sec27 = (b,c,k)=> `### Versets à retenir\n\n- ${k?.v ? `${b} ${c}:${k.v}` : `${b} ${c}`}\n- Ajouter d’autres versets marquants selon l’étude.`;
const sec28 = ()=> `### Prière de fin\n\nAction de grâces pour la Parole reçue ; demande de **lumière**, de **force** et d’**obéissance**.`;

/** ---------- Construction dynamique (richie) ---------- **/
async function buildDynamicStudy(book, chap, perLen, version='LSG'){
  const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
  if (!ok || !content) throw new Error('Chapitre introuvable ou vide via api.bible');

  const text = (verses?.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const tLower = text.toLowerCase();
  const keywords = topKeywords(text, 12);
  const themes = detectThemes(tLower);
  const genre = guessGenre(book, tLower);
  const outline = buildOutline(Math.max(4, verseCount || (verses?.length||0) || 8));
  let key = scoreKeyVerse(verses||[]);
  if (!key && verses?.length) key = verses[Math.floor(verses.length/2)];

  // Densité → cible de longueur par section (approximatif)
  const target = Number(perLen)||1500;
  const perSection = Math.max(380, Math.floor(target/6)); // on enrichit surtout les sections "noyau"

  const baseSections = [
    { id:1,  title:'Prière d’ouverture',              description:'Invocation du Saint-Esprit.',                    content: sec1(book,chap) },
    { id:2,  title:'Canon et testament',              description:'Unité AT/NT.',                                  content: sec2(book,chap,version) },
    { id:3,  title:'Questions du chapitre précédent', description:'Questions + réponses concrètes.',               content: sec3(book,chap) },
    { id:4,  title:'Titre du chapitre',               description:'Formulation synthétique et index lexical.',     content: sec4(book,chap,keywords) },
    { id:5,  title:'Contexte historique',             description:'Cadre et portée.',                              content: sec5(book,chap,genre) },
    { id:6,  title:'Structure littéraire',            description:'Découpage et progression.',                     content: sec6(book,chap,outline) },
    { id:7,  title:'Genre littéraire',                description:'Incidences herméneutiques.',                    content: sec7(book,chap,genre) },
    { id:8,  title:'Auteur et généalogie',            description:'Inspiration et réception.',                     content: sec8(book,chap) },
    { id:9,  title:'Verset-clé doctrinal',            description:'Pivot théologique.',                             content: sec9(book,chap,key,version) },
    { id:10, title:'Analyse exégétique',              description:'Contexte et grammaire.',                         content: sec10(book,chap,key) },
    { id:11, title:'Analyse lexicale',                description:'Termes clés.',                                   content: sec11(book,chap,keywords) },
    { id:12, title:'Références croisées',             description:'Passages parallèles.',                           content: sec12(themes) },
    { id:13, title:'Fondements théologiques',         description:'Attributs, alliance, promesse.',                 content: sec13() },
    { id:14, title:'Thème doctrinal',                 description:'Rattachement systématique.',                     content: sec14(book,chap) },
    { id:15, title:'Fruits spirituels',               description:'Vertus produites.',                              content: sec15() },
    { id:16, title:'Types bibliques',                 description:'Typologie canonique.',                           content: sec16() },
    { id:17, title:'Appui doctrinal',                 description:'Textes concordants.',                            content: sec17() },
    { id:18, title:'Comparaison interne',             description:'Harmonisation.',                                 content: sec18() },
    { id:19, title:'Parallèle ecclésial',             description:'Continuité dans l’Église.',                      content: sec19() },
    { id:20, title:'Verset à mémoriser',              description:'Formulation mémorisable.',                       content: sec20(book,chap,key) },
    { id:21, title:'Enseignement pour l’Église',      description:'Culte, mission.',                                content: sec21() },
    { id:22, title:'Enseignement pour la famille',    description:'Transmission.',                                  content: sec22() },
    { id:23, title:'Enseignement pour enfants',       description:'Pédagogie.',                                     content: sec23() },
    { id:24, title:'Application missionnaire',        description:'Annonce contextualisée.',                        content: sec24() },
    { id:25, title:'Application pastorale',           description:'Accompagnement.',                                 content: sec25() },
    { id:26, title:'Application personnelle',         description:'Décision concrète.',                              content: sec26() },
    { id:27, title:'Versets à retenir',               description:'Sélection utile.',                                content: sec27(book,chap,key) },
    { id:28, title:'Prière de fin',                   description:'Action de grâces.',                               content: sec28() }
  ];

  // Enrichir intelligemment certaines sections (5,6,9,10,11,12,14,24,25,26)
  const toBoost = new Set([4,5,6,9,10,11,12,14,24,25,26]);
  const sections = baseSections.map(s => {
    if (toBoost.has(s.id)) {
      return { ...s, content: expandSection(s.content, perSection) };
    }
    return s;
  });

  // Ajout d’une estimation de longueur en structure (utile visuellement)
  sections.find(x=>x.id===6).content += `\n\n*Nombre de versets estimé :* ${Math.max(verseCount || (verses?.length||0) || 0, 1)}.`;

  return { sections, mode:'dynamic' };
}

/** ---------- Fallback (gabarit, mais enrichi) ---------- **/
function expandUnique(base, pool, targetLen){
  let out = base.trim();
  const used = new Set();
  for (const s of pool){
    const t = s.trim(); if (!t || used.has(t)) continue;
    out += '\n' + (/[.!?]$/.test(t) ? t : (t+'.'));
    used.add(t);
    if (out.length >= targetLen) break;
  }
  if (out.length < targetLen) {
    out = ensureMinLength(out, targetLen);
  }
  return out;
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
  const pool = [
    'La Bible s’explique par la Bible et garde l’unité de la foi',
    'Le Christ accomplit la promesse et oriente l’interprétation',
    'La Parole édifie l’Église et forme la vie quotidienne',
    'La doctrine naît du texte reçu, non de la spéculation',
    'La prière accompagne l’étude et ouvre à l’obéissance'
  ];
  const linkChap = linkRef(book, chap, '', version);
  const target = Number(perLen)||1500;

  const sections = [];
  for (let i=1;i<=28;i++){
    const base = i===3
      ? `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\n**Q1.** Quel attribut de Dieu ressort ?\n**R.** Sa fidélité souveraine.\n\n**Q2.** Quel fil littéraire ?\n**R.** Progression et reprises stratégiques.\n\n**Q3.** Tensions ouvertes ?\n**R.** Celles qui préparent la suite.`
      : `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title: titles[i], description:'', content: expandUnique(base, pool, target/6) });
  }
  return { sections, mode:'fallback' };
}

/** ---------- Builder ---------- **/
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

/** ---------- Handler ---------- **/
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques enrichies.',
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

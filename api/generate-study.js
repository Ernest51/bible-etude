// /api/generate-study.js
// Étude 28 rubriques — propre, doctrinale, sans doublons — toujours JSON 200.

/* -------------------- HTTP utils -------------------- */
async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1 } = {}) {
  const once = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      const txt = await r.text();
      let json;
      if (ct.includes('application/json') || ct.includes('application/problem+json')) {
        try { json = txt ? JSON.parse(txt) : {}; }
        catch { json = { raw: txt }; }
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

/* -------------------- Mappings -------------------- */
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
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75', JND:'64' }; // Darby/JND = 64
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

/* -------------------- Helpers texte -------------------- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc'.split(/\s+/));
function words(text){ return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); }
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

/* -------------------- Unicité & règles doctrinales -------------------- */
class UniqueManager{
  constructor(){
    this.used = new Set();   // phrases exactes déjà utilisées
    this.stems = new Set();  // tronc sémantique pour éviter les quasi-doublons
  }
  _norm(s){
    return String(s||'')
      .replace(/\s+—\s*[a-z0-9]{3,6}\.?$/i,'') // retire anciens suffixes
      .trim()
      .toLowerCase();
  }
  take(lines){
    if (!Array.isArray(lines) || !lines.length) return '';
    for (const s of lines){
      const exact = String(s||'').trim();
      const stem  = this._norm(exact);
      if (!stem) continue;
      if (!this.stems.has(stem) && !this.used.has(exact.toLowerCase())){
        this.stems.add(stem);
        this.used.add(exact.toLowerCase());
        return exact; // pas de suffixe inventé
      }
    }
    return ''; // plus rien d’unique
  }
}
const FINGERPRINTS = new Set();
function dedupNgrams(text, n=5){
  const s = String(text||'').replace(/\s+/g,' ').trim();
  if (!s) return '';
  const toks = s.split(' ').filter(Boolean);
  for (let i=0;i<=toks.length-n;i++){
    const key = toks.slice(i,i+n).join(' ').toLowerCase();
    if (FINGERPRINTS.has(key)) return ''; // phrase trop proche
  }
  for (let i=0;i<=toks.length-n;i++){
    const key = toks.slice(i,i+n).join(' ').toLowerCase();
    FINGERPRINTS.add(key);
  }
  return s;
}
const AXES = /(dieu|christ|j(é|e)sus|esprit|parole|gr(â|a)ce|foi|alliance)/i;
function doctrinalGuard(s){
  const t = String(s||'').trim();
  if (!t) return false;
  if (!AXES.test(t)) return false;
  if (/\b(nous|je|tu)\b/i.test(t) && /^(nous|je|tu)\b/i.test(t)) {
    if (!/(par|gr(â|a)ce|dieu|christ|esprit|parole)/i.test(t)) return false; // initiative divine requise
  }
  return true;
}

/* -------------------- ENV-based YouVersion -------------------- */
function linkRef(book, chap, vv, version='LSG'){
  const code = YV_BOOK[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}
function youVersionUrl(book, chap, verse, version='LSG'){
  const code  = YV_BOOK[book] || 'GEN';
  const vcode = (version||'LSG').toUpperCase();
  const verId = YV_VERSION_ID[vcode] || YV_VERSION_ID.LSG;
  const anchor = verse ? `#v${verse}` : '';
  return `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${vcode}${anchor}`;
}

/* -------------------- api.bible : fetch du chapitre -------------------- */
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

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

  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 0 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

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

  if ((!verses.length || verses.length < Math.floor((verseItems?.length||0)/2)) && Array.isArray(verseItems) && verseItems.length) {
    verses = verseItems.map(v => {
      const ref = String(v?.reference||'');
      const m = ref.match(/(\d+)(?:\D+)?$/);
      const num = m ? Number(m[1]) : null;
      return { v: num, text: CLEAN(v?.text||'') };
    }).filter(x => x.v && x.text);
  }

  return { ok: !!content || verses.length>0, content, verses, verseCount: (verseItems?.length || verses?.length || 0) };
}

/* -------------------- Familles & saveurs -------------------- */
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

/* -------------------- Variants doctrinaux (matière unique) -------------------- */
function djb2(str){ let h=5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)^str.charCodeAt(i); return h>>>0; }
function pick(arr, seed, salt){ if (!arr.length) return ''; const idx = Math.abs(djb2(String(seed)+'|'+salt)) % arr.length; return arr[idx]; }

const BLOCKS = {
  grace: [
    "La grâce de Dieu initie et relève ; notre réponse suit humblement.",
    "Dieu agit le premier par grâce ; la foi accueille et obéit.",
    "Par grâce, Dieu fonde l’alliance ; la foi se déploie en amour."
  ],
  foi: [
    "La foi naît de la Parole entendue et se prouve par l’amour.",
    "Croire, c’est s’appuyer sur la promesse de Dieu et marcher."
  ],
  parole: [
    "La Parole éclaire et juge nos pensées ; elle façonne l’obéissance.",
    "La Parole crée la foi et nourrit l’espérance de l’Église."
  ],
  christ: [
    "Le centre demeure Christ : promesse accomplie, salut offert, vie nouvelle.",
    "Tout converge vers Christ, accomplissement des Écritures."
  ],
  alliance: [
    "Dieu garde l’alliance et ses promesses pour son peuple.",
    "L’alliance structure la vie du peuple : culte, mission, éthique."
  ],
  esprit: [
    "L’Esprit donne la vie et conduit dans toute la vérité.",
    "Par l’Esprit, le cœur est éclairé et affermi."
  ],
  creation: [
    "Le Créateur appelle l’univers à l’existence et soutient tout.",
    "La création témoigne de la sagesse et de la bonté de Dieu."
  ],
  lumiere: [
    "La lumière de Dieu dissipe les ténèbres et oriente nos pas.",
    "Dieu fait resplendir la lumière dans les cœurs."
  ]
};
function doctrinalLines(seed, book, chap, flav, fam, genre, keywords, key){
  const k4 = keywords.slice(0,4).map(w=>`**${w}**`).join(', ');
  const vref = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const base = [
    pick(BLOCKS.parole, seed, 'p') || "La Parole oriente et édifie.",
    pick(BLOCKS.christ, seed, 'c') || "Christ est le centre et l’accomplissement.",
    pick(BLOCKS.grace, seed, 'g') || "La grâce précède notre réponse.",
    "Le texte oriente l’Église (culte, mission, éthique) sans se contredire.",
    `Repères du chapitre : ${k4 || 'termes à repérer dans le passage'}.`,
    `Point de gravité : ${vref}.`
  ];
  if (flav && BLOCKS[flav]) base.unshift(pick(BLOCKS[flav], seed, 'f') || '');
  return base.filter(Boolean);
}

/* -------------------- Sections (génèrent du matériau) -------------------- */
function sec1_prayer(seed, u, book, chap, fam, genre, flav, keywords){
  const openers = [
    'Père des lumières, nous venons à toi',
    'Seigneur, ouvre nos cœurs et nos esprits',
    'Dieu vivant, parle et nous vivrons',
    'Dieu de paix, établis-nous dans ta vérité'
  ];
  const accents = {
    'création':'tu appelles l’univers à l’existence et tu soutiens tout par ta puissance',
    'lumière':'tu fais resplendir la lumière dans nos ténèbres',
    'Esprit':'ton Esprit donne la vie et conduit dans toute la vérité',
    'grâce':'ta grâce nous précède et nous relève',
    'foi':'tu suscites la foi par ta Parole efficace',
    'Parole':'ta Parole ne retourne pas à toi sans effet',
    'alliance':'tu gardes l’alliance et les promesses'
  };
  const opener = pick(openers, seed, 'op');
  const accent = accents[flav] || 'tu te révèles et tu sauves';
  const lines = [
    `### Prière d’ouverture`,
    `*Référence :* ${book} ${chap}`,
    `${opener} : **${accent}**.`,
    `Dans **${fam}** (${genre}), rends-nous attentifs, humbles et obéissants.`,
    `Que ${book} ${chap} produise prière, foi et service.`,
  ];
  const tag = keywords.slice(0,3).map(w=>`**${w}**`).join(', ');
  if (tag) lines.push(`Mots-clés à observer : ${tag}.`);
  return lines.join('\n');
}
function sec2_canon(seed, u, book, chap, version){
  return [
    `### Canon et testament`,
    `*Référence :* ${book} ${chap}`,
    `La révélation progresse sans se contredire et converge vers **le Christ**.`,
    `Nous lisons ${linkRef(book,chap,'',version)} dans l’unité **AT/NT**.`,
    `L’Écriture interprète l’Écriture : passages clairs guidant les difficiles.`
  ].join('\n');
}
function sec3_questions(seed, u, book, chap, flav, genre, key, keywords){
  const tag = keywords.slice(0,4).map(w=>`**${w}**`).join(', ');
  return [
    `### Questions du chapitre précédent`,
    `*Référence :* ${book} ${chap}`,
    `**Q1.** Quel attribut de Dieu ressort ?`,
    `**R.** Sa ${flav||'souveraineté'} se manifeste dans le déroulement du texte.`,
    `**Q2.** Quel fil littéraire structure le passage ?`,
    `**R.** Progression ${key?.v ? `autour de ${book} ${chap}:${key.v}` : 'en mouvements successifs'} avec connecteurs.`,
    `**Q3.** Quelle tension prépare la suite ?`,
    `**R.** Celle qui appelle **foi** et **repentance** et ouvre l’espérance.`,
    tag ? `Mots-clés : ${tag}.` : ''
  ].filter(Boolean).join('\n');
}
function sec4_title(seed, u, book, chap, keywords){
  const proposals = [
    `De ${keywords[0]||'Dieu'} à ${keywords[1]||'l’homme'} : route du texte`,
    `Itinéraire de foi : ${keywords.slice(0,3).join(' · ') || 'écouter et obéir'}`,
    `${keywords[0]||'Parole'} et ${keywords[1]||'vie'} en dialogue`
  ];
  const chosen = proposals[Math.abs(djb2(seed+'|t'))%proposals.length];
  return [
    `### Titre du chapitre`,
    `*Référence :* ${book} ${chap}`,
    `**Proposition :** ${chosen}.`,
    `*Index lexical :* ${keywords.slice(0,8).join(', ')}.`
  ].join('\n');
}
function sec5_context(seed, u, book, chap, fam, genre){
  return [
    `### Contexte historique`,
    `*Référence :* ${book} ${chap}`,
    `- Famille : **${fam}** ; registre **${genre}**.`,
    `- Cadre : l’histoire éclaire, mais **le texte fait autorité**.`,
    `- Finalité : connaître Dieu, édifier l’Église, orienter la vie.`
  ].join('\n');
}
function sec6_structure(seed, u, book, chap, outline, verseCount){
  const bloc = outline.map(s=>`**v.${s.from}–${s.to} — ${s.label}**`).join('\n- ');
  return [
    `### Structure littéraire`,
    `*Référence :* ${book} ${chap}`,
    `- ${bloc}`,
    `- Nombre de versets estimé : ${Math.max(verseCount||0,1)}.`
  ].join('\n');
}
function sec7_genre(seed, u, book, chap, genre){
  return [
    `### Genre littéraire`,
    `*Référence :* ${book} ${chap}`,
    `Le registre **${genre}** oriente la lecture (rythme, parallélismes, connecteurs).`,
    `La forme sert le sens : repérer les repères narratifs et l’argument.`
  ].join('\n');
}
function sec8_author(){ return `### Auteur et généalogie\nL’**inspiration** fonde l’autorité ; l’auteur humain sert la Parole.\nLa réception ecclésiale garde et transmet fidèlement.`; }
function sec9_key(seed, u, book, chap, key, version){
  const url = youVersionUrl(book, chap, key?.v, version);
  const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const quote = key?.text ? `> *« ${key.text} »*` : '> *(choisir un pivot dans le contexte).*';
  return `### Verset-clé doctrinal\n*Référence :* ${label}\nVerset pivot : ${label} — [Ouvrir sur YouVersion](${url})\n\n${quote}`;
}
function sec10_exeg(seed, u, book, chap, key){
  const focus = key?.v ? `autour de v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : 'dans les unités du passage';
  return `### Analyse exégétique\n*Référence :* ${book} ${chap}\nObserver la **grammaire** (verbes porteurs), les **connecteurs** (cause/contraste/conséquence).\nContexte immédiat ${focus} ; repérer le fil argumentaire.`;
}
function sec11_lex(seed, u, book, chap, keywords){
  const items = keywords.slice(0,6).map(w=>`- **${w}** : terme clé du chapitre.`).join('\n');
  return `### Analyse lexicale\n*Référence :* ${book} ${chap}\n${items || '- Termes clés à relever.'}`;
}
function sec12_xrefs(seed, u, themes){
  if (!themes?.length) return `### Références croisées\n- À compléter selon les motifs relevés.`;
  const lines = themes.map(t => `- **${t.k}** : ${t.refs.map(([b,c,v]) => linkRef(b,c,v)).join(', ')}`).join('\n');
  return `### Références croisées\n${lines}`;
}
function sec13_found(){ return `### Fondements théologiques\nAttributs de Dieu, **alliance** et promesse ; création et providence.\nL’Écriture interprète l’Écriture : doctrine reçue, non spéculée.`; }
function sec14_theme(seed, u, book, chap, flav){
  return `### Thème doctrinal\n*Référence :* ${book} ${chap}\nFormuler le thème en une phrase centrée sur Dieu et son œuvre (${flav||'salut'}).\nTrajectoire : **révélation → rédemption → vie nouvelle**.`;
}
function sec15_fruits(){ return `### Fruits spirituels\n**Foi**, **espérance**, **amour** ; obéissance joyeuse ; persévérance.\nConsolation et transformation par l’Évangile.`; }
function sec16_types(){ return `### Types bibliques\nRepérer les figures canoniques (sans arbitraire) et leur accomplissement en **Christ**.`; }
function sec17_support(){ return `### Appui doctrinal\nChoisir des textes concordants qui confirment et balisent l’interprétation.`; }
function sec18_internal(){ return `### Comparaison interne\nComparer les passages voisins ; noter **parallèles** et **contrastes** ; laisser le tout éclairer les parties.`; }
function sec19_ecclesial(){ return `### Parallèle ecclésial\nConfession, liturgie et mission enracinées dans la Parole.\nSobriété, clarté doctrinale, charité concrète.`; }
function sec20_memory(seed, u, book, chap, key){
  return `### Verset à mémoriser\nÀ mémoriser : ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}.\nInscrire la Parole dans le cœur pour la prière et l’obéissance.`;
}
function sec21_church(seed, u, book, chap, themes){
  const flav = flavorFromThemes(themes);
  const axes = {
    'création': ['adoration du Créateur','écologie intégrale prudente','travail comme vocation'],
    'lumière': ['ministère de la Parole','discipulat clair','témoignage public'],
    'Esprit': ['prière persévérante','discernement des dons','unité dans la paix'],
    'grâce': ['accueil du pécheur','discipline restauratrice','liturgie centrée Évangile'],
    'foi': ['catéchèse solide','accompagnement des doutes','mission courageuse'],
    'Parole': ['prédication expositive','lectio communautaire','formation des responsables'],
    'alliance': ['baptême et cène bien enseignés','pastorale familiale','fidélité dans l’épreuve']
  }[flav] || ['Parole & prière','formation de disciples','mission locale'];
  const list = axes.map(x=>`- **${x}**.`).join('\n');
  return `### Enseignement pour l’Église\n*Référence :* ${book} ${chap}\n${list}`;
}
function sec22_family(seed, u, book, chap, themes, keywords){
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes);
  const focusByFam = {
    'Pentateuque': 'raconter les grands actes de Dieu et transmettre l’alliance',
    'Historiques': 'relire la providence à travers les générations',
    'Sagesse & Poésie': 'chanter, mémoriser, prier pour façonner le cœur',
    'Prophètes': 'écouter l’appel à revenir et pratiquer la justice',
    'Évangiles': 'suivre Jésus en paroles et en actes',
    'Actes': 'témoigner, ouvrir la maison, persévérer ensemble',
    'Épîtres': 'ordonner la maison autour de l’Évangile',
    'Apocalypse': 'espérer la victoire de l’Agneau et persévérer'
  }[fam] || 'vivre simplement l’Évangile chaque jour';
  const tag = keywords.slice(0,2).map(w=>`**${w}**`).join(', ');
  return `### Enseignement pour la famille\n*Référence :* ${book} ${chap}\n- Orientation : ${focusByFam}${flav?` (accent **${flav}**)`:''}.\n- Habitudes : lecture brève régulière, prière commune.\n${tag ? `- Mots-clés à transmettre : ${tag}.` : ''}`;
}
function sec23_children(seed, u, book, chap, key){
  const mem = key?.v ? ` (ex. ${book} ${chap}:${key.v})` : '';
  return `### Enseignement pour enfants\n*Référence :* ${book} ${chap}\n- raconter simplement\n- apprendre un verset${mem}`;
}
function sec24_mission(seed, u, book, chap){
  return `### Application missionnaire\n*Référence :* ${book} ${chap}\nTémoigner avec **clarté** et **douceur** ; contextualiser sans diluer l’Évangile.\nDialoguer avec les questions réelles soulevées par le chapitre.`;
}
function sec25_pastoral(){ return `### Application pastorale\nAccompagner la souffrance ; enseigner le **pardon** ; viser la **réconciliation**.\nLa discipline est restauratrice et orientée vers la vie.`; }
function sec26_personal(seed, u, book, chap, themes, key){
  const flav = flavorFromThemes(themes);
  const decisions = {
    'création': 'travailler avec intégrité et rendre grâce',
    'lumière': 'rejeter les ténèbres et marcher dans la lumière',
    'Esprit': 'demander la conduite de l’Esprit et obéir',
    'grâce': 'recevoir le pardon et pardonner à autrui',
    'foi': 'faire confiance dans l’épreuve et avancer',
    'Parole': 'méditer chaque jour et pratiquer',
    'alliance': 'renouveler ses engagements devant Dieu'
  }[flav] || 'mettre en pratique aujourd’hui ce que Dieu a montré';
  return `### Application personnelle\n*Référence :* ${book} ${chap}\n- Décision : ${decisions}${key?.v?` (à mémoriser : ${book} ${chap}:${key.v})`:''}.\n- Prière : adorer, confesser, demander, remercier.\n- Étape concrète : écrire une action précise et datée.`;
}
function sec27_keep(seed, u, book, chap, key){
  return `### Versets à retenir\n- ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}\n- Ajouter d’autres versets marquants selon l’étude.`;
}
function sec28_end(){ return `### Prière de fin\nNous te bénissons pour ta Parole : éclaire, convertis, conduis dans l’obéissance.\nDonne la **paix** et la **force** pour servir en toute humilité.`; }

/* -------------------- Budgeteur & remplissage propre -------------------- */
function splitIntoUnits(text){
  // découpe en lignes + phrases courtes
  const lines = String(text||'').split(/\n+/).map(s=>s.trim()).filter(Boolean);
  const out = [];
  for (const l of lines){
    const parts = l.split(/(?<=[.!?…])\s+(?=[A-ZÉÈÇa-z])/).map(s=>s.trim()).filter(Boolean);
    if (parts.length) out.push(...parts); else out.push(l);
  }
  return out;
}
function allocateBudget(nSections, totalChars){
  // 3 piliers : 2 (Canon), 9 (Clé), 26 (Application pers.)
  const weights = Array.from({length:nSections}, ()=>1);
  [1,8,25].forEach(i=>weights[i]=3); // indices 1-based → 2,9,26 ; notre array 0-based
  const sum = weights.reduce((s,x)=>s+x,0);
  const per = Math.max(40, Math.floor(totalChars / sum));
  return weights.map(w => Math.max(80, Math.floor(per * w)));
}
function fillSection(seed, budget, primaryText, extraGenerator, u){
  const pieces = [];
  // 1) matière primaire (builder de section)
  splitIntoUnits(primaryText).forEach(s => pieces.push(s));
  // 2) matière doctrinale complémentaire
  const extra = extraGenerator();
  extra.forEach(s => pieces.push(s));

  let out = '';
  for (const raw of pieces){
    const candidate = u.take([raw]);        // unicité textuelle
    if (!candidate) continue;
    if (!doctrinalGuard(candidate)) continue;
    const clean = dedupNgrams(candidate, 5); // anti n-gram global
    if (!clean) continue;
    if ((out + (out?'\n':'') + clean).length > budget + 60) { // marge douce
      // on ajoute si c'est vraiment utile (≥30% du budget restant)
      const rest = budget - out.length;
      if (clean.length < Math.max(60, rest*0.3)) continue;
    }
    out += (out?'\n':'') + clean;
    if (out.length >= budget) break;
  }
  return out || ''; // peut être court, d’autres sections compenseront
}

/* -------------------- Orchestrateurs -------------------- */
async function buildDynamicStudy(book, chap, totalBudget, version='LSG'){
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
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes);

  const budgets = allocateBudget(28, totalBudget);
  const u = new UniqueManager();

  const mk = (id, title, buildPrimary) => {
    const seed = `${book}|${chap}|${id}`;
    const primary = buildPrimary(seed);
    const extraGen = () => doctrinalLines(seed, book, chap, flav, fam, genre, keywords, key);
    const content = fillSection(seed, budgets[id-1], primary, extraGen, u);
    return { id, title, description:'', content };
  };

  const sections = [
    mk(1,  'Prière d’ouverture',           (s)=>sec1_prayer(s,u,book,chap,fam,genre,flav,keywords)),
    mk(2,  'Canon et testament',           (s)=>sec2_canon(s,u,book,chap,version)),
    mk(3,  'Questions du chapitre précédent',(s)=>sec3_questions(s,u,book,chap,flav,genre,key,keywords)),
    mk(4,  'Titre du chapitre',            (s)=>sec4_title(s,u,book,chap,keywords)),
    mk(5,  'Contexte historique',          (s)=>sec5_context(s,u,book,chap,fam,genre)),
    mk(6,  'Structure littéraire',         (s)=>sec6_structure(s,u,book,chap,outline,verseCount)),
    mk(7,  'Genre littéraire',             (s)=>sec7_genre(s,u,book,chap,genre)),
    mk(8,  'Auteur et généalogie',         (s)=>sec8_author(s,u,book,chap)),
    mk(9,  'Verset-clé doctrinal',         (s)=>sec9_key(s,u,book,chap,key,version)),
    mk(10, 'Analyse exégétique',           (s)=>sec10_exeg(s,u,book,chap,key)),
    mk(11, 'Analyse lexicale',             (s)=>sec11_lex(s,u,book,chap,keywords)),
    mk(12, 'Références croisées',          (s)=>sec12_xrefs(s,u,themes)),
    mk(13, 'Fondements théologiques',      (s)=>sec13_found(s,u)),
    mk(14, 'Thème doctrinal',              (s)=>sec14_theme(s,u,book,chap,flav)),
    mk(15, 'Fruits spirituels',            (s)=>sec15_fruits(s,u)),
    mk(16, 'Types bibliques',              (s)=>sec16_types(s,u)),
    mk(17, 'Appui doctrinal',              (s)=>sec17_support(s,u)),
    mk(18, 'Comparaison interne',          (s)=>sec18_internal(s,u)),
    mk(19, 'Parallèle ecclésial',          (s)=>sec19_ecclesial(s,u)),
    mk(20, 'Verset à mémoriser',           (s)=>sec20_memory(s,u,book,chap,key)),
    mk(21, 'Enseignement pour l’Église',   (s)=>sec21_church(s,u,book,chap,themes)),
    mk(22, 'Enseignement pour la famille', (s)=>sec22_family(s,u,book,chap,themes,keywords)),
    mk(23, 'Enseignement pour enfants',    (s)=>sec23_children(s,u,book,chap,key)),
    mk(24, 'Application missionnaire',     (s)=>sec24_mission(s,u,book,chap)),
    mk(25, 'Application pastorale',        (s)=>sec25_pastoral(s,u)),
    mk(26, 'Application personnelle',      (s)=>sec26_personal(s,u,book,chap,themes,key)),
    mk(27, 'Versets à retenir',            (s)=>sec27_keep(s,u,book,chap,key)),
    mk(28, 'Prière de fin',                (s)=>sec28_end(s,u))
  ];

  return { sections };
}

function fallbackStudy(book, chap, totalBudget, version='LSG'){
  const u = new UniqueManager();
  const fam = bookFamily(book);
  const genre = 'narratif/doctrinal';
  const flav = 'Parole';
  const keywords = [book.toLowerCase(),'parole','foi','grâce','vie','justice','peuple','alliance'];
  const key = { v: 1, text: '' };
  const budgets = allocateBudget(28, totalBudget);
  const outline = buildOutline(20);

  const mk = (id, title, buildPrimary) => {
    const seed = `${book}|${chap}|fallback|${id}`;
    const primary = buildPrimary(seed);
    const extraGen = () => doctrinalLines(seed, book, chap, flav, fam, genre, keywords, key);
    const content = fillSection(seed, budgets[id-1], primary, extraGen, u);
    return { id, title, description:'', content };
  };

  const sections = [
    mk(1,'Prière d’ouverture',(s)=>sec1_prayer(s,u,book,chap,fam,genre,flav,keywords)),
    mk(2,'Canon et testament',(s)=>sec2_canon(s,u,book,chap,version)),
    mk(3,'Questions du chapitre précédent',(s)=>sec3_questions(s,u,book,chap,flav,genre,key,keywords)),
    mk(4,'Titre du chapitre',(s)=>sec4_title(s,u,book,chap,keywords)),
    mk(5,'Contexte historique',(s)=>sec5_context(s,u,book,chap,fam,genre)),
    mk(6,'Structure littéraire',(s)=>sec6_structure(s,u,book,chap,outline,20)),
    mk(7,'Genre littéraire',(s)=>sec7_genre(s,u,book,chap,genre)),
    mk(8,'Auteur et généalogie',(s)=>sec8_author(s,u,book,chap)),
    mk(9,'Verset-clé doctrinal',(s)=>sec9_key(s,u,book,chap,key,version)),
    mk(10,'Analyse exégétique',(s)=>sec10_exeg(s,u,book,chap,key)),
    mk(11,'Analyse lexicale',(s)=>sec11_lex(s,u,book,chap,keywords)),
    mk(12,'Références croisées',(s)=>sec12_xrefs(s,u,[])),
    mk(13,'Fondements théologiques',(s)=>sec13_found(s,u)),
    mk(14,'Thème doctrinal',(s)=>sec14_theme(s,u,book,chap,flav)),
    mk(15,'Fruits spirituels',(s)=>sec15_fruits(s,u)),
    mk(16,'Types bibliques',(s)=>sec16_types(s,u)),
    mk(17,'Appui doctrinal',(s)=>sec17_support(s,u)),
    mk(18,'Comparaison interne',(s)=>sec18_internal(s,u)),
    mk(19,'Parallèle ecclésial',(s)=>sec19_ecclesial(s,u)),
    mk(20,'Verset à mémoriser',(s)=>sec20_memory(s,u,book,chap,key)),
    mk(21,'Enseignement pour l’Église',(s)=>sec21_church(s,u,book,chap,[])),
    mk(22,'Enseignement pour la famille',(s)=>sec22_family(s,u,book,chap,[],keywords)),
    mk(23,'Enseignement pour enfants',(s)=>sec23_children(s,u,book,chap,key)),
    mk(24,'Application missionnaire',(s)=>sec24_mission(s,u,book,chap)),
    mk(25,'Application pastorale',(s)=>sec25_pastoral(s,u)),
    mk(26,'Application personnelle',(s)=>sec26_personal(s,u,book,chap,[],key)),
    mk(27,'Versets à retenir',(s)=>sec27_keep(s,u,book,chap,key)),
    mk(28,'Prière de fin',(s)=>sec28_end(s,u))
  ];
  return { sections };
}

/* -------------------- Build orchestrateur -------------------- */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
function normalizeTotal(length){
  // Interprète options.length comme budget total : clamp 1500–2500 (par défaut 2000)
  const L = Number(length);
  if (L >= 1500 && L <= 2500) return L;
  if (L === 2500) return 2500;
  if (L === 1500 || L === 500) return 1500;
  return 2000;
}
async function buildStudy(passage, length, version='LSG'){
  const total = normalizeTotal(length);
  const { book, chap } = parsePassage(passage||'Genèse 1');
  if (KEY && BIBLE_ID && USFM[book]) {
    try {
      return { study: await buildDynamicStudy(book, chap, total, version) };
    } catch (e) {
      console.error('[generate-study] buildDynamicStudy error:', e);
      return { study: fallbackStudy(book, chap, total, version), emergency:true, error:'dynamic_failed' };
    }
  } else {
    return { study: fallbackStudy(book, chap, total, version), emergency:true, error:'missing_env_or_mapping' };
  }
}

/* -------------------- Handler -------------------- */
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":1500|2000|2500, "translation":"LSG|JND|..." } } → 28 rubriques doctrinales, uniques.',
      requires: { API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length  = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    try { return send200(ctx, await buildStudy(passage, length, version)); }
    catch (e) {
      console.error('[generate-study] buildStudy error:', e);
      return send200(ctx, { study:{ sections:[] }, emergency:true, error:String(e) });
    }
  }
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}
export default async function handler(req, res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    const payload = { study:{ sections:[] }, emergency:true, fatal:true, error: String(e && e.message || e) };
    if (res && typeof res.status === 'function') {
      res.status(200);
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }
    });
  }
}

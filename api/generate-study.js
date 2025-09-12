// /api/generate-study.js — génération 28 rubriques (utilise api.scripture.api.bible si dispo)
// Renvoie TOUJOURS 200 (front tolérant), avec metadata.usedApiBible + verseCount.

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
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

/* ---------------- api.bible ---------------- */
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

const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();

async function fetchJson(url, { headers = {}, timeout = 12000 } = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(()=>ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const text = await r.text();
    let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    if (!r.ok) { const msg = json?.error?.message || `HTTP ${r.status}`; const e = new Error(msg); e.status=r.status; e.body=json; throw e; }
    return json;
  } finally { clearTimeout(tid); }
}

function buildUrl(path, params = {}) {
  const u = new URL(API_ROOT + path);
  // ATTENTION: l’API veut des noms AVEC TIRETS
  for (const [k,v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}

async function fetchChapterFromApiBible(book, chap) {
  if (!KEY || !BIBLE_ID || !USFM[book]) {
    return { ok:false, reason:'missing_env_or_mapping', usedApiBible:false };
  }
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // 1) contenu du chapitre en TEXTE (bons paramètres)
  const urlContent = buildUrl(`/bibles/${BIBLE_ID}/chapters/${chapterId}`, {
    'content-type': 'text',
    'include-verse-numbers': 'true',
    'include-titles': 'false',
    'include-notes': 'false'
  });

  // 2) liste des versets (pour compter)
  const urlVerses = buildUrl(`/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`);

  try {
    const [jContent, jVerses] = await Promise.all([
      fetchJson(urlContent, { headers }),
      fetchJson(urlVerses, { headers })
    ]);

    const content = CLEAN(jContent?.data?.content || jContent?.data?.text || '');
    const verseItems = Array.isArray(jVerses?.data) ? jVerses.data : [];
    let verses = [];

    if (content) {
      // split naïf “1 … 2 …”
      const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
      verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1], text:CLEAN(m[2])}:null; }).filter(Boolean);

      if (verses.length < Math.max(2, Math.floor((verseItems.length||0)/3))) {
        const arr = [];
        const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
        let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
        if (arr.length) verses = arr;
      }
    }

    return {
      ok: !!content || verses.length>0,
      usedApiBible: true,
      content,
      verses,
      verseCount: verseItems.length || verses.length || 0
    };
  } catch (e) {
    // 400 ici => mauvais paramètres. Avec la correction 'content-type', ça doit disparaître.
    return { ok:false, usedApiBible:true, reason: String(e.message||e), status:e.status||400 };
  }
}

/* -------------- Génération (simple, sans casser le front) -------------- */

function linkRef(book, chap, vv, version='LSG'){
  const code = USFM[book] || 'GEN';
  const verId = '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${version}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}

function sectionTitles(){
  return {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',
    9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',
    13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',
    27:'Versets à retenir',28:'Prière de fin'
  };
}

function enrichFromText(book, chap, verses, content){
  const text = verses?.length ? verses.map(v=>v.text).join(' ') : (content||'');
  const has = (re)=> re.test(text.toLowerCase());
  const key = (verses && verses.length) ? verses[0].v : 1;

  const title = `### ${book} ${chap} — fil conducteur\n` +
    `*Référence :* ${linkRef(book, chap)}\n\n` +
    `Lecture continue du chapitre en recherchant le **fil doctrinal** et les **échos canoniques**.`;

  const hist = has(/\broi|pharaon|ann[eé]e|mois|jour|guerre|ville|royaume/) ? 
    `Le cadre suggère un **ancrage historique** (personnages, lieux, chronologie) ; lire ${linkRef(book, chap)} avec les repères de l’histoire du salut.` :
    `Le texte relève davantage du **récit théologique** que de la chronique brute ; l’histoire sert la révélation.`;

  const structure = has(/\b(et|puis|alors)\b/g) ? 
    `Repérer les **enchaînements** (“et… puis… alors…”) qui structurent la progression.` :
    `Observer les **strophes/parallélismes** qui scandent le propos.`;

  const theme = has(/\blumi[eè]re\b/) ? 'lumière et ordre créateur' :
                has(/\balliance\b/) ? 'alliance et fidélité divine' :
                has(/\bfoi|croire\b/) ? 'foi et promesse' :
                has(/\bgr[aâ]ce|mis[eé]ricorde|pardon\b/) ? 'grâce et restauration' :
                'révélation et seigneurie de Dieu';

  const keyVerse = verses && verses.length ? verses.reduce((best, v)=>{
    const t=v.text.toLowerCase();
    let s=0; if (/\bdieu|seigneur|christ|j[eé]sus|esprit\b/.test(t)) s+=3;
    if (/\bfoi|gr[aâ]ce|parole|vie|v[ée]rit[eé]\b/.test(t)) s+=2;
    if (v.text.length>=40 && v.text.length<=180) s+=2;
    return (s>best.s)?{v:v.v,t:v.text,s}:best;
  },{v:null,t:'',s:-1}) : null;

  return { title, hist, structure, theme, keyVerse };
}

function buildSections(book, chap, verses, content){
  const t = sectionTitles();
  const info = enrichFromText(book, chap, verses, content);

  const sec = (id, body)=>({ id, title: t[id], description: '', content: body });

  const out = [];

  // 1 — prière d’ouverture (contextualisée une fois)
  out.push(sec(1,
`### Prière d’ouverture

*Référence :* ${book} ${chap}

Père des lumières, éclaire notre lecture de ${book} ${chap}. Donne-nous l’intelligence spirituelle et la joie d’obéir à ta Parole. Que ton Esprit nous conduise dans la vérité en Christ. Amen.`));

  // 2
  out.push(sec(2,
`### Canon et testament

*Référence :* ${book} ${chap}

L’Écriture s’interprète par l’Écriture. ${linkRef(book, chap)} s’inscrit dans l’unité des deux Testaments : promesse, accomplissement, proclamation.`));

  // 3 — Questions (restituées)
  out.push(sec(3,
`### Questions du chapitre précédent

*Référence :* ${book} ${chap}

1) Quel est le fil conducteur doctrinal dégagé ?  
2) Quelles tensions/interrogations le texte laisse-t-il ouvertes ?  
3) Quels échos canoniques appellent une vérification (`+linkRef(book, chap)+` et parallèles) ?  
4) Quelle application est restée incomplète et doit être reprise cette semaine ?`));

  // 4 Titre
  out.push(sec(4, info.title));

  // 5 Contexte
  out.push(sec(5,
`### Contexte historique

*Référence :* ${book} ${chap}

${info.hist}`));

  // 6 Structure
  out.push(sec(6,
`### Structure littéraire

*Référence :* ${book} ${chap}

${info.structure}`));

  // 7 Genre
  out.push(sec(7,
`### Genre littéraire

*Référence :* ${book} ${chap}

Repérer le registre dominant (récit, poésie, oracle, sagesse). Ici, l’accent porte sur **${info.theme}**.`));

  // 8 Auteur (sobre)
  out.push(sec(8,
`### Auteur et généalogie

*Référence :* ${book} ${chap}

Recevoir le texte tel que l’Église l’a transmis : inspiré, autoritatif, centré sur Dieu.`));

  // 9 Verset-clé
  const kv = info.keyVerse ? `**${book} ${chap}:${info.keyVerse.v}** — ${info.keyVerse.t}` : `Choisir un verset représentatif du propos.`;
  out.push(sec(9,
`### Verset-clé doctrinal

*Référence :* ${book} ${chap}

${kv}`));

  // 10–27 (brefs, variés, non dupliqués)
  out.push(sec(10,`### Analyse exégétique

*Référence :* ${book} ${chap}

Sens littéral, grammaire, contexte proche/lointain ; l’analogie de la foi garde l’unité doctrinale.`));
  out.push(sec(11,`### Analyse lexicale

*Référence :* ${book} ${chap}

Relevé des termes saillants ; enrichir par des parallèles (mêmes racines, mêmes thèmes).`));
  out.push(sec(12,`### Références croisées

*Référence :* ${book} ${chap}

Lier ${linkRef(book, chap)} à d’autres passages illustrant **${info.theme}** (AT et NT).`));
  out.push(sec(13,`### Fondements théologiques

*Référence :* ${book} ${chap}

Dieu, Alliance, Parole, Esprit, Christ : la doctrine naît du texte reçu, non d’une spéculation.`));
  out.push(sec(14,`### Thème doctrinal

*Référence :* ${book} ${chap}

Thème repéré : **${info.theme}** ; conséquences pour la foi, l’adoration et la mission.`));
  out.push(sec(15,`### Fruits spirituels

*Référence :* ${book} ${chap}

Humilité, confiance, repentance, louange, service fraternel.`));
  out.push(sec(16,`### Types bibliques

*Référence :* ${book} ${chap}

Lorsque c’est pertinent, discerner les anticipations du Christ sans forcer le texte.`));
  out.push(sec(17,`### Appui doctrinal

*Référence :* ${book} ${chap}

Articuler le passage avec les confessions de foi historiques (autorité de l’Écriture, grâce, Christ).`));
  out.push(sec(18,`### Comparaison interne

*Référence :* ${book} ${chap}

Harmoniser les sous-passages du chapitre pour éviter les lectures fragmentées.`));
  out.push(sec(19,`### Parallèle ecclésial

*Référence :* ${book} ${chap}

Implications pour la vie d’Église (culte, prédication, diaconie, discipline).`));
  out.push(sec(20,`### Verset à mémoriser

*Référence :* ${book} ${chap}

Choisir un verset court et central ; le réciter en prière.`));
  out.push(sec(21,`### Enseignement pour l’Église

*Référence :* ${book} ${chap}

Gouvernance, sacrements, mission : recevoir et pratiquer la Parole.`));
  out.push(sec(22,`### Enseignement pour la famille

*Référence :* ${book} ${chap}

Transmission intergénérationnelle : lire, prier, pratiquer la justice.`));
  out.push(sec(23,`### Enseignement enfants

*Référence :* ${book} ${chap}

Une idée simple, vraie, mémorisable ; relire le verset clé.`));
  out.push(sec(24,`### Application missionnaire

*Référence :* ${book} ${chap}

De la doctrine à l’annonce ; contextualiser sans diluer l’Évangile.`));
  out.push(sec(25,`### Application pastorale

*Référence :* ${book} ${chap}

Consoler, reprendre, encourager ; l’Évangile guérit et forme.`));
  out.push(sec(26,`### Application personnelle

*Référence :* ${book} ${chap}

Prier, confesser, obéir aujourd’hui ; formuler un engagement concret.`));
  out.push(sec(27,`### Versets à retenir

*Référence :* ${book} ${chap}

Sélection utile pour la prière et le partage : ${linkRef(book, chap)}.`));
  out.push(sec(28,`### Prière de fin

*Référence :* ${book} ${chap}

Nous te rendons grâce pour ${book} ${chap}. Scelle cette Parole dans nos cœurs ; fais-nous vivre pour ta gloire. Amen.`));

  return out;
}

function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

async function buildStudy(passage, length, version='LSG'){
  const { book, chap } = parsePassage(passage||'Genèse 1');
  let usedApiBible = false, verseCount = 0, content = '', verses = [];

  const canCall = KEY && BIBLE_ID && USFM[book];

  if (canCall) {
    const r = await fetchChapterFromApiBible(book, chap);
    usedApiBible = !!r.usedApiBible;
    if (r.ok) { content = r.content||''; verses = r.verses||[]; verseCount = r.verseCount||0; }
  }

  const sections = buildSections(book, chap, verses, content);

  return {
    study: { sections },
    metadata: {
      book, chapter: chap, version,
      generatedAt: new Date().toISOString(),
      usedApiBible,
      verseCount
    }
  };
}

/* ---------------- handler ---------------- */
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":1500 } } → 28 rubriques.',
      requires:{ hasKey: !!KEY, hasBibleId: !!BIBLE_ID }
    });
  }
  if (method === 'POST') {
    try{
      const body = await readBody(ctx);
      const passage = String(body?.passage || '').trim() || 'Genèse 1';
      const version = String((body?.options?.translation || 'LSG')).toUpperCase();
      const data = await buildStudy(passage, Number(body?.options?.length)||1500, version);
      return send200(ctx, data);
    }catch(e){
      return send200(ctx, { study:{ sections:[] }, metadata:{ emergency:true, error:String(e?.message||e) } });
    }
  }
  // autres méthodes → hint
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res){
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

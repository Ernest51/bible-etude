// /api/generate-study.js — Étude 28 rubriques dynamiques avec tolérance d’erreurs API
// Contrat: toujours 200 (GET=hint, POST={ study:{sections:[28]} , metadata:{...} })

//////////////////// HTTP utils ////////////////////
async function fetchJson(url, { headers = {}, timeout = 10000 } = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    const txt = await r.text();
    let json;
    if (ct.includes('json')) { try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; } }
    else { json = { raw: txt }; }
    return { ok: r.ok, status: r.status, json, text: txt };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  } finally {
    clearTimeout(tid);
  }
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
  return new Response(payload, { status:200, headers:{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }});
}

async function readBody(ctx){
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

//////////////////// Constantes ////////////////////
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
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75', JND:'64' };
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const yv = (b,c,v,ver='LSG') => {
  const code = USFM[b] || 'GEN';
  const id = YV_VERSION_ID[(ver||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${id}/${code}.${c}.${(ver||'LSG').toUpperCase()}`;
  return `[${b} ${c}${v?':'+v:''}](${url})`;
};

//////////////////// Récup chapitre (tolérant) ////////////////////
async function fetchChapterSoft(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) {
    return { ok:false, usedApi:false, verses:[], content:'', reasons:['missing_env_or_mapping'] };
  }
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;
  const reasons = [];

  // A) Essai contenu du chapitre
  let content = '';
  const r1 = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeNotes=false&includeTitles=false`, { headers, timeout: 12000 });
  if (r1.ok) {
    content = CLEAN(r1.json?.data?.content || r1.json?.data?.text || '');
  } else {
    reasons.push(`chapter_text_${r1.status || 'ERR'}`);
  }

  // B) Essai liste des versets
  let verses = [];
  const r2 = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000 });
  if (r2.ok && Array.isArray(r2.json?.data)) {
    // parser d'abord depuis content si possible
    if (content) {
      const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
      verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1], text:CLEAN(m[2])}:null; }).filter(Boolean);
      if (verses.length < Math.max(2, Math.floor(r2.json.data.length/3))) {
        const arr=[]; const re=/(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g; let m;
        while ((m=re.exec(content))) arr.push({ v:+m[1], text:CLEAN(m[2]) });
        if (arr.length) verses = arr;
      }
    }
    // sinon, fallback depuis la liste
    if (!verses.length) {
      verses = r2.json.data.map(it => {
        const ref = String(it?.reference||''); const m = ref.match(/:(\d{1,3})$/);
        return { v: m?+m[1]:undefined, text: CLEAN(it?.text || '') };
      }).filter(x => Number.isFinite(x.v) && x.text);
    }
  } else {
    reasons.push(`verses_${r2.status || 'ERR'}`);
  }

  const ok = (!!content || verses.length>0);
  return { ok, usedApi:true, verses, content, reasons };
}

//////////////////// Analyse basique ////////////////////
function analyze(book, chap, verses, content){
  const raw = verses?.length ? verses.map(v=>v.text).join(' ') : (content||'');
  const t = raw.toLowerCase();

  const cnt = re => (t.match(re)||[]).length;
  const cRefrain = cnt(/\bil y (eut|eu) soir(?:,)? et (?:il y )?(?:eut|eu) matin\b/g);
  const cChain = cnt(/\bet\b/g) + cnt(/\bpuis\b/g) + cnt(/\balors\b/g);

  let struct = [];
  if (cRefrain>=2) struct.push(`Refrain observable (${cRefrain}×) — “il y eut soir et il y eut matin”.`);
  if (cChain>=8) struct.push(`Chaîne narrative dense via connecteurs (“et/puis/alors” ≈ ${cChain}).`);
  if (!struct.length) struct.push(`Progression simple sans refrain dominant.`);

  let theme = 'révélation et seigneurie de Dieu';
  if (/\bcr[ée]a|cr[ée]ation|parole|dit\b/.test(t)) theme = 'création par la Parole efficace de Dieu';
  else if (/\blumi[eè]re\b/.test(t)) theme = 'lumière, ordre et mise en forme du chaos';
  else if (/\balliance\b/.test(t)) theme = 'alliance et fidélité divine';
  else if (/\bfoi|croire\b/.test(t)) theme = 'foi et promesse';
  else if (/\bgr[aâ]ce|mis[ée]ricorde|pardon\b/.test(t)) theme = 'grâce et restauration';

  const doctrinal =
    theme.includes('création') ? `Dieu crée et ordonne par sa Parole; tout dépend de lui et subsiste en lui.`
    : theme.includes('lumière') ? `Dieu sépare et ordonne; de la confusion surgit un monde habitable sous sa lumière.`
    : theme.includes('alliance') ? `Dieu s’engage, promet et garde sa parole à travers l’histoire du salut.`
    : theme.includes('foi') ? `La Parole appelle la confiance; la foi reçoit et suit la promesse de Dieu.`
    : theme.includes('grâce') ? `Dieu fait grâce aux pécheurs: pardon, relèvement et vie nouvelle en Christ.`
    : `Dieu se révèle souverainement; sa Parole fonde la foi et l’obéissance.`;

  // verset clé
  const key = verses && verses.length ? verses.reduce((best,v)=>{
    const sText=v.text.toLowerCase(); let s=0;
    if (/\bdieu|seigneur|christ|j[ée]sus|esprit\b/.test(sText)) s+=3;
    if (/\bfoi|gr[âa]ce|parole|vie|v[ée]rit[ée]\b/.test(sText)) s+=2;
    if (v.text.length>=40 && v.text.length<=180) s+=2;
    return s>best.s ? { v:v.v, t:v.text, s } : best;
  }, { v:null,t:'',s:-1 }) : null;

  const parallels = [];
  const add = (b,c,v)=>parallels.push(yv(b,c,v));
  if (theme.includes('création')) { add('Psaumes',33,'6'); add('Jean',1,'1–3'); add('Hébreux',11,'3'); }
  if (theme.includes('lumière')) { add('2 Corinthiens',4,'6'); add('Jean',8,'12'); }
  if (theme.includes('foi')) { add('Romains',10,'17'); add('Hébreux',11,'1'); }
  if (theme.includes('grâce')) { add('Éphésiens',2,'8–9'); add('Tite',3,'4–7'); }
  if (theme.includes('alliance')) { add('Genèse',15,'1–6'); add('Luc',22,'20'); }

  const answers = {
    thread: doctrinal,
    tensions:
      theme.includes('création') ? `Lecture théologique vs chronologie stricte; refrain et portée universelle du message.`
      : theme.includes('alliance') ? `Signe et portée; condition/promesse; continuité AT/NT.`
      : theme.includes('foi') ? `Foi/œuvres; épreuve; assurance.`
      : theme.includes('grâce') ? `Gratuité et transformation; grâce et responsabilité.`
      : `Lettre/esprit; sens littéral/figuratif; transposition aujourd’hui.`,
    parallels: parallels.slice(0,3),
    application:
      theme.includes('création') ? `Recevoir le monde comme don; travailler et garder avec reconnaissance.`
      : theme.includes('lumière') ? `Rejeter les œuvres des ténèbres; rechercher vérité et clarté dans nos choix.`
      : theme.includes('foi') ? `Écouter la Parole chaque jour; répondre par prière et obéissance.`
      : theme.includes('grâce') ? `Accueillir le pardon; pratiquer la miséricorde envers le prochain.`
      : `Connaître Dieu; vivre sobrement, justement et pieusement.`
  };

  return { struct, theme, doctrinal, key, parallels: answers.parallels, answers };
}

//////////////////// Sections ////////////////////
function S(id, title, content, description=''){ return { id, title, description, content:String(content||'') }; }

function buildSections(book, chap, verses, content){
  const A = analyze(book, chap, verses, content);
  const T = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',9:'Verset-clé doctrinal',
    10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',13:'Fondements théologiques',14:'Thème doctrinal',
    15:'Fruits spirituels',16:'Types bibliques',17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',
    20:'Verset à mémoriser',21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement pour enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',27:'Versets à retenir',28:'Prière de fin'
  };
  const out = [];

  out.push(S(1,T[1],
`### Prière d’ouverture

*Référence :* ${book} ${chap}

Père des lumières, ouvre nos cœurs à ta Parole en ${book} ${chap}. Donne l’intelligence spirituelle et conduis-nous de la compréhension à l’obéissance, par Jésus-Christ. Amen.`));

  out.push(S(2,T[2],
`### Canon et testament

*Référence :* ${book} ${chap}

L’Écriture interprète l’Écriture : ${book} ${chap} s’inscrit dans l’unité de la révélation, orientée vers le Christ. Les passages clairs éclairent les plus obscurs; la progression canonique ne se contredit pas.`));

  out.push(S(3,T[3],
`### Questions du chapitre précédent

*Référence :* ${book} ${chap}

1) **Fil doctrinal dégagé**  
   → ${A.answers.thread}

2) **Tensions / questions ouvertes**  
   → ${A.answers.tensions}

3) **Échos à vérifier**  
   → ${A.parallels.length ? A.parallels.join(' ; ') : 'À compléter via une concordance.'}

4) **Application à reprendre cette semaine**  
   → ${A.answers.application}`));

  out.push(S(4,T[4],
`### Titre du chapitre

*Référence :* ${book} ${chap}

${A.theme.charAt(0).toUpperCase()+A.theme.slice(1)}.`));

  out.push(S(5,T[5],
`### Contexte historique

*Référence :* ${book} ${chap}

Cadre et portée: destinataires, situation, visée théologique; lire comme histoire du salut, non comme chronique exhaustive.`));

  out.push(S(6,T[6],
`### Structure littéraire

*Référence :* ${book} ${chap}

• ${A.struct.join('\n• ')}`));

  out.push(S(7,T[7],
`### Genre littéraire

*Référence :* ${book} ${chap}

Indices de genre (narratif, poétique, prophétique, épistolaire…) guidant l’interprétation.`));

  out.push(S(8,T[8],
`### Auteur et généalogie

*Référence :* ${book} ${chap}

Auteur humain inspiré; fiabilité du témoignage; place dans l’histoire du canon.`));

  out.push(S(9,T[9],
`### Verset-clé doctrinal

*Référence :* ${book} ${chap}

${A.key ? `**${book} ${chap}:${A.key.v}** — ${A.key.t}` : `Choisir un verset pivot (clarté doctrinale, longueur moyenne).`}`));

  out.push(S(10,T[10],
`### Analyse exégétique

*Référence :* ${book} ${chap}

Contexte littéral et historique; logique du passage; liens proches et lointains; éviter les sur-lectures.`));

  out.push(S(11,T[11],
`### Analyse lexicale

*Référence :* ${book} ${chap}

Termes-clés à observer (racines, champs sémantiques, parallèles).`));

  out.push(S(12,T[12],
`### Références croisées

*Référence :* ${book} ${chap}

Échos suggérés: ${A.parallels.length ? A.parallels.join(' ; ') : 'à compléter selon l’accent du chapitre.'}`));

  out.push(S(13,T[13],
`### Fondements théologiques

*Référence :* ${book} ${chap}

Attributs de Dieu, création, alliance, rédemption, providence, sainteté — selon l’accent du chapitre.`));

  out.push(S(14,T[14],
`### Thème doctrinal

*Référence :* ${book} ${chap}

${A.doctrinal}`));

  out.push(S(15,T[15],
`### Fruits spirituels

*Référence :* ${book} ${chap}

Foi, espérance, amour; humilité, justice, miséricorde; vie de prière et d’adoration.`));

  out.push(S(16,T[16],
`### Types bibliques

*Référence :* ${book} ${chap}

Typologie prudente (création/recréation, exode, roi/serviteur, temple, alliance).`));

  out.push(S(17,T[17],
`### Appui doctrinal

*Référence :* ${book} ${chap}

Textes concordants pour confirmer l’interprétation sans forcer le sens.`));

  out.push(S(18,T[18],
`### Comparaison interne

*Référence :* ${book} ${chap}

Harmoniser les péricopes du livre; noter progressions et répétitions.`));

  out.push(S(19,T[19],
`### Parallèle ecclésial

*Référence :* ${book} ${chap}

Usage ecclésial: catéchèse, liturgie, mission, discipline spirituelle.`));

  out.push(S(20,T[20],
`### Verset à mémoriser

*Référence :* ${book} ${chap}

${A.key ? `**${book} ${chap}:${A.key.v}** — à apprendre par cœur.` : `Choisir un verset clair et bref.`}`));

  out.push(S(21,T[21],
`### Enseignement pour l’Église

*Référence :* ${book} ${chap}

Doctrine, culte, gouvernement, discipline; l’Église reçoit et obéit à la Parole.`));

  out.push(S(22,T[22],
`### Enseignement pour la famille

*Référence :* ${book} ${chap}

Transmission intergénérationnelle: lecture, prière, pratique quotidienne de la justice.`));

  out.push(S(23,T[23],
`### Enseignement pour enfants

*Référence :* ${book} ${chap}

Expliquer simplement, raconter fidèlement, prier ensemble, mémoriser.`));

  out.push(S(24,T[24],
`### Application missionnaire

*Référence :* ${book} ${chap}

Témoignage, service, hospitalité; contextualiser sans trahir le message.`));

  out.push(S(25,T[25],
`### Application pastorale

*Référence :* ${book} ${chap}

Consoler, avertir, encourager; accompagner les consciences par l’Écriture.`));

  out.push(S(26,T[26],
`### Application personnelle

*Référence :* ${book} ${chap}

Prier, confesser, décider un pas concret cette semaine (lecture, réconciliation, service).`));

  out.push(S(27,T[27],
`### Versets à retenir

*Référence :* ${book} ${chap}

Sélection utile pour la prière et le partage: ${yv(book,chap)}`));

  out.push(S(28,T[28],
`### Prière de fin

*Référence :* ${book} ${chap}

Nous te rendons grâce pour ${book} ${chap}. Scelle cette Parole dans nos cœurs; fais-nous vivre pour ta gloire. Amen.`));

  return out;
}

//////////////////// Fallback ////////////////////
function fallbackStudy(book, chap){
  const tit = ['Prière d’ouverture','Canon et testament','Questions du chapitre précédent','Titre du chapitre',
    'Contexte historique','Structure littéraire','Genre littéraire','Auteur et généalogie','Verset-clé doctrinal',
    'Analyse exégétique','Analyse lexicale','Références croisées','Fondements théologiques','Thème doctrinal',
    'Fruits spirituels','Types bibliques','Appui doctrinal','Comparaison interne','Parallèle ecclésial',
    'Verset à mémoriser','Enseignement pour l’Église','Enseignement pour la famille','Enseignement pour enfants',
    'Application missionnaire','Application pastorale','Application personnelle','Versets à retenir','Prière de fin'];
  const sections = [];
  for (let i=1;i<=28;i++){
    sections.push({ id:i, title:tit[i-1], description:'', content:`### ${tit[i-1]}\n\n*Référence :* ${book} ${chap}\n\nContenu de base (fallback). Développer selon le chapitre.` });
  }
  return { sections };
}

//////////////////// Build ////////////////////
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

async function buildStudy(passage, _length, version='LSG'){
  const { book, chap } = parsePassage(passage||'Genèse 1');

  // Tente la récup “souple”
  const api = await fetchChapterSoft(book, chap);

  if (api.ok) {
    const sections = buildSections(book, chap, api.verses, api.content);
    return {
      study: { sections },
      metadata: {
        book, chapter: chap, version,
        generatedAt: new Date().toISOString(),
        usedApiBible: true,
        verseCount: api.verses?.length || 0,
        diagnostics: api.reasons || []
      }
    };
  }

  // Fallback si on n’a rien
  return {
    study: fallbackStudy(book, chap),
    metadata: {
      book, chapter: chap, version,
      generatedAt: new Date().toISOString(),
      emergency: true,
      usedApiBible: api.usedApi || false,
      verseCount: 0,
      diagnostics: api.reasons || ['fallback_used']
    }
  };
}

//////////////////// Handler ////////////////////
async function core(ctx){
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques dynamiques.',
      requires:{ API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }

  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    try {
      return send200(ctx, await buildStudy(passage, body?.options?.length, version));
    } catch (e) {
      return send200(ctx, {
        study:{ sections:[] },
        metadata:{ emergency:true, error:String(e?.message||e) }
      });
    }
  }

  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req,res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    const payload = { study:{ sections:[] }, metadata:{ emergency:true, fatal:true, error:String(e?.message||e) } };
    if (res && typeof res.status === 'function') {
      res.status(200); res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), { status:200, headers:{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }});
  }
}

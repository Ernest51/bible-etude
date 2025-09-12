// /api/generate-study.js — robuste (toujours 200/JSON) + génération 28 rubriques sans doublons
// S'inspire de la logique de Rubrique 0 : on lit un chapitre (api.bible si dispo) → on analyse → on génère.

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

function send200(ctx, data) {
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type','application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control','no-store');
    ctx.res.end(payload);
    return;
  }
  return new Response(payload, {
    status: 200,
    headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }
  });
}

async function readBody(ctx){
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') { try { return await req.json(); } catch {} }
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

async function fetchJson(url, { headers={}, timeout=12000, retries=1 } = {}){
  const once = async () => {
    const ctrl = new AbortController(); const tid = setTimeout(()=>ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const text = await r.text();
      let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
      if (!r.ok) { const e=new Error(json?.error?.message || `HTTP ${r.status}`); e.status=r.status; e.details=json; throw e; }
      return json;
    } finally { clearTimeout(tid); }
  };
  let last;
  for (let i=0;i<=retries;i++){
    try { return await once(); }
    catch(e){ last=e; if (i===retries) throw e; await new Promise(r=>setTimeout(r, 300*(i+1))); }
  }
  throw last;
}

/* ------------------ Analyse texte (comme Rubrique 0) ------------------ */
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

function detectThemes(t){
  const out=[]; const add=(k,refs)=>out.push({k,refs});
  if (/\b(lumiere|lumière)\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(createur|créateur|creation|création|créa|crea)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\balliance\b/.test(t)) add('alliance', [['Genèse',15,'1–6'],['Luc',22,'20']]);
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

/* -------- Récupère le chapitre (api.bible si dispo) -------- */
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) {
    return { ok:false, content:'', verses:[], verseCount:0, note:'missing env or mapping' };
  }
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // Texte de chapitre
  const j = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, { headers, timeout: 12000, retries: 1 });
  const content = CLEAN(j?.data?.content || j?.data?.text || '');

  // Liste des versets
  const vlist = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 1 });
  const items = Array.isArray(vlist?.data) ? vlist.data : [];
  let verses = [];
  if (content) {
    // split "1 ..." "2 ..." etc.
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m ? { v:+m[1], text: CLEAN(m[2]) } : null; }).filter(Boolean);
    if (verses.length < Math.max(2, Math.floor(items.length/3))) {
      const arr = []; const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) arr.push({ v:+m[1], text:CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }
  if (!verses.length && items.length){
    verses = items.map(it => {
      const ref = String(it?.reference||''); const m = ref.match(/:(\d+)\b/);
      return { v: m?+m[1]:null, text: CLEAN(it?.text||'') };
    }).filter(x=>x.v && x.text);
  }

  return { ok: !!content || verses.length>0, content, verses, verseCount: items.length || (verses.length) };
}

/* -------- Contexte & génération non-dupliquée -------- */
class UniqueManager {
  constructor(){ this.stems = new Set(); }
  _stem(s){
    return String(s||'').toLowerCase()
      .normalize('NFD').replace(/\p{Diacritic}/gu,'')
      .replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim();
  }
  take(arr){
    for (const t of arr){
      const s = (t||'').trim(); if (!s) continue;
      const stem = this._stem(s);
      if (!this.stems.has(stem)){ this.stems.add(stem); return s; }
    }
    return arr[0] || '';
  }
}

function linkRef(book, chap, vv, version='LSG'){
  const code = USFM[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}

function mkSectionGenerators(context){
  const { book, chapter, text, keywords, themes, verses, keyVerse } = context;
  const kw = keywords.slice(0,5).join(', ');
  const themeName = themes[0]?.k || 'révélation';
  const kvRef = keyVerse?.v ? `${book} ${chapter}:${keyVerse.v}` : null;

  const mk = (title, body)=>`### ${title}\n\n*Référence :* ${book} ${chapter}\n\n${body}`;

  return {
    1: ()=>[
      mk(`Prière d’ouverture`,
        `Père, nous venons recevoir ta Parole. Ouvre nos cœurs à ${book} ${chapter}. Que ton Esprit éclaire notre intelligence, et que cette lecture nourrisse l’adoration et l’obéissance.`),
      mk(`Prière d’ouverture`,
        `Dieu saint, rends vivante ta Parole aujourd’hui. Dans ${book} ${chapter}, apprends-nous à discerner ta volonté et à marcher humblement sous ta grâce.`)
    ],

    2: ()=>[
      mk(`Canon et testament`,
        `${book} ${chapter} appartient au canon inspiré, où l’Écriture interprète l’Écriture. Le fil rouge christologique unit AT et NT : promesse puis accomplissement (cf. ${linkRef('Jean',1,'1–3')}; ${linkRef('Hébreux',11,'3')}).`)
    ],

    3: ()=>[
      mk(`Questions du chapitre précédent`,
        `Quelles tensions restent ouvertes à l’entrée de ${book} ${chapter} ? Quels motifs reviennent (${kw}) ? Comment la progression canonique éclaire-t-elle ces questions ? Propositions de réponses, argumentées par le texte.`)
    ],

    4: ()=>[
      mk(`Titre du chapitre`,
        `Synthèse doctrinale : ce chapitre met l’accent sur **${themeName}**. Les mots-clés (${kw}) orientent la lecture et l’application ecclésiale.`)
    ],

    5: ()=>[
      mk(`Contexte historique`,
        `Cadre et portée : replacer ${book} ${chapter} dans l’histoire du salut (auteur, destinataires, situation). Montrer comment ce contexte sert l’intention théologique.`)
    ],

    6: ()=>[
      mk(`Structure littéraire`,
        `Découpage proposé (à partir des versets) : ${verses && verses.length ? 'repérage des unités de sens et marqueurs de transition' : 'structure déduite de la progression thématique'}. La structure sert le message.`)
    ],

    7: ()=>[
      mk(`Genre littéraire`,
        `Indications de genre : ${guessGenre(book, text)}. Le genre informe la manière de lire (attentes de forme, portée du langage, symboles éventuels).`)
    ],

    8: ()=>[
      mk(`Auteur et généalogie`,
        `Auteur humain et inspiration : l’Esprit conduit l’auteur et l’Église reçoit le texte comme Parole de Dieu. Les listes/généalogies, s’il y en a, servent la promesse.`)
    ],

    9: ()=>[
      mk(`Verset-clé doctrinal`,
        kvRef ? `Pivot proposé : **${kvRef}** — utile pour la mémorisation et la catéchèse.` : `Choisir un verset pivot (clair, mémorisable) pour résumer le message du chapitre.`)
    ],

    10: ()=>[
      mk(`Analyse exégétique`,
        `Observation → interprétation → corrélation : grammaire, parallèles, contexte proche/lointain. L’exégèse précède l’application et évite l’arbitraire.`)
    ],

    11: ()=>[
      mk(`Analyse lexicale`,
        `Termes à sonder : ${kw || 'termes récurrents du chapitre'}. Noter les champs sémantiques et leur portée théologique.`)
    ],

    12: ()=>[
      mk(`Références croisées`,
        `Lire l’Écriture par l’Écriture : ${themes.length ? themes.map(t=>`${t.k}`).join(', ') : 'thèmes du chapitre'}. Passages parallèles : ${linkRef('Colossiens',1,'16–17')}, ${linkRef('Psaumes',33,'6')} (à titre d’exemples).`)
    ],

    13: ()=>[
      mk(`Fondements théologiques`,
        `Attributs de Dieu, alliance, création/rédemption : articuler la doctrine à partir du texte, sans projeter des idées étrangères.`)
    ],

    14: ()=>[
      mk(`Thème doctrinal`,
        `Déployer ${themeName} : définition, portée biblique, ancrage dans le chapitre et dans le reste du canon.`)
    ],

    15: ()=>[
      mk(`Fruits spirituels`,
        `Vertus et attitudes nourries par ce chapitre (foi, espérance, amour ; justice, humilité, patience). La doctrine produit la vie.`)
    ],

    16: ()=>[
      mk(`Types bibliques`,
        `Typologie (type/antitype) **si** légitime par la trame canonique et confirmée par le NT.`)
    ],

    17: ()=>[
      mk(`Appui doctrinal`,
        `Textes d’appui concordants : établir au moins deux témoins scripturaires pour chaque thèse enseignée.`)
    ],

    18: ()=>[
      mk(`Comparaison interne`,
        `Harmoniser ${book} ${chapter} avec les passages voisins et l’ensemble du livre (cohérence d’auteur, progression).`)
    ],

    19: ()=>[
      mk(`Parallèle ecclésial`,
        `Échos dans l’histoire de l’Église : catéchèses, symboles, liturgie — avec discernement et retour à l’Écriture.`)
    ],

    20: ()=>[
      mk(`Verset à mémoriser`,
        kvRef ? `À apprendre par cœur : **${kvRef}** (équilibre forme/sens, utile pour la prière et le témoignage).` : `Choisir un verset clair, bref, central dans l’argument.`)
    ],

    21: ()=>[
      mk(`Enseignement pour l’Église`,
        `Gouvernance, culte, discipline, mission : applications déduites du texte, dans l’ordre de l’Évangile.`)
    ],

    22: ()=>[
      mk(`Enseignement pour la famille`,
        `Transmission intergénérationnelle : lire, prier, pratiquer la justice. Le foyer comme premier lieu de discipulat.`)
    ],

    23: ()=>[
      mk(`Enseignement pour enfants`,
        `Pédagogie simple et fidèle : raconter, prier, mémoriser un verset, illustrer par des actes de compassion.`)
    ],

    24: ()=>[
      mk(`Application missionnaire`,
        `Annonce contextualisée, fidèle au texte. Relier ${book} ${chapter} aux besoins de la ville et aux nations.`)
    ],

    25: ()=>[
      mk(`Application pastorale`,
        `Consoler, exhorter, corriger avec douceur. La Parole guérit et oriente concrètement.`)
    ],

    26: ()=>[
      mk(`Application personnelle`,
        `Prier le chapitre ; nommer une décision concrète (renoncer / commencer / réparer) ; demander l’aide de l’Esprit.`)
    ],

    27: ()=>[
      mk(`Versets à retenir`,
        `Sélection utile pour la prière et le partage : ${kvRef || linkRef(book,chapter)}.`)
    ],

    28: ()=>[
      mk(`Prière de fin`,
        `Nous te rendons grâce pour ${book} ${chapter}. Scelle cette Parole dans nos cœurs ; fais-nous vivre ce que tu commandes.`)
    ],
  };
}

function buildSectionsFromContext(context){
  const titles = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',9:'Verset-clé doctrinal',
    10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',13:'Fondements théologiques',14:'Thème doctrinal',
    15:'Fruits spirituels',16:'Types bibliques',17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',
    20:'Verset à mémoriser',21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement pour enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',27:'Versets à retenir',28:'Prière de fin'
  };
  const gen = mkSectionGenerators(context);
  const u = new UniqueManager();
  const sections = [];
  for (let i=1;i<=28;i++){
    const title = titles[i];
    const candidates = (gen[i] ? gen[i]() : [
      `### ${title}\n\n*Référence :* ${context.book} ${context.chapter}\n\nDéveloppement à articuler à partir du texte et des thèmes repérés.`
    ]);
    const content = u.take(candidates);
    sections.push({ id:i, title, description:'', content });
  }
  return sections;
}

/* ------------------ Build study (GET data → context → 28) ------------------ */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/i.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

function normLength(len){
  const n = Number(len);
  return [500,1500,2500,2200,3000].includes(n) ? n : 1500;
}

async function buildStudy(passage, length, version='LSG'){
  const { book, chap } = parsePassage(passage||'Genèse 1');
  try {
    let text = '', verses = [], verseCount = 0;
    if (KEY && BIBLE_ID && USFM[book]) {
      const data = await fetchChapter(book, chap);
      if (data.ok) {
        text = data.verses?.length ? data.verses.map(v=>v.text).join(' ') : data.content || '';
        verses = data.verses || [];
        verseCount = data.verseCount || (verses.length);
      }
    }
    // Si pas de texte récupéré, on garde fallback (mais pas d’erreur 500)
    const keywords = topKeywords(text || `${book} ${chap}`, 12);
    const themes = detectThemes((text || `${book} ${chap}`).toLowerCase());
    const genre = guessGenre(book, (text || '').toLowerCase());
    const keyVerse = pickKeyVerse(verses);

    const context = { book, chapter: chap, text, keywords, themes, genre, verses, verseCount, keyVerse };
    const sections = buildSectionsFromContext(context);

    return {
      study: { sections },
      metadata: {
        book, chapter: chap, version, generatedAt: new Date().toISOString(),
        usedApiBible: !!(KEY && BIBLE_ID && USFM[book]),
        verseCount
      }
    };
  } catch (e){
    // AUCUN throw : on renvoie un fallback JSON propre
    const sections = buildSectionsFromContext({ book, chapter: chap, text:'', keywords:[], themes:[], genre:'narratif/doctrinal', verses:[], verseCount:0, keyVerse:null });
    return {
      study: { sections },
      metadata: {
        book, chapter: chap, version, generatedAt: new Date().toISOString(),
        emergency: true, error: String(e && e.message || e)
      }
    };
  }
}

function pickKeyVerse(verses){
  if (!verses || !verses.length) return null;
  const PRIORITY = ['dieu','seigneur','christ','jésus','jesus','esprit','foi','grâce','grace','parole','salut','vérité','verite','royaume','alliance'];
  let best=null; let bestScore=-1;
  for (const v of verses){
    const t=(v.text||'').toLowerCase(); if (!t) continue;
    let s=0; for (const k of PRIORITY) if (t.includes(k)) s+=2;
    const L=v.text.length; if (L>=50 && L<=220) s+=3; else if (L>=30 && L<=280) s+=1;
    if (s>bestScore){ best=v; bestScore=s; }
  }
  return best ? { v: best.v, text: best.text, score: bestScore } : null;
}

/* ------------------ Handler ------------------ */
async function core(ctx){
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return send200(ctx, {
      ok:true,
      route:'/api/generate-study',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500, "translation":"LSG" } } → 28 rubriques.',
      requires: { API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }

  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || 'Genèse 1');
    const length  = normLength(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();

    const data = await buildStudy(passage, length, version);
    return send200(ctx, data);
  }

  // Autres méthodes → retour neutre (jamais 500)
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    // Dernier filet de sécurité : toujours 200 + JSON
    const payload = { study:{ sections:[] }, metadata:{ emergency:true, fatal:true, error:String(e && e.message || e) } };
    if (res && typeof res.status === 'function') {
      res.status(200);
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }
    });
  }
}

// /api/generate-study.js
// Génération d'étude 28 rubriques — dynamique (api.bible) + fallback — toujours 200

/* -------------------- HTTP utils -------------------- */
async function fetchJson(url, { headers = {}, timeout = 12000, retries = 1 } = {}) {
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

/* -------------------- ENV & Mappings -------------------- */
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
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75' };

function linkRef(book, chap, vv, version='LSG'){
  const code = USFM[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}

/* -------------------- Helpers texte -------------------- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc entre vers avec sans chez chez-nous parmi auprès selon tandis'.split(/\s+/));

function words(text){ 
  return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); 
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
function detectThemes(t){
  const out=[];
  const add=(k, refs)=>out.push({k, refs});
  if (/\blumi(è|e)re\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(gr(â|a)ce|pardon|mis(é|e)ricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(cr(é|e)a(tion|teur)|créa|crea)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\balliance\b/.test(t)) add('alliance', [['Genèse',15,'1–6'],['Luc',22,'20']]);
  return out;
}
function guessGenre(book, t){
  if (/\bvision|songe|oracle|ainsi dit\b/.test(t)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez|harpe\b/.test(t)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume|pharisien|samaritain\b/.test(t)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(t)) return 'historique';
  if (book==='Proverbes' || /\bproverbe|sagesse\b/.test(t)) return 'sagesse';
  if (/\bgr(â|a)ce|foi|justification|ap(ô|o)tre(s)?\b/.test(t)) return 'épître/doctrinal';
  return 'narratif/doctrinal';
}
function bookFamily(book) {
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
function hashCode(str){ let h=0; for(let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0; } return h; }

/* -------------------- Unicité (éviter doublons) -------------------- */
class UniqueManager {
  constructor(){ this.sig = new Set(); }
  norm(s){
    return String(s||'')
      .toLowerCase()
      .replace(/[^\w\sàâçéèêëîïôûùüÿæœ]/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  take(cands){
    for (const c of cands){
      const t = String(c||'').trim(); if (!t) continue;
      const k = this.norm(t).slice(0,280);
      if (!this.sig.has(k)){ this.sig.add(k); return t; }
    }
    return cands[0] || '';
  }
}

/* -------------------- API bible: chapitre + versets -------------------- */
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // A) contenu texte “chapitre”
  const jChap = await fetchJson(
    `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`,
    { headers, timeout: 14000, retries: 1 }
  );
  const content = CLEAN(jChap?.data?.content || jChap?.data?.text || '');

  // B) liste des versets (id + reference)
  const jVerses = await fetchJson(
    `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`,
    { headers, timeout: 12000, retries: 1 }
  );
  const items = Array.isArray(jVerses?.data) ? jVerses.data : [];

  // C) essaye d’extraire v+texte à partir du “content”
  let verses = [];
  if (content){
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1], text:CLEAN(m[2])}:null; }).filter(Boolean);

    if (verses.length < Math.max(2, Math.floor(items.length/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) arr.push({ v:+m[1], text:CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }

  // D) fallback v->texte depuis “items” si possible (souvent sans texte)
  if (!verses.length && items.length){
    verses = items.map(v => {
      const ref = String(v?.reference||'');
      const m = ref.match(/:(\d+)(?:\D+)?$/);
      return { v: m ? +m[1] : null, text: '' };
    }).filter(x=>x.v);
  }

  return { ok: !!content || verses.length>0, content, verses, verseCount: items.length || verses.length || 0 };
}

/* -------------------- Analyse & outline -------------------- */
function scoreKeyVerse(verses) {
  if (!verses || !verses.length) return null;
  const PRIORITY = ['dieu','seigneur','christ','jésus','jesus','esprit','foi','amour','gr(â|a)ce','parole','vie','v(é|e)rit(é|e)','royaume','salut','p(é|e)ch(é|e)','alliance','promesse'];
  let best={v:null,text:'',score:-1};
  for (const verse of verses){
    if (!verse?.v || !verse?.text) continue;
    const t = verse.text.toLowerCase();
    let s=0;
    for (const w of PRIORITY) if (new RegExp(`\\b${w}\\b`).test(t)) s+=3;
    const L = verse.text.length;
    if (L>=50 && L<=200) s+=5; else if (L>=30 && L<=250) s+=2; else if (L<20 || L>300) s-=2;
    if (/\b(car|parce que|ainsi|donc|c'est pourquoi)\b/.test(t)) s+=2;
    if (/\b(fils de|engendra|enfanta)\b/.test(t)) s-=3;
    if (s>best.score) best={v:verse.v,text:verse.text,score:s};
  }
  return best.v?best:null;
}
function roughOutline(verses){
  // Découpe grossière par blocs de 5-10 versets ou par marqueurs simples.
  if (!verses || verses.length<6) return [{from:1,to:verses.at(-1)?.v||verses.length, label:'Unité principale'}];
  const last = verses.at(-1)?.v || verses.length;
  const blocks = [];
  let start = 1;
  for (let i=6; i<=last; i+=6) {
    const end = Math.min(i, last);
    blocks.push({ from:start, to:end, label:`Section ${blocks.length+1}`});
    start = end+1;
  }
  if (start<=last) blocks.push({ from:start, to:last, label:`Section ${blocks.length+1}`});
  return blocks;
}

/* -------------------- Génération des 28 rubriques (style Rubrique 0) -------------------- */
const TITLES = [
  'Prière d’ouverture','Canon et testament','Questions du chapitre précédent','Titre du chapitre',
  'Contexte historique','Structure littéraire','Genre littéraire','Auteur et généalogie',
  'Verset-clé doctrinal','Analyse exégétique','Analyse lexicale','Références croisées',
  'Fondements théologiques','Thème doctrinal','Fruits spirituels','Types bibliques',
  'Appui doctrinal','Comparaison interne','Parallèle ecclésial','Verset à mémoriser',
  'Enseignement pour l’Église','Enseignement pour la famille','Enseignement pour enfants',
  'Application missionnaire','Application pastorale','Application personnelle',
  'Versets à retenir','Prière de fin'
];

function buildSections(book, chap, ctx, budget=1500, version='LSG'){
  const u = new UniqueManager();
  const K = ctx.keywords.slice(0,6).join(', ') || '—';
  const themes = ctx.themes.map(t=>t.k).join(', ') || '—';
  const outline = roughOutline(ctx.verses);
  const keyV = ctx.keyVerse ? `${book} ${chap}:${ctx.keyVerse.v}` : null;

  const mkList = (arr)=> arr.map(x=>`- ${x}`).join('\n');

  const candidates = {
    1: [
`### Prière d’ouverture

*Référence :* ${book} ${chap}

Père, nous venons à ta Parole. Ouvre notre intelligence et nos cœurs par ton Esprit. En lisant ${linkRef(book,chap,'',version)}, rends-nous attentifs à ta vérité, humbles dans l’exégèse et prompts à l’obéissance. Que Christ soit exalté, et que cette étude porte du fruit dans l’Église. Amen.`
    ],
    2: [
`### Canon et testament

*Référence :* ${book} ${chap}

${book} ${chap} s’inscrit dans l’unité de l’Écriture : l’Ancien et le Nouveau Testament témoignent d’un même dessein salvifique. La règle demeure : l’Écriture interprète l’Écriture. Nous lisons ${linkRef(book,chap,'',version)} à la lumière du tout, avec ${themes!=='—'?`les thèmes remarqués (${themes})`:'les grands fils directeurs de la révélation'}.`
    ],
    3: [
`### Questions du chapitre précédent

*Référence :* ${book} ${chap}

Questions ouvertes héritées du contexte : 
${mkList([
  `Quelles tensions narratives ou théologiques préparent ${book} ${chap} ?`,
  `Quels motifs récurrents (${K}) trouvent ici une réponse ou un approfondissement ?`,
  `Comment le fil de l’alliance est-il poursuivi ou réorienté ?`
])}

**Réponses synthétiques :** le chapitre clarifie la progression de l’alliance, recentre l’attention sur l’initiative divine et oriente l’attente vers l’accomplissement en Christ.`
    ],
    4: [
`### Titre du chapitre

*Référence :* ${book} ${chap}

Un intitulé utile pourrait être : **« ${themes!=='—' ? themes.charAt(0).toUpperCase()+themes.slice(1) : 'Axes majeurs'} dans ${book} ${chap} »**.  
Mots-clés observables : ${K}.  
Découpage suggéré : ${outline.map(o=>`${o.label} (${o.from}–${o.to})`).join(' ; ')}.`
    ],
    5: [
`### Contexte historique

*Référence :* ${book} ${chap}

${book} appartient à la section **${bookFamily(book)}**. Le cadre historique et littéraire éclaire le sens littéral : destinataires, époque, et situation de rédaction (selon le consensus documentaire). ${themes!=='—'?`Les thèmes (${themes})`:'Les motifs dominants'} se lisent à l’horizon de l’alliance de Dieu qui conduit l’histoire vers son accomplissement.`
    ],
    6: [
`### Structure littéraire

*Référence :* ${book} ${chap}

Une lecture structurée de ${book} ${chap} :
${outline.map(o=>`- ${o.label} : ${book} ${chap}:${o.from}–${o.to}`).join('\n')}
La progression interne sert l’accent théologique du passage et guide l’application.`
    ],
    7: [
`### Genre littéraire

*Référence :* ${book} ${chap}

Indications de genre : **${guessGenre(book, ctx.text.toLowerCase())}**. Le genre oriente l’attente d’interprétation (figures, parallélismes, narration, argument logique). On privilégie la méthode grammatico-historique, puis l’analogie de la foi pour harmoniser avec le canon.`
    ],
    8: [
`### Auteur et généalogie

*Référence :* ${book} ${chap}

Les données d’auteur (tradition et discussions critiques) servent l’orientation du message, non l’inverse. Les éventuels repères généalogiques ou d’autorité prophétique/apostolique fondent l’**autorité** de la parole écrite pour l’Église.`
    ],
    9: [
`### Verset-clé doctrinal

*Référence :* ${book} ${chap}${keyV?` ; pivot : ${keyV}`:''}

${keyV ? `Un pivot mémorisable : **${book} ${chap}:${ctx.keyVerse.v}** — « ${ctx.keyVerse.text} ».` : `Choisir un verset clair et synthétique qui porte l’accent du chapitre.`}
Ce verset éclaire la doctrine en jeu et dialogue avec le reste du canon (voir §12).`
    ],
    10: [
`### Analyse exégétique

*Référence :* ${book} ${chap}

Observations : contexte immédiat, enchaînements logiques, connecteurs (car, afin que, donc), répétitions et contrastes. Le sens littéral prime ; les lectures typologiques s’appuient sur des indices textuels solides et l’usage canonique ultérieur.`
    ],
    11: [
`### Analyse lexicale

*Référence :* ${book} ${chap}

Termes saillants : ${K}.  
On relève les champs sémantiques majeurs (Dieu/Parole/Esprit, foi/grâce/justice, alliance/royaume) et on consulte, si possible, l’original (hébreu/grec) pour préciser valeurs et collocations.`
    ],
    12: [
`### Références croisées

*Référence :* ${book} ${chap}

L’Écriture éclaire l’Écriture. Pistes :
${(ctx.themes.length? ctx.themes.map(t=>`- ${t.k} : ${t.refs.map(([b,c,v])=>linkRef(b,c,v,version)).join(', ')}`).join('\n') : '- Échos canoniques pertinents selon les thèmes dominants.')}
Ces parallèles préviennent les lectures isolées et affermissent la doctrine.`
    ],
    13: [
`### Fondements théologiques

*Référence :* ${book} ${chap}

Dieu se révèle, parle et agit souverainement. ${themes!=='—'?`Les thèmes remarqués (${themes})`:'Les axes du texte'} s’enracinent dans les attributs divins (sainteté, sagesse, bonté, justice) et l’économie de l’alliance. Le Christ récapitule la révélation et la promesse.`
    ],
    14: [
`### Thème doctrinal

*Référence :* ${book} ${chap}

Thème principal proposé : **${themes!=='—'?themes:'Christ & l’alliance'}**.  
Il se déploie de la création à l’accomplissement, s’articule avec la loi et l’évangile, et appelle une réponse de foi obéissante.`
    ],
    15: [
`### Fruits spirituels

*Référence :* ${book} ${chap}

Ce que produit la vraie réception du texte : **foi**, **espérance**, **amour**, et une **piété** façonnée par la Parole. L’éthique découle de l’évangile reçu, non d’un volontarisme moral.`
    ],
    16: [
`### Types bibliques

*Référence :* ${book} ${chap}

Là où le texte le justifie, on note des **figures** (Adam/Israël/Serviteur/Roi/Temple) orientées vers le Christ. Les typologies restent sobres et contrôlées par le canon.`
    ],
    17: [
`### Appui doctrinal

*Référence :* ${book} ${chap}

La doctrine s’enracine dans le **texte** et dans l’**accord** des Écritures ; on évite les constructions spéculatives. On privilégie les passages clairs pour éclairer les plus discrets.`
    ],
    18: [
`### Comparaison interne

*Référence :* ${book} ${chap}

Harmonisation intra-biblique : motifs, citations, échos, intertextualité. On vérifie que l’interprétation respecte le flux de l’argument et la place du chapitre dans le livre.`
    ],
    19: [
`### Parallèle ecclésial

*Référence :* ${book} ${chap}

Usage ecclésial légitime : lecture publique, prédication christocentrique, catéchèse, sacrements (selon le cas), discipline spirituelle. Le texte édifie le corps entier.`
    ],
    20: [
`### Verset à mémoriser

*Référence :* ${book} ${chap}

${keyV ? `À retenir : **${book} ${chap}:${ctx.keyVerse.v}** — « ${ctx.keyVerse.text} ».` : `Choisir un verset bref, clair, doctrinalement riche, pour ancrer la méditation et la prière.`}`
    ],
    21: [
`### Enseignement pour l’Église

*Référence :* ${book} ${chap}

Conséquences pour la **gouvernance**, la **vie communautaire**, la **mission** et le **culte** ; l’autorité biblique règle et réforme en permanence la pratique de l’Église.`
    ],
    22: [
`### Enseignement pour la famille

*Référence :* ${book} ${chap}

Transmission intergénérationnelle : lecture, prière, service ; la maison devient un lieu de **discipulat** où la Parole façonne l’amour et la justice au quotidien.`
    ],
    23: [
`### Enseignement pour enfants

*Référence :* ${book} ${chap}

Dire vrai simplement : raconter, répéter, prier. Insister sur la bonté, la vérité et la fidélité de Dieu, en montrant **Jésus** comme accomplissement des promesses.`
    ],
    24: [
`### Application missionnaire

*Référence :* ${book} ${chap}

Annonce contextualisée, mais **fidèle** au texte : vérité, grâce, appel à la repentance et à la foi. L’amour du prochain porte l’évangile en paroles et en actes.`
    ],
    25: [
`### Application pastorale

*Référence :* ${book} ${chap}

Consolation des affligés, exhortation des découragés, correction des errants : le **bon pasteur** utilise la Parole pour soigner, orienter, protéger.`
    ],
    26: [
`### Application personnelle

*Référence :* ${book} ${chap}

Prier le texte ; confesser ; croire ; obéir concrètement cette semaine. Chercher l’unité de vie (cœur, paroles, actions) sous l’autorité de Christ.`
    ],
    27: [
`### Versets à retenir

*Référence :* ${book} ${chap}

Sélection : ${ctx.verses.slice(0,4).map(v=>`${book} ${chap}:${v.v}`).join(', ') || '(à choisir selon la lecture)'}.
Objectif : nourrir la **prière** et la **mémoire** de l’Église.`
    ],
    28: [
`### Prière de fin

*Référence :* ${book} ${chap}

Dieu de paix, scelle en nous ta Parole. Que l’enseignement reçu transforme notre intelligence, fortifie notre foi et fasse de nous des témoins de Jésus-Christ. **Amen**.`
    ]
  };

  // Ajustements contextuels sur certaines rubriques
  if (ctx.keyVerse) {
    candidates[12].push(
`### Références croisées

*Référence :* ${book} ${chap}

Pivot : ${linkRef(book, chap, String(ctx.keyVerse.v), version)}. Relire les échos doctrinaux majeurs (foi/grâce/Parole/Esprit) et harmoniser avec la totalité du canon.`
    );
  }

  const sections = [];
  for (let i=1;i<=28;i++){
    const picked = u.take(candidates[i] || [
      `### ${TITLES[i-1]}\n\n*Référence :* ${book} ${chap}\n\nContenu généré à partir du texte du chapitre (analyse, thèmes, application).`
    ]);
    sections.push({ id:i, title:TITLES[i-1], description:'', content: picked });
  }
  return sections;
}

/* -------------------- Fallback propre (si API KO) -------------------- */
function buildFallbackStudy(book, chap, version='LSG'){
  const sections = [];
  for (let i=1;i<=28;i++){
    sections.push({
      id:i,
      title: TITLES[i-1],
      description:'',
      content:
`### ${TITLES[i-1]}

*Référence :* ${book} ${chap}

Contenu de base (fallback). Développer selon le chapitre.`
    });
  }
  return { sections, fallback:true, version };
}

/* -------------------- Build principal -------------------- */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
function normalizeTotal(length){
  const L = Number(length);
  if (L===500 || L===1500 || L===2500) return L;
  if (L>=1200 && L<=3000) return L;
  return 1500;
}

async function buildDynamicStudy(book, chap, totalBudget, version='LSG'){
  const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
  if (!ok) throw new Error('Chapitre introuvable ou vide');

  const text = verses?.length ? verses.map(v=>v.text).join(' ') : content;
  const keywords = topKeywords(text, 14);
  const themes = detectThemes(text.toLowerCase());
  const genre = guessGenre(book, text.toLowerCase());
  const keyVerse = scoreKeyVerse(verses);

  const ctx = { book, chapter: chap, text, keywords, themes, genre, verses, verseCount, keyVerse, family: bookFamily(book) };
  const sections = buildSections(book, chap, ctx, totalBudget, version);

  return {
    study: { sections },
    metadata: {
      book, chapter: chap, version,
      generatedAt: new Date().toISOString(),
      verseCount,
      features: { keywords, themes: themes.map(t=>t.k), genre, keyVerse: keyVerse?keyVerse.v:null }
    }
  };
}

async function buildStudy(passage, length, version='LSG'){
  const total = normalizeTotal(length);
  const { book, chap } = parsePassage(passage||'Genèse 1');
  if (KEY && BIBLE_ID && USFM[book]) {
    try {
      return await buildDynamicStudy(book, chap, total, version);
    } catch (e) {
      // fallback doux
      return { study: buildFallbackStudy(book, chap, version), metadata: { emergency:true, error:'dynamic_failed' } };
    }
  } else {
    return { study: buildFallbackStudy(book, chap, version), metadata: { emergency:true, error:'missing_env_or_mapping' } };
  }
}

/* -------------------- Handler principal -------------------- */
async function core(ctx){
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return send200(ctx, {
      ok:true,
      route:'/api/generate-study',
      method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500, "translation":"LSG" } } → 28 rubriques dynamiques.',
      requires: { API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID }
    });
  }

  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();

    try {
      const result = await buildStudy(passage, length, version);
      return send200(ctx, result);
    } catch (e) {
      // Dernier filet de sécurité — toujours 200
      const { book, chap } = parsePassage(passage);
      return send200(ctx, { study: buildFallbackStudy(book, chap, version), metadata:{ emergency:true, fatal:true, error:String(e?.message||e) } });
    }
  }

  // autres méthodes → info
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour ping, POST pour générer.' });
}

export default async function handler(req, res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    const payload = { study: { sections: [] }, metadata: { emergency:true, fatal:true, error:String(e?.message||e) } };
    if (res && typeof res.status === 'function') {
      res.status(200);
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), { status:200, headers:{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' }});
  }
}

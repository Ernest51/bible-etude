// /api/generate-study.js
// Étude biblique — 28 rubriques, dynamique, robuste, avec monitoring qualité/perf.

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

/* -------------------- Performance Monitoring -------------------- */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      generations: 0, successes: 0, failures: 0,
      totalDuration: 0, apiCalls: 0, fallbacks: 0,
      qualityScores: []
    };
  }
  startTimer(){ return Date.now(); }
  recordGeneration(success, duration, usedFallback, qualityScore){
    this.metrics.generations++;
    if (success) this.metrics.successes++; else this.metrics.failures++;
    this.metrics.totalDuration += duration;
    if (usedFallback) this.metrics.fallbacks++;
    if (qualityScore !== undefined) this.metrics.qualityScores.push(qualityScore);
  }
  recordApiCall(){ this.metrics.apiCalls++; }
  getStats(){
    const avgDuration = this.metrics.generations ? (this.metrics.totalDuration/this.metrics.generations).toFixed(2) : 0;
    const successRate = this.metrics.generations ? ((this.metrics.successes/this.metrics.generations)*100).toFixed(2) : 0;
    const avgQuality = this.metrics.qualityScores.length ? (this.metrics.qualityScores.reduce((a,b)=>a+b,0)/this.metrics.qualityScores.length).toFixed(2) : 0;
    return {
      ...this.metrics,
      averageDuration: +avgDuration,
      successRate: +successRate,
      fallbackRate: this.metrics.generations ? +(((this.metrics.fallbacks/this.metrics.generations)*100).toFixed(2)) : 0,
      averageQuality: +avgQuality
    };
  }
}
const performanceMonitor = new PerformanceMonitor();

/* -------------------- Quality Assessment -------------------- */
class QualityAssessor {
  static calculateUniqueness(sections) {
    const allContent = sections.map(s => s.content||'').join(' ').toLowerCase();
    const words = allContent.match(/\b[\p{L}\p{N}’'-]+\b/gu) || [];
    const uniqueWords = new Set(words);
    return Math.min(100, (uniqueWords.size / Math.max(words.length, 1)) * 100);
  }
  static calculateLexicalDiversity(text) {
    const words = (text||'').toLowerCase().match(/\b[\p{L}’'-]+\b/gu) || [];
    if (!words.length) return 0;
    const unique = new Set(words);
    return Math.min(100, (unique.size/words.length)*100);
  }
  static checkDoctrinalCoherence(sections){
    const KEYS = ['dieu','christ','jésus','esprit','parole','grâce','foi','alliance','salut','péché','rédemption','sainteté'];
    let total=0, n=0;
    for (const s of sections){
      const t = (s.content||'').toLowerCase();
      if (!t) continue;
      let sc = 0, c=0;
      for (const k of KEYS){ if (t.includes(k)) { sc+=10; c++; } }
      if (c>=3) sc+=20; if (c>=5) sc+=30;
      if (t.length<80) sc-=20;
      const sentences = t.split(/[.!?]+/).filter(x=>x.trim());
      if (sentences.length<2) sc-=10;
      total += Math.max(0, Math.min(100, sc)); n++;
    }
    return n? total/n : 0;
  }
  static checkCompleteness(sections){
    const filled = sections.filter(s => (s.content||'').trim().length > 80).length;
    return (filled/28)*100;
  }
  static assessOverallQuality(sections){
    const uniqueness = this.calculateUniqueness(sections);
    const doctrinal = this.checkDoctrinalCoherence(sections);
    const completeness = this.checkCompleteness(sections);
    const diversity = this.calculateLexicalDiversity(sections.map(s=>s.content||'').join(' '));
    const overall = uniqueness*0.25 + doctrinal*0.35 + completeness*0.25 + diversity*0.15;
    return {
      overall: Math.round(overall),
      uniqueness: Math.round(uniqueness),
      doctrinal: Math.round(doctrinal),
      completeness: Math.round(completeness),
      diversity: Math.round(diversity)
    };
  }
}

/* -------------------- Mappings & ENV -------------------- */
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
  if (/\blumi[eè]re\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(gr[âa]ce|pardon|mis[ée]ricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(cr[ée]a|cr[ée]ation|créateur|createur)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
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

/* -------------------- Unicité -------------------- */
class ImprovedUniqueManager {
  constructor(){
    this.used = new Set(); this.stems = new Set(); this.conceptMap = new Map();
    this.qualityThreshold = 50;
  }
  _normalize(s){
    return String(s||'').replace(/\s+—\s*[a-z0-9]{3,6}\.?$/i,'').trim().toLowerCase()
      .replace(/[^\w\sàâçéèêëîïôûùüÿæœ]/g,' ').replace(/\s+/g,' ');
  }
  _scoreContent(text){
    if (!text || text.length<20) return 0;
    let score=50;
    if (text.length>=120 && text.length<=600) score+=20;
    else if (text.length<80) score-=15;
    const doctrinal=['dieu','christ','esprit','parole','foi','grâce'];
    const found = doctrinal.filter(w=>text.toLowerCase().includes(w)).length;
    score += found*4;
    if (/\b(car|parce que|ainsi|donc|c'est pourquoi|en effet)\b/.test(text)) score+=8;
    if (text.includes(':')||text.includes(';')) score+=4;
    return Math.max(0, Math.min(100, score));
  }
  take(candidates, concept='general'){
    const scored = (candidates||[]).map(t=>({text:String(t||'').trim(), score:this._scoreContent(String(t||''))}))
      .filter(x=>x.text && x.score>=this.qualityThreshold).sort((a,b)=>b.score-a.score);
    for (const c of scored){
      const stem = this._normalize(c.text);
      const exact = c.text.toLowerCase();
      if (!stem || this.stems.has(stem) || this.used.has(exact)) continue;
      this.stems.add(stem); this.used.add(exact);
      this.conceptMap.set(concept,(this.conceptMap.get(concept)||0)+1);
      return c.text;
    }
    return '';
  }
  getUsageStats(){ return { totalUsed:this.used.size, conceptsUsed:Object.fromEntries(this.conceptMap), uniqueStems:this.stems.size }; }
}

/* -------------------- Petits utilitaires domaine -------------------- */
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
function scoreKeyVerse(verses){
  if (!verses?.length) return null;
  const PRIORITY=['dieu','seigneur','christ','jésus','jesus','esprit','foi','amour','grâce','grace','parole','vie','vérité','verite','royaume','salut','péché','peche','alliance','promesse'];
  let best={v:null,text:'',score:-1};
  for (const v of verses){
    if (!v?.v || !v?.text) continue;
    const t=v.text.toLowerCase(); let s=0;
    for (const w of PRIORITY){ if (t.includes(w)) s+=3; }
    const L=v.text.length; if (L>=50 && L<=200) s+=5; else if (L>=30 && L<=250) s+=2; else if (L<20 || L>300) s-=2;
    if (t.includes(':')||t.includes(';')) s+=1;
    if (/\b(fils de|fille de|enfanta|engendra)\b/.test(t)) s-=3;
    if (/\b(\d+\s+(ans|année|mois|jour))\b/.test(t)) s-=2;
    if (s>best.score) best={v:v.v, text:v.text, score:s};
  }
  return best.v ? best : null;
}
function linkRef(book, chap, vv, version='LSG'){
  const code = USFM[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}
function allocateSmartBudget(total, defs){
  const W={high:3,medium:2,low:1};
  const tw = defs.reduce((s,d)=>s+(W[d.priority]||1),0);
  const unit = Math.max(60, Math.floor(total/tw));
  return defs.map(d => unit*(W[d.priority]||1));
}
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}
function normalizeTotal(length){
  const L=Number(length);
  if (L>=1500 && L<=3000) return L;
  if ([500,1500,2500,3000].includes(L)) return L===500?1500:L;
  return 2200;
}

/* -------------------- Récup chapitre -------------------- */
async function fetchChapter(book, chap){
  const t0=Date.now(); performanceMonitor.recordApiCall();
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  let content='', verses=[], verseCount=0;
  try{
    const jC = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`,
      { headers, timeout: 12000, retries: 1 }
    );
    content = CLEAN(jC?.data?.content || jC?.data?.text || '');

    const jV = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`,
      { headers, timeout: 10000, retries: 1 }
    );
    const items = Array.isArray(jV?.data) ? jV.data : [];
    verseCount = items.length;

    if (content){
      const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
      verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1], text:CLEAN(m[2])}:null; }).filter(Boolean);
      if (verses.length < Math.max(2, Math.floor(verseCount/3))){
        const arr=[]; const re=/(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g; let m;
        while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
        if (arr.length) verses=arr;
      }
    }
    if (!verses.length && items.length){
      verses = items.map(v=>{
        const ref = String(v?.reference||''); const mm = ref.match(/(\d+)(?:\D+)?$/);
        const num = mm ? Number(mm[1]) : null;
        return { v:num, text:CLEAN(v?.text||'') };
      }).filter(x=>x.v && x.text);
    }
    const dt=Date.now()-t0;
    return { ok: !!content || verses.length>0, content, verses, verseCount: verseCount || verses.length || 0, duration: dt };
  }catch(e){
    const dt=Date.now()-t0; console.error(`[API] ${book} ${chap} failed in ${dt}ms:`, e.message);
    throw e;
  }
}

/* -------------------- Builders de sections -------------------- */
function buildPrayerSection(book, chapter){
  return [
    `### Prière d’ouverture\n*Référence :* ${book} ${chapter}\n\nPère des lumières, nous venons à toi dans la dépendance de ton Esprit. Ouvre nos cœurs à ta Parole en ${book} ${chapter}, accorde intelligence et obéissance, afin que nous recevions ce texte dans la foi et la reconnaissance. Au nom de Jésus-Christ. Amen.`
  ];
}
function buildCanonSection(book, chapter){
  return [
    `### Canon et testament\n*Référence :* ${book} ${chapter}\n\n${book} ${chapter} s’inscrit dans l’unité des deux Testaments : l’Ancien annonce, le Nouveau accomplit ; **l’Écriture interprète l’Écriture**. Le Christ demeure la clé herméneutique de l’ensemble canonique.`
  ];
}

/* Rubrique 3 — Questions du chapitre précédent (≥ 5 Q/R, spécifiques) */
function buildQuestionsPrevSection(book, chapter, context){
  const prev = chapter>1 ? `${book} ${chapter-1}` : `${book} ${chapter}`;
  const kws = (context.keywords||[]).slice(0,4).join(', ');
  const qs = [
    `1) Qu’ai-je appris dans ${prev} sur le caractère de Dieu ?\n**Réponse :** ${book} ${chapter-1||chapter} montre que Dieu agit fidèlement ; les termes clés (${kws}) éclairent son œuvre.`,
    `2) Quel lien textuel unit ${prev} à ${book} ${chapter} ?\n**Réponse :** Le fil littéraire se poursuit par motifs et annonces repris au chapitre actuel.`,
    `3) Quelle promesse ou menace ressort de ${prev} ?\n**Réponse :** Elle prépare l’écoute de ${book} ${chapter} en appelant à la foi/obéissance.`,
    `4) Quels personnages/lieux structurent ${prev} ?\n**Réponse :** Leur trajectoire sert de cadre narratif et théologique au chapitre courant.`,
    `5) Quelle application a découlé de ${prev} ?\n**Réponse :** Mettre en pratique la Parole reçue ; ${book} ${chapter} approfondit cet appel.`
  ];
  return [
    `### Questions du chapitre précédent\n*Référence :* ${prev}\n\n${qs.join('\n\n')}`
  ];
}

/* Rubrique 9 — Verset-clé doctrinal (choisi automatiquement) */
function buildKeyVerseSection(book, chapter, context){
  const kv = context.keyVerse;
  if (!kv) {
    return [
      `### Verset-clé doctrinal\n*Référence :* ${book} ${chapter}\n\nChoisir un verset représentatif (doctrinal, mémorisable) qui concentre l’enseignement du chapitre.`
    ];
  }
  const ref = linkRef(book, chapter, String(kv.v));
  return [
    `### Verset-clé doctrinal\n*Référence :* ${book} ${chapter}\n\n**${ref}** — ${kv.text}\n\nPourquoi clé : densité doctrinale (mots-clés), clarté pour la mémorisation, centralité dans l’argument du chapitre.`
  ];
}

/* Rubrique 14 — Thème doctrinal (appuyé par thèmes détectés) */
function buildThemeSection(book, chapter, context){
  const t = context.themes?.[0];
  const label = t?.k || 'révélation';
  const refs = (t?.refs||[]).map(([b,c,v])=>`- ${linkRef(b,c,v)}`).join('\n');
  return [
    `### Thème doctrinal\n*Référence :* ${book} ${chapter}\n\nThème principal : **${label}**.\n\nAppuis canoniques :\n${refs || '- (à préciser selon le chapitre)'}\n\nSynthèse : le thème oriente la lecture et l’application, sous l’autorité de l’Écriture.`
  ];
}

/* Rubrique 21 — Enseignement pour l’Église */
function buildChurchSection(book, chapter, context){
  const family = context.family || 'Canon';
  return [
    `### Enseignement pour l’Église\n*Référence :* ${book} ${chapter}\n\n- **Culte :** recevoir la Parole avec foi et repentance.\n- **Discipulat :** enraciner la communauté dans la saine doctrine (famille : ${family}).\n- **Mission :** annoncer Christ conformément au texte étudié.\n- **Gouvernance :** pratiques modelées par l’Écriture (sainteté, service).`
  ];
}

/* Rubrique 26 — Application personnelle */
function buildPersonalSection(book, chapter, context){
  const kv = context.keyVerse ? `${book} ${chapter}:${context.keyVerse.v}` : `${book} ${chapter}`;
  return [
    `### Application personnelle\n*Référence :* ${book} ${chapter}\n\n- **Vérité à croire :** Dieu parle et agit comme révélé en ${kv}.\n- **Péché à confesser :** incrédulité, autosuffisance.\n- **Promesse à saisir :** grâce suffisante en Christ.\n- **Obéissance à pratiquer :** prière, écoute, service humble.\n- **Décision concrète aujourd’hui :** noter un engagement vérifiable.`
  ];
}

/* Rubrique générique (autres id) — contextualisée et unique */
function buildGenericSection(id, title, book, chapter, context){
  const theme = context.themes?.[0]?.k || 'révélation';
  const kws = (context.keywords||[]).slice(0,5).join(', ');
  const extras = {
    5: 'Contexte historique : période, cadre géopolitique, culture, lieux.',
    6: 'Structure : péricopes, parallélismes, inclusions, progression.',
    7: 'Genre : repérer marqueurs (narratif, poétique, prophétique, épître…).',
    8: 'Auteur/généalogie : auteur, destinataires, place dans l’histoire du salut.',
    10: 'Exégèse : grammaire, syntaxe, contexte immédiat élargi.',
    11: 'Lexique : termes originaux clés, champ sémantique, portée doctrinale.',
    12: 'Références croisées : textes parallèles/complémentaires utiles.',
    13: 'Fondements : attributs de Dieu, création, alliance, salut.',
    15: 'Fruits : vertus/attitudes suscitées par la Parole reçue.',
    16: 'Typologie : symboles, figures, accomplissements.',
    17: 'Appui : autres textes confirmant l’enseignement.',
    18: 'Comparaison : versets internes, harmonisation.',
    19: 'Parallèle avec Actes 2 : vie de l’Église et Esprit.',
    20: 'Mémorisation : choisir un verset bref/clair.',
    22: 'Famille : transmission fidèle au foyer.',
    23: 'Enfants : pédagogie adaptée (histoire, images).',
    24: 'Mission : annonce contextualisée, vérité et grâce.',
    25: 'Pastorale : consolation, exhortation, correction.',
    27: 'Versets à retenir : sélection pour la pastorale.',
    28: 'Prière de fin : action de grâces et envoi.'
  };
  const extra = extras[id] ? `\n\n${extras[id]}` : '';
  return [
    `### ${title}\n*Référence :* ${book} ${chapter}\n\nLecture de ${linkRef(book, chapter)} avec accent **${title.toLowerCase()}**. Thème saillant : *${theme}*. Mots-clés : ${kws || '—'}.${extra}`
  ];
}

/* -------------------- Fallback complet -------------------- */
function buildFallbackStudy(book, chap){
  const u = new ImprovedUniqueManager();
  const sections=[]; 
  const titles = [
    'Prière d\'ouverture','Canon et testament','Questions du chapitre précédent','Titre du chapitre',
    'Contexte historique','Structure littéraire','Genre littéraire','Auteur et généalogie','Verset-clé doctrinal',
    'Analyse exégétique','Analyse lexicale','Références croisées','Fondements théologiques','Thème doctrinal',
    'Fruits spirituels','Types bibliques','Appui doctrinal','Comparaison interne','Parallèle ecclésial',
    'Verset à mémoriser','Enseignement pour l’Église','Enseignement pour la famille','Enseignement pour enfants',
    'Application missionnaire','Application pastorale','Application personnelle','Versets à retenir','Prière de fin'
  ];
  for (let i=1;i<=28;i++){
    const content = u.take([`### ${titles[i-1]}\n*Référence :* ${book} ${chap}\n\nContenu de base (fallback). Développer selon le chapitre.`], `fallback_${i}`);
    sections.push({ id:i, title:titles[i-1], description:'', content: content || `### ${titles[i-1]}\n*Référence :* ${book} ${chap}\n\n(à compléter)` });
  }
  return { sections };
}

/* -------------------- Génération principale -------------------- */
async function buildImprovedStudy(book, chap, totalBudget, version='LSG'){
  const t0=Date.now(); let usedFallback=false; let qualityScore=0;

  try{
    const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
    if (!ok || (!content && !verses?.length)) throw new Error('Chapitre introuvable ou vide');

    const text = verses?.length ? verses.map(v=>v.text).join(' ') : content;
    const keywords = topKeywords(text, 14);
    const themes = detectThemes(text.toLowerCase());
    const genre = guessGenre(book, text.toLowerCase());
    const context = {
      book, chapter: chap, text, keywords, themes, genre,
      verses, verseCount, family: bookFamily(book), keyVerse: scoreKeyVerse(verses)
    };

    const u = new ImprovedUniqueManager();
    const sections=[];
    const defs = [
      { id:1, title:'Prière d\'ouverture', priority:'high' },
      { id:2, title:'Canon et testament', priority:'high' },
      { id:3, title:'Questions du chapitre précédent', priority:'high' },
      { id:4, title:'Titre du chapitre', priority:'medium' },
      { id:5, title:'Contexte historique', priority:'medium' },
      { id:6, title:'Structure littéraire', priority:'medium' },
      { id:7, title:'Genre littéraire', priority:'medium' },
      { id:8, title:'Auteur et généalogie', priority:'low' },
      { id:9, title:'Verset-clé doctrinal', priority:'high' },
      { id:10, title:'Analyse exégétique', priority:'high' },
      { id:11, title:'Analyse lexicale', priority:'medium' },
      { id:12, title:'Références croisées', priority:'high' },
      { id:13, title:'Fondements théologiques', priority:'high' },
      { id:14, title:'Thème doctrinal', priority:'high' },
      { id:15, title:'Fruits spirituels', priority:'medium' },
      { id:16, title:'Types bibliques', priority:'low' },
      { id:17, title:'Appui doctrinal', priority:'medium' },
      { id:18, title:'Comparaison interne', priority:'medium' },
      { id:19, title:'Parallèle ecclésial', priority:'medium' },
      { id:20, title:'Verset à mémoriser', priority:'low' },
      { id:21, title:'Enseignement pour l\'Église', priority:'high' },
      { id:22, title:'Enseignement pour la famille', priority:'medium' },
      { id:23, title:'Enseignement pour enfants', priority:'low' },
      { id:24, title:'Application missionnaire', priority:'medium' },
      { id:25, title:'Application pastorale', priority:'medium' },
      { id:26, title:'Application personnelle', priority:'high' },
      { id:27, title:'Versets à retenir', priority:'low' },
      { id:28, title:'Prière de fin', priority:'medium' }
    ];
    allocateSmartBudget(totalBudget, defs); // (budget pré-calculé si besoin plus tard)

    // Routeurs vers builders spécifiques
    function buildById(id, title){
      switch(id){
        case 1: return buildPrayerSection(book, chap);
        case 2: return buildCanonSection(book, chap);
        case 3: return buildQuestionsPrevSection(book, chap, context);
        case 9: return buildKeyVerseSection(book, chap, context);
        case 14: return buildThemeSection(book, chap, context);
        case 21: return buildChurchSection(book, chap, context);
        case 26: return buildPersonalSection(book, chap, context);
        default: return buildGenericSection(id, title, book, chap, context);
      }
    }

    for (const d of defs){
      const candidates = Array.isArray(buildById(d.id, d.title)) ? buildById(d.id, d.title) : [buildById(d.id, d.title)];
      const contentSel = u.take(candidates, `section_${d.id}`) || candidates[0] || '';
      sections.push({ id:d.id, title:d.title, description:'', content: contentSel });
    }

    const quality = QualityAssessor.assessOverallQuality(sections);
    qualityScore = quality.overall;
    const dt = Date.now()-t0;
    performanceMonitor.recordGeneration(true, dt, usedFallback, qualityScore);

    return {
      study: { sections: sections.sort((a,b)=>a.id-b.id) },
      metadata: {
        book, chapter: chap, version,
        generatedAt: new Date().toISOString(),
        processingTime: dt, quality,
        usageStats: u.getUsageStats(), fallbackUsed: usedFallback
      },
      performance: performanceMonitor.getStats()
    };
  }catch(e){
    usedFallback = true;
    const fb = buildFallbackStudy(book, chap);
    const dt = Date.now()-t0;
    performanceMonitor.recordGeneration(false, dt, usedFallback, 0);
    return {
      study: fb,
      metadata: {
        book, chapter: chap, version,
        generatedAt: new Date().toISOString(),
        processingTime: dt, quality:{ overall:40, note:'Fallback utilisé' },
        fallbackUsed: true, error: e.message
      },
      performance: performanceMonitor.getStats()
    };
  }
}

/* -------------------- Orchestration -------------------- */
async function buildStudy(passage, length, version='LSG'){
  const total = normalizeTotal(length);
  const { book, chap } = parsePassage(passage||'Genèse 1');
  if (KEY && BIBLE_ID && USFM[book]) {
    try { return await buildImprovedStudy(book, chap, total, version); }
    catch(e){ console.error('[generate-study] dynamic failed:', e); }
  }
  // fallback direct si env manquant ou erreur
  return {
    study: buildFallbackStudy(book, chap),
    metadata: { emergency:true, error: 'missing_env_or_dynamic_error', book, chapter: chap, version },
    performance: performanceMonitor.getStats()
  };
}

/* -------------------- Handler -------------------- */
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  if (method === 'GET'){
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":1500|2200|3000, "translation":"LSG|JND|..." } } → 28 rubriques.',
      requires:{ API_BIBLE_KEY: !!KEY, API_BIBLE_ID: !!BIBLE_ID },
      performance: performanceMonitor.getStats()
    });
  }
  if (method === 'POST'){
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    try { return send200(ctx, await buildStudy(passage, length, version)); }
    catch(e){
      console.error('[generate-study] buildStudy error:', e);
      performanceMonitor.recordGeneration(false, 0, true, 0);
      return send200(ctx, { study:{ sections:[] }, metadata:{ emergency:true, error:String(e) }, performance: performanceMonitor.getStats() });
    }
  }
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.', performance: performanceMonitor.getStats() });
}

export default async function handler(req, res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    performanceMonitor.recordGeneration(false, 0, true, 0);
    const payload = { study:{ sections:[] }, metadata:{ emergency:true, fatal:true, error:String(e && e.message || e) }, performance: performanceMonitor.getStats() };
    if (res && typeof res.status === 'function') {
      res.status(200); res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    return new Response(JSON.stringify(payload), { status:200, headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }});
  }
}

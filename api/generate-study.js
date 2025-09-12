// /api/generate-study.js
// Étude biblique avec indicateurs de performance intégrés

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

/* -------------------- Performance Monitoring -------------------- */
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      generations: 0,
      successes: 0,
      failures: 0,
      totalDuration: 0,
      apiCalls: 0,
      fallbacks: 0,
      qualityScores: []
    };
  }

  startTimer() {
    return Date.now();
  }

  recordGeneration(success, duration, usedFallback, qualityScore) {
    this.metrics.generations++;
    if (success) this.metrics.successes++;
    else this.metrics.failures++;
    this.metrics.totalDuration += duration;
    if (usedFallback) this.metrics.fallbacks++;
    if (qualityScore !== undefined) this.metrics.qualityScores.push(qualityScore);
  }

  recordApiCall() {
    this.metrics.apiCalls++;
  }

  getStats() {
    const avgDuration = this.metrics.generations > 0 ? 
      (this.metrics.totalDuration / this.metrics.generations).toFixed(2) : 0;
    const successRate = this.metrics.generations > 0 ? 
      ((this.metrics.successes / this.metrics.generations) * 100).toFixed(2) : 0;
    const avgQuality = this.metrics.qualityScores.length > 0 ?
      (this.metrics.qualityScores.reduce((a,b) => a+b, 0) / this.metrics.qualityScores.length).toFixed(2) : 0;
    
    return {
      ...this.metrics,
      averageDuration: parseFloat(avgDuration),
      successRate: parseFloat(successRate),
      fallbackRate: this.metrics.generations > 0 ? 
        ((this.metrics.fallbacks / this.metrics.generations) * 100).toFixed(2) : 0,
      averageQuality: parseFloat(avgQuality)
    };
  }
}

const performanceMonitor = new PerformanceMonitor();

/* -------------------- Quality Assessment -------------------- */
class QualityAssessor {
  static calculateUniqueness(sections) {
    const allContent = sections.map(s => s.content).join(' ').toLowerCase();
    const words = allContent.match(/\b\w+\b/g) || [];
    const uniqueWords = new Set(words);
    return Math.min(100, (uniqueWords.size / Math.max(words.length, 1)) * 100);
  }

  static calculateLexicalDiversity(text) {
    const words = (text || '').toLowerCase().match(/\b[a-zàâçéèêëîïôûùüÿæœ]+\b/g) || [];
    if (words.length === 0) return 0;
    
    const uniqueWords = new Set(words);
    const diversity = (uniqueWords.size / words.length) * 100;
    return Math.min(100, diversity);
  }

  static checkDoctrinalCoherence(sections) {
    const DOCTRINAL_KEYWORDS = [
      'dieu', 'christ', 'jésus', 'esprit', 'parole', 'grâce', 'foi', 
      'alliance', 'salut', 'péché', 'rédemption', 'sainteté'
    ];
    
    let totalScore = 0;
    let validSections = 0;

    sections.forEach(section => {
      if (!section.content) return;
      
      const content = section.content.toLowerCase();
      let sectionScore = 0;
      let keywordCount = 0;

      DOCTRINAL_KEYWORDS.forEach(keyword => {
        if (content.includes(keyword)) {
          sectionScore += 10;
          keywordCount++;
        }
      });

      // Bonus pour équilibre doctrinal
      if (keywordCount >= 3) sectionScore += 20;
      if (keywordCount >= 5) sectionScore += 30;

      // Pénalité pour contenu trop court ou trop répétitif
      if (content.length < 50) sectionScore -= 20;
      
      const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length < 2) sectionScore -= 15;

      totalScore += Math.max(0, Math.min(100, sectionScore));
      validSections++;
    });

    return validSections > 0 ? totalScore / validSections : 0;
  }

  static checkCompleteness(sections) {
    let filledSections = 0;
    let totalExpected = 28;

    sections.forEach(section => {
      if (section.content && section.content.trim().length > 30) {
        filledSections++;
      }
    });

    return (filledSections / totalExpected) * 100;
  }

  static assessOverallQuality(sections) {
    const uniqueness = this.calculateUniqueness(sections);
    const doctrinal = this.checkDoctrinalCoherence(sections);
    const completeness = this.checkCompleteness(sections);
    const diversity = this.calculateLexicalDiversity(
      sections.map(s => s.content).join(' ')
    );

    // Pondération des métriques
    const overall = (
      uniqueness * 0.25 +
      doctrinal * 0.35 +
      completeness * 0.25 +
      diversity * 0.15
    );

    return {
      overall: Math.round(overall),
      uniqueness: Math.round(uniqueness),
      doctrinal: Math.round(doctrinal),
      completeness: Math.round(completeness),
      diversity: Math.round(diversity)
    };
  }
}

/* -------------------- Mappings et constantes -------------------- */
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

/* -------------------- Helpers texte améliorés -------------------- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc'.split(/\s+/));

function words(text){ 
  return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); 
}

function topKeywords(text, k=14){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()]
    .sort((a,b)=>b[1]-a[1])
    .slice(0,k)
    .map(([w])=>w);
}

function detectThemes(t){
  const out=[]; 
  const add=(k,refs)=>out.push({k,refs});
  
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

/* -------------------- Unicité et cohérence renforcées -------------------- */
class ImprovedUniqueManager {
  constructor(){
    this.used = new Set();
    this.stems = new Set();
    this.conceptMap = new Map(); // Suivi des concepts utilisés
    this.qualityThreshold = 50; // Score minimum de qualité
  }

  _normalize(s) {
    return String(s||'')
      .replace(/\s+—\s*[a-z0-9]{3,6}\.?$/i,'')
      .trim()
      .toLowerCase()
      .replace(/[^\w\sàâçéèêëîïôûùüÿæœ]/g, ' ')
      .replace(/\s+/g, ' ');
  }

  _scoreContent(text) {
    if (!text || text.length < 20) return 0;
    
    let score = 50; // Score de base
    
    // Longueur optimale
    if (text.length >= 80 && text.length <= 300) score += 20;
    else if (text.length < 40) score -= 20;
    
    // Présence de mots-clés doctrinaux
    const doctrinalWords = ['dieu', 'christ', 'esprit', 'parole', 'foi', 'grâce'];
    const foundWords = doctrinalWords.filter(w => text.toLowerCase().includes(w));
    score += foundWords.length * 5;
    
    // Structure grammaticale
    if (/\b(car|parce que|ainsi|donc|c'est pourquoi|en effet)\b/.test(text)) score += 10;
    if (text.includes(':') || text.includes(';')) score += 5;
    
    // Éviter le contenu trop personnel
    if (/\b(nous devons|il faut que|vous devez)\b/.test(text)) score -= 10;
    
    return Math.max(0, Math.min(100, score));
  }

  take(candidates, concept = 'general') {
    if (!Array.isArray(candidates) || !candidates.length) return '';
    
    // Trier les candidats par score de qualité
    const scoredCandidates = candidates
      .map(text => ({
        text: String(text || '').trim(),
        score: this._scoreContent(text)
      }))
      .filter(item => item.text && item.score >= this.qualityThreshold)
      .sort((a, b) => b.score - a.score);

    for (const candidate of scoredCandidates) {
      const exact = candidate.text;
      const stem = this._normalize(exact);
      
      if (!stem) continue;
      
      if (!this.stems.has(stem) && !this.used.has(exact.toLowerCase())) {
        this.stems.add(stem);
        this.used.add(exact.toLowerCase());
        
        // Enregistrer le concept
        if (!this.conceptMap.has(concept)) {
          this.conceptMap.set(concept, 0);
        }
        this.conceptMap.set(concept, this.conceptMap.get(concept) + 1);
        
        return exact;
      }
    }
    return '';
  }

  getUsageStats() {
    return {
      totalUsed: this.used.size,
      conceptsUsed: Object.fromEntries(this.conceptMap),
      uniqueStems: this.stems.size
    };
  }
}

/* -------------------- Générateurs de contenu enrichis -------------------- */
const DOCTRINAL_POOLS = {
  grace: [
    "La grâce de Dieu précède et rend possible toute réponse humaine fidèle.",
    "Par grâce seule, Dieu justifie et sanctifie ceux qui croient en Christ.",
    "La grâce divine initie l'alliance et soutient la persévérance des saints.",
    "L'œuvre de grâce révèle la miséricorde de Dieu envers les pécheurs.",
    "La grâce efficace transforme le cœur et produit une foi véritable."
  ],
  foi: [
    "La foi naît de l'écoute de la Parole de Dieu proclamée avec fidélité.",
    "Croire, c'est s'appuyer entièrement sur les promesses divines révélées.",
    "La foi véritable se manifeste par l'obéissance et la persévérance.",
    "Par la foi, nous saisissons les réalités invisibles du royaume de Dieu.",
    "La foi unit le croyant au Christ et à ses bénéfices salvifiques."
  ],
  parole: [
    "La Parole de Dieu est vivante, efficace et ne retourne jamais à vide.",
    "L'Écriture Sainte constitue l'autorité suprême en matière de foi et de pratique.",
    "La Parole éclaire l'intelligence et sanctifie la conscience par l'Esprit.",
    "Christ, Parole incarnée, accomplit et révèle parfaitement la volonté divine.",
    "La prédication fidèle de la Parole édifie l'Église et convainc le monde."
  ],
  christ: [
    "Jésus-Christ, vrai Dieu et vrai homme, est le seul médiateur entre Dieu et les hommes.",
    "En Christ, toutes les promesses de Dieu trouvent leur accomplissement parfait.",
    "L'œuvre rédemptrice du Christ assure le salut complet de son peuple.",
    "Christ règne souverainement sur toutes choses pour le bien de l'Église.",
    "La personne et l'œuvre du Christ révèlent pleinement la gloire de Dieu."
  ]
};

function generateDoctrinalContent(theme, context, seed) {
  const pool = DOCTRINAL_POOLS[theme] || DOCTRINAL_POOLS.parole;
  const baseIdx = Math.abs(hashCode(seed + theme)) % pool.length;
  const content = pool[baseIdx];
  
  // Adaptation contextuelle
  if (context.book && context.chapter) {
    return `${content} Cette vérité transparaît clairement dans ${context.book} ${context.chapter}.`;
  }
  
  return content;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Conversion en 32-bit
  }
  return hash;
}

/* -------------------- Section builders améliorés -------------------- */
function buildEnrichedSection(id, title, book, chapter, context, u) {
  const seed = `${book}_${chapter}_${id}`;
  const builders = {
    1: () => buildPrayerSection(book, chapter, context),
    2: () => buildCanonSection(book, chapter, context),
    9: () => buildKeyVerseSection(book, chapter, context),
    14: () => buildThemeSection(book, chapter, context),
    21: () => buildChurchSection(book, chapter, context),
    26: () => buildPersonalSection(book, chapter, context)
  };
  
  const builder = builders[id] || (() => buildGenericSection(id, title, book, chapter, context));
  const candidates = builder();
  
  const selectedContent = u.take(candidates, `section_${id}`);
  
  return {
    id,
    title,
    description: '',
    content: selectedContent || `### ${title}\n*Référence :* ${book} ${chapter}\nContenu en cours d'élaboration selon les principes doctrinaux réformés.`
  };
}

function buildPrayerSection(book, chapter, context) {
  const { themes, genre, family } = context;
  const themeAccent = themes?.[0]?.k || 'révélation';
  
  return [
    `### Prière d'ouverture\n*Référence :* ${book} ${chapter}\n\nPère des lumières, nous venons à toi dans la dépendance de ton Esprit. Tu te révèles par ta Parole et tu donnes l'intelligence spirituelle. Dans cette étude de ${book} ${chapter}, ouvre nos cœurs à ta vérité révélée. Que ton Esprit nous conduise dans toute la vérité et nous rende obéissants à ta volonté sainte.\n\nNous reconnaissons que sans toi, nous ne pouvons rien comprendre des choses spirituelles. Éclaire-nous par ta grâce et fais que cette Parole porte du fruit dans nos vies.\n\nAu nom de Jésus-Christ, notre Sauveur et Seigneur. Amen.`,
    
    `### Prière d'ouverture\n*Référence :* ${book} ${chapter}\n\nDieu saint et miséricordieux, nous nous approchons de ta Parole avec révérence et foi. Tu as parlé par tes serviteurs les prophètes et définitivement par ton Fils bien-aimé. Accorde-nous la grâce de recevoir avec humilité l'enseignement de ${book} ${chapter}.\n\nPar ton Esprit, rends vivante cette ancienne Parole pour nos cœurs d'aujourd'hui. Que nous ne soyons pas seulement des auditeurs, mais des pratiquants fidèles de ta volonté révélée.\n\nGlorifie ton nom dans cette étude. Amen.`
  ];
}

function buildCanonSection(book, chapter, context) {
  return [
    `### Canon et testament\n*Référence :* ${book} ${chapter}\n\nL'Écriture Sainte, composée de l'Ancien et du Nouveau Testament, constitue la révélation complète et suffisante de Dieu. ${book} ${chapter} s'inscrit dans cette économie unitaire du salut où la révélation progresse sans jamais se contredire.\n\nLa règle d'or de l'interprétation demeure : l'Écriture interprète l'Écriture. Les passages clairs éclairent les plus obscurs, et Christ constitue le centre herméneutique de toute l'Écriture.\n\nNous lisons donc ce passage dans la lumière de l'ensemble canonique, reconnaissant l'autorité divine qui traverse chaque livre inspiré.`,
    
    `### Canon et testament\n*Référence :* ${book} ${chapter}\n\nLa doctrine de l'inspiration plénière garantit que ${book} ${chapter} porte l'autorité divine au même titre que l'ensemble des Écritures. Cette autorité ne dépend ni de l'Église ni de la raison humaine, mais procède de Dieu lui-même.\n\nL'unité organique des deux Testaments se manifeste dans la progression de la révélation : l'Ancien Testament prépare et annonce, le Nouveau accomplit et révèle pleinement. Christ est la clé de lecture de toute l'Écriture.\n\nAinsi, nous abordons ce texte avec confiance, sachant qu'il contient tout ce qui est nécessaire pour la foi et la piété.`
  ];
}

/* -------------------- API principale avec monitoring -------------------- */
async function fetchChapter(book, chap){
  const timer = Date.now();
  performanceMonitor.recordApiCall();
  
  if (!KEY || !BIBLE_ID || !USFM[book]) {
    throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  }
  
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  let content = '';
  let verses = [];
  let verseCount = 0;

  try {
    // Tentative de récupération du contenu
    const contentResponse = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, 
      { headers, timeout: 12000, retries: 1 }
    );
    content = CLEAN(contentResponse?.data?.content || contentResponse?.data?.text || '');

    // Récupération des versets
    const versesResponse = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, 
      { headers, timeout: 10000, retries: 1 }
    );
    const verseItems = Array.isArray(versesResponse?.data) ? versesResponse.data : [];
    verseCount = verseItems.length;

    // Traitement des versets
    if (content) {
      const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
      verses = split1.map(s => { 
        const m=s.match(/^(\d{1,3})\s+(.*)$/); 
        return m ? {v:+m[1], text: CLEAN(m[2])} : null; 
      }).filter(Boolean);

      if (verses.length < Math.max(2, Math.floor(verseCount/3))) {
        const arr = [];
        const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
        let m; 
        while ((m = re.exec(content))) {
          arr.push({ v:+m[1], text: CLEAN(m[2]) });
        }
        if (arr.length) verses = arr;
      }
    }

    // Fallback si les versets manquent
    if (verses.length === 0 && verseItems.length > 0) {
      verses = verseItems.map(v => {
        const ref = String(v?.reference||'');
        const m = ref.match(/(\d+)(?:\D+)?$/);
        const num = m ? Number(m[1]) : null;
        return { v: num, text: CLEAN(v?.text||'') };
      }).filter(x => x.v && x.text);
    }

    const duration = Date.now() - timer;
    console.log(`[API] Chapter ${book} ${chap} fetched in ${duration}ms - ${verses.length} verses`);

    return { 
      ok: !!content || verses.length > 0, 
      content, 
      verses, 
      verseCount: verseCount || verses.length || 0 
    };

  } catch (error) {
    const duration = Date.now() - timer;
    console.error(`[API] Error fetching ${book} ${chap} after ${duration}ms:`, error.message);
    throw error;
  }
}

async function buildImprovedStudy(book, chap, totalBudget, version='LSG') {
  const startTime = Date.now();
  let usedFallback = false;
  let qualityScore = 0;

  try {
    const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
    
    if (!ok || !content) {
      throw new Error('Chapitre introuvable ou vide');
    }

    // Analyse du contenu
    const text = verses?.length ? verses.map(v=>v.text).join(' ') : content;
    const keywords = topKeywords(text, 14);
    const themes = detectThemes(text.toLowerCase());
    const genre = guessGenre(book, text.toLowerCase());
    
    // Contexte enrichi
    const context = {
      book,
      chapter: chap,
      text,
      keywords,
      themes,
      genre,
      verses,
      verseCount,
      family: bookFamily(book),
      keyVerse: scoreKeyVerse(verses)
    };

    // Génération des sections avec manager d'unicité amélioré
    const u = new ImprovedUniqueManager();
    const sections = [];

    // Sections prioritaires avec contenu enrichi
    const sectionBuilders = [
      { id: 1, title: 'Prière d\'ouverture', priority: 'high' },
      { id: 2, title: 'Canon et testament', priority: 'high' },
      { id: 3, title: 'Questions du chapitre précédent', priority: 'medium' },
      { id: 4, title: 'Titre du chapitre', priority: 'medium' },
      { id: 5, title: 'Contexte historique', priority: 'medium' },
      { id: 6, title: 'Structure littéraire', priority: 'medium' },
      { id: 7, title: 'Genre littéraire', priority: 'medium' },
      { id: 8, title: 'Auteur et généalogie', priority: 'low' },
      { id: 9, title: 'Verset-clé doctrinal', priority: 'high' },
      { id: 10, title: 'Analyse exégétique', priority: 'high' },
      { id: 11, title: 'Analyse lexicale', priority: 'medium' },
      { id: 12, title: 'Références croisées', priority: 'high' },
      { id: 13, title: 'Fondements théologiques', priority: 'high' },
      { id: 14, title: 'Thème doctrinal', priority: 'high' },
      { id: 15, title: 'Fruits spirituels', priority: 'medium' },
      { id: 16, title: 'Types bibliques', priority: 'low' },
      { id: 17, title: 'Appui doctrinal', priority: 'medium' },
      { id: 18, title: 'Comparaison interne', priority: 'medium' },
      { id: 19, title: 'Parallèle ecclésial', priority: 'medium' },
      { id: 20, title: 'Verset à mémoriser', priority: 'low' },
      { id: 21, title: 'Enseignement pour l\'Église', priority: 'high' },
      { id: 22, title: 'Enseignement pour la famille', priority: 'medium' },
      { id: 23, title: 'Enseignement pour enfants', priority: 'low' },
      { id: 24, title: 'Application missionnaire', priority: 'medium' },
      { id: 25, title: 'Application pastorale', priority: 'medium' },
      { id: 26, title: 'Application personnelle', priority: 'high' },
      { id: 27, title: 'Versets à retenir', priority: 'low' },
      { id: 28, title: 'Prière de fin', priority: 'medium' }
    ];

    // Budget intelligent basé sur les priorités
    const budgets = allocateSmartBudget(totalBudget, sectionBuilders);

    // Génération des sections
    for (const builder of sectionBuilders) {
      const section = buildEnrichedSection(
        builder.id, 
        builder.title, 
        book, 
        chap, 
        context, 
        u,
        budgets[builder.id - 1]
      );
      sections.push(section);
    }

    // Évaluation de la qualité
    const quality = QualityAssessor.assessOverallQuality(sections);
    qualityScore = quality.overall;

    // Métriques de performance
    const duration = Date.now() - startTime;
    performanceMonitor.recordGeneration(true, duration, usedFallback, qualityScore);

    const result = {
      study: { sections },
      metadata: {
        book,
        chapter: chap,
        version,
        generatedAt: new Date().toISOString(),
        processingTime: duration,
        quality,
        usageStats: u.getUsageStats(),
        fallbackUsed: usedFallback
      },
      performance: performanceMonitor.getStats()
    };

    return result;

  } catch (error) {
    usedFallback = true;
    console.error(`[StudyBuilder] Error for ${book} ${chap}:`, error.message);
    
    // Fallback avec suivi de performance
    const fallbackStudy = buildFallbackStudy(book, chap, totalBudget, version);
    const duration = Date.now() - startTime;
    
    performanceMonitor.recordGeneration(false, duration, usedFallback, 0);

    return {
      study: fallbackStudy,
      metadata: {
        book,
        chapter: chap,
        version,
        generatedAt: new Date().toISOString(),
        processingTime: duration,
        quality: { overall: 40, note: 'Fallback utilisé' },
        fallbackUsed: true,
        error: error.message
      },
      performance: performanceMonitor.getStats()
    };
  }
}

/* -------------------- Fonctions utilitaires supplémentaires -------------------- */
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

function scoreKeyVerse(verses) {
  if (!verses || !verses.length) return null;
  
  const PRIORITY_WORDS = [
    'dieu', 'seigneur', 'christ', 'jésus', 'jesus', 'esprit',
    'foi', 'amour', 'grâce', 'grace', 'parole', 'vie', 'vérité', 'verite',
    'royaume', 'salut', 'péché', 'peche', 'alliance', 'promesse'
  ];
  
  let best = { v: null, text: '', score: -1 };
  
  for (const verse of verses) {
    if (!verse?.v || !verse?.text) continue;
    
    const text = verse.text.toLowerCase();
    let score = 0;
    
    // Mots-clés doctrinaux
    for (const word of PRIORITY_WORDS) {
      if (text.includes(word)) score += 3;
    }
    
    // Longueur optimale pour mémorisation
    const len = verse.text.length;
    if (len >= 50 && len <= 200) score += 5;
    else if (len >= 30 && len <= 250) score += 2;
    else if (len < 20 || len > 300) score -= 2;
    
    // Structure grammaticale
    if (text.includes(':') || text.includes(';')) score += 1;
    if (/\b(car|parce que|ainsi|donc|c'est pourquoi)\b/.test(text)) score += 2;
    
    // Éviter les versets trop techniques ou généalogiques
    if (/\b(fils de|fille de|enfanta|engendra)\b/.test(text)) score -= 3;
    if (/\b(\d+\s+(ans|année|mois|jour))\b/.test(text)) score -= 2;
    
    if (score > best.score) {
      best = { v: verse.v, text: verse.text, score };
    }
  }
  
  return best.v ? best : null;
}

function allocateSmartBudget(totalBudget, sectionBuilders) {
  const priorities = { high: 3, medium: 2, low: 1 };
  const totalWeight = sectionBuilders.reduce((sum, s) => sum + priorities[s.priority], 0);
  const baseUnit = Math.floor(totalBudget / totalWeight);
  
  return sectionBuilders.map(s => Math.max(60, baseUnit * priorities[s.priority]));
}

function buildGenericSection(id, title, book, chapter, context) {
  const theme = context.themes?.[0]?.k || 'révélation';
  const keywordsList = context.keywords.slice(0, 4).join(', ');
  
  return [
    `### ${title}\n*Référence :* ${book} ${chapter}\n\nCette section développe les implications du texte selon les principes de l'herméneutique réformée. Le thème principal (${theme}) guide l'interprétation dans la fidélité à l'intention divine.\n\nMots-clés à observer : ${keywordsList}.\n\nL'application demeure subordonnée à l'exégèse et s'ancre dans la doctrine reçue par l'Église.`,
    
    `### ${title}\n*Référence :* ${book} ${chapter}\n\nL'enseignement de ce passage s'inscrit dans l'économie générale du salut révélée dans les Écritures. La méthode grammatico-historique éclaire le sens littéral, tandis que l'analogie de la foi préserve la cohérence doctrinale.\n\nPrincipes d'interprétation : clarté de l'Écriture, suffisance de la révélation, autorité divine.\n\nL'Esprit Saint rend efficace cette Parole pour l'édification des croyants.`
  ];
}

function buildFallbackStudy(book, chap, totalBudget, version) {
  const u = new ImprovedUniqueManager();
  const sections = [];
  
  const context = {
    book,
    chapter: chap,
    family: bookFamily(book),
    keywords: ['dieu', 'parole', 'foi', 'grâce'],
    themes: [{ k: 'révélation' }],
    genre: 'narratif/doctrinal'
  };

  for (let i = 1; i <= 28; i++) {
    const titles = [
      'Prière d\'ouverture', 'Canon et testament', 'Questions du chapitre précédent',
      'Titre du chapitre', 'Contexte historique', 'Structure littéraire',
      'Genre littéraire', 'Auteur et généalogie', 'Verset-clé doctrinal',
      'Analyse exégétique', 'Analyse lexicale', 'Références croisées',
      'Fondements théologiques', 'Thème doctrinal', 'Fruits spirituels',
      'Types bibliques', 'Appui doctrinal', 'Comparaison interne',
      'Parallèle ecclésial', 'Verset à mémoriser', 'Enseignement pour l\'Église',
      'Enseignement pour la famille', 'Enseignement pour enfants',
      'Application missionnaire', 'Application pastorale', 'Application personnelle',
      'Versets à retenir', 'Prière de fin'
    ];
    
    const content = u.take([
      `### ${titles[i-1]}\n*Référence :* ${book} ${chap}\n\nContenu de base généré selon les principes doctrinaux réformés. Cette section nécessite un développement ultérieur avec les données bibliques spécifiques.\n\nL'autorité de l'Écriture demeure le fondement de toute interprétation fidèle.`
    ], `fallback_${i}`);
    
    sections.push({
      id: i,
      title: titles[i-1],
      description: '',
      content: content || `### ${titles[i-1]}\nContenu en préparation.`
    });
  }
  
  return { sections };
}

/* -------------------- YouVersion Links -------------------- */
function linkRef(book, chap, vv, version='LSG'){
  const YV_BOOK = USFM;
  const code = YV_BOOK[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}

/* -------------------- Parse et normalisation -------------------- */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

function normalizeTotal(length){
  const L = Number(length);
  if (L >= 1500 && L <= 3000) return L;
  if (L === 3000) return 3000;
  if (L === 1500 || L === 500) return 1500;
  return 2200; // Budget par défaut augmenté
}

async function buildStudy(passage, length, version='LSG'){
  const total = normalizeTotal(length);
  const { book, chap } = parsePassage(passage||'Genèse 1');
  
  if (KEY && BIBLE_ID && USFM[book]) {
    try {
      return await buildImprovedStudy(book, chap, total, version);
    } catch (e) {
      console.error('[generate-study] buildImprovedStudy error:', e);
      const fallback = buildFallbackStudy(book, chap, total, version);
      return { 
        study: fallback, 
        metadata: { emergency: true, error: 'dynamic_failed' },
        performance: performanceMonitor.getStats()
      };
    }
  } else {
    const fallback = buildFallbackStudy(book, chap, total, version);
    return { 
      study: fallback, 
      metadata: { emergency: true, error: 'missing_env_or_mapping' },
      performance: performanceMonitor.getStats()
    };
  }
}

/* -------------------- Handler principal -------------------- */
async function core(ctx){
  const method = ctx.req?.method || 'GET';
  
  if (method === 'GET') {
    return send200(ctx, {
      ok: true, 
      route: '/api/generate-study', 
      method: 'GET',
      hint: 'POST { "passage":"Genèse 1", "options":{ "length":1500|2200|3000, "translation":"LSG|JND|..." } } → 28 rubriques doctrinales avec KPI.',
      requires: { 
        API_BIBLE_KEY: !!KEY, 
        API_BIBLE_ID: !!BIBLE_ID 
      },
      performance: performanceMonitor.getStats()
    });
  }
  
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const length = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    
    try { 
      return send200(ctx, await buildStudy(passage, length, version)); 
    } catch (e) {
      console.error('[generate-study] buildStudy error:', e);
      performanceMonitor.recordGeneration(false, 0, true, 0);
      return send200(ctx, { 
        study: { sections: [] }, 
        metadata: { emergency: true, error: String(e) },
        performance: performanceMonitor.getStats()
      });
    }
  }
  
  return send200(ctx, { 
    ok: true, 
    route: '/api/generate-study', 
    hint: 'GET pour smoke-test, POST pour générer.',
    performance: performanceMonitor.getStats()
  });
}

export default async function handler(req, res){
  try {
    if (res && typeof res.status === 'function') return core({ req, res });
    return core({ req });
  } catch (e) {
    performanceMonitor.recordGeneration(false, 0, true, 0);
    const payload = { 
      study: { sections: [] }, 
      metadata: { emergency: true, fatal: true, error: String(e && e.message || e) },
      performance: performanceMonitor.getStats()
    };
    
    if (res && typeof res.status === 'function') {
      res.status(200);
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.setHeader('Cache-Control','no-store');
      return res.end(JSON.stringify(payload));
    }
    
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 
        'Content-Type':'application/json; charset=utf-8', 
        'Cache-Control':'no-store' 
      }
    });
  }
}

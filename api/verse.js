// /api/verses.js
// GET /api/verses?book=Luc&chapter=1
// Réponse: { ok:true, book, chapter, version:'DARBY/LSG', verses:[{ v:1, text:'...' }, ...] }

const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO",
  "Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH",
  "1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE",
  "1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

const YV_BOOK = { ...USFM }; // pour les liens de secours YouVersion (LSG)

function cleanText(s=''){
  return String(s)
    .replace(/<[^>]+>/g,' ')        // retire HTML
    .replace(/\s+/g,' ')            // espaces
    .replace(/\s([;:,.!?…])/g,'$1') // espace avant ponctuation
    .trim();
}

// exécute des promesses par lots (limite de concurrence)
async function mapBatched(items, batchSize, worker){
  const out = [];
  for (let i=0; i<items.length; i+=batchSize){
    const slice = items.slice(i, i+batchSize);
    const part = await Promise.all(slice.map(worker));
    out.push(...part);
  }
  return out;
}

export default async function handler(req, res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');

  if (req.method !== 'GET'){
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }

  try{
    const book = String(req.query.book || '');
    const chapter = parseInt(req.query.chapter, 10);

    if (!book || !Number.isFinite(chapter)){
      return res.status(400).json({ ok:false, error:'Missing book or chapter' });
    }

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.API_BIBLE_ID || ''; // ← mets l’ID DARBY ici (dans Vercel)

    // Fallback si pas de clé/ID: on renvoie au moins la base YouVersion pour les liens
    if (!apiKey || !bibleId){
      const code = YV_BOOK[book] || 'GEN';
      return res.status(200).json({
        ok:true, source:'fallback', book, chapter, version:'LSG',
        youversionBase: `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`,
        verses: [] // le front mettra un placeholder et le lien YV
      });
    }

    // ========= api.scripture.api.bible =========
    const base = 'https://api.scripture.api.bible/v1';
    const headers = { 'api-key': apiKey };

    const bookId = USFM[book];
    if (!bookId) {
      return res.status(400).json({ ok:false, error:'Unknown book' });
    }
    const chapterId = `${bookId}.${chapter}`;

    // 1) Récupère la liste des versets pour le chapitre
    const rList = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}/verses`, { headers });
    const jList = await rList.json();
    const items = (jList && jList.data) || [];

    if (!Array.isArray(items) || !items.length){
      // Certains jeux de données nécessitent content-type=text directement sur le chapitre
      const rAlt = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}?contentType=text`, { headers });
      const jAlt = await rAlt.json();
      const raw = cleanText(jAlt?.data?.content || '');
      // tentative simple: split par « n. » (peut varier selon versions)
      const chunks = raw.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
      const versesAlt = chunks.map(ch=>{
        const m = ch.match(/^(\d{1,3})\s+(.*)$/);
        return m ? { v:parseInt(m[1],10), text:m[2] } : null;
      }).filter(Boolean);
      return res.status(200).json({ ok:true, source:'api.bible.chapter', book, chapter, version:'DARBY', verses: versesAlt });
    }

    // 2) Pour chaque verset, on récupère le texte "contentType=text"
    const verses = await mapBatched(items, 12, async (it) => {
      // it.id ressemble à "LUK.3.2"
      const r = await fetch(`${base}/bibles/${bibleId}/verses/${it.id}?contentType=text`, { headers });
      const j = await r.json();
      const text = cleanText(j?.data?.content || j?.data?.reference || '');
      // supprime le numéro au début s'il est recollé
      const m = text.match(/^\s*(\d{1,3})\s*(.*)$/);
      if (m) return { v: parseInt(m[1],10), text: m[2] || '' };
      // sinon, essaye d’extraire depuis it.reference "Luc 3:2"
      const m2 = (it.reference || '').match(/:(\d{1,3})$/);
      const v = m2 ? parseInt(m2[1],10) : undefined;
      return { v, text };
    });

    // Trie par numéro de verset et nettoie
    const clean = verses
      .filter(v => Number.isFinite(v.v))
      .sort((a,b)=>a.v-b.v)
      .map(v => ({ v: v.v, text: v.text.trim() }));

    return res.status(200).json({ ok:true, source:'api.bible.verses', book, chapter, version:'DARBY', verses: clean });
  } catch (e){
    return res.status(200).json({ ok:false, emergency:true, error:String(e?.message||e) });
  }
}

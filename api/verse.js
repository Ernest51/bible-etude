// api/verses.js
// GET /api/verses?book=Luc&chapter=1
// Réponse: { ok:true, book, chapter, version: 'LSG', verses:[{v:1, text:'...'}, ...] }

const YV_BOOK = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL",
  "1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

export default async function handler(req, res) {
  try {
    res.setHeader('Content-Type','application/json; charset=utf-8');
    res.setHeader('Cache-Control','no-store');

    if (req.method !== 'GET') {
      return res.status(405).json({ ok:false, error:'Method Not Allowed' });
    }

    const book = (req.query.book || '').toString();
    const chapter = parseInt(req.query.chapter, 10);
    if (!book || !Number.isFinite(chapter)) {
      return res.status(400).json({ ok:false, error:'Missing book or chapter' });
    }

    const apiKey = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.API_BIBLE_ID || ''; // ex: LSG id si tu en as un sur api.scripture.api.bible

    // Si pas de clé → fallback: on renvoie des versets vides + URL YouVersion (au moins cliquable)
    if (!apiKey || !bibleId) {
      const code = YV_BOOK[book] || 'GEN';
      // Nombre de versets inconnu ici → on enverra 1..N côté front, mais on mettra text: null
      return res.status(200).json({
        ok:true, source:'fallback', book, chapter, version:'LSG',
        youversionBase: `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`,
        verses: [] // le front affichera le lien et "— ouvrir sur YouVersion" si vide
      });
    }

    // Avec clé API.Bible — on tente de récupérer le chapitre complet en texte
    // Doc: https://scripture.api.bible/
    // Endpoint (contentType=text): /v1/bibles/{bibleId}/chapters/{chapterId}?contentType=text
    // Il faut un chapterId, pas "BOOK.CH".
    // Simplification: on essaye via passages using osis "Book.Ch" → passages search:
    const base = 'https://api.scripture.api.bible/v1';
    const chapQuery = encodeURIComponent(`${book} ${chapter}`);
    const headers = { 'api-key': apiKey };

    // 1) Resolve passage to passageId(s)
    const rs1 = await fetch(`${base}/bibles/${bibleId}/search?query=${chapQuery}&limit=1`, { headers });
    const j1 = await rs1.json();
    const passageId = j1?.data?.passages?.[0]?.id;
    if (!passageId) {
      return res.status(200).json({ ok:true, source:'api.bible', book, chapter, version:'LSG', verses: [] });
    }

    // 2) Fetch passage content plain text
    const rs2 = await fetch(`${base}/bibles/${bibleId}/passages/${passageId}?content-type=text`, { headers });
    const j2 = await rs2.json();
    const content = j2?.data?.content || '';

    // Parse très simple: sépare chaque verset par numéros (ex: ^1 , ^2 , etc.). Les formats varient selon version.
    // On tente plusieurs motifs (1) <sup>1</sup>   (2) 1  (espace insécable)   (3) [1]
    const lines = content.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const verses = [];
    let currentV = null, buf = [];

    const flush = () => {
      if (currentV !== null) {
        verses.push({ v: currentV, text: buf.join(' ').replace(/\s+/g,' ').trim() });
      }
      currentV = null; buf = [];
    };

    for (const ln of lines) {
      const m = ln.match(/^(\d{1,3})\s+(.*)$/); // "1  Au commencement..."
      if (m) {
        flush();
        currentV = parseInt(m[1],10);
        buf.push(m[2] || '');
      } else {
        buf.push(ln);
      }
    }
    flush();

    return res.status(200).json({ ok:true, source:'api.bible', book, chapter, version:'LSG', verses });
  } catch (err) {
    return res.status(200).json({ ok:false, emergency:true, error: String(err && err.message || err) });
  }
}

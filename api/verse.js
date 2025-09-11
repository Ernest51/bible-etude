// /api/verses.js
// GET /api/verses?book=Luc&chapter=1
// -> { ok:true, source:'api.bible.verses|chapter|fallback', book, chapter, version:'DARBY|LSG', verses:[{v:1,text:'…'},…] }

const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH",
  "Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC",
  "Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB",
  "Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN",
  "Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI",
  "2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE",
  "1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV = { ...USFM }; // pour fallback lien LSG

const CLEAN = s => String(s||'')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s([;:,.!?…])/g, '$1')
  .trim();

async function batched(list, size, worker){
  const out = [];
  for (let i=0;i<list.length;i+=size){
    const chunk = list.slice(i,i+size);
    const part = await Promise.all(chunk.map(worker));
    out.push(...part);
  }
  return out;
}

export default async function handler(req, res){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');

  if (req.method !== 'GET') return res.status(405).json({ ok:false, error:'Method Not Allowed' });

  try{
    const book = String(req.query.book||'');
    const chapter = parseInt(req.query.chapter,10);
    if (!book || !Number.isFinite(chapter)) return res.status(400).json({ ok:false, error:'Missing book/chapter' });

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.API_BIBLE_ID || ''; // ← ID Darby
    const code = USFM[book];

    // Fallback "lien only"
    if (!apiKey || !bibleId || !code){
      const yv = YV[book] || 'GEN';
      return res.status(200).json({
        ok:true, source:'fallback', book, chapter, version:'LSG',
        youversionBase:`https://www.bible.com/fr/bible/93/${yv}.${chapter}.LSG`,
        verses:[]
      });
    }

    const base = 'https://api.scripture.api.bible/v1';
    const headers = { 'api-key': apiKey };
    const chapterId = `${code}.${chapter}`;

    // A) Liste des versets du chapitre
    const rList = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}/verses`, { headers });
    const jList = await rList.json();
    const items = Array.isArray(jList?.data) ? jList.data : [];

    // B) Si on a la liste de verseIds, on récupère chacun en text
    if (items.length){
      const verses = await batched(items, 12, async (it) => {
        const r = await fetch(`${base}/bibles/${bibleId}/verses/${it.id}?contentType=text`, { headers });
        const j = await r.json();
        const raw = CLEAN(j?.data?.content || j?.data?.reference || '');
        // essaie d'ôter le numéro en tête
        const m = raw.match(/^\s*(\d{1,3})\s*(.*)$/);
        if (m) return { v: parseInt(m[1],10), text: (m[2]||'').trim() };
        const m2 = (it.reference||'').match(/:(\d{1,3})$/);
        return { v: m2?parseInt(m2[1],10):undefined, text: raw };
      });
      const clean = verses.filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.v-b.v).map(x=>({v:x.v, text:x.text}));
      return res.status(200).json({ ok:true, source:'api.bible.verses', book, chapter, version:'DARBY', verses: clean });
    }

    // C) Plan B: prendre le chapitre complet en text et parser
    const rChap = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}?contentType=text`, { headers });
    const jChap = await rChap.json();
    const content = CLEAN(jChap?.data?.content || '');
    if (!content) return res.status(200).json({ ok:true, source:'api.bible.empty', book, chapter, version:'DARBY', verses:[] });

    // Parse multi-patterns
    // 1) "1 " au début de phrase
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    let verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:m[2]}:null; }).filter(Boolean);
    // 2) Si trop court, tenter "[1]" ou "1." etc.
    if (verses.length < 2){
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
      if (arr.length) verses = arr;
    }

    return res.status(200).json({ ok:true, source:'api.bible.chapter', book, chapter, version:'DARBY', verses });
  } catch (e){
    return res.status(200).json({ ok:false, emergency:true, error:String(e?.message||e) });
  }
}

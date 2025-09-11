// /api/verses.js
// GET /api/verses?book=Luc&chapter=1[&count=31]
// -> { ok:true, source:'api.bible.verses|chapter|fallback|fallback-generated', book, chapter, version:'DARBY|LSG',
//      verses:[{v:1,text:'…', noteHTML:'…'}, …] }

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

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Générateur d'explication (style cohérent avec tes rubriques)
function makeNoteHTML(text, ref){
  const t = String(text || '').toLowerCase();
  const motifs = [];
  if (/\blumi[eè]re?\b/.test(t)) motifs.push(`théologie de la <strong>lumière</strong> (création, révélation, 2 Co 4:6)`);
  if (/\besprit\b/.test(t)) motifs.push(`œuvre de l’<strong>Esprit</strong> (création, inspiration, nouvelle création)`);
  if (/\bparole\b/.test(t)) motifs.push(`primat de la <strong>Parole</strong> efficace de Dieu (Hé 11:3; Jn 1)`);
  if (/\bhomme\b|\bhumain\b|adam/.test(t)) motifs.push(`<strong>anthropologie</strong> (image de Dieu, vocation)`);
  if (/\bterre\b|\bciel\b/.test(t)) motifs.push(`<strong>cosmologie</strong> ordonnée par Dieu`);
  if (/\bp[ée]ch[ée]\b/.test(t)) motifs.push(`réalité du <strong>péché</strong> et besoin de rédemption`);
  const axes = motifs.length ? motifs.join('; ') : `création, providence et finalité en Dieu`;

  const parts = [
    `<strong>Analyse littéraire</strong> — repérer termes clés, parallélismes et rythmes. Le verset ${ref} s’insère dans l’argument et porte l’accent théologique.`,
    `<strong>Axes théologiques</strong> — ${axes}.`,
    `<strong>Échos canoniques</strong> — lire “Écriture par l’Écriture” (Torah, Sagesse, Prophètes; puis Évangiles et Épîtres).`,
    `<strong>Christologie</strong> — comment ${ref} est récapitulé en <strong>Christ</strong> (Col 1:16-17; Lc 24:27) ?`,
    `<strong>Ecclésial & pastoral</strong> — implications pour l’<strong>Église</strong> (adoration, mission, éthique).`,
    `<strong>Application personnelle</strong> — prier le texte et formuler une décision concrète aujourd’hui.`
  ];
  return parts.map(p=>`<p>${p}</p>`).join('');
}

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
  // Cache doux : 60s (en cas d’erreur → no-store)
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=60, s-maxage=60');

  if (req.method !== 'GET') {
    res.setHeader('Cache-Control','no-store');
    return res.status(405).json({ ok:false, error:'Method Not Allowed' });
  }

  try{
    const book = String(req.query.book||'');
    const chapter = parseInt(req.query.chapter,10);
    const fallbackCount = clamp(parseInt(req.query.count,10) || 31, 1, 200);

    if (!book || !Number.isFinite(chapter)) {
      res.setHeader('Cache-Control','no-store');
      return res.status(400).json({ ok:false, error:'Missing book/chapter' });
    }

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.API_BIBLE_ID || ''; // DARBY
    const code = USFM[book];

    // Fallback "lien + génération placeholder" si pas d'API/config
    if (!apiKey || !bibleId || !code){
      const yv = YV[book] || 'GEN';
      const verses = Array.from({ length: fallbackCount }, (_, i) => {
        const v = i + 1;
        return { v, text: '', noteHTML: makeNoteHTML('', `${book} ${chapter}:${v}`) };
      });
      return res.status(200).json({
        ok:true,
        source:'fallback-generated',
        book, chapter,
        version:'LSG',
        youversionBase:`https://www.bible.com/fr/bible/93/${yv}.${chapter}.LSG`,
        verses
      });
    }

    const base = 'https://api.scripture.api.bible/v1';
    const headers = { 'api-key': apiKey };
    const chapterId = `${code}.${chapter}`;

    // A) Liste des versets du chapitre
    const rList = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}/verses`, { headers });
    const jList = await rList.json();
    const items = Array.isArray(jList?.data) ? jList.data : [];

    // B) Versets individuels + noteHTML générée
    if (items.length){
      const verses = await batched(items, 12, async (it) => {
        const r = await fetch(`${base}/bibles/${bibleId}/verses/${it.id}?contentType=text`, { headers });
        const j = await r.json();
        const raw = CLEAN(j?.data?.content || j?.data?.reference || '');
        // Essaie d'ôter le numéro en tête
        let vnum, txt;
        const m = raw.match(/^\s*(\d{1,3})\s*(.*)$/);
        if (m) { vnum = parseInt(m[1],10); txt = (m[2]||'').trim(); }
        else {
          const m2 = (it.reference||'').match(/:(\d{1,3})$/);
          vnum = m2?parseInt(m2[1],10):undefined;
          txt = raw;
        }
        const ref = `${book} ${chapter}:${vnum ?? '?'}`;
        return { v:vnum, text:txt, noteHTML: makeNoteHTML(txt, ref) };
      });

      const clean = verses
        .filter(x=>Number.isFinite(x.v))
        .sort((a,b)=>a.v-b.v)
        .map(x=>({ v:x.v, text:x.text, noteHTML:x.noteHTML }));

      return res.status(200).json({ ok:true, source:'api.bible.verses', book, chapter, version:'DARBY', verses: clean });
    }

    // C) Plan B: chapitre complet → parse → noteHTML
    const rChap = await fetch(`${base}/bibles/${bibleId}/chapters/${chapterId}?contentType=text`, { headers });
    const jChap = await rChap.json();
    const content = CLEAN(jChap?.data?.content || '');
    if (!content) {
      return res.status(200).json({ ok:true, source:'api.bible.empty', book, chapter, version:'DARBY', verses:[] });
    }

    // Parse
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    let verses = split1.map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:m[2]}:null; }).filter(Boolean);
    if (verses.length < 2){
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
      if (arr.length) verses = arr;
    }

    const enriched = verses.map(({v,text}) => ({
      v, text, noteHTML: makeNoteHTML(text, `${book} ${chapter}:${v}`)
    }));
    return res.status(200).json({ ok:true, source:'api.bible.chapter', book, chapter, version:'DARBY', verses: enriched });
  } catch (e){
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ ok:false, emergency:true, error:String(e?.message||e) });
  }
}

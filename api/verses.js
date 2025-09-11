// /api/verses.js — robuste JSON-only + fallback généré avec noteHTML
// GET /api/verses?book=Genèse&chapter=1&count=31
// -> { ok:true, source:'api.bible.verses|api.bible.chapter|fallback-generated|fallback',
//      book, chapter, version:'DARBY|LSG', verses:[{v:1,text:'…',noteHTML:'…'},…] }

export const config = { runtime: "nodejs" };

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

const CLEAN = (s) => String(s||'')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s([;:,.!?…])/g, '$1')
  .trim();

const KEY  = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

// ---------- little helpers ----------
function json(res, status, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).end(JSON.stringify(payload));
}

function mkNoteHTML(text, ref){
  const t = String(text||'').toLowerCase();
  const motifs = [];
  if (/\blumi[eè]re?\b/.test(t)) motifs.push(`théologie de la <strong>lumière</strong> (création, révélation, 2 Co 4:6)`);
  if (/\besprit\b/.test(t)) motifs.push(`œuvre de l’<strong>Esprit</strong> (création, inspiration, nouvelle création)`);
  if (/\bparole\b/.test(t)) motifs.push(`primat de la <strong>Parole</strong> efficace de Dieu (Hé 11:3; Jn 1)`);
  if (/\bhomme\b|\bhumain\b|adam/.test(t)) motifs.push(`<strong>anthropologie</strong> biblique (image de Dieu, vocation)`);
  if (/\bterre\b|\bciel\b/.test(t)) motifs.push(`<strong>cosmologie</strong> ordonnée par Dieu`);
  if (/\bp[ée]ch[ée]\b/.test(t)) motifs.push(`réalité du <strong>péché</strong> et besoin de rédemption`);
  const axes = motifs.length ? motifs.join('; ') : `théologie de la création, providence et finalité en Dieu`;

  return [
    `<strong>Analyse littéraire</strong> — repérer termes clés, parallélismes et rythmes. Le verset ${ref} s’insère dans l’argument et porte l’accent théologique.`,
    `<strong>Axes théologiques</strong> — ${axes}.`,
    `<strong>Échos canoniques</strong> — lire “Écriture par l’Écriture” (Torah, Sagesse, Prophètes; puis Évangiles et Épîtres).`,
    `<strong>Christologie</strong> — comment ${ref} est récapitulé en <strong>Christ</strong> (Col 1:16-17; Lc 24:27) ?`,
    `<strong>Ecclésial & pastoral</strong> — implications pour l’<strong>Église</strong> (adoration, mission, éthique).`,
    `<strong>Application personnelle</strong> — prier le texte et formuler une décision concrète aujourd’hui.`
  ].join('<br/>');
}

function fallbackGenerated(book, chapter, count){
  const code = USFM[book] || 'GEN';
  const youversionBase = `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`;
  const verses = Array.from({length: count}, (_,i) => {
    const v = i+1;
    const ref = `${book} ${chapter}:${v}`;
    return {
      v,
      text: '',
      noteHTML: mkNoteHTML('', ref)
    };
  });
  return {
    ok: true,
    source: 'fallback-generated',
    book, chapter, version: 'LSG',
    youversionBase,
    verses
  };
}

// Fetch helper with timeout
async function fetchJson(url, headers, timeout = 10000){
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeout);
  try{
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const text = await r.text();
    let json;
    try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
    return { ok: r.ok, status: r.status, json };
  } finally {
    clearTimeout(to);
  }
}

// ---------- main handler ----------
export default async function handler(req, res){
  try{
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Access-Control-Allow-Methods','GET,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers','content-type,accept');
      res.status(204).end();
      return;
    }
    if (req.method !== 'GET') {
      return json(res, 405, { ok:false, error: 'Method Not Allowed' });
    }

    const book = String(req.query.book || 'Genèse');
    const chapter = Math.max(1, parseInt(req.query.chapter,10) || 1);
    const count = Math.max(1, Math.min(parseInt(req.query.count,10) || 200, 200));

    // No ENV or unknown book -> fallback-generated (toujours JSON, jamais 500)
    if (!KEY || !BIBLE_ID || !USFM[book]) {
      const pay = fallbackGenerated(book, chapter, count);
      return json(res, 200, pay);
    }

    const base = 'https://api.scripture.api.bible/v1';
    const headers = { 'api-key': KEY, 'accept': 'application/json' };
    const chapterId = `${USFM[book]}.${chapter}`;

    // A) liste des versets
    const rList = await fetchJson(`${base}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, headers);
    if (!rList.ok) {
      // B) Plan B: prendre le chapitre complet et parser
      const rChap = await fetchJson(`${base}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text`, headers);
      if (!rChap.ok) {
        const pay = fallbackGenerated(book, chapter, count);
        pay.source = 'fallback-generated';
        return json(res, 200, pay);
      }
      const content = CLEAN(rChap.json?.data?.content || '');
      if (!content) {
        const pay = fallbackGenerated(book, chapter, count);
        pay.source = 'fallback';
        return json(res, 200, pay);
      }
      // parse "1 ... 2 ..." etc.
      let verses = content.split(/\s(?=\d{1,3}\s)/g)
        .map(s=>s.trim())
        .map(s=>{ const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:CLEAN(m[2])}:null; })
        .filter(Boolean);
      if (verses.length < 2){
        const arr = [];
        const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
        let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
        if (arr.length) verses = arr;
      }
      const withNotes = verses.slice(0, count).map(({v, text}) => ({
        v, text, noteHTML: mkNoteHTML(text, `${book} ${chapter}:${v}`)
      }));
      return json(res, 200, { ok:true, source:'api.bible.chapter', book, chapter, version:'DARBY', verses: withNotes });
    }

    // C) On a la liste → on récupère chaque verset (batched)
    const items = Array.isArray(rList.json?.data) ? rList.json.data : [];
    const ids = items.map(it => ({ id: it.id, ref: it.reference || '' })).slice(0, count);

    // petite batch pour limiter les connexions
    const batchSize = 10;
    const verses = [];
    for (let i=0;i<ids.length;i+=batchSize){
      const chunk = ids.slice(i, i+batchSize);
      const got = await Promise.all(chunk.map(async (it) => {
        const rV = await fetchJson(`${base}/bibles/${BIBLE_ID}/verses/${it.id}?contentType=text`, headers);
        const raw = CLEAN(rV.json?.data?.content || rV.json?.data?.text || rV.json?.data?.reference || '');
        let v = undefined;
        const m = raw.match(/^\s*(\d{1,3})\s*(.*)$/);
        let text = '';
        if (m) { v = parseInt(m[1],10); text = (m[2]||'').trim(); }
        else {
          const m2 = (it.ref||'').match(/:(\d{1,3})$/);
          v = m2 ? parseInt(m2[1],10) : undefined;
          text = raw;
        }
        if (!Number.isFinite(v)) return null;
        return { v, text };
      }));
      verses.push(...got.filter(Boolean));
    }

    const clean = verses
      .sort((a,b)=>a.v-b.v)
      .map(({v,text}) => ({ v, text, noteHTML: mkNoteHTML(text, `${book} ${chapter}:${v}`) }));

    return json(res, 200, { ok:true, source:'api.bible.verses', book, chapter, version:'DARBY', verses: clean });

  } catch (e){
    // Ne JAMAIS renvoyer 500 HTML: toujours JSON + fallback minimal
    const msg = String(e?.message || e);
    const pay = { ok:false, emergency:true, error: msg };
    try {
      return json(res, 200, pay);
    } catch {
      // dernier filet
      res.setHeader('Content-Type','application/json; charset=utf-8');
      res.status(200).end(JSON.stringify(pay));
    }
  }
}

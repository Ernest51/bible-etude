// api/bibleProvider.js
// Petite lib serveur pour interroger api.bible (https://scripture.api.bible/)
// Utilise : process.env.API_BIBLE_KEY et process.env.API_BIBLE_BIBLE_ID
//
// Fournit :
// - getChapterOverview(bookName, chapterNumber): { ok, book, chapter, verses: [{n, ref, text}], note? }
//
// Robustesse : si l'API est KO, renvoie ok:false + message.

const BASE = 'https://api.scripture.api.bible/v1';
const KEY  = process.env.API_BIBLE_KEY;
const BIBLE_ID = process.env.API_BIBLE_BIBLE_ID || process.env.API_BIBLE_ID || process.env.DARBY_BIBLE_ID; // tolérant

if (!KEY) {
  console.warn('[bibleProvider] Missing API_BIBLE_KEY');
}
if (!BIBLE_ID) {
  console.warn('[bibleProvider] Missing API_BIBLE_BIBLE_ID');
}

// Cache mémoire simple (Vercel: froid/chaud selon env)
const mem = {
  books: null,                // [{id, name, abbreviation, nameLong}]
  chaptersByBook: new Map(),  // bookId -> [{id, number, reference}]
};

const sleep = (ms)=> new Promise(r=>setTimeout(r,ms));

function norm(s){
  return String(s||'')
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/\s+/g,' ')
    .trim().toLowerCase();
}

// essaie plusieurs correspondances (nom long, nom, abréviation)
function matchBook(inputName, list){
  const target = norm(inputName);
  let best = null;
  for (const b of list){
    const candidates = [b.name, b.nameLong, b.abbreviation].filter(Boolean).map(norm);
    if (candidates.some(c => c===target || c.startsWith(target) || target.startsWith(c))){
      best = b; break;
    }
  }
  return best;
}

async function api(path, params){
  const url = new URL(BASE + path);
  if (params) for (const [k,v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), {
    headers: { 'api-key': KEY }
  });
  if (!r.ok) {
    const t = await r.text().catch(()=> '');
    throw new Error(`[api.bible] ${r.status} ${r.statusText}: ${t}`.slice(0,600));
  }
  return r.json();
}

async function ensureBooks(){
  if (mem.books) return mem.books;
  const j = await api(`/bibles/${BIBLE_ID}/books`);
  mem.books = Array.isArray(j.data) ? j.data : [];
  return mem.books;
}

async function ensureChapters(bookId){
  if (mem.chaptersByBook.has(bookId)) return mem.chaptersByBook.get(bookId);
  const j = await api(`/bibles/${BIBLE_ID}/books/${bookId}/chapters`);
  const arr = Array.isArray(j.data) ? j.data.map(x => {
    // x.id, x.number, x.reference
    const number = Number(String(x.number).replace(/\D+/g,'')) || null;
    return { id:x.id, number, reference:x.reference };
  }) : [];
  mem.chaptersByBook.set(bookId, arr);
  return arr;
}

// Récupère tous les IDs de versets d'un chapitre
async function listVerseIds(chapterId){
  const j = await api(`/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`);
  const arr = Array.isArray(j.data) ? j.data : [];
  // data: [{id, reference}]
  return arr.map(v => ({ id:v.id, ref:v.reference || '' }));
}

// Récupère le texte simple d'un verset (sans HTML)
async function fetchVerseText(verseId){
  // content-type=text -> renvoie text, mais selon la bible, parfois "content" (HTML).
  // On essaie d'abord content-type=text, on retombe sur "content" sinon.
  const j = await api(`/bibles/${BIBLE_ID}/verses/${verseId}`, {
    'content-type':'text',
    'include-notes':'false',
    'include-titles':'false',
    'include-verse-numbers':'false',
  });
  const d = j.data || {};
  // Priorité: d.text ; fallback: nettoyer d.content
  if (d.text && typeof d.text === 'string') return d.text.trim();
  if (d.content && typeof d.content === 'string'){
    return d.content.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  }
  return '';
}

// Explanatoire très léger basé sur le texte du verset (règles neutres)
function explainVerse(n, text){
  if (!text) {
    return `Sens (v.${n}) : note indisponible.`;
  }
  const lower = text.toLowerCase();
  let angle = 'Dieu enseigne et oriente la vie du lecteur par la vérité révélée.';
  if (/\b(dieu|seigneur)\b/.test(lower)) angle = 'Dieu se révèle et prend l’initiative: sa parole commande, promet et rassure.';
  if (/\b(foi|croire|croyez)\b/.test(lower)) angle = 'La foi est appelée à répondre: confiance, adhésion, persévérance.';
  if (/\b(pardon|grace|misericorde)\b/.test(lower)) angle = 'La grâce est offerte: le pardon restaure et ouvre un chemin d’obéissance.';
  if (/\b(loi|commandement|ordonne)\b/.test(lower)) angle = 'La loi éclaire: l’obéissance n’est pas un mérite mais la forme aimante de la réponse.';
  if (/\b(esperance|gloire|joie)\b/.test(lower)) angle = 'L’espérance est nourrie: la joie promise soutient la marche.';
  return `Sens (v.${n}) : ${angle}`;
}

// Point d'entrée : livre + chapitre → versets [{n, ref, text}]
async function getChapterOverview(bookName, chapterNumber){
  try{
    if (!KEY || !BIBLE_ID) {
      return { ok:false, book:bookName, chapter:chapterNumber, verses:[], note:'Clé ou Bible ID manquant.' };
    }

    const books = await ensureBooks();
    const book = matchBook(bookName, books);
    if (!book) {
      return { ok:false, book:bookName, chapter:chapterNumber, verses:[], note:`Livre introuvable dans la Bible ${BIBLE_ID}.` };
    }

    const chapters = await ensureChapters(book.id);
    const chNum = Math.max(1, Math.min(Number(chapterNumber)||1, chapters.length||1));
    const ch = chapters.find(c => c.number === chNum) || chapters[chNum-1];
    if (!ch) {
      return { ok:false, book:bookName, chapter:chNum, verses:[], note:'Chapitre introuvable.' };
    }

    // Liste des versets puis fetch (on espace légèrement pour éviter un éventuel rate-limit)
    const verseIds = await listVerseIds(ch.id);
    const verses = [];
    let n = 0;
    for (const v of verseIds){
      n++;
      let txt = '';
      try{
        txt = await fetchVerseText(v.id);
      }catch(e){
        // si ça rate, on laisse txt = ''
      }
      verses.push({ n, ref: v.ref || `${book.name} ${chNum}:${n}`, text: txt, note: explainVerse(n, txt) });
      if (n % 5 === 0) await sleep(50); // micro-pause pour être gentil
    }

    return { ok:true, book:book.name, chapter:chNum, verses };
  }catch(err){
    console.error('[bibleProvider] getChapterOverview error:', err);
    return { ok:false, book:bookName, chapter:chapterNumber, verses:[], note: String(err.message||err) };
  }
}

module.exports = { getChapterOverview };

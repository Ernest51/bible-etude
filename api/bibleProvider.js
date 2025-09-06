// api/bibleProvider.js
// Provider unique pour api.bible (sans aucune dépendance OpenAI).
// Utilisation côté routes: const bp = require('./bibleProvider'); await bp.getBooks()

const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY;
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || '';

if (!KEY) {
  // On n'échoue pas au chargement pour éviter d'empêcher le boot Vercel,
  // mais chaque appel renverra une erreur claire si la clé est absente.
  console.warn('[bibleProvider] Missing API_BIBLE_KEY env var');
}

/** Utilitaire fetch sécurisé */
async function call(endpoint, { method = 'GET', params = {}, signal } = {}) {
  if (!KEY) {
    const e = new Error('API_BIBLE_KEY is missing from environment.');
    e.status = 500;
    throw e;
  }
  const url = new URL(`${API_ROOT}${endpoint}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), {
    method,
    headers: {
      'accept': 'application/json',
      'api-key': KEY,
    },
    signal,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!res.ok) {
    const err = new Error(json?.error?.message || `api.bible error ${res.status}`);
    err.status = res.status;
    err.details = json;
    throw err;
  }
  return json;
}

/** Récupère la liste des bibles (option filterLang) */
async function getBibles({ language = undefined } = {}) {
  const data = await call('/bibles', { params: language ? { language } : {} });
  return data?.data || [];
}

/** Choisit un bibleId: env > param > première FR si dispo > première */
async function resolveBibleId(preferredId) {
  if (preferredId) return preferredId;
  if (DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;

  const bibles = await getBibles(); // tu peux filtrer avec {language:'fra'} si besoin
  if (!bibles.length) throw new Error('No bibles available from api.bible');

  // essaie de trouver une Bible FR (titles/abbr peuvent varier).
  const fr = bibles.find(b => (b.language?.name || '').toLowerCase().startsWith('fr'));
  return fr?.id || bibles[0].id;
}

/** Liste des livres pour un bibleId donné (ou résolu automatiquement) */
async function getBooks({ bibleId } = {}) {
  const id = await resolveBibleId(bibleId);
  const data = await call(`/bibles/${id}/books`);
  return { bibleId: id, books: data?.data || [] };
}

/** Liste des chapitres pour un livre (bookId) */
async function getChapters({ bibleId, bookId }) {
  const id = await resolveBibleId(bibleId);
  if (!bookId) {
    const e = new Error('Missing bookId');
    e.status = 400;
    throw e;
  }
  const data = await call(`/bibles/${id}/books/${bookId}/chapters`);
  return { bibleId: id, chapters: data?.data || [] };
}

/**
 * Récupère un passage (texte HTML propre) pour une référence:
 * - ref peut être "GEN.1" ou un verset "GEN.1.1-5"
 * - contentType=html pour garder formatage (titres, verse numbers optionnels)
 */
async function getPassage({ bibleId, ref, includeVerseNumbers = false }) {
  const id = await resolveBibleId(bibleId);
  if (!ref) {
    const e = new Error('Missing ref (e.g., "GEN.1")');
    e.status = 400;
    throw e;
  }
  const params = {
    'content-type': 'html',
    'include-notes': false,
    'include-titles': true,
    'include-chapter-numbers': true,
    'include-verse-numbers': !!includeVerseNumbers,
    'include-verse-spans': false,
    'use-org-id': false,
  };
  const data = await call(`/bibles/${id}/passages/${encodeURIComponent(ref)}`, { params });
  // data.data.content est du HTML; data.data.reference fourni la réf.
  return {
    bibleId: id,
    reference: data?.data?.reference || ref,
    contentHtml: data?.data?.content || '',
  };
}

module.exports = {
  getBibles,
  getBooks,
  getChapters,
  getPassage,
  // util exposé si besoin
  resolveBibleId,
};

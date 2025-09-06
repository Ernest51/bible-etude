// api/bibleProvider.js
// Provider unique pour api.bible (ESM). Aucune dépendance OpenAI.
// Exporte: getBibles, getBooks, getChapters, getPassage, resolveBibleId

export const config = { runtime: "nodejs" };

const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID =
  process.env.API_BIBLE_ID ||
  process.env.API_BIBLE_BIBLE_ID || // compat éventuelle
  "";

if (!KEY) {
  console.warn("[bibleProvider] ⚠️ API_BIBLE_KEY manquante (les appels échoueront).");
}

/** Appel générique api.bible */
async function callApiBible(path, params = {}) {
  if (!KEY) {
    const e = new Error("API_BIBLE_KEY manquante dans les variables d’environnement.");
    e.status = 500;
    throw e;
  }
  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, {
    headers: { accept: "application/json", "api-key": KEY },
  });
  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!r.ok) {
    const e = new Error(json?.error?.message || `api.bible ${r.status}`);
    e.status = r.status;
    e.details = json;
    throw e;
  }
  return json;
}

/** Liste des bibles (filtrable par langue DBL ex: 'fra') */
export async function getBibles({ language } = {}) {
  const data = await callApiBible("/bibles", language ? { language } : {});
  return data?.data || [];
}

/** Résout un bibleId : env > param > première FR > première dispo */
export async function resolveBibleId(preferredId) {
  if (preferredId) return preferredId;
  if (DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;

  const bibles = await getBibles(); // toutes
  if (!bibles.length) throw new Error("Aucune Bible disponible depuis api.bible");

  const fr = bibles.find(b => (b.language?.id || "").toLowerCase().startsWith("fra")
    || (b.language?.name || "").toLowerCase().startsWith("french"));
  return fr?.id || bibles[0].id;
}

/** Livres d’une Bible */
export async function getBooks({ bibleId } = {}) {
  const id = await resolveBibleId(bibleId);
  const data = await callApiBible(`/bibles/${id}/books`);
  return { bibleId: id, books: data?.data || [] };
}

/** Chapitres d’un livre */
export async function getChapters({ bibleId, bookId }) {
  const id = await resolveBibleId(bibleId);
  if (!bookId) {
    const e = new Error("Paramètre 'bookId' requis");
    e.status = 400;
    throw e;
  }
  const data = await callApiBible(`/bibles/${id}/books/${bookId}/chapters`);
  return { bibleId: id, chapters: data?.data || [] };
}

/** Passage HTML (ref ex: "GEN.1" ou "GEN.1.1-5") */
export async function getPassage({ bibleId, ref, includeVerseNumbers = false }) {
  const id = await resolveBibleId(bibleId);
  if (!ref) {
    const e = new Error('Paramètre "ref" requis (ex: "GEN.1")');
    e.status = 400;
    throw e;
  }
  const params = {
    "content-type": "html",
    "include-notes": false,
    "include-titles": true,
    "include-chapter-numbers": true,
    "include-verse-numbers": !!includeVerseNumbers,
    "include-verse-spans": false,
    "use-org-id": false,
  };
  const data = await callApiBible(`/bibles/${id}/passages/${encodeURIComponent(ref)}`, params);
  return {
    bibleId: id,
    reference: data?.data?.reference || ref,
    contentHtml: data?.data?.content || "",
  };
}

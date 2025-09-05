// pages/api/bibleChapters.js
export const config = { runtime: "edge" };

const API_KEY = process.env.API_BIBLE_KEY; // ta clé API.bible
const BASE_URL = "https://api.scripture.api.bible/v1";

/**
 * Retourne la liste des chapitres d’un livre donné dans une Bible
 * Usage: /api/bibleChapters?bibleId=a93a92589195411f-01&bookId=GEN
 */
export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const bibleId = searchParams.get("bibleId");
    const bookId = searchParams.get("bookId");

    if (!API_KEY) {
      return new Response(
        JSON.stringify({ ok: false, error: "API_BIBLE_KEY manquant dans les variables d’environnement." }),
        { status: 500, headers: { "content-type": "application/json" } }
      );
    }

    if (!bibleId || !bookId) {
      return new Response(
        JSON.stringify({ ok: false, error: "Paramètres 'bibleId' et 'bookId' requis." }),
        { status: 400, headers: { "content-type": "application/json" } }
      );
    }

    const url = `${BASE_URL}/bibles/${bibleId}/books/${bookId}/chapters`;
    const r = await fetch(url, {
      headers: { "api-key": API_KEY }
    });

    if (!r.ok) {
      const msg = await r.text();
      return new Response(
        JSON.stringify({ ok: false, error: `API.Bible ${r.status}: ${msg}` }),
        { status: r.status, headers: { "content-type": "application/json" } }
      );
    }

    const data = await r.json();
    return new Response(JSON.stringify({ ok: true, data }, null, 2), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err.message }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
}

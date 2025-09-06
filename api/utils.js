// api/utils.js
export const config = { runtime: "nodejs" };

/**
 * Multi-endpoint pour réduire le nombre de Serverless Functions :
 * /api/utils?action=ping
 * /api/utils?action=health
 * /api/utils?action=whoami
 * /api/utils?action=bibles&lang=fra
 * /api/utils?action=books&bibleId=...
 * /api/utils?action=chapters&bibleId=...&bookId=GEN
 */

const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID =
  process.env.API_BIBLE_ID ||
  process.env.API_BIBLE_BIBLE_ID ||
  "";

function j(res, status, payload) {
  res.status(status).setHeader("content-type","application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

async function apiBible(path, params={}) {
  if (!KEY) {
    const e = new Error("API_BIBLE_KEY manquante");
    e.status = 500; throw e;
  }
  const url = new URL(API_ROOT + path);
  for (const [k,v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const r = await fetch(url, { headers: { "api-key": KEY, "accept":"application/json" } });
  const text = await r.text();
  let json; try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!r.ok) {
    const e = new Error(`api.bible ${r.status}`);
    e.status = r.status; e.details = json; throw e;
  }
  return json;
}

export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const action = (searchParams.get("action") || "").toLowerCase();

    // 0) ping
    if (action === "ping") {
      return j(res, 200, { ok:true, pong:true, time:new Date().toISOString() });
    }

    // 1) health
    if (action === "health") {
      return j(res, 200, {
        ok: true,
        time: new Date().toISOString(),
        region: process.env.VERCEL_REGION || "local",
        node: process.version || "unknown",
        env: {
          hasApiBibleKey: !!KEY,
          hasApiBibleId: !!DEFAULT_BIBLE_ID
        }
      });
    }

    // 2) whoami
    if (action === "whoami") {
      return j(res, 200, {
        ok: true,
        defaultBibleId: DEFAULT_BIBLE_ID,
        region: process.env.VERCEL_REGION || "local",
        env: { hasApiBibleKey: !!KEY, hasApiBibleId: !!DEFAULT_BIBLE_ID }
      });
    }

    // 3) bibles (liste)
    if (action === "bibles") {
      const lang = searchParams.get("lang") || undefined; // ex: 'fra'
      const data = await apiBible("/bibles", lang ? { language: lang } : {});
      return j(res, 200, { ok:true, ...data });
    }

    // 4) books (livres)
    if (action === "books") {
      const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;
      if (!bibleId) return j(res, 400, { ok:false, error:"bibleId requis (ou configure API_BIBLE_ID)" });
      const data = await apiBible(`/bibles/${bibleId}/books`);
      return j(res, 200, { ok:true, data: data?.data || [], meta: data?.meta || null, bibleId });
    }

    // 5) chapters (chapitres d’un livre)
    if (action === "chapters") {
      const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;
      const bookId  = searchParams.get("bookId") || "";
      if (!bibleId || !bookId) return j(res, 400, { ok:false, error:"bibleId et bookId requis" });
      const data = await apiBible(`/bibles/${bibleId}/books/${bookId}/chapters`);
      return j(res, 200, { ok:true, data: data?.data || [], meta: data?.meta || null, bibleId, bookId });
    }

    // fallback
    return j(res, 400, { ok:false, error:"action invalide", actions:[
      "ping","health","whoami","bibles","books","chapters"
    ]});
  } catch (e) {
    const status = e?.status || 500;
    return j(res, status, { ok:false, error:String(e?.message||e), details:e?.details||null });
  }
}

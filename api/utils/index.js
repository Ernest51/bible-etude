// /api/utils/index.js
// Endpoint multi-actions : ping, health, whoami, bibles, books, chapters.

export const config = { runtime: "nodejs" };

/* -------------------- Constantes & ENV -------------------- */
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID =
  process.env.API_BIBLE_ID ||
  process.env.API_BIBLE_BIBLE_ID ||
  "";

/* -------------------- Helpers HTTP -------------------- */
function headers(res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
}
function send(res, status, body) {
  headers(res);
  res.statusCode = status;
  res.end(JSON.stringify(body, null, 2));
}

/* -------------------- fetch JSON robuste -------------------- */
async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1, trace = null } = {}) {
  const run = async () => {
    trace && trace.push({ step: "fetch", url });
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const text = await r.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; }
      catch { json = { raw: text }; }
      if (!r.ok) {
        const msg = json?.error?.message || `HTTP ${r.status}`;
        const e = new Error(msg); e.status = r.status; e.details = json;
        trace && trace.push({ step: "error", status: r.status, msg });
        throw e;
      }
      trace && trace.push({ step: "ok", status: r.status });
      return json;
    } finally {
      clearTimeout(tid);
    }
  };

  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await run(); }
    catch (e) { last = e; if (i === retries) throw e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
  }
  throw last;
}

/* -------------------- Appels api.bible -------------------- */
async function apiBible(path, params = {}, { trace = null } = {}) {
  if (!KEY) {
    const e = new Error("API_BIBLE_KEY manquante"); e.status = 500; throw e;
  }
  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return await fetchJson(url.toString(), {
    headers: { accept: "application/json", "api-key": KEY },
    timeout: 12000,
    retries: 1,
    trace,
  });
}

/* -------------------- Handler -------------------- */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "Method Not Allowed" });

  const base = `http://${req.headers.host || "local.test"}`;
  let url; try { url = new URL(req.url, base); } catch { return send(res, 400, { ok: false, error: "URL invalide" }); }

  const sp = url.searchParams;
  const action = (sp.get("action") || "").toLowerCase();
  const wantTrace = sp.get("trace") === "1";
  const trace = wantTrace ? [] : null;

  // ---- Page d’accueil
  if (!action) {
    return send(res, 200, {
      ok: true,
      route: "/api/utils",
      hint: "actions: ping | health | whoami | bibles&lang=fra | books&bibleId=... | chapters&bibleId=...&bookId=GEN"
    });
  }

  // ---- Actions légères
  if (action === "ping") {
    return send(res, 200, { ok: true, pong: true, time: new Date().toISOString() });
  }
  if (action === "health") {
    return send(res, 200, {
      ok: true,
      time: new Date().toISOString(),
      region: process.env.VERCEL_REGION || "local",
      node: process.version || "unknown",
      env: { hasApiBibleKey: !!KEY, hasApiBibleId: !!DEFAULT_BIBLE_ID }
    });
  }
  if (action === "whoami") {
    return send(res, 200, {
      ok: true,
      defaultBibleId: DEFAULT_BIBLE_ID,
      region: process.env.VERCEL_REGION || "local",
      env: { hasApiBibleKey: !!KEY, hasApiBibleId: !!DEFAULT_BIBLE_ID }
    });
  }

  // ---- Actions api.bible
  try {
    // 1) bibles
    if (action === "bibles") {
      const lang = sp.get("lang") || undefined; // ex: 'fra'
      const data = await apiBible("/bibles", lang ? { language: lang } : {}, { trace });
      // cache doux CDN 10 minutes : via header s-maxage (Vercel) – on renvoie dans le body une note
      res.setHeader("cache-control", "public, max-age=0, s-maxage=600");
      return send(res, 200, { ok: true, ...data, trace });
    }

    // 2) books
    if (action === "books") {
      const bibleId = sp.get("bibleId") || DEFAULT_BIBLE_ID;
      if (!bibleId) return send(res, 400, { ok: false, error: "bibleId requis (ou configure API_BIBLE_ID)" });
      const data = await apiBible(`/bibles/${bibleId}/books`, {}, { trace });
      res.setHeader("cache-control", "public, max-age=0, s-maxage=600");
      return send(res, 200, { ok: true, bibleId, data: data?.data || [], meta: data?.meta || null, trace });
    }

    // 3) chapters
    if (action === "chapters") {
      const bibleId = sp.get("bibleId") || DEFAULT_BIBLE_ID;
      const bookId = sp.get("bookId") || "";
      if (!bibleId || !bookId) {
        return send(res, 400, { ok: false, error: "bibleId et bookId requis" });
      }
      const data = await apiBible(`/bibles/${bibleId}/books/${bookId}/chapters`, {}, { trace });
      res.setHeader("cache-control", "public, max-age=0, s-maxage=600");
      return send(res, 200, { ok: true, bibleId, bookId, data: data?.data || [], meta: data?.meta || null, trace });
    }

    // action inconnue
    return send(res, 400, {
      ok: false,
      error: "action invalide",
      actions: ["ping", "health", "whoami", "bibles", "books", "chapters"]
    });
  } catch (e) {
    const status = Number(e?.status || 500);
    const message = e?.message || "Erreur serveur";
    const normalized =
      !KEY && /API_BIBLE_KEY/i.test(message)
        ? "API_BIBLE_KEY manquante (configure la variable dans Vercel)"
        : message;
    return send(res, status, { ok: false, error: normalized, details: e?.details || null, trace });
  }
}

// /api/utils.js
// Endpoint multi-actions (ping, health, whoami, bibles, books, chapters)
// Exemples :
//   /api/utils?action=ping
//   /api/utils?action=health
//   /api/utils?action=whoami
//   /api/utils?action=bibles&lang=fra
//   /api/utils?action=books&bibleId=...
//   /api/utils?action=chapters&bibleId=...&bookId=GEN

export const config = { runtime: "nodejs" }; // OK en pages/api sur Vercel

// ------------------------- Constantes & ENV -------------------------
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID =
  process.env.API_BIBLE_ID ||
  process.env.API_BIBLE_BIBLE_ID ||
  process.env.DARBY_BIBLE_ID ||
  "";

// ------------------------- Utilitaires HTTP -------------------------
function setCommonHeaders(res, { cache = "no-store" } = {}) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  // CORS permissif : utile pour pages statiques dans /public/tests
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  if (cache === "no-store") {
    res.setHeader("cache-control", "no-store, max-age=0");
  } else if (typeof cache === "number") {
    res.setHeader("cache-control", `public, max-age=${cache}, s-maxage=${cache}`);
  } else if (typeof cache === "string") {
    res.setHeader("cache-control", cache);
  }
}

function send(res, status, payload, { cache = "no-store" } = {}) {
  setCommonHeaders(res, { cache });
  res.statusCode = status;
  res.end(JSON.stringify(payload, null, 2));
}

function ok(res, payload, opts) {
  return send(res, 200, payload, opts);
}

function badRequest(res, message, extra = undefined) {
  return send(res, 400, { ok: false, error: message, ...(extra ? { details: extra } : {}) });
}

function methodNotAllowed(res, method) {
  return send(res, 405, { ok: false, error: `Method ${method} not allowed` });
}

// ------------------------- Fetch robuste (api.bible) -------------------------
function shouldRetryError(e) {
  // Timeout réseau / Abort / 5xx => retry
  if (e?.name === "AbortError") return true;
  const msg = String(e?.message || "");
  if (/timeout/i.test(msg)) return true;
  const st = Number(e?.status || 0);
  if (st >= 500 && st < 600) return true;
  return false;
}

async function delay(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

function truncate(s, n = 120, tail = "…") {
  const t = String(s || "");
  return t.length <= n ? t : t.slice(0, n - tail.length) + tail;
}

async function fetchJson(url, { headers = {}, timeout = 12000, retries = 2, trace = null } = {}) {
  const exec = async () => {
    trace && trace.push({ step: "fetch", url });
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeout);

    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const text = await r.text();
      let json;
      try {
        json = text ? JSON.parse(text) : {};
      } catch {
        json = { raw: text };
      }
      if (!r.ok) {
        // api.scripture.api.bible renvoie souvent { error: { message } }
        const message = json?.error?.message || `api.bible ${r.status}`;
        const err = new Error(message);
        err.status = r.status;
        err.details = json;
        trace && trace.push({ step: "error", status: r.status, body: truncate(String(message), 200) });
        throw err;
      }
      trace && trace.push({ step: "ok", status: r.status });
      return json;
    } finally {
      clearTimeout(to);
    }
  };

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await exec();
    } catch (e) {
      lastErr = e;
      if (attempt === retries || !shouldRetryError(e)) throw e;
      await delay(250 * Math.pow(2, attempt)); // backoff simple
    }
  }
  throw lastErr;
}

async function apiBible(path, params = {}, { trace = null, timeout = 10000, retries = 1 } = {}) {
  if (!KEY) {
    const e = new Error("API_BIBLE_KEY manquante");
    e.status = 500;
    throw e;
  }
  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  return await fetchJson(url.toString(), {
    headers: { accept: "application/json", "api-key": KEY },
    timeout,
    retries,
    trace,
  });
}

// ------------------------- Handler principal -------------------------
export default async function handler(req, res) {
  // Pré-traitement CORS / méthodes
  if (req.method === "OPTIONS") {
    setCommonHeaders(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return methodNotAllowed(res, req.method);
  }

  // Construction d'URL sûre (évite les 404 “NOT_FOUND” si querystring exotique)
  const base = `http://${req.headers.host || "local.test"}`;
  let url;
  try {
    url = new URL(req.url, base);
  } catch {
    return badRequest(res, "URL invalide");
  }

  const sp = url.searchParams;
  const action = (sp.get("action") || "").toLowerCase();
  const wantTrace = sp.get("trace") === "1";
  const trace = wantTrace ? [] : null;

  try {
    // 0) ping
    if (action === "ping") {
      return ok(
        res,
        { ok: true, pong: true, time: new Date().toISOString() },
        { cache: "no-store" }
      );
    }

    // 1) health
    if (action === "health") {
      return ok(
        res,
        {
          ok: true,
          time: new Date().toISOString(),
          region: process.env.VERCEL_REGION || "local",
          node: process.version || "unknown",
          env: { hasApiBibleKey: !!KEY, hasApiBibleId: !!DEFAULT_BIBLE_ID },
        },
        { cache: "no-store" }
      );
    }

    // 2) whoami
    if (action === "whoami") {
      return ok(
        res,
        {
          ok: true,
          defaultBibleId: DEFAULT_BIBLE_ID,
          region: process.env.VERCEL_REGION || "local",
          env: { hasApiBibleKey: !!KEY, hasApiBibleId: !!DEFAULT_BIBLE_ID },
        },
        { cache: "no-store" }
      );
    }

    // 3) bibles
    if (action === "bibles") {
      if (!KEY) return send(res, 500, { ok: false, error: "API_BIBLE_KEY manquante" });
      const lang = sp.get("lang") || "fra"; // défaut FR
      const data = await apiBible("/bibles", { language: lang }, { trace });
      // Cache doux 10 minutes côté CDN (suffit pour un catalogue)
      return ok(res, { ok: true, data: data?.data || [], meta: data?.meta || null, trace }, { cache: 600 });
    }

    // 4) books
    if (action === "books") {
      if (!KEY) return send(res, 500, { ok: false, error: "API_BIBLE_KEY manquante" });
      const bibleId = sp.get("bibleId") || DEFAULT_BIBLE_ID;
      if (!bibleId) return badRequest(res, "bibleId requis (ou configure API_BIBLE_ID)");
      const data = await apiBible(`/bibles/${bibleId}/books`, {}, { trace });
      return ok(
        res,
        { ok: true, bibleId, data: data?.data || [], meta: data?.meta || null, trace },
        { cache: 600 }
      );
    }

    // 5) chapters
    if (action === "chapters") {
      if (!KEY) return send(res, 500, { ok: false, error: "API_BIBLE_KEY manquante" });
      const bibleId = sp.get("bibleId") || DEFAULT_BIBLE_ID;
      const bookId = sp.get("bookId") || "";
      if (!bibleId || !bookId) return badRequest(res, "bibleId et bookId requis");
      const data = await apiBible(`/bibles/${bibleId}/books/${bookId}/chapters`, {}, { trace });
      return ok(
        res,
        { ok: true, bibleId, bookId, data: data?.data || [], meta: data?.meta || null, trace },
        { cache: 600 }
      );
    }

    // Fallback action invalide
    return send(
      res,
      400,
      {
        ok: false,
        error: "action invalide",
        actions: ["ping", "health", "whoami", "bibles", "books", "chapters"],
      },
      { cache: "no-store" }
    );
  } catch (e) {
    const status = Number(e?.status || 500);
    const message = e?.message || "Erreur serveur";
    const details = e?.details || null;

    // Normalise quelques messages fréquents
    const normalized =
      !KEY && /API_BIBLE_KEY/i.test(message)
        ? "API_BIBLE_KEY manquante (configure la variable dans Vercel)"
        : message;

    return send(
      res,
      status,
      { ok: false, error: normalized, details, trace },
      { cache: "no-store" }
    );
  }
}

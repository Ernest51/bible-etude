// /api/chat.js — Proxy vers /api/study-28 (LLM-FREE, api.bible only)
export const config = { runtime: "nodejs18.x" };

// ---------- utils ----------
function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"warn":"send_failed"}'); } catch {}
  }
}

async function readJsonBody(req) {
  // Supporte body déjà parsé (vercel dev) ou flux brut (prod)
  if (req && req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { resolve({ __parse_error: e.message, __raw: data }); }
    });
    req.on("error", (err) => resolve({ __stream_error: err?.message || String(err) }));
  });
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Use POST" });
    }

    const body = await readJsonBody(req);
    if (body && body.__parse_error) {
      return send(res, 400, { ok: false, error: "JSON parse error", detail: body.__parse_error });
    }

    // Sonde du panneau debug (frontend)
    if (body && body.probe) {
      return send(res, 200, { ok: true, source: "study-28-proxy", probe: true });
    }

    const {
      book = "",
      chapter = "",
      verse = "",
      version = "LSG",      // depuis le front
      translation = "",     // alias accepté
      mode = "full",        // "mini" ou "full"
      bibleId = ""          // si transmis par le front
    } = body || {};

    if (!book || !chapter) {
      return send(res, 400, { ok: false, error: "book et chapter requis" });
    }

    // Construit l’URL absolue vers /api/study-28
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers["host"];
    const base  = `${proto}://${host}`;

    const sp = new URLSearchParams({
      book: String(book),
      chapter: String(chapter),
      translation: String(translation || version || "LSG"),
      mode: String(mode || "full")
    });
    if (verse)   sp.set("verse", String(verse));
    if (bibleId) sp.set("bibleId", String(bibleId));

    const url = `${base}/api/study-28?${sp.toString()}`;
    const r = await fetch(url, { method: "GET", headers: { accept: "application/json" } });

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return send(res, 502, { ok: false, error: `study-28 ${r.status}`, detail: txt.slice(0, 1200) });
    }

    const j = await r.json().catch(() => ({}));
    if (!j || j.ok === false) {
      return send(res, 502, { ok: false, error: j?.error || "study-28 invalid response" });
    }

    return send(res, 200, { ok: true, data: j.data, source: "study-28-proxy" });
  } catch (e) {
    return send(res, 500, { ok: false, error: "proxy_failed", detail: String(e?.message || e) });
  }
}

// /api/diag.js — Diagnostic des routes & env (Vercel, Node 18)
// Objectif : savoir QUI répond à /api/study-28, voir les headers (X-Handler), env, etc.

export const config = { runtime: "nodejs18.x" };

function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"warn":"send_failed"}'); } catch {}
  }
}

function pickHeaders(h) {
  const names = [
    "content-type", "content-length", "x-handler",
    "x-vercel-id", "x-vercel-cache", "x-powered-by",
  ];
  const out = {};
  for (const n of names) {
    const v = h.get(n);
    if (v != null) out[n] = v;
  }
  return out;
}

async function probe(url, options = {}, bodyMax = 400) {
  try {
    const r = await fetch(url, options);
    const ct = (r.headers.get("content-type") || "").toLowerCase();
    const headers = pickHeaders(r.headers);
    if (ct.includes("application/json")) {
      const j = await r.json().catch(() => ({}));
      return { ok: r.ok, status: r.status, headers, json: j };
    } else {
      const t = await r.text().catch(() => "");
      return { ok: r.ok, status: r.status, headers, text: t.slice(0, bodyMax) };
    }
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export default async function handler(req, res) {
  try {
    const now = new Date().toISOString();
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers["host"];
    const base  = `${proto}://${host}`;

    const url = new URL(req.url, base);
    const verbose = url.searchParams.get("verbose") === "1";

    // 1) Infos process/env
    const envInfo = {
      hasApiBibleKey: !!process.env.API_BIBLE_KEY,
      hasApiBibleId:  !!process.env.API_BIBLE_ID || !!process.env.API_BIBLE_BIBLE_ID, // au cas où il y a la faute de nom
      hasOpenAIKey:   !!process.env.OPENAI_API_KEY, // pour détecter les versions legacy
      region:         process.env.VERCEL_REGION || "local",
      node:           process.version || "unknown"
    };

    // 2) En-têtes de la requête entrante (utile pour les proxies)
    const reqInfo = {
      method: req.method,
      url: url.toString(),
      headers: {
        host: req.headers["host"],
        "x-forwarded-proto": req.headers["x-forwarded-proto"],
        "x-forwarded-host": req.headers["x-forwarded-host"],
        "x-real-ip": req.headers["x-real-ip"],
        "user-agent": req.headers["user-agent"],
      }
    };

    // 3) Probes : qui répond ?
    const pStudyDash = await probe(`${base}/api/study-28?selftest=1`, { method: "GET" }, verbose ? 4000 : 400);
    const pStudyNoDash = await probe(`${base}/api/study28?selftest=1`, { method: "GET" }, verbose ? 4000 : 400);
    const pChat = await probe(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: true })
    });

    // 4) Résumé rapide lisible
    const summary = {
      study_dash: {
        status: pStudyDash?.status,
        x_handler: pStudyDash?.headers?.["x-handler"] || null,
        ok: pStudyDash?.ok ?? null,
        hint: (!pStudyDash?.ok && pStudyDash?.text?.includes("OPENAI_API_KEY")) ? "Ancien handler OpenAI détecté" : null
      },
      study_nodash: {
        status: pStudyNoDash?.status,
        x_handler: pStudyNoDash?.headers?.["x-handler"] || null,
        ok: pStudyNoDash?.ok ?? null
      },
      chat_post: {
        status: pChat?.status,
        x_handler: pChat?.headers?.["x-handler"] || null,
        ok: pChat?.ok ?? null
      }
    };

    // 5) Réponse
    const out = {
      ok: true,
      time: now,
      base,
      env: envInfo,
      request: reqInfo,
      summary,
      details: {
        study_dash: pStudyDash,
        study_nodash: pStudyNoDash,
        chat_post: pChat
      }
    };

    // Ajoute un petit header de signature pour repérer ce handler
    res.setHeader("X-Handler", "diag-pages");
    return send(res, 200, out);
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
}

// /api/diag.js
// Diagnostic pour savoir QUEL handler répond, et sonder /api/study-28 + /api/chat

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
  const keep = ["content-type","content-length","x-handler","x-vercel-id","x-vercel-cache","x-powered-by"];
  const out = {};
  keep.forEach(k => { const v = h.get(k); if (v != null) out[k] = v; });
  return out;
}

async function probe(url, options = {}, bodyMax = 600) {
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
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers["host"];
    const base  = `${proto}://${host}`;
    const url   = new URL(req.url, base);
    const verbose = url.searchParams.get("verbose") === "1";

    // 1) Infos env
    const env = {
      hasApiBibleKey: !!process.env.API_BIBLE_KEY,
      hasApiBibleId:  !!process.env.API_BIBLE_ID || !!process.env.API_BIBLE_BIBLE_ID, // au cas où
      hasOpenAIKey:   !!process.env.OPENAI_API_KEY,
      region:         process.env.VERCEL_REGION || "local",
      node:           process.version || "unknown",
    };

    // 2) Requête entrante
    const request = {
      method: req.method,
      url: url.toString(),
      headers: {
        host: req.headers["host"],
        "x-forwarded-proto": req.headers["x-forwarded-proto"],
        "x-forwarded-host": req.headers["x-forwarded-host"],
        "user-agent": req.headers["user-agent"],
      }
    };

    // 3) Sondes internes
    const pStudyDash   = await probe(`${base}/api/study-28?selftest=1`, { method: "GET" }, verbose ? 4000 : 600);
    const pStudyNoDash = await probe(`${base}/api/study28?selftest=1`,  { method: "GET" }, verbose ? 4000 : 600);
    const pChat        = await probe(`${base}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: true })
    });

    const summary = {
      study_dash: {
        ok: pStudyDash?.ok ?? null,
        status: pStudyDash?.status ?? null,
        x_handler: pStudyDash?.headers?.["x-handler"] || null,
        hint: (!pStudyDash?.ok && (pStudyDash?.text||"").includes("OPENAI_API_KEY"))
          ? "Ancien handler OpenAI détecté"
          : null
      },
      study_nodash: {
        ok: pStudyNoDash?.ok ?? null,
        status: pStudyNoDash?.status ?? null,
        x_handler: pStudyNoDash?.headers?.["x-handler"] || null
      },
      chat_post: {
        ok: pChat?.ok ?? null,
        status: pChat?.status ?? null,
        x_handler: pChat?.headers?.["x-handler"] || null
      }
    };

    res.setHeader("X-Handler", "diag-pages");
    return send(res, 200, {
      ok: true,
      time: new Date().toISOString(),
      base,
      env, request,
      summary,
      details: verbose ? { study_dash: pStudyDash, study_nodash: pStudyNoDash, chat_post: pChat } : undefined
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
}

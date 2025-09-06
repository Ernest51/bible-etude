// /api/chat.js — proxy vers /api/study-28 (LLM-free)
// Compatible Vercel (runtime nodejs)

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Méthode non autorisée (POST requis)" });
      return;
    }

    // lit le corps JSON
    const body = await readJsonBody(req);

    // reconstruit l’URL de l’endpoint study-28
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    const base = `${proto}://${host}`;

    const r = await fetch(`${base}/api/study-28`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });

    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    res.status(r.status).json({
      ok: true,
      source: "study-28-proxy",
      status: r.status,
      data
    });
  } catch (e) {
    res.status(500).json({
      ok: false,
      error: "chat.js_failed",
      detail: e?.message || String(e)
    });
  }
}

// utilitaire pour lire le body JSON
async function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        resolve({ __parse_error: e.message, __raw: data });
      }
    });
    req.on("error", (err) => resolve({ __stream_error: err?.message || String(err) }));
  });
}

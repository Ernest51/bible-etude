// /api/utils/index.js
// Étape 1 : version minimale pour valider la route et supprimer le 404.
// Ensuite on réajoutera bibles/books/chapters.

export const config = { runtime: "nodejs" };

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

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "Method Not Allowed" });

  const base = `http://${req.headers.host || "local.test"}`;
  let url;
  try { url = new URL(req.url, base); }
  catch { return send(res, 400, { ok: false, error: "URL invalide" }); }

  const action = (url.searchParams.get("action") || "").toLowerCase();

  if (!action) {
    return send(res, 200, {
      ok: true,
      route: "/api/utils",
      hint: "Ajoute ?action=ping|health|whoami"
    });
  }

  if (action === "ping") {
    return send(res, 200, { ok: true, pong: true, time: new Date().toISOString() });
  }

  if (action === "health") {
    return send(res, 200, {
      ok: true,
      time: new Date().toISOString(),
      region: process.env.VERCEL_REGION || "local",
      node: process.version || "unknown",
      env: {
        hasApiBibleKey: !!process.env.API_BIBLE_KEY,
        hasApiBibleId:
          !!process.env.API_BIBLE_ID || !!process.env.API_BIBLE_BIBLE_ID,
      },
    });
  }

  if (action === "whoami") {
    return send(res, 200, {
      ok: true,
      defaultBibleId:
        process.env.API_BIBLE_ID ||
        process.env.API_BIBLE_BIBLE_ID ||
        "",
      region: process.env.VERCEL_REGION || "local",
    });
  }

  return send(res, 400, {
    ok: false,
    error: "action invalide",
    actions: ["ping", "health", "whoami"],
  });
}

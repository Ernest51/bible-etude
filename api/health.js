// /api/health.js — santé minimale, toujours JSON
export const config = { runtime: "nodejs" };

function send(res, status, payload) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store, max-age=0");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  res.statusCode = status;
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET")   return send(res, 405, { ok:false, error:"Method Not Allowed" });

  const hasApiBibleKey = !!process.env.API_BIBLE_KEY;
  const hasApiBibleId  = !!(process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID);

  return send(res, 200, {
    ok: true,
    time: new Date().toISOString(),
    region: process.env.VERCEL_REGION || "local",
    node: process.version || "unknown",
    env: { hasApiBibleKey, hasApiBibleId }
  });
}

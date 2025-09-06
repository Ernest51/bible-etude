// /api/health.js — healthcheck simple avec signature
export const config = { runtime: "nodejs18.x" };

export default async function handler(_req, res) {
  try {
    res.setHeader("X-Handler", "health-pages");
    res.status(200).json({
      ok: true,
      time: new Date().toISOString(),
      region: process.env.VERCEL_REGION || "local",
      node: process.version || "unknown",
      env: {
        hasApiBibleKey: !!process.env.API_BIBLE_KEY,
        hasApiBibleId:  !!process.env.API_BIBLE_ID || !!process.env.API_BIBLE_BIBLE_ID
      }
    });
  } catch {
    res.status(500).json({ ok: false, error: "health_failed" });
  }
}

// /api/health.js — healthcheck simple, sans aucune dépendance OpenAI
export const config = { runtime: "nodejs18.x" };

export default async function handler(_req, res) {
  try {
    res.status(200).json({
      ok: true,
      env: {
        hasApiBibleKey: !!process.env.API_BIBLE_KEY,
        hasApiBibleId:  !!process.env.API_BIBLE_ID,
        region: process.env.VERCEL_REGION || "local",
        node: process.version || "unknown",
      },
      uptimeSeconds: typeof process.uptime === "function" ? Math.round(process.uptime()) : null,
      time: new Date().toISOString(),
    });
  } catch (_e) {
    res.status(500).json({ ok: false, error: "health_failed" });
  }
}

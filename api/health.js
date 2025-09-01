// /api/health.js — simple healthcheck
export default async function handler(_req, res) {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    res.status(200).json({
      ok: true,
      env: {
        hasOpenAIKey,
        region: process.env.VERCEL_REGION || "local",
        node: process.version || "unknown"
      },
      time: new Date().toISOString()
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: "health failed" });
  }
}

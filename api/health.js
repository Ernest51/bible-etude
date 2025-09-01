// /api/health.js — Simple health-check

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  try {
    const ok = true;
    const out = {
      ok,
      env: {
        hasOpenAIKey: !!process.env.OPENAI_API_KEY,
        region: process.env.VERCEL_REGION || "local",
        node: process.version
      },
      time: new Date().toISOString()
    };
    res.status(200).json(out);
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
}

// /api/health.js — petit endpoint de diagnostic
export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");

  const hasKey = !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim());

  res.status(200).end(
    JSON.stringify({
      ok: true,
      env: {
        hasOpenAIKey: hasKey,
        node: process.version,
        region: process.env.VERCEL_REGION || process.env.FLY_REGION || "unknown",
      },
      time: new Date().toISOString(),
    })
  );
}

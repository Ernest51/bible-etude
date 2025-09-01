// api/health.js
export default function handler(req, res) {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).json({
    ok: true,
    env: {
      hasOpenAIKey: hasKey,
      region: process.env.VERCEL_REGION || "local",
      node: process.version,
    },
    time: new Date().toISOString(),
  });
}

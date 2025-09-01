export default async function handler(req, res) {
  const hasKey = !!process.env.OPENAI_API_KEY;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.status(200).json({
    ok: true,
    hasKey,
    model: "gpt-4o-mini",
    ts: new Date().toISOString()
  });
}

// /api/study-28.js — version LLM-FREE de test
export const config = { runtime: "nodejs18.x" };

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("X-Handler", "pages-study-28-llmfree");
  
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.searchParams.get("selftest") === "1") {
    return res.status(200).json({
      ok: true,
      engine: "LLM-FREE",
      selftest: true,
      time: new Date().toISOString()
    });
  }

  // stub normal
  return res.status(200).json({
    ok: true,
    engine: "LLM-FREE",
    info: "endpoint en place, remplace OpenAI",
    time: new Date().toISOString()
  });
}

// /api/study-28.js — LLM-FREE (sans OpenAI)
// Corrigé pour Vercel (runtime: "nodejs")

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("X-Handler", "study-28-llmfree");

    const url = new URL(req.url, `http://${req.headers.host}`);

    // mode selftest
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
      info: "endpoint en place (stub, sans OpenAI)",
      time: new Date().toISOString()
    });
  } catch (e) {
    return res.status(500).json({
      ok: false,
      error: "study-28_failed",
      detail: S

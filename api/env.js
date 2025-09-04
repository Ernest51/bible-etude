// /api/env.js — diagnostic rapide (à supprimer après test)
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.status(200).json({
    hasApiBibleKey: !!process.env.API_BIBLE_KEY,
    apiBibleKeyLen: (process.env.API_BIBLE_KEY || "").length,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    env: process.env.VERCEL_ENV || "unknown",
  });
}

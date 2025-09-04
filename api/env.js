export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.status(200).json({
    keys: Object.keys(process.env).sort(),
    API_BIBLE_KEY: process.env.API_BIBLE_KEY || null,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? "(set)" : null,
    env: process.env.VERCEL_ENV || "unknown"
  });
}

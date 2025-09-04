export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.status(200).json({
    hasApiBibleKey: !!process.env.API_BIBLE_KEY,
    apiBibleKeyLen: (process.env.API_BIBLE_KEY || "").length,
    hasOpenAIKey: !!process.env.OPENAI_API_KEY,
    TEST_FLAG: process.env.TEST_FLAG || null,
    project: {
      name: process.env.VERCEL_PROJECT_NAME,
      url: process.env.VERCEL_PROJECT_PRODUCTION_URL,
      id: process.env.VERCEL_PROJECT_ID,
    },
    env: process.env.VERCEL_ENV || "unknown",
  });
}

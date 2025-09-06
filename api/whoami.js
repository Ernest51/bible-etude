// /api/whoami.js — expose l'ID Bible par défaut (pas la clé)
export const config = { runtime: "nodejs" };

export default function handler(_req, res) {
  try {
    const defaultBibleId =
      process.env.API_BIBLE_ID ||
      process.env.API_BIBLE_BIBLE_ID ||
      "";

    res.status(200).json({
      ok: true,
      region: process.env.VERCEL_REGION || "local",
      defaultBibleId,
      env: {
        hasApiBibleKey: !!process.env.API_BIBLE_KEY,
        hasApiBibleId: !!defaultBibleId,
      }
    });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}

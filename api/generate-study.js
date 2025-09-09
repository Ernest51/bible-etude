// api/generate-study.js
// ESM — Vercel Functions (Node 20)
// But :
// - GET  => ping/infos
// - POST => renvoie squelette 28 rubriques (noms fixes) ou echo

export default function handler(req, res) {
  const allowed = ["GET", "POST"];
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed);
    return res.status(405).json({ error: "Method Not Allowed", allowed });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/generate-study",
      mode: "info",
      hint: "POST JSON { passage: 'Genèse 1', mode?: 'echo' }",
      timestamp: new Date().toISOString(),

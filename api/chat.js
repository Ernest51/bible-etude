// api/chat.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({
    ok: true,
    message: "Chat API fonctionne ✅ (stub)",
    method: req.method,
    url: req.url
  }, null, 2));
}

// /api/ok.js — simple ping
export default function handler(req, res) {
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ok: true,
    route: '/api/ok',
    method: req.method || 'GET',
    ts: new Date().toISOString()
  });
}

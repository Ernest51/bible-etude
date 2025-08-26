// api/chat.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: 'chat',
    method: req.method,
    note: 'Route /api/chat opérationnelle'
  });
}

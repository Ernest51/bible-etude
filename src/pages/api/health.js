// api/health.js
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    service: 'health',
    method: req.method,
    time: new Date().toISOString()
  });
}

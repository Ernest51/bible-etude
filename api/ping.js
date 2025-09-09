// ESM handler pour Vercel (Option A)
// Route: /api/ping
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/ping",
    now: new Date().toISOString()
  });
}

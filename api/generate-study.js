// api/generate-study.js
// ESM — Vercel Functions (Node 20)

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
      mode: "echo-minimal",
      hint: "POST JSON to echo it back",
      timestamp: new Date().toISOString(),
    });
  }

  // POST: echo minimal
  const body = req.body ?? {};
  return res.status(200).json({
    ok: true,
    endpoint: "/api/generate-study",
    echo: body,
    timestamp: new Date().toISOString(),
  });
}

// api/generate-study.js
// ESM (package.json contient: { "type": "module" })

/**
 * Minimal echo endpoint to clear the 404 on /api/generate-study.
 * - GET: returns a simple JSON with status 'ok'
 * - POST: echoes back the received JSON body under { echo: ... }
 */
export default async function handler(req, res) {
  // Allow only GET and POST for now
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
  try {
    // On Vercel Node functions, req.body is already parsed for application/json
    const body = req.body ?? {};
    return res.status(200).json({
      ok: true,
      endpoint: "/api/generate-study",
      echo: body,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "Invalid JSON body",
      details: err?.message ?? String(err),
    });
  }
}

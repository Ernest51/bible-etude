// api/generate-study.js
// CommonJS variant (forces Vercel to pick up the route)

module.exports = async function (req, res) {
  const allowed = ["GET", "POST"];
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed);
    return res.status(405).json({ error: "Method Not Allowed", allowed });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/generate-study",
      mode: "echo-minimal (cjs)",
      hint: "POST JSON to echo it back",
      timestamp: new Date().toISOString(),
    });
  }

  let body = {};
  try {
    body = req.body ?? {};
  } catch {
    body = {};
  }

  return res.status(200).json({
    ok: true,
    endpoint: "/api/generate-study",
    echo: body,
    timestamp: new Date().toISOString(),
  });
};

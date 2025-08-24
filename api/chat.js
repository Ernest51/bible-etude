export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const KEY = process.env.OPENAI_API_KEY || "";
  const PROJ = process.env.OPENAI_PROJECT || "";

  if (!KEY) {
    return res.status(500).json({ error: "Missing OPENAI_API_KEY" });
  }

  const headers = {
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json"
  };
  if (PROJ) headers["OpenAI-Project"] = PROJ;

  try {
    const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers,
      body: JSON.stringify(req.body || {})
    });

    const text = await upstream.text();
    res
      .status(upstream.status)
      .type(upstream.headers.get("content-type") || "application/json")
      .send(text);
  } catch (e) {
    res.status(502).json({ error: "Upstream error", detail: String(e) });
  }
}

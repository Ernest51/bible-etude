// api/chat.js
export const config = { runtime: 'nodejs' };

function send(res, code, payload) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.end(JSON.stringify(payload, null, 2));
}

async function readBody(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getQuery(req) {
  const base = `http://${req.headers.host || "localhost"}`;
  return new URL(req.url, base).searchParams;
}

function normalize(payload, req) {
  // Body JSON
  if (typeof payload?.input === "string") return payload.input.trim();
  if (typeof payload?.reference === "string") return payload.reference.trim();
  if (payload?.book && payload?.chapter) {
    return payload.verses
      ? `${payload.book} ${payload.chapter}:${payload.verses}`
      : `${payload.book} ${payload.chapter}`;
  }

  // Fallback sur query string
  const q = getQuery(req);
  return (q.get("q") || "").trim();
}

function buildMessages(ref, templateId) {
  return [
    {
      role: "system",
      content: `
Tu es un assistant de théologie.
Génère une étude biblique en **28 points** selon un canevas fixe.
- Français uniquement.
- Strictement sur le passage demandé.
- Sortie **UNIQUEMENT** en JSON valide.
`.trim()
    },
    { role: "user", content: `Référence : ${ref}\nModèle : ${templateId}` }
  ];
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      return res.status(204).end();
    }

    if (!process.env.OPENAI_API_KEY) {
      return send(res, 500, { ok: false, error: "OPENAI_API_KEY manquant" });
    }

    // lecture body si POST, sinon vide
    const body = req.method === "POST" ? await readBody(req) : {};
    const templateId = body.templateId || getQuery(req).get("templateId") || "v28-standard";
    const ref = normalize(body, req);

    if (!ref) {
      return send(res, 400, { ok: false, error: "Aucune référence trouvée dans POST body ou GET query" });
    }

    // Appel OpenAI
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 4000,
        messages: buildMessages(ref, templateId)
      })
    });

    const raw = await resp.text();
    if (!resp.ok) return send(res, 502, { ok: false, error: "OpenAI API error", status: resp.status, body: raw });

    let parsed;
    try {
      const apiResp = JSON.parse(raw);
      parsed = apiResp.choices?.[0]?.message?.content?.trim();
    } catch {
      return send(res, 502, { ok: false, error: "Réponse OpenAI illisible", raw });
    }

    return send(res, 200, { ok: true, reference: ref, templateId, raw: parsed });

  } catch (err) {
    return send(res, 500, { ok: false, error: err.message || "Erreur serveur" });
  }
}

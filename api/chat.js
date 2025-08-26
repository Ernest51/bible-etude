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
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return { input: raw.trim() }; }
}

function getQuery(req) {
  const base = `http://${req.headers.host || "localhost"}`;
  return new URL(req.url, base).searchParams;
}

function normalize(payload, req) {
  if (typeof payload?.input === "string") return payload.input.trim();
  if (typeof payload?.reference === "string") return payload.reference.trim();
  if (payload?.book && payload?.chapter) {
    return payload.verses
      ? `${payload.book} ${payload.chapter}:${payload.verses}`
      : `${payload.book} ${payload.chapter}`;
  }
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
- Sortie **UNIQUEMENT** en JSON valide :
{
  "reference": "Livre Chapitre:Verses",
  "templateId": "v28-standard",
  "sections": [
    { "id": 1, "title": "...", "content": "...", "verses": ["Marc 5:1-5"] },
    ...,
    { "id": 28, "title": "...", "content": "...", "verses": ["..."] }
  ]
}
Contraintes :
- 28 sections exactes
- title ≤ 90 caractères
- content ≤ 700 caractères
- verses = tableau de références (pas de texte intégral)
- aucun texte hors du JSON
`.trim()
    },
    {
      role: "user",
      content: `Génère l'étude en 28 points pour : ${ref}\nModèle : ${templateId}`
    }
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
    if (req.method !== "GET" && req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Méthode non autorisée" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return send(res, 500, { ok: false, error: "OPENAI_API_KEY manquant" });
    }

    const body = req.method === "POST" ? await readBody(req) : {};
    const templateId = body.templateId || getQuery(req).get("templateId") || "v28-standard";
    const ref = normalize(body, req);

    if (!ref) {
      return send(res, 400, { ok: false, error: "Aucune référence biblique fournie" });
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
    if (!resp.ok) {
      return send(res, 502, { ok: false, error: "OpenAI API error", status: resp.status, body: raw });
    }

    let data;
    try {
      const parsed = JSON.parse(raw);
      data = parsed.choices?.[0]?.message?.content?.trim();
    } catch {
      return send(res, 502, { ok: false, error: "Réponse OpenAI non JSON", raw });
    }

    if (!data) return send(res, 502, { ok: false, error: "Réponse vide d’OpenAI" });

    let parsedJSON;
    try {
      parsedJSON = JSON.parse(data);
    } catch {
      const match = data.match(/\{[\s\S]*\}$/);
      if (!match) return send(res, 502, { ok: false, error: "Pas de JSON détecté", raw: data });
      try { parsedJSON = JSON.parse(match[0]); }
      catch (e) { return send(res, 502, { ok: false, error: "JSON invalide", details: e.message, raw: data }); }
    }

    if (!Array.isArray(parsedJSON.sections) || parsedJSON.sections.length !== 28) {
      return send(res, 502, {
        ok: false,
        error: "Le résultat n’a pas 28 sections",
        got: Array.isArray(parsedJSON.sections) ? parsedJSON.sections.length : typeof parsedJSON.sections,
        sample: parsedJSON.sections?.[0]
      });
    }

    return send(res, 200, {
      ok: true,
      data: {
        reference: parsedJSON.reference ?? ref,
        templateId,
        sections: parsedJSON.sections
      }
    });

  } catch (err) {
    return send(res, 500, { ok: false, error: "Erreur serveur", details: err.message });
  }
}

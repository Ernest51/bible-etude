// api/chat.js
export const config = { runtime: 'nodejs20.x' }; // force Node 20 sans vercel.json

function send(res, code, payload) {
  res.status(code).setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-ref");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.end(JSON.stringify(payload, null, 2));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return { _empty: true };
  try { return JSON.parse(raw); } catch { return { input: raw.trim(), _from: "text/plain" }; }
}

function getQuery(req) {
  const base = `http://${req.headers.host || "localhost"}`;
  const url = new URL(req.url, base);
  return url.searchParams;
}

function normalize(payload, req) {
  const headerRef = (req.headers["x-ref"] || req.headers["x-reference"]);
  if (typeof headerRef === "string" && headerRef.trim()) return headerRef.trim();

  if (typeof payload?.input === "string") return payload.input.trim();
  if (typeof payload?.reference === "string") return payload.reference.trim();
  if (payload?.book && payload?.chapter) {
    return payload.verses
      ? `${payload.book} ${payload.chapter}:${String(payload.verses).trim()}`
      : `${payload.book} ${payload.chapter}`;
  }

  const q = getQuery(req);
  const qRef = q.get("q") || q.get("reference") || q.get("input");
  if (qRef) return qRef.trim();

  return "";
}

function parseRef(raw) {
  const s = (raw || "").trim();
  const m = s.match(/^([\p{L}\p{M}\s\.\-’']+)\s+(\d+)(?::([\d\-–,; ]+))?$/u);
  if (!m) return { book: s || null, chapter: null, verses: null, raw: s };
  const [, book, chapter, verses] = m;
  return {
    book: book.trim(),
    chapter: Number(chapter),
    verses: verses ? verses.replace(/\s+/g, "") : null,
    raw: s
  };
}

function buildMessages({ book, chapter, verses, raw, templateId }) {
  const system = `
Tu génères des études bibliques en **28 points** selon un canevas fixe.
RÈGLES :
- Français uniquement.
- Strictement sur le passage demandé (zéro aléatoire).
- Sortie **UNIQUEMENT** en JSON valide :

{
  "reference": "Livre Chapitre:Verses",
  "templateId": "v28-standard",
  "sections": [
    { "id": 1, "title": "…", "content": "…", "verses": ["Marc 5:1-5"] },
    …,
    { "id": 28, "title": "…", "content": "…", "verses": ["…"] }
  ]
}

CONTRAINTES :
- 28 sections exactement (id 1→28)
- title ≤ 90c ; content ≤ 700c
- verses = tableau de références (pas de citation intégrale)
- Aucun texte hors du JSON.
`.trim();

  const user = `
Génère l'étude en 28 points pour : ${raw}
Détails:
- Livre: ${book ?? "Inconnu"}
- Chapitre: ${chapter ?? "Inconnu"}
- Versets: ${verses ?? "Non spécifié"}
- Modèle: ${templateId}
`.trim();

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

export default async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-ref");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      return res.status(204).end();
    }
    if (req.method !== "POST" && req.method !== "GET") {
      return send(res, 405, { ok: false, error: "Méthode non autorisée (utilise GET ou POST)" });
    }

    const { OPENAI_API_KEY, OPENAI_MODEL } = process.env;
    if (!OPENAI_API_KEY) {
      return send(res, 500, { ok: false, error: "OPENAI_API_KEY manquant dans les variables d'environnement" });
    }

    const body = req.method === "POST" ? await readBody(req) : {};
    const templateId =
      (typeof body?.templateId === "string" && body.templateId) ||
      getQuery(req).get("templateId") ||
      "v28-standard";

    const refStr = normalize(body, req);
    if (!refStr) {
      return send(res, 400, {
        ok: false,
        error: "Entrée invalide : aucune référence trouvée",
        how_to_fix: [
          `GET  /api/chat?q=Marc%205:1-20`,
          `POST /api/chat  body: {"input":"Marc 5:1-20"}`
        ]
      });
    }

    const ref = parseRef(refStr);
    const messages = buildMessages({ ...ref, templateId });

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 4000,
        messages
      })
    });

    const raw = await resp.text();
    if (!resp.ok) {
      return send(res, 502, { ok: false, error: "OpenAI API error", status: resp.status, body: tryJson(raw) });
    }

    const data = tryJson(raw);
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return send(res, 502, { ok: false, error: "Réponse vide du modèle", body: data });

    let parsed;
    try { parsed = JSON.parse(text); }
    catch {
      const m = text.match(/\{[\s\S]*\}$/);
      if (!m) return send(res, 502, { ok: false, error: "Sortie non JSON", raw: text });
      try { parsed = JSON.parse(m[0]); }
      catch (e2) { return send(res, 502, { ok: false, error: "JSON invalide", details: String(e2), raw: text }); }
    }

    if (!Array.isArray(parsed.sections) || parsed.sections.length !== 28) {
      return send(res, 502, {
        ok: false,
        error: "Le résultat ne contient pas exactement 28 sections",
        got: Array.isArray(parsed.sections) ? parsed.sections.length : typeof parsed.sections
      });
    }

    return send(res, 200, {
      ok: true,
      data: {
        reference: parsed.reference ?? ref.raw,
        templateId,
        sections: parsed.sections
      }
    });

  } catch (err) {
    return send(res, 500, { ok: false, error: "Erreur serveur", details: String(err) });
  }
}

function tryJson(s) { try { return JSON.parse(s); } catch { return s; } }

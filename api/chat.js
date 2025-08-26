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
      ? `${payload.book} ${payload.chapter}:${String(payload.verses).trim()}`
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
Génère une étude biblique en **28 points** pour le passage demandé.
CONTRAINTES DE SORTIE (OBLIGATOIRES) :
- Réponds en **JSON UNIQUEMENT** (pas de markdown, pas de \`\`\`).
- Schéma exact :
{
  "reference": "Livre Chapitre:Verses",
  "templateId": "v28-standard",
  "sections": [
    { "id": 1, "title": "<=90c>", "content": "<=700c>", "verses": ["Livre Chapitre:Verses", "..."] },
    ...,
    { "id": 28, "title": "<=90c>", "content": "<=700c>", "verses": ["..."] }
  ]
}
RÈGLES :
- Français uniquement.
- Strictement le passage demandé (aucun contenu aléatoire).
- 28 sections **exactement** (id 1→28).
`.trim()
    },
    {
      role: "user",
      content: `Référence: ${ref}\nModèle: ${templateId}`
    }
  ];
}

/* ====== Parse & Normalisation tolérante ====== */

// retire éventuelles fences ```...```
function stripFences(s) {
  if (!s) return "";
  const fence = s.match(/```[\s\S]*?```/g);
  if (!fence) return s.trim();
  // Prend le premier bloc
  const m = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return (m ? m[1] : s).trim();
}

// extrait le 1er objet JSON "{...}" s'il y a du bruit autour
function extractJsonObject(s) {
  const i = s.indexOf("{");
  const j = s.lastIndexOf("}");
  if (i === -1 || j === -1 || j <= i) return null;
  const sub = s.slice(i, j + 1);
  try { return JSON.parse(sub); } catch { return null; }
}

function mapAnyToSections(obj, fallbackRef) {
  // cas standard déjà OK
  if (Array.isArray(obj?.sections)) return sanitizeSections(obj.sections, fallbackRef);

  // cas "points" à la racine
  if (Array.isArray(obj?.points)) return sanitizeSections(obj.points, fallbackRef);

  // cas "étude_biblique" -> "points"
  const eb = obj?.["étude_biblique"] || obj?.etude_biblique;
  if (eb && Array.isArray(eb.points)) return sanitizeSections(eb.points, fallbackRef);

  // sinon, impossible
  return null;
}

function sanitizeSections(arr, fallbackRef) {
  const sections = arr.map((it, idx) => {
    const id =
      it?.id ?? it?.numéro ?? it?.numero ?? it?.index ?? (idx + 1);

    const title =
      it?.title ?? it?.titre ?? it?.heading ?? `Point ${id}`;

    const content =
      it?.content ?? it?.description ?? it?.texte ?? "";

    const verses =
      Array.isArray(it?.verses) ? it.verses :
      Array.isArray(it?.versets) ? it.versets :
      typeof it?.verses === "string" ? [it.verses] :
      typeof it?.versets === "string" ? [it.versets] :
      [fallbackRef];

    return {
      id: Number(id),
      title: String(title).slice(0, 90),
      content: String(content).slice(0, 700),
      verses: verses.map(v => String(v)).slice(0, 6)
    };
  });

  // Trie par id croissant, puis coupe/pad pour 28
  sections.sort((a, b) => (a.id || 0) - (b.id || 0));

  // coupe si >28
  if (sections.length > 28) sections.length = 28;

  // pad si <28
  for (let i = sections.length; i < 28; i++) {
    sections.push({
      id: i + 1,
      title: `Point ${i + 1}`,
      content: "",
      verses: [fallbackRef]
    });
  }

  // reindexe 1..28 pour éviter les trous
  return sections.map((s, i) => ({ ...s, id: i + 1 }));
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

    if (!ref) return send(res, 400, { ok: false, error: "Aucune référence fournie" });

    // ==== Appel OpenAI ====
    const api = await fetch("https://api.openai.com/v1/chat/completions", {
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

    const raw = await api.text();
    if (!api.ok) {
      return send(res, 502, { ok: false, error: "OpenAI API error", status: api.status, body: safeJson(raw) });
    }

    let content;
    try {
      const j = JSON.parse(raw);
      content = j?.choices?.[0]?.message?.content ?? "";
    } catch {
      return send(res, 502, { ok: false, error: "Réponse OpenAI non JSON", raw });
    }

    if (!content) return send(res, 502, { ok: false, error: "Réponse vide d’OpenAI" });

    // ==== Normalisation robuste ====
    // 1) Si la réponse est déjà un JSON valide avec sections
    let direct;
    try { direct = JSON.parse(content); } catch { /* pas du JSON direct */ }

    let sections = null;
    if (direct) {
      sections = mapAnyToSections(direct, ref);
    } else {
      // 2) Retire les fences et récupère l’objet JSON interne
      const unfenced = stripFences(content);
      const inner = extractJsonObject(unfenced);
      if (inner) sections = mapAnyToSections(inner, ref);
    }

    if (!sections || sections.length !== 28) {
      return send(res, 502, {
        ok: false,
        error: "Impossible de normaliser en 28 sections",
        hint: "Le modèle a peut-être répondu avec un autre schéma ; renvoyé ci-dessous pour diagnostic.",
        content_preview: content.slice(0, 1200)
      });
    }

    return send(res, 200, {
      ok: true,
      data: {
        reference: ref,
        templateId,
        sections
      }
    });

  } catch (err) {
    return send(res, 500, { ok: false, error: "Erreur serveur", details: String(err) });
  }
}

function safeJson(s) { try { return JSON.parse(s); } catch { return s; } }

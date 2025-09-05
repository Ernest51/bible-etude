// /api/chat.js — Génération des 28 points via OpenAI (JSON strict)
export const config = { runtime: "nodejs" };

function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"source":"chat","warn":"send_failed"}'); } catch {}
  }
}

async function readJsonBody(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { resolve({ __parse_error: e.message, __raw: data }); }
    });
    req.on("error", (err) => resolve({ __stream_error: err?.message || String(err) }));
  });
}

function cleanText(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSchema() {
  return {
    name: "etude28",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        meta: {
          type: "object",
          additionalProperties: false,
          properties: {
            book: { type: "string" },
            chapter: { type: "string" },
            translation: { type: "string" },
            wordsCount: { type: "integer" },
            modelNotes: { type: "string" }
          },
          required: ["book", "chapter", "translation", "wordsCount", "modelNotes"]
        },
        ...Object.fromEntries(
          Array.from({ length: 28 }, (_, i) => {
            const k = `p${String(i + 1).padStart(2, "0")}`;
            return [k, {
              type: "object",
              additionalProperties: false,
              properties: {
                titre: { type: "string" },
                contenu: { type: "string" }
              },
              required: ["titre", "contenu"]
            }];
          })
        )
      },
      required: ["meta"].concat(
        Array.from({ length: 28 }, (_, i) => `p${String(i + 1).padStart(2, "0")}`)
      )
    },
    strict: true
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Use POST" });
    }

    const body = await readJsonBody(req);
    if (body && body.__parse_error) {
      return send(res, 400, { ok: false, error: "JSON parse error", detail: body.__parse_error, raw: body.__raw?.slice(0, 1500) });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || "";
    if (!OPENAI_API_KEY) return send(res, 500, { ok: false, error: "OPENAI_API_KEY manquante" });

    const {
      book = "",
      chapter = "",
      translation = "LSG",
      passageText = "",
      language = "fr"
    } = body || {};

    if (!book || !chapter) return send(res, 400, { ok: false, error: "book et chapter requis" });

    const passage = cleanText(passageText);
    if (!passage) {
      return send(res, 400, {
        ok: false,
        error: "passageText vide",
        hint: "Appelle d’abord /api/bibleProvider pour récupérer le texte du chapitre, puis renvoie-le ici."
      });
    }

    const system = `Tu es un exégète biblique francophone. Réponds STRICTEMENT en JSON (aucun texte hors JSON).`;

    const userText = [
      `Livre: ${book}`,
      `Chapitre: ${chapter}`,
      `Traduction: ${translation}`,
      ``,
      `Texte (nettoyé):`,
      passage,
      ``,
      `Objectif: produire une étude structurée en 28 points selon ma trame.`,
      `Règles:`,
      `- langue: ${language}`,
      `- clés: p01..p28, chacune { "titre": "...", "contenu": "..." }`,
      `- ajoute "meta" {book,chapter,translation,wordsCount,modelNotes}`,
      `- pas de markdown, pas de commentaires en dehors du JSON`
    ].join("\n");

    const schema = makeSchema();

    const openaiMod = await import("openai");
    const openai = new openaiMod.default({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_schema", json_schema: schema },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userText }
      ]
    });

    const content = completion.choices?.[0]?.message?.content || "{}";

    let json;
    try { json = JSON.parse(content); }
    catch {
      return send(res, 502, { ok: false, error: "Invalid JSON returned by model" });
    }

    // enrichir meta
    json.meta = {
      ...(json.meta || {}),
      book: String(book),
      chapter: String(chapter),
      translation: String(translation),
      wordsCount: passage.split(/\s+/).length,
      modelNotes: (json.meta?.modelNotes || "").slice(0, 400)
    };

    return send(res, 200, { ok: true, data: json });
  } catch (e) {
    return send(res, 500, { ok: false, error: "chat_failed", detail: String(e?.message || e) });
  }
}

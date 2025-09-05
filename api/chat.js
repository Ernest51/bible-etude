// /api/chat.js — Génération 28 points via OpenAI (JSON strict) + fallback auto vers /api/bibleProvider
// ENV (Vercel → Settings → Environment Variables) :
//   - OPENAI_API_KEY
//   - OPENAI_MODEL (optionnel, défaut: gpt-4.1-mini)

export const config = { runtime: "nodejs" };

// ---------------- helpers ----------------
function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"warn":"send_failed"}'); } catch {}
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

const cleanText = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\[[^\]]*\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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

// ---------------- handler ----------------
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Use POST" });
    }

    const body = await readJsonBody(req);
    if (body && body.__parse_error) {
      return send(res, 400, { ok: false, error: "JSON parse error", detail: body.__parse_error });
    }

    const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
    const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    if (!OPENAI_API_KEY) return send(res, 500, { ok: false, error: "OPENAI_API_KEY manquante" });

    const {
      book = "",
      chapter = "",
      verse = "",
      translation = "LSG",
      language = "fr",
      passageText = ""
    } = body || {};

    if (!book || !chapter) return send(res, 400, { ok: false, error: "book et chapter requis" });

    // 1) Passage (fourni ou auto-récupéré)
    let passage = cleanText(passageText);

    if (!passage) {
      // reconstruit l'URL absolue de /api/bibleProvider
      const proto = req.headers["x-forwarded-proto"] || "https";
      const host  = req.headers["x-forwarded-host"] || req.headers["host"];
      const base  = `${proto}://${host}`;

      const url =
        `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
        (verse ? `&verse=${encodeURIComponent(verse)}` : "");

      const r = await fetch(url);
      const j = await r.json().catch(() => ({}));
      const fromProvider = j?.data?.passageText || j?.data?.items?.[0]?.text || "";
      passage = cleanText(fromProvider);
    }

    if (!passage) {
      return send(res, 400, {
        ok: false,
        error: "passageText introuvable",
        hint: "Vérifie /api/bibleProvider (clé/ID) ou passe passageText directement."
      });
    }

    // 2) Prompt
    const system = "Tu es un exégète biblique francophone. Réponds STRICTEMENT en JSON (aucun texte hors JSON).";
    const userText = [
      `Livre: ${book}`,
      `Chapitre: ${chapter}`,
      `Traduction: ${translation}`,
      "",
      "Texte (nettoyé):",
      passage,
      "",
      "Objectif: produire une étude structurée en 28 points selon ma trame.",
      "Règles:",
      `- langue: ${language}`,
      '- clés: p01..p28, chacune { "titre": "...", "contenu": "..." }',
      '- ajoute "meta" {book,chapter,translation,wordsCount,modelNotes}',
      "- pas de markdown, pas de commentaires hors JSON"
    ].join("\n");

    // 3) Appel OpenAI (REST, pas besoin de dépendance)
    const schema = makeSchema();
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_schema", json_schema: schema },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userText }
        ]
      })
    });

    if (!r.ok) {
      const msg = await r.text();
      return send(res, 502, { ok: false, error: `OpenAI ${r.status}`, detail: msg.slice(0, 1200) });
    }

    const j = await r.json();
    const raw = j?.choices?.[0]?.message?.content || "{}";

    let data;
    try { data = JSON.parse(raw); }
    catch { return send(res, 502, { ok: false, error: "Invalid JSON returned by model" }); }

    // 4) enrichir meta
    data.meta = {
      ...(data.meta || {}),
      book: String(book),
      chapter: String(chapter),
      translation: String(translation),
      wordsCount: passage.split(/\s+/).length,
      modelNotes: (data.meta?.modelNotes || "").slice(0, 400)
    };

    return send(res, 200, { ok: true, data });
  } catch (e) {
    return send(res, 500, { ok: false, error: "chat_failed", detail: String(e?.message || e) });
  }
}

// /api/study-28.js
export const config = { runtime: "edge" };

/** ENV
 * - OPENAI_API_KEY (obligatoire)
 * - OPENAI_MODEL (optionnel) -> défaut: gpt-4o-mini-2024-07-18
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// Titres fixes pour le mode "full"
const STUDY_TITLES = [
  "Thème central",
  "Résumé en une phrase",
  "Contexte historique",
  "Auteur et date",
  "Genre littéraire",
  "Structure du passage",
  "Plan détaillé",
  "Mots-clés",
  "Termes clés (définis)",
  "Personnages et lieux",
  "Problème / Question de départ",
  "Idées majeures (développement)",
  "Verset pivot (climax)",
  "Références croisées (AT)",
  "Références croisées (NT)",
  "Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)",
  "Vérités doctrinales (3–5)",
  "Promesses et avertissements",
  "Principes intemporels",
  "Applications personnelles (3–5)",
  "Applications communautaires",
  "Questions pour petits groupes (6)",
  "Prière guidée",
  "Méditation courte",
  "Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses",
  "Ressources complémentaires"
];

// -------- helpers I/O --------
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function qs(req) {
  const u = new URL(req.url);
  const g = (k, d = "") => u.searchParams.get(k)?.trim() || d;
  return {
    book: g("book"),
    chapter: g("chapter"),
    verse: g("verse"),
    translation: g("translation", "LSG"),
    bibleId: g("bibleId", ""),
    mode: g("mode", "full"),        // "mini" (3) ou "full" (28)
    maxtok: parseInt(g("maxtok", "1500"), 10),
    oaitimeout: parseInt(g("oaitimeout", "30000"), 10)
  };
}

// -------- prompts --------
function systemPrompt() {
  return [
    "Tu es un bibliste pédagogue.",
    "Langue: français.",
    "Base unique: le passage fourni par l’utilisateur (ne pas inventer).",
    "Sortie STRICTEMENT en JSON valide conforme au schéma fourni (aucun texte hors JSON).",
    "Concision: 4–10 phrases par section (mini: 2–6)."
  ].join(" ");
}

function userPrompt({ reference, translation, passageText, mode }) {
  const titles = mode === "mini"
    ? ["Thème central", "Idées majeures (développement)", "Applications personnelles"]
    : STUDY_TITLES;

  const expected = titles.length;
  const ordered = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    `Passage: ${reference} (${translation}).`,
    "Texte (base unique) :",
    "```",
    passageText,
    "```",
    "",
    `Produis exactement ${expected} sections dans cet ordre strict :`,
    ordered,
    "",
    "IMPORTANT: sors UNIQUEMENT le JSON conforme au schéma imposé."
  ].join("\n");
}

// -------- JSON Schema pour Responses API --------
function buildJsonSchema({ expectedSections }) {
  return {
    name: "etude_biblique",
    strict: true,
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
            verse: { type: "string" },
            translation: { type: "string" },
            reference: { type: "string" },
            osis: { type: "string" }
          },
          required: ["book", "chapter", "verse", "translation", "reference", "osis"]
        },
        sections: {
          type: "array",
          minItems: expectedSections,
          maxItems: expectedSections,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              index: { type: "integer", minimum: 1, maximum: expectedSections },
              title: { type: "string" },
              content: { type: "string" },
              verses: { type: "array", items: { type: "string" } }
            },
            required: ["index", "title", "content", "verses"]
          }
        }
      },
      required: ["meta", "sections"]
    }
  };
}

// -------- appel OpenAI (Responses API) --------
async function callOpenAI({ sys, user, maxtok, oaitimeout, expectedSections }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, oaitimeout || 30000));

  const schema = buildJsonSchema({ expectedSections });

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_output_tokens: Number.isFinite(maxtok) ? Math.max(500, maxtok) : 1500,
        // ⚠️ Pas de "modalities" ici.
        text: {
          format: "json_schema",
          json_schema: schema
        },
        input: [
          { role: "system", content: sys },
          { role: "user", content: user }
        ],
        seed: 7
      })
    });

    const bodyText = await r.text();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${bodyText}`);

    let payload;
    try { payload = JSON.parse(bodyText); } catch { throw new Error("OpenAI: réponse non-JSON (API)"); }

    const outputText =
      payload.output_text ||
      payload.output?.[0]?.content?.[0]?.text ||
      payload.content?.[0]?.text;

    if (typeof outputText !== "string" || !outputText.trim()) {
      throw new Error("OpenAI: contenu vide");
    }

    let out;
    try {
      out = JSON.parse(outputText);
    } catch {
      const m = outputText.match(/\{[\s\S]*\}$/m);
      if (!m) throw new Error("Sortie OpenAI non-JSON.");
      out = JSON.parse(m[0]);
    }

    if (!Array.isArray(out.sections) || out.sections.length !== expectedSections) {
      throw new Error(
        `Sections attendues: ${expectedSections}, reçues: ${Array.isArray(out.sections) ? out.sections.length : "?"}`
      );
    }

    return out;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req) {
  try {
    const { book, chapter, verse, translation, bibleId, mode, maxtok, oaitimeout } = qs(req);
    if (!book || !chapter) return json(400, { ok: false, error: "Paramètres requis: book, chapter" });

    // 1) Passage via /api/bibleProvider
    const origin = new URL(req.url).origin;
    const sp = new URLSearchParams();
    sp.set("book", book);
    sp.set("chapter", chapter);
    if (verse) sp.set("verse", verse);
    if (bibleId) sp.set("bibleId", bibleId);

    const rBP = await fetch(`${origin}/api/bibleProvider?${sp.toString()}`, {
      headers: { accept: "application/json" }
    });
    const bpText = await rBP.text();
    if (!rBP.ok) return json(500, { ok: false, error: `BibleProvider ${rBP.status}: ${bpText}` });

    let bp;
    try { bp = JSON.parse(bpText); } catch { return json(500, { ok: false, error: "BibleProvider: réponse non-JSON" }); }
    if (!bp.ok) return json(500, { ok: false, error: bp.error || "BibleProvider: échec" });

    const passageText = (bp.data?.passageText || "").trim();
    const reference = bp.data?.reference || `${book} ${chapter}${verse ? ":" + verse : ""}`;
    const osis = bp.data?.osis || "";
    if (!passageText) return json(500, { ok: false, error: "Passage vide depuis BibleProvider" });

    // 2) Prompts & schéma
    const expectedSections = mode === "mini" ? 3 : 28;
    const sys = systemPrompt();
    const user = userPrompt({ reference, translation, passageText, mode });

    // 3) OpenAI Responses
    const out = await callOpenAI({ sys, user, maxtok, oaitimeout, expectedSections });

    // 4) Meta normalisée
    const metaIn = out.meta || {};
    out.meta = {
      book: String(metaIn.book || book),
      chapter: String(metaIn.chapter || chapter),
      verse: String(metaIn.verse || (verse || "")),
      translation: String(metaIn.translation || translation || ""),
      reference: String(metaIn.reference || reference),
      osis: String(metaIn.osis || osis)
    };

    return json(200, { ok: true, data: out });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

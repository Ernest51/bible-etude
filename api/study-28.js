// /api/study-28.js
export const config = { runtime: "edge" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

const STUDY_TITLES = [
  "Thème central", "Résumé en une phrase", "Contexte historique", "Auteur et date",
  "Genre littéraire", "Structure du passage", "Plan détaillé", "Mots-clés",
  "Termes clés (définis)", "Personnages et lieux", "Problème / Question de départ",
  "Idées majeures (développement)", "Verset pivot (climax)", "Références croisées (AT)",
  "Références croisées (NT)", "Parallèles bibliques", "Lien avec l’Évangile (Christocentrique)",
  "Vérités doctrinales (3–5)", "Promesses et avertissements", "Principes intemporels",
  "Applications personnelles (3–5)", "Applications communautaires", "Questions pour petits groupes (6)",
  "Prière guidée", "Méditation courte", "Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses", "Ressources complémentaires"
];

function json(status, body, extraHeaders) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-study28-build": "v7-no-seed",
      ...(extraHeaders || {})
    }
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
    mode: g("mode", "full"),
    maxtok: parseInt(g("maxtok", "1500"), 10),
    oaitimeout: parseInt(g("oaitimeout", "30000"), 10),
    debug: g("debug", "")
  };
}

function systemPrompt() {
  return [
    "Tu es un bibliste pédagogue.",
    "Langue: français.",
    "Base unique: le passage fourni (ne rien inventer).",
    "Sortie STRICTEMENT JSON conforme au schéma (aucun texte hors JSON).",
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

async function callOpenAI({ sys, user, maxtok, oaitimeout, expectedSections, debug }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, oaitimeout || 30000));

  const schema = buildJsonSchema({ expectedSections });

  const body = {
    model: OPENAI_MODEL,
    temperature: 0.1,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(500, maxtok) : 1500,
    text: {
      format: "json_schema",
      json_schema: schema
    },
    input: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ]
    // ⚠️ seed supprimé
  };

  if (debug === "1") throw Object.assign(new Error("DEBUG_BODY"), { _debug_body: body });

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const bodyText = await r.text();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${bodyText}`);

    let payload;
    try { payload = JSON.parse(bodyText); } catch { throw new Error("OpenAI: réponse non-JSON"); }

    const outputText =
      payload.output_text ||
      payload.output?.[0]?.content?.[0]?.text ||
      payload.content?.[0]?.text;

    if (typeof outputText !== "string" || !outputText.trim()) throw new Error("OpenAI: contenu vide");

    let out;
    try { out = JSON.parse(outputText); } catch {
      const m = outputText.match(/\{[\s\S]*\}$/m);
      if (!m) throw new Error("Sortie OpenAI non-JSON.");
      out = JSON.parse(m[0]);
    }

    if (!Array.isArray(out.sections) || out.sections.length !== expectedSections) {
      throw new Error(`Sections attendues: ${expectedSections}, reçues: ${Array.isArray(out.sections) ? out.sections.length : "?"}`);
    }

    return out;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req) {
  try {
    const { book, chapter, verse, translation, bibleId, mode, maxtok, oaitimeout, debug } = qs(req);
    if (!book || !chapter) return json(400, { ok: false, error: "Paramètres requis: book, chapter" });

    const origin = new URL(req.url).origin;
    const sp = new URLSearchParams();
    sp.set("book", book);
    sp.set("chapter", chapter);
    if (verse) sp.set("verse", verse);
    if (bibleId) sp.set("bibleId", bibleId);

    const rBP = await fetch(`${origin}/api/bibleProvider?${sp.toString()}`, { headers: { accept: "application/json" } });
    const bpText = await rBP.text();
    if (!rBP.ok) return json(500, { ok: false, error: `BibleProvider ${rBP.status}: ${bpText}` });

    let bp;
    try { bp = JSON.parse(bpText); } catch { return json(500, { ok: false, error: "BibleProvider: réponse non-JSON" }); }
    if (!bp.ok) return json(500, { ok: false, error: bp.error || "BibleProvider: échec" });

    const passageText = (bp.data?.passageText || "").trim

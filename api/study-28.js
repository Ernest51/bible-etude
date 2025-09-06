// api/study-28.js
import { NextResponse } from "next/server";

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// ---------------- JSON Schemas ----------------
const META_SCHEMA = {
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
};

function sectionSchema(rangeStart, rangeEnd) {
  const allowed = Array.from({ length: rangeEnd - rangeStart + 1 }, (_, i) => rangeStart + i);
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      index: { type: "integer", enum: allowed },
      title: { type: "string" },
      content: { type: "string" },
      verses: { type: "array", items: { type: "string" } }
    },
    required: ["index", "title", "content", "verses"]
  };
}

function fullSchema(rangeStart, rangeEnd) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: META_SCHEMA,
      sections: { type: "array", items: sectionSchema(rangeStart, rangeEnd) }
    },
    required: ["meta", "sections"]
  };
}

function miniSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: META_SCHEMA,
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index: { type: "integer", enum: [1, 2, 3] },
            title: { type: "string" },
            content: { type: "string" },
            verses: { type: "array", items: { type: "string" } }
          },
          required: ["index", "title", "content", "verses"]
        }
      }
    },
    required: ["meta", "sections"]
  };
}

function makeTextFormat(schemaName, schemaObj) {
  return {
    name: "json_schema",
    strict: true,
    schema: { name: schemaName, schema: schemaObj }
  };
}

function respond(res, status = 200) {
  return NextResponse.json(res, { status });
}

// ---------------- Prompts ----------------
function sysPrompt(mode, range) {
  const isMini = mode === "mini";
  const band = "≈70–90 mots";
  const slice = range ? `Génère UNIQUEMENT les sections ${range[0]} à ${range[1]}.` : "";
  return [
    "Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON selon le schéma fourni.",
    "Langue: français. Ton rigoureux mais pastoral. N'invente pas de versets.",
    isMini ? "Format MINI: exactement 3 sections." : "Format FULL: exactement 28 sections.",
    `Chaque section: ${band}.`,
    slice,
    "Réponds UNIQUEMENT par l'objet JSON (pas de texte autour)."
  ].filter(Boolean).join(" ");
}

function userPrompt({ reference, translation, osis, passageText, mode, range }) {
  const header = `Passage : ${reference} (${translation})\nOSIS : ${osis || ""}`;
  const body = "Texte source :\n```\n" + passageText + "\n```";

  const titlesFull = [
    "1. Thème central",
    "2. Résumé en une phrase",
    "3. Contexte historique",
    "4. Auteur et date",
    "5. Genre littéraire",
    "6. Structure du passage",
    "7. Plan détaillé",
    "8. Mots-clés",
    "9. Termes clés (définis)",
    "10. Personnages et lieux",
    "11. Problème / Question de départ",
    "12. Idées majeures (développement)",
    "13. Verset pivot (climax)",
    "14. Références croisées (AT)",
    "15. Références croisées (NT)",
    "16. Parallèles bibliques",
    "17. Lien avec l’Évangile (Christocentrique)",
    "18. Vérités doctrinales (3–5)",
    "19. Promesses et avertissements",
    "20. Principes intemporels",
    "21. Applications personnelles (3–5)",
    "22. Applications communautaires",
    "23. Questions pour petits groupes (6)",
    "24. Prière guidée",
    "25. Méditation courte",
    "26. Versets à mémoriser (2–3)",
    "27. Difficultés/objections & réponses",
    "28. Ressources complémentaires"
  ];
  const titlesMini = [
    "1. Thème central",
    "2. Idées majeures (développement)",
    "3. Applications personnelles"
  ];

  const list = (mode === "mini" ? titlesMini : titlesFull).filter((t) => {
    if (!range) return true;
    const idx = parseInt(t.split(".")[0], 10);
    return idx >= range[0] && idx <= range[1];
  });

  const constraints = [
    "Contraintes :",
    "- EXACTEMENT le nombre de sections attendu.",
    "- Chaque section inclut: index, title, content (≈70–90 mots), verses (string[]).",
    "- Utilise UNIQUEMENT le passage fourni."
  ];

  return [header, body, "", "Titres attendus :", ...list, "", ...constraints].join("\n");
}

// ---------------- Utils ----------------
function safeParseJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try { return JSON.parse(txt.slice(i, j + 1)); } catch { /* ignore */ }
    }
    return null;
  }
}

async function callResponses({ model, sys, user, schemaName, schemaObj, maxtok, timeoutMs }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs || 30000));
  const body = {
    model,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    text: { format: makeTextFormat(schemaName, schemaObj) },
    temperature: 0.12,
    max_output_tokens: Math.max(600, Number.isFinite(maxtok) ? maxtok : 1100)
  };

  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    const raw = await r.json();

    const parts = [];
    if (typeof raw.output_text === "string") parts.push(raw.output_text);
    if (Array.isArray(raw.output)) {
      for (const msg of raw.output) {
        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (typeof c?.text === "string") parts.push(c.text);
            if (typeof c?.output_text === "string") parts.push(c.output_text);
          }
        }
      }
    }
    const text = parts.join("\n").trim();
    const incomplete = raw?.status === "incomplete";
    const reason = raw?.incomplete_details?.reason || null;
    return { raw, text, incomplete, reason };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ---------------- Generation ----------------
async function generateMini({ reference, translation, osis, passageText, maxtok, timeoutMs }) {
  const sys = sysPrompt("mini");
  const user = userPrompt({ reference, translation, osis, passageText, mode: "mini" });
  const schema = miniSchema();
  return await callResponses({
    model: OPENAI_MODEL,
    sys,
    user,
    schemaName: "study_28_mini",
    schemaObj: schema,
    maxtok: Number.isFinite(maxtok) ? maxtok : 900,
    timeoutMs
  });
}

async function generateFullSlice({ range, reference, translation, osis, passageText, maxtok, timeoutMs }) {
  const sys = sysPrompt("full", range);
  const user = userPrompt({ reference, translation, osis, passageText, mode: "full", range });
  const schema = fullSchema(range[0], range[1]);
  return await callResponses({
    model: OPENAI_MODEL,
    sys,
    user,
    schemaName: `study_28_${range[0]}_${range[1]}`,
    schemaObj: schema,
    maxtok: Number.isFinite(maxtok) ? maxtok : 1100,
    timeoutMs
  });
}

async function generateFullTwoPass(ctx, timeoutMs) {
  // Pass 1 : 1–14
  const p1 = await generateFullSlice({
    range: [1, 14],
    reference: ctx.reference,
    translation: ctx.translation,
    osis: ctx.osis,
    passageText: ctx.passageText,
    maxtok: 1100,
    timeoutMs
  });
  const j1 = p1.text ? safeParseJson(p1.text) : null;
  if (!j1 || !Array.isArray(j1.sections)) {
    return { ok: false, debug: { p1 } };
  }

  // Pass 2 : 15–28
  const p2 = await generateFullSlice({
    range: [15, 28],
    reference: ctx.reference,
    translation: ctx.translation,
    osis: ctx.osis,
    passageText: ctx.passageText,
    maxtok: 1100,
    timeoutMs
  });
  const j2 = p2.text ? safeParseJson(p2.text) : null;
  if (!j2 || !Array.isArray(j2.sections)) {
    return { ok: false, debug: { p1, p2 } };
  }

  const merged = {
    meta: j1.meta || {
      book: ctx.book,
      chapter: ctx.chapter,
      verse: ctx.verse || "",
      translation: ctx.translation,
      reference: ctx.reference,
      osis: ctx.osis || ""
    },
    sections: [...j1.sections, ...j2.sections].sort((a, b) => a.index - b.index)
  };

  return { ok: true, data: merged, debug: { p1: p1.raw, p2: p2.raw } };
}

// ---------------- Route ----------------
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = (searchParams.get("mode") || "full").toLowerCase(); // full | mini
  const maxtok = parseInt(searchParams.get("maxtok") || "", 10);
  const timeout = parseInt(searchParams.get("oaitimeout") || "30000", 10);
  const dry = searchParams.get("dry") || "";
  const debug = searchParams.get("debug") === "1";

  try {
    if (!OPENAI_API_KEY) return respond({ ok: false, error: "OPENAI_API_KEY manquante." });

    // Dry-run pour smoke tests UI
    if (dry) {
      if (mode === "mini") {
        return respond({
          ok: true,
          data: {
            meta: {
              book, chapter, verse, translation,
              reference: verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`,
              osis: ""
            },
            sections: [
              { index: 1, title: "Thème central", content: "Exemple MINI.", verses: [] },
              { index: 2, title: "Idées majeures (développement)", content: "Exemple MINI.", verses: [] },
              { index: 3, title: "Applications personnelles", content: "Exemple MINI.", verses: [] }
            ]
          }
        });
      }
      return respond({
        ok: true,
        data: {
          meta: {
            book, chapter, verse, translation,
            reference: verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`,
            osis: ""
          },
          sections: Array.from({ length: 28 }, (_, i) => ({
            index: i + 1, title: `Section ${i + 1}`, content: "Exemple FULL.", verses: []
          }))
        }
      });
    }

    // 1) Récupération du passage via bibleProvider (serveur)
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) return respond({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${await pRes.text()}` });
    const pJson = await pRes.json();
    if (!pJson.ok) return respond({ ok: false, error: pJson.error || "BibleProvider error" });

    const passage = pJson.data;
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    const osis = passage.osis || "";
    const passageText = passage.passageText || "";

    // 2) MINI : un seul appel
    if (mode === "mini") {
      const res = await generateMini({
        reference, translation, osis, passageText,
        maxtok: Number.isFinite(maxtok) ? maxtok : 900,
        timeoutMs: timeout
      });
      const parsed = res.text ? safeParseJson(res.text) : null;
      if (!parsed || !parsed.meta || !Array.isArray(parsed.sections)) {
        return respond(debug
          ? { ok: false, error: "Sortie OpenAI non-JSON (mini).", debug: { raw: res.raw } }
          : { ok: false, error: "Sortie OpenAI non-JSON (mini)." }
        );
      }
      parsed.meta.book = parsed.meta.book || String(book);
      parsed.meta.chapter = parsed.meta.chapter || String(chapter);
      parsed.meta.verse = parsed.meta.verse ?? String(verse || "");
      parsed.meta.translation = parsed.meta.translation || String(translation);
      parsed.meta.reference = parsed.meta.reference || reference;
      parsed.meta.osis = parsed.meta.osis || osis;

      return respond({ ok: true, data: parsed });
    }

    // 3) FULL : toujours en 2 passes (fiable)
    const two = await generateFullTwoPass(
      {
        book, chapter, verse, translation,
        reference, osis,
        passageText
      },
      timeout
    );

    if (!two.ok) {
      return respond(debug
        ? { ok: false, error: "Sortie OpenAI non-JSON (full).", debug: two.debug }
        : { ok: false, error: "Sortie OpenAI non-JSON (full)." }
      );
    }

    // compléter meta
    two.data.meta.book = two.data.meta.book || String(book);
    two.data.meta.chapter = two.data.meta.chapter || String(chapter);
    two.data.meta.verse = two.data.meta.verse ?? String(verse || "");
    two.data.meta.translation = two.data.meta.translation || String(translation);
    two.data.meta.reference = two.data.meta.reference || reference;
    two.data.meta.osis = two.data.meta.osis || osis;

    return respond({ ok: true, data: two.data });
  } catch (e) {
    return respond({ ok: false, error: String(e) });
  }
}

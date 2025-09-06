// api/study-28.js
import { NextResponse } from "next/server";

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// ---------- Schémas JSON ----------
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

function sectionSchema(rangeStart = 1, rangeEnd = 28) {
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

function fullSchema(rangeStart = 1, rangeEnd = 28) {
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

function makeTextFormat(name, schema) {
  return {
    name: "json_schema",
    strict: true,
    schema: { name, schema }
  };
}

function json(res, status = 200) {
  return NextResponse.json(res, { status });
}

function sysPrompt(mode, range) {
  const isMini = mode === "mini";
  const wordBand = "90–120 mots";
  const rangeNote = range ? `Génère UNIQUEMENT les sections ${range[0]} à ${range[1]}.` : "";
  return [
    "Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON (schéma strict).",
    "Langue: français. Ton pastoral, concis, rigoureux. N'invente pas de versets.",
    isMini
      ? `Format MINI: exactement 3 sections. ${wordBand} par section.`
      : `Format FULL: exactement 28 sections. ${wordBand} par section.`,
    rangeNote,
    "Réponds UNIQUEMENT par l'objet JSON (pas de prose autour)."
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

  const rangeTitles = (mode === "mini" ? titlesMini : titlesFull).filter((t) => {
    if (!range) return true;
    const idx = parseInt(t.split(".")[0], 10);
    return idx >= range[0] && idx <= range[1];
  });

  const constraints = [
    "Contraintes :",
    "- EXACTEMENT le nombre de sections attendu.",
    "- Chaque section: index (1..N), title, content (90–120 mots), verses (string[]).",
    "- Respecte les titres/indices ci-dessous."
  ];

  return [header, body, "", "Titres attendus :", ...rangeTitles, "", ...constraints].join("\n");
}

function safeParseJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try { return JSON.parse(txt.slice(i, j + 1)); } catch { return null; }
    }
    return null;
  }
}

async function callResponses({ model, sys, user, schemaName, schemaObj, maxtok, timeoutMs }) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs || 30000));
  const body = {
    model,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    text: { format: makeTextFormat(schemaName, schemaObj) },
    temperature: 0.12,
    max_output_tokens: Math.max(800, Number.isFinite(maxtok) ? maxtok : 3000)
  };

  let raw;
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
    clearTimeout(t);

    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    raw = await r.json();

    const chunks = [];
    if (typeof raw.output_text === "string") chunks.push(raw.output_text);
    if (Array.isArray(raw.output)) {
      for (const msg of raw.output) {
        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (typeof c?.text === "string") chunks.push(c.text);
            if (typeof c?.output_text === "string") chunks.push(c.output_text);
          }
        }
      }
    }
    const text = chunks.join("\n").trim();
    return { raw, text, incomplete: raw.status === "incomplete", reason: raw?.incomplete_details?.reason };
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

async function generateOnce({ mode, range, reference, translation, osis, passageText, maxtok, timeoutMs }) {
  const sys = sysPrompt(mode, range);
  const user = userPrompt({ reference, translation, osis, passageText, mode, range });
  const schemaName = range ? `study_28_part_${range[0]}_${range[1]}` : "study_28";
  const schemaObj = fullSchema(range ? range[0] : 1, range ? range[1] : (mode === "mini" ? 3 : 28));

  return await callResponses({
    model: OPENAI_MODEL,
    sys, user,
    schemaName, schemaObj,
    maxtok,
    timeoutMs
  });
}

async function generateFullPaged(ctx, timeoutMs) {
  // 2 passes : 1–14 puis 15–28 (avec 1400–1800 tokens de sortie chacun)
  const pass1 = await generateOnce({ ...ctx, range: [1, 14], maxtok: 1800, timeoutMs });
  let part1 = pass1.text ? safeParseJson(pass1.text) : null;

  if (!part1 || !Array.isArray(part1.sections)) {
    return { parsed: null, raw: { pass1 } };
  }

  const pass2 = await generateOnce({ ...ctx, range: [15, 28], maxtok: 1800, timeoutMs });
  let part2 = pass2.text ? safeParseJson(pass2.text) : null;

  if (!part2 || !Array.isArray(part2.sections)) {
    return { parsed: null, raw: { pass1, pass2 } };
  }

  // fusion
  const merged = {
    meta: part1.meta || ctx.meta || {
      book: ctx.book, chapter: ctx.chapter, verse: ctx.verse ?? "",
      translation: ctx.translation, reference: ctx.reference, osis: ctx.osis || ""
    },
    sections: [...part1.sections, ...part2.sections].sort((a, b) => a.index - b.index)
  };
  return { parsed: merged, raw: { pass1, pass2 } };
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = (searchParams.get("mode") || "full").toLowerCase(); // mini | full
  const maxtok = parseInt(searchParams.get("maxtok") || "", 10);
  const timeout = parseInt(searchParams.get("oaitimeout") || "30000", 10);
  const dry = searchParams.get("dry") || "";
  const debug = searchParams.get("debug") === "1";

  try {
    if (!OPENAI_API_KEY) return json({ ok: false, error: "OPENAI_API_KEY manquante." });

    // DRY
    if (dry) {
      if (mode === "mini") {
        return json({
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
      return json({
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

    // Passage via bibleProvider
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) return json({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${await pRes.text()}` });
    const pJson = await pRes.json();
    if (!pJson.ok) return json({ ok: false, error: pJson.error || "BibleProvider error" });

    const passage = pJson.data;
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    const osis = passage.osis || "";

    // MINI — simple
    if (mode === "mini") {
      const one = await generateOnce({
        mode,
        reference, translation, osis, passageText: passage.passageText || "",
        maxtok: Number.isFinite(maxtok) ? maxtok : 900,
        timeoutMs: timeout
      });
      const parsed = one.text ? safeParseJson(one.text) : null;
      if (!parsed || !parsed.meta || !Array.isArray(parsed.sections)) {
        if (debug) return json({ ok: false, error: "Sortie OpenAI non-JSON (mini).", debug: { raw: one.raw } });
        return json({ ok: false, error: "Sortie OpenAI non-JSON (mini)." });
      }
      parsed.meta.book = parsed.meta.book || String(book);
      parsed.meta.chapter = parsed.meta.chapter || String(chapter);
      parsed.meta.verse = parsed.meta.verse ?? String(verse || "");
      parsed.meta.translation = parsed.meta.translation || String(translation);
      parsed.meta.reference = parsed.meta.reference || reference;
      parsed.meta.osis = parsed.meta.osis || osis;
      return json({ ok: true, data: parsed });
    }

    // FULL — tentative 1 shot
    const oneShot = await generateOnce({
      mode,
      reference, translation, osis, passageText: passage.passageText || "",
      maxtok: Number.isFinite(maxtok) ? maxtok : 3500,
      timeoutMs: timeout
    });

    let parsed = oneShot.text ? safeParseJson(oneShot.text) : null;

    // si coupé/non JSON → bascule en 2 passes
    if (!parsed || !parsed.meta || !Array.isArray(parsed.sections) || oneShot.incomplete) {
      const paged = await generateFullPaged(
        {
          mode,
          reference, translation, osis, passageText: passage.passageText || "",
          meta: { book, chapter, verse: verse || "", translation, reference, osis }
        },
        timeout
      );

      if (!paged.parsed) {
        if (debug) return json({
          ok: false,
          error: "Sortie OpenAI non-JSON (full, paged).",
          debug: { oneShot: oneShot.raw, paged: paged.raw }
        });
        return json({ ok: false, error: "Sortie OpenAI non-JSON (full)." });
      }
      parsed = paged.parsed;
    }

    // compléter meta
    parsed.meta.book = parsed.meta.book || String(book);
    parsed.meta.chapter = parsed.meta.chapter || String(chapter);
    parsed.meta.verse = parsed.meta.verse ?? String(verse || "");
    parsed.meta.translation = parsed.meta.translation || String(translation);
    parsed.meta.reference = parsed.meta.reference || reference;
    parsed.meta.osis = parsed.meta.osis || osis;

    return json({ ok: true, data: parsed });
  } catch (e) {
    return json({ ok: false, error: String(e) });
  }
}

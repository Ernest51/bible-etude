// api/study-28.js
import { NextResponse } from "next/server";

// ---------- CONFIG ----------
export const config = { runtime: "nodejs" };
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// Moins de jetons / passe pour éviter incomplete
const TOKENS_PER_PASS = 600; // ~600 suffit pour 7 sections compactes
const WORDS_PER_SECTION = "35–45"; // sections plus courtes

// ---------- JSON SCHEMAS ----------
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

function sectionSchema(start, end) {
  const enums = Array.from({ length: end - start + 1 }, (_, i) => start + i);
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      index: { type: "integer", enum: enums },
      title: { type: "string" },
      content: { type: "string" },
      verses: { type: "array", items: { type: "string" } }
    },
    required: ["index", "title", "content", "verses"]
  };
}

function fullSchema(start, end) {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: META_SCHEMA,
      sections: { type: "array", items: sectionSchema(start, end) }
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

// ---------- PROMPTS ----------
function sysPrompt(mode, range) {
  const slice = range ? ` Génère UNIQUEMENT les sections ${range[0]} à ${range[1]}.` : "";
  return (
    "Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON conforme au schéma." +
    " Langue: français. N'invente pas de versets. Cite uniquement le passage fourni." +
    (mode === "mini" ? " Format MINI: exactement 3 sections." : " Format FULL: exactement 28 sections au total.") +
    ` Chaque section ≈${WORDS_PER_SECTION} mots, style direct, sans puces.` +
    slice +
    " Réponds UNIQUEMENT par l'objet JSON."
  );
}

function userPrompt(ctx) {
  const { reference, translation, osis, passageText, mode, range } = ctx;
  const head = `Passage : ${reference} (${translation})\nOSIS : ${osis || ""}`;
  const body = "Texte :\n```\n" + passageText + "\n```";

  const titlesFull = [
    "1. Thème central","2. Résumé en une phrase","3. Contexte historique","4. Auteur et date",
    "5. Genre littéraire","6. Structure du passage","7. Plan détaillé","8. Mots-clés",
    "9. Termes clés (définis)","10. Personnages et lieux","11. Problème / Question de départ",
    "12. Idées majeures (développement)","13. Verset pivot (climax)","14. Références croisées (AT)",
    "15. Références croisées (NT)","16. Parallèles bibliques","17. Lien avec l’Évangile (Christocentrique)",
    "18. Vérités doctrinales (3–5)","19. Promesses et avertissements","20. Principes intemporels",
    "21. Applications personnelles (3–5)","22. Applications communautaires","23. Questions pour petits groupes (6)",
    "24. Prière guidée","25. Méditation courte","26. Versets à mémoriser (2–3)",
    "27. Difficultés/objections & réponses","28. Ressources complémentaires"
  ];
  const titlesMini = [
    "1. Thème central","2. Idées majeures (développement)","3. Applications personnelles"
  ];
  const titles = (mode === "mini" ? titlesMini : titlesFull).filter(t => {
    if (!range) return true;
    const i = parseInt(t.split(".")[0], 10);
    return i >= range[0] && i <= range[1];
  });

  const constraints = [
    "Contraintes :",
    "- EXACTEMENT le nombre de sections attendu pour l'intervalle demandé.",
    "- Chaque section contient: index, title, content (≈" + WORDS_PER_SECTION + " mots), verses (string[]).",
    "- Utilise UNIQUEMENT le passage fourni."
  ];

  return [head, body, "", "Titres attendus :", ...titles, "", ...constraints].join("\n");
}

// ---------- HELPERS ----------
function respond(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function safeParseJson(txt) {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch {}
  const i = txt.indexOf("{");
  const j = txt.lastIndexOf("}");
  if (i >= 0 && j > i) {
    try { return JSON.parse(txt.slice(i, j + 1)); } catch {}
  }
  return null;
}

// ---------- OPENAI ADAPTATIF ----------
async function callOpenAIAdaptive({ sys, user, schemaName, schemaObj, tokens, timeoutMs }) {
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${OPENAI_API_KEY}`
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(5000, timeoutMs || 30000));
  const signal = controller.signal;

  const attempts = [];

  // A) Responses API (format objet)
  attempts.push({
    endpoint: "https://api.openai.com/v1/responses",
    body: {
      model: MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          schema: schemaObj,
          strict: true
        }
      },
      temperature: 0.1,
      max_output_tokens: tokens
    },
    extractor: raw => {
      const out = [];
      if (typeof raw.output_text === "string") out.push(raw.output_text);
      if (Array.isArray(raw.output)) {
        for (const msg of raw.output) {
          if (Array.isArray(msg.content)) {
            for (const c of msg.content) {
              if (typeof c?.text === "string") out.push(c.text);
              if (typeof c?.output_text === "string") out.push(c.output_text);
            }
          }
        }
      }
      return out.join("\n").trim();
    }
  });

  // B) Responses API (legacy format)
  attempts.push({
    endpoint: "https://api.openai.com/v1/responses",
    body: {
      model: MODEL,
      input: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      text: {
        format: "json_schema",
        json_schema: {
          name: schemaName,
          schema: schemaObj,
          strict: true
        }
      },
      temperature: 0.1,
      max_output_tokens: tokens
    },
    extractor: raw => {
      const out = [];
      if (typeof raw.output_text === "string") out.push(raw.output_text);
      if (Array.isArray(raw.output)) {
        for (const msg of raw.output) {
          if (Array.isArray(msg.content)) {
            for (const c of msg.content) {
              if (typeof c?.text === "string") out.push(c.text);
              if (typeof c?.output_text === "string") out.push(c.output_text);
            }
          }
        }
      }
      return out.join("\n").trim();
    }
  });

  // C) Chat Completions fallback
  attempts.push({
    endpoint: "https://api.openai.com/v1/chat/completions",
    body: {
      model: MODEL,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user }
      ],
      temperature: 0.1,
      max_tokens: tokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          schema: schemaObj,
          strict: true
        }
      }
    },
    extractor: raw => raw?.choices?.[0]?.message?.content || ""
  });

  let lastErr = null;
  for (const att of attempts) {
    try {
      const r = await fetch(att.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(att.body),
        signal
      });
      if (!r.ok) {
        lastErr = new Error(`OpenAI ${r.status}: ${await r.text()}`);
        continue;
      }
      const raw = await r.json();
      const text = att.extractor(raw);
      const parsed = safeParseJson(text);
      clearTimeout(timer);
      return { ok: true, raw, text, parsed };
    } catch (e) {
      lastErr = e;
      continue;
    }
  }
  clearTimeout(timer);
  return { ok: false, error: String(lastErr) };
}

// ---------- GENERATION ----------
async function genMini(ctx, timeoutMs) {
  const sys = sysPrompt("mini");
  const user = userPrompt({ ...ctx, mode: "mini" });
  return await callOpenAIAdaptive({
    sys,
    user,
    schemaName: "study_28_mini",
    schemaObj: miniSchema(),
    tokens: TOKENS_PER_PASS,
    timeoutMs
  });
}

async function genFullSlice(ctx, range, timeoutMs) {
  const sys = sysPrompt("full", range);
  const user = userPrompt({ ...ctx, mode: "full", range });
  return await callOpenAIAdaptive({
    sys,
    user,
    schemaName: `study_28_${range[0]}_${range[1]}`,
    schemaObj: fullSchema(range[0], range[1]),
    tokens: TOKENS_PER_PASS,
    timeoutMs
  });
}

async function genFullFourPass(ctx, timeoutMs) {
  const ranges = [[1,7],[8,14],[15,21],[22,28]];
  const parts = [];
  const debug = {};
  for (const rg of ranges) {
    const r = await genFullSlice(ctx, rg, timeoutMs);
    debug[`p${rg[0]}_${rg[1]}`] = r.raw || r.error || null;
    if (!r.ok || !r.parsed?.sections) {
      return { ok: false, debug };
    }
    parts.push(r.parsed);
  }
  // Fusion
  const meta = parts[0].meta || {
    book: ctx.book, chapter: ctx.chapter, verse: ctx.verse || "",
    translation: ctx.translation, reference: ctx.reference, osis: ctx.osis || ""
  };
  const sections = parts.flatMap(p => p.sections).sort((a,b)=>a.index-b.index);
  if (sections.length !== 28) {
    return { ok: false, debug: { ...debug, mergedCount: sections.length } };
  }
  return { ok: true, data: { meta, sections }, debug };
}

// ---------- ROUTE ----------
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = (searchParams.get("mode") || "full").toLowerCase(); // mini | full
  const dry = searchParams.get("dry") || "";
  const debug = searchParams.get("debug") === "1";
  const selftest = searchParams.get("selftest") === "1";
  const timeout = parseInt(searchParams.get("oaitimeout") || "30000", 10);

  try {
    if (selftest) {
      return respond({
        ok: true,
        version: "study-28@adaptive-4pass",
        model: MODEL,
        tokensPerPass: TOKENS_PER_PASS,
        wordsPerSection: WORDS_PER_SECTION
      });
    }

    if (!OPENAI_API_KEY) {
      return respond({ ok: false, error: "OPENAI_API_KEY manquante." }, 500);
    }

    // DRY pour UI
    if (dry) {
      const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
      if (mode === "mini") {
        return respond({
          ok: true,
          data: {
            meta: { book, chapter, verse, translation, reference, osis: "" },
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
          meta: { book, chapter, verse, translation, reference, osis: "" },
          sections: Array.from({ length: 28 }, (_, i) => ({
            index: i + 1, title: `Section ${i + 1}`, content: "Exemple FULL.", verses: []
          }))
        }
      });
    }

    // Passage (serveur->serveur)
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) return respond({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${await pRes.text()}` }, 502);
    const pJson = await pRes.json();
    if (!pJson.ok) return respond({ ok: false, error: pJson.error || "BibleProvider error" }, 502);

    const passage = pJson.data;
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    const ctx = {
      book, chapter, verse, translation, reference,
      osis: passage.osis || "",
      passageText: passage.passageText || ""
    };

    if (mode === "mini") {
      const r = await genMini(ctx, timeout);
      if (!r.ok || !r.parsed?.sections) {
        return respond(debug
          ? { ok: false, error: "Sortie OpenAI non-JSON (mini).", debug: r }
          : { ok: false, error: "Sortie OpenAI non-JSON (mini)." }, 502);
      }
      // compléter meta
      r.parsed.meta = r.parsed.meta || {};
      r.parsed.meta.book = r.parsed.meta.book || String(book);
      r.parsed.meta.chapter = r.parsed.meta.chapter || String(chapter);
      r.parsed.meta.verse = r.parsed.meta.verse ?? String(verse || "");
      r.parsed.meta.translation = r.parsed.meta.translation || String(translation);
      r.parsed.meta.reference = r.parsed.meta.reference || reference;
      r.parsed.meta.osis = r.parsed.meta.osis || ctx.osis;
      return respond({ ok: true, data: r.parsed });
    }

    // FULL → 4 passes
    const four = await genFullFourPass(ctx, timeout);
    if (!four.ok) {
      return respond(debug
        ? { ok: false, error: "Sortie OpenAI non-JSON (full).", debug: four.debug }
        : { ok: false, error: "Sortie OpenAI non-JSON (full)." }, 502);
    }
    // compléter meta
    four.data.meta.book = four.data.meta.book || String(book);
    four.data.meta.chapter = four.data.meta.chapter || String(chapter);
    four.data.meta.verse = four.data.meta.verse ?? String(verse || "");
    four.data.meta.translation = four.data.meta.translation || String(translation);
    four.data.meta.reference = four.data.meta.reference || reference;
    four.data.meta.osis = four.data.meta.osis || ctx.osis;

    // Sanity check final: 28 sections, index 1..28
    const idxs = new Set(four.data.sections.map(s => s.index));
    if (four.data.sections.length !== 28 || idxs.size !== 28 || !idxs.has(1) || !idxs.has(28)) {
      return respond({ ok: false, error: "Assemblage incomplet des 28 sections (full)." }, 502);
    }

    return respond({ ok: true, data: four.data });
  } catch (e) {
    return respond({ ok: false, error: String(e) }, 500);
  }
}

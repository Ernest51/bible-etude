// api/study-28.js
import { NextResponse } from "next/server";

export const config = { runtime: "nodejs" }; // Serverless (pas Edge)

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL =
  process.env.OPENAI_MODEL || "gpt-4.1-mini"; // compatible Responses API

// ---------- Schéma JSON strict pour 28 sections ----------
const STUDY_SCHEMA = {
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
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          title: { type: "string" },
          content: { type: "string" },
          verses: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["index", "title", "content", "verses"]
      }
    }
  },
  required: ["meta", "sections"]
};

// ---------- petits utilitaires ----------
function asJson(obj, status = 200) {
  return NextResponse.json(obj, { status });
}

function buildSystemPrompt(mode) {
  const isMini = mode === "mini";
  return [
    "Tu es un bibliste pédagogue.",
    isMini
      ? "Produit une synthèse **court format** (3 sections) conforme au schéma JSON strict fourni."
      : "Produit une étude **complète** en **28 sections** conforme au schéma JSON strict fourni.",
    "Langue: français. Ton pastoral mais rigoureux.",
    "Ne réécris pas le passage biblique intégral, résume et structure. N'invente pas d'autres versets que le passage fourni.",
  ].join(" ");
}

function buildUserPrompt({ reference, translation, passageText, mode }) {
  const header = `Passage: ${reference} (${translation})`;
  const body = "Texte (source unique pour l’analyse):\n```\n" + passageText + "\n```";

  if (mode === "mini") {
    return [
      header,
      body,
      "",
      "Produit une **synthèse courte** conforme au schéma JSON (3 sections fixes):",
      "- 1) Thème central",
      "- 2) Idées majeures (développement)",
      "- 3) Applications personnelles",
      "Respecte exactement les clés demandées par le schéma.",
    ].join("\n");
  }

  // full (28)
  return [
    header,
    body,
    "",
    "Produit une **étude complète** en **28 sections**. Les titres attendus :",
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
    "28. Ressources complémentaires",
    "",
    "Respecte exactement les clés demandées par le schéma.",
  ].join("\n");
}

// ---------- OpenAI call (Responses API v1) ----------
async function callOpenAI({ sys, user, maxtok = 1500, timeoutMs = 30000, debug = false }) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  // format pour forcer un JSON strict selon le schéma
  const textFormat = {
    name: "json_schema",
    strict: true,
    schema: {
      name: "study_28",
      schema: STUDY_SCHEMA
    }
  };

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    text: {
      format: textFormat
    },
    temperature: 0.1,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(400, maxtok) : 1500
  };

  let raw;
  try {
    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!r.ok) {
      const errText = await r.text();
      const msg = `OpenAI ${r.status}: ${errText}`;
      throw new Error(msg);
    }

    raw = await r.json();

    // 1) voie rapide : output_text (champ pratique des Responses)
    if (typeof raw.output_text === "string" && raw.output_text.trim()) {
      return { parsed: safeParseJson(raw.output_text), raw };
    }

    // 2) concatène tous les blocs de texte
    const textChunks =
      Array.isArray(raw.output)
        ? raw.output.flatMap(item =>
            Array.isArray(item.content)
              ? item.content
                  .filter(c => c && (typeof c.text === "string" || typeof c.output_text === "string"))
                  .map(c => c.text ?? c.output_text)
              : []
          )
        : [];

    const allText = textChunks.join("\n").trim();

    if (allText) {
      return { parsed: safeParseJson(allText), raw };
    }

    // 3) rien de textuel -> erreur
    return { parsed: null, raw };
  } catch (err) {
    clearTimeout(timer);
    const prefix = err.name === "AbortError" ? "OpenAI fetch error: This operation was aborted" : String(err);
    if (debug) {
      throw new Error(prefix + (raw ? ` | raw=${JSON.stringify(raw).slice(0, 1200)}` : ""));
    }
    throw new Error(prefix);
  }
}

function safeParseJson(txt) {
  // tentative directe
  try {
    return JSON.parse(txt);
  } catch (_) {
    // essaie d’extraire le plus grand bloc {...} JSON
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      const slice = txt.slice(i, j + 1);
      try {
        return JSON.parse(slice);
      } catch (_) {
        return null;
      }
    }
    return null;
  }
}

// ---------- Handler ----------
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = (searchParams.get("mode") || "full").toLowerCase(); // "mini" | "full"
  const maxtok = parseInt(searchParams.get("maxtok") || "1500", 10);
  const timeout = parseInt(searchParams.get("oaitimeout") || "30000", 10);
  const dry = searchParams.get("dry") || "";
  const debug = searchParams.get("debug") === "1";

  try {
    // 1) dry-run (pour tests UI)
    if (dry) {
      if (mode === "mini") {
        return asJson({
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
      // full
      return asJson({
        ok: true,
        data: {
          meta: {
            book, chapter, verse, translation,
            reference: verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`,
            osis: ""
          },
          sections: Array.from({ length: 28 }, (_, k) => ({
            index: k + 1,
            title: `Section ${k + 1}`,
            content: "Exemple FULL.",
            verses: []
          }))
        }
      });
    }

    // 2) on va chercher le passage côté serveur via /api/bibleProvider
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl = `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(
      chapter
    )}${verse ? `&verse=${encodeURIComponent(verse)}` : ""}${bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : ""}`;

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) {
      const msg = await pRes.text();
      return asJson({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${msg}` }, 200);
    }
    const pJson = await pRes.json();
    if (!pJson.ok) {
      return asJson({ ok: false, error: pJson.error || "BibleProvider error" }, 200);
    }

    const passage = pJson.data;
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;

    // 3) prompts
    const sys = buildSystemPrompt(mode);
    const user = buildUserPrompt({
      reference,
      translation,
      passageText: passage.passageText || "",
      mode
    });

    // 4) Appel OpenAI
    const { parsed, raw } = await callOpenAI({
      sys,
      user,
      maxtok,
      timeoutMs: timeout,
      debug
    });

    if (!parsed || !parsed.meta || !Array.isArray(parsed.sections)) {
      if (debug) {
        return asJson({
          ok: false,
          error: "Sortie OpenAI non-JSON (ou invalide).",
          rawOpenAI: raw
        });
      }
      return asJson({ ok: false, error: `Sortie OpenAI non-JSON (${mode}).` }, 200);
    }

    // 5) compléter meta si vide
    parsed.meta.book = parsed.meta.book || String(book);
    parsed.meta.chapter = parsed.meta.chapter || String(chapter);
    parsed.meta.verse = parsed.meta.verse ?? String(verse || "");
    parsed.meta.translation = parsed.meta.translation || String(translation);
    parsed.meta.reference = parsed.meta.reference || reference;
    parsed.meta.osis = parsed.meta.osis || (passage.osis || "");

    return asJson({ ok: true, data: parsed });
  } catch (err) {
    return asJson({ ok: false, error: String(err) }, 200);
  }
}

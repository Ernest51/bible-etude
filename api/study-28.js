// api/study-28.js
import { NextResponse } from "next/server";

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// Choisis un modèle Responses API (ex: gpt-4.1-mini, gpt-4o-mini-2024-07-18, o4-mini)
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// ---------- Schéma JSON strict -----------
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
          verses: { type: "array", items: { type: "string" } }
        },
        required: ["index", "title", "content", "verses"]
      }
    }
  },
  required: ["meta", "sections"]
};

function json(res, status = 200) {
  return NextResponse.json(res, { status });
}

function sysPrompt(mode) {
  const isMini = mode === "mini";
  return [
    "Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON conforme au schéma fourni.",
    "Langue: français. Ton pastoral mais rigoureux. N'invente pas de versets.",
    isMini
      ? "Format MINI: exactement 3 sections. 90–120 mots max par section."
      : "Format FULL: exactement 28 sections. 90–120 mots max par section. Sois concis.",
    "Respecte le schéma strict (clés, types)."
  ].join(" ");
}

function userPrompt({ reference, translation, osis, passageText, mode }) {
  const header = `Passage : ${reference} (${translation})\nOSIS : ${osis || ""}`;
  const body = "Texte (source unique) :\n```\n" + passageText + "\n```";
  const sections =
    mode === "mini"
      ? [
          "1. Thème central",
          "2. Idées majeures (développement)",
          "3. Applications personnelles"
        ]
      : [
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

  const constraints = [
    "Contraintes :",
    "- EXACTEMENT le nombre de sections attendu selon le mode.",
    "- Chaque section contient: index (1..N), title, content (90–120 mots), verses (tableau de chaînes).",
    "- Réponds UNIQUEMENT par l’objet JSON final (pas de texte autour)."
  ];

  return [header, body, "", "Titres attendus :", ...sections, "", ...constraints].join("\n");
}

function makeTextFormat() {
  return {
    name: "json_schema",
    strict: true,
    schema: { name: "study_28", schema: STUDY_SCHEMA }
  };
}

function safeParseJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    const i = txt.indexOf("{");
    const j = txt.lastIndexOf("}");
    if (i >= 0 && j > i) {
      try {
        return JSON.parse(txt.slice(i, j + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callOpenAIOnce({ sys, user, maxtok, timeoutMs }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs || 30000));

  const body = {
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user }
    ],
    text: { format: makeTextFormat() },
    temperature: 0.12,
    max_output_tokens: Math.max(800, Number.isFinite(maxtok) ? maxtok : 3500)
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
      signal: ctrl.signal
    });

    clearTimeout(timer);

    if (!r.ok) {
      throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
    }
    raw = await r.json();

    // voie courte
    if (typeof raw.output_text === "string" && raw.output_text.trim()) {
      return { raw, text: raw.output_text, incomplete: raw.status === "incomplete" };
    }

    // concat des blocs
    const chunks = Array.isArray(raw.output)
      ? raw.output.flatMap(msg =>
          Array.isArray(msg.content)
            ? msg.content
                .filter(c => typeof c?.text === "string" || typeof c?.output_text === "string")
                .map(c => c.text ?? c.output_text)
            : []
        )
      : [];
    const text = chunks.join("\n").trim();
    return { raw, text, incomplete: raw.status === "incomplete" };
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function callOpenAIAdaptive({ sys, user, mode, maxtok, timeoutMs }) {
  // stratégie : pour FULL, par défaut 3500 ; pour MINI, 900 ; on remonte si incomplete/max_output_tokens
  const initialTok = Number.isFinite(maxtok)
    ? maxtok
    : mode === "mini"
    ? 900
    : 3500;

  let attempt = await callOpenAIOnce({ sys, user, maxtok: initialTok, timeoutMs });
  let parsed = attempt.text ? safeParseJson(attempt.text) : null;

  // si incomplet pour cause de max_output_tokens : on retente une fois +2000 (limite 6000)
  const reason = attempt.raw?.incomplete_details?.reason;
  if ((!parsed || attempt.incomplete) && reason === "max_output_tokens") {
    const bump = Math.min((initialTok || 0) + 2000, 6000);
    attempt = await callOpenAIOnce({ sys, user, maxtok: bump, timeoutMs });
    parsed = attempt.text ? safeParseJson(attempt.text) : null;
  }

  return { parsed, raw: attempt.raw };
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
    if (!OPENAI_API_KEY) {
      return json({ ok: false, error: "OPENAI_API_KEY manquante." });
    }

    // --- DRY RUN pour tests UI ---
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

    // --- fetch passage via bibleProvider ---
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) {
      return json({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${await pRes.text()}` });
    }
    const pJson = await pRes.json();
    if (!pJson.ok) {
      return json({ ok: false, error: pJson.error || "BibleProvider error" });
    }

    const passage = pJson.data;
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    const osis = passage.osis || "";

    const sys = sysPrompt(mode);
    const user = userPrompt({
      reference, translation, osis, passageText: passage.passageText || "", mode
    });

    const { parsed, raw } = await callOpenAIAdaptive({
      sys,
      user,
      mode,
      // si full et pas de maxtok explicite, on pousse à 3500
      maxtok: Number.isFinite(maxtok) ? maxtok : (mode === "full" ? 3500 : 900),
      timeoutMs: timeout
    });

    if (!parsed || !parsed.meta || !Array.isArray(parsed.sections)) {
      if (debug) {
        return json({ ok: false, error: "Sortie OpenAI non-JSON (full).", debug: { raw } });
      }
      return json({ ok: false, error: `Sortie OpenAI non-JSON (${mode}).` });
    }

    // compléter meta si besoin
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

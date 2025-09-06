// api/study-28.js
import { NextResponse } from "next/server";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";

// --- Schéma JSON pour 28 sections ---
const schema = {
  name: "study_28",
  schema: {
    type: "object",
    properties: {
      meta: {
        type: "object",
        properties: {
          book: { type: "string" },
          chapter: { type: "string" },
          verse: { type: "string" },
          translation: { type: "string" },
          reference: { type: "string" },
          osis: { type: "string" }
        },
        required: ["book", "chapter", "translation", "reference", "osis"]
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            title: { type: "string" },
            content: { type: "string" },
            verses: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["index", "title", "content"]
        }
      }
    },
    required: ["meta", "sections"]
  },
  strict: true
};

// --- Appel OpenAI ---
async function callOpenAI(sys, user, maxtok = 1500, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
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
      // seed: 7  ❌ supprimé car plus supporté
    };

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });

    clearTimeout(id);

    if (!r.ok) {
      const err = await r.text();
      throw new Error(`OpenAI ${r.status}: ${err}`);
    }

    const out = await r.json();
    return out.output[0]?.content[0]?.text
      ? JSON.parse(out.output[0].content[0].text)
      : null;
  } catch (err) {
    throw err;
  }
}

// --- Route handler ---
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = searchParams.get("mode") || "full";
  const maxtok = parseInt(searchParams.get("maxtok") || "1500", 10);
  const timeout = parseInt(searchParams.get("oaitimeout") || "30000", 10);

  try {
    // --- Récupère le passage biblique ---
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl = `${base}/api/bibleProvider?book=${encodeURIComponent(
      book
    )}&chapter=${chapter}${
      verse ? `&verse=${encodeURIComponent(verse)}` : ""
    }${bibleId ? `&bibleId=${bibleId}` : ""}`;

    const passageRes = await fetch(passageUrl);
    const passageJson = await passageRes.json();

    if (!passageJson.ok) {
      return NextResponse.json({ ok: false, error: passageJson.error });
    }

    const passage = passageJson.data;

    // --- Instructions pour OpenAI ---
    const sys = `Tu es un expert en théologie. 
Ta mission est de produire une étude biblique structurée en 28 sections (mode=${mode}).
Chaque section doit suivre le schéma JSON strict fourni.`;

    const user = `Passage : ${passage.reference} (${translation})
Texte : ${passage.passageText}`;

    // --- Appel OpenAI ---
    const parsed = await callOpenAI(sys, user, maxtok, timeout);

    if (!parsed) {
      return NextResponse.json({ ok: false, error: "Sortie OpenAI vide." });
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err) });
  }
}

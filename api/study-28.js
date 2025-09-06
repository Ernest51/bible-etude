// /api/study-28.js
import { NextResponse } from "next/server";

/** ========= RUNTIME =========
 *  Node = plus robuste (env vars, logs) qu'Edge pour ce cas
 */
export const runtime = "nodejs";

/** ========= CONFIG ========= */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// modèle par défaut = celui qui marche déjà chez toi via /api/oai-quick
const DEFAULT_MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

/** ========= SCHÉMA FULL (28 sections) ========= */
const schemaFull = {
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
            index:   { type: "integer" },
            title:   { type: "string" },
            content: { type: "string" },
            verses:  { type: "array", items: { type: "string" } }
          },
          required: ["index", "title", "content"]
        }
      }
    },
    required: ["meta", "sections"]
  },
  strict: true
};

/** ========= UTILS ========= */
function absoluteBaseUrl(req) {
  const host  = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function mkAbort(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs || 30000));
  return { controller, timer };
}

function okJson(data) {
  return NextResponse.json({ ok: true, data });
}
function errJson(error) {
  return NextResponse.json({ ok: false, error });
}

/** ========= OpenAI — mini (json_object) ========= */
async function callOpenAImini({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const { controller, timer } = mkAbort(timeoutMs);

  const body = {
    model,
    temperature: 0.15,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 700,
    text: { format: "json_object" },
    input: prompt
  };

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(debug ? `OpenAI ${r.status}: ${t}` : `OpenAI ${r.status}`);
  }

  const out = await r.json();

  if (out?.output_parsed) return out.output_parsed;

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return JSON.parse(out.output_text); } catch {}
  }

  const maybe = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybe === "string" && maybe.trim()) {
    try { return JSON.parse(maybe); } catch {
      throw new Error("Sortie OpenAI non-JSON (mini).");
    }
  }

  throw new Error("Sortie OpenAI vide (mini).");
}

/** ========= OpenAI — full (json_schema = 28 sec) ========= */
async function callOpenAIfull({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const { controller, timer } = mkAbort(timeoutMs);

  const body = {
    model,
    temperature: 0.12,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(900, maxtok) : 1500,
    text: { format: "json_schema", json_schema: schemaFull },
    input: prompt
  };

  let r;
  try {
    r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(debug ? `OpenAI ${r.status}: ${t}` : `OpenAI ${r.status}`);
  }

  const out = await r.json();

  if (out?.output_parsed) return out.output_parsed;

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return JSON.parse(out.output_text); } catch {}
  }

  const maybe = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybe === "string" && maybe.trim()) {
    try { return JSON.parse(maybe); } catch {
      throw new Error("Sortie OpenAI non-JSON (full).");
    }
  }

  throw new Error("Sortie OpenAI vide (full).");
}

/** ========= ROUTE ========= */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const book        = searchParams.get("book")        || "Genèse";
    const chapter     = searchParams.get("chapter")     || "1";
    const verse       = searchParams.get("verse")       || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId     = searchParams.get("bibleId")     || "";
    const mode        = (searchParams.get("mode") || "full").toLowerCase(); // mini | full
    const model       = searchParams.get("model") || DEFAULT_MODEL;
    const maxtok      = parseInt(searchParams.get("maxtok") || (mode === "mini" ? "700" : "1500"), 10);
    const timeout     = parseInt(searchParams.get("oaitimeout") || "30000", 10);
    const debug       = searchParams.get("debug") === "1";

    // 1) Passage (via notre API locale)
    const base = absoluteBaseUrl(req);
    const url =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}` +
      `&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(url, { headers: { Accept: "application/json" } });
    if (!pRes.ok) {
      const t = await pRes.text().catch(() => "");
      return errJson(`BibleProvider ${pRes.status}: ${t}`);
    }
    const pJson = await pRes.json().catch(() => null);
    if (!pJson?.ok || !pJson?.data?.passageText) {
      return errJson(pJson?.error || "BibleProvider: réponse invalide.");
    }
    const passage = pJson.data;

    // 2) Prompt
    const must28 = mode === "full";
    const header =
`Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON ${must28 ? "(schéma 28 sections)" : "(3 sections)"}.
Langue: français. N'invente pas de versets. Cite uniquement le passage fourni.`;

    const guideFull =
`Structure 28 sections (index 1..28, titres exacts) :
1.Thème central
2.Résumé en une phrase
3.Contexte historique
4.Auteur et date
5.Genre littéraire
6.Structure du passage
7.Plan détaillé
8.Mots-clés
9.Termes clés (définis)
10.Personnages et lieux
11.Problème / Question de départ
12.Idées majeures (développement)
13.Verset pivot (climax)
14.Références croisées (AT)
15.Références croisées (NT)
16.Parallèles bibliques
17.Lien avec l’Évangile (Christocentrique)
18.Vérités doctrinales (3–5)
19.Promesses et avertissements
20.Principes intemporels
21.Applications personnelles (3–5)
22.Applications communautaires
23.Questions pour petits groupes (6)
24.Prière guidée
25.Méditation courte
26.Versets à mémoriser (2–3)
27.Difficultés/objections & réponses
28.Ressources complémentaires`;

    const guideMini =
`Structure 3 sections EXACTES :
1) Thème central
2) Idées majeures (développement)
3) Applications personnelles`;

    const schemaHint =
`Schéma JSON :
{
  "meta": { "book": string, "chapter": string, "verse": string, "translation": string, "reference": string, "osis": string },
  "sections": [ { "index": number, "title": string, "content": string, "verses": string[]? }, ... ]
}
Réponds UNIQUEMENT par l'objet JSON.`;

    const prompt =
`${header}

Passage : ${passage.reference} (${translation})
OSIS : ${passage.osis}

Texte (entre triples backticks) :
\`\`\`
${passage.passageText}
\`\`\`

Contraintes :
${must28 ? guideFull : guideMini}

${schemaHint}`;

    // 3) Appel OpenAI selon mode
    const parsed = must28
      ? await callOpenAIfull({ model, prompt, maxtok, timeoutMs: timeout, debug })
      : await callOpenAImini({ model, prompt, maxtok, timeoutMs: timeout, debug });

    // 4) Compléter meta
    parsed.meta = {
      book,
      chapter,
      verse,
      translation,
      reference: passage.reference,
      osis: passage.osis,
      ...(parsed.meta || {})
    };

    // 5) Validation stricte pour full
    if (must28) {
      if (!Array.isArray(parsed.sections)) {
        return errJson("Le modèle n’a pas renvoyé de tableau 'sections'.");
      }
      if (parsed.sections.length !== 28) {
        return errJson(`Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`);
      }
    }

    return okJson(parsed);

  } catch (e) {
    return errJson(String(e?.message || e));
  }
}

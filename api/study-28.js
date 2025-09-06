// /api/study-28.js
import { NextResponse } from "next/server";

/** ===== Runtime ===== */
export const runtime = "edge";

/** ====== CONFIG ====== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4.1";

/** ====== SCHEMA 28 sections (mode full) ====== */
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

/** ====== Utils ====== */
function absoluteBaseUrl(req) {
  const host  = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return "http://localhost:3000";
}

function mkAbort(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));
  return { controller, timer };
}

/** ====== OpenAI — mode MINI (json_object) ====== */
async function callOpenAImini({ prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante dans les variables d’environnement.");

  const { controller, timer } = mkAbort(timeoutMs);

  const body = {
    model: OPENAI_MODEL,
    temperature: 0.15,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 700,
    text: { format: "json_object" },
    input: prompt
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  }).catch((e) => {
    clearTimeout(timer);
    throw e;
  });

  clearTimeout(timer);

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(debug ? `OpenAI ${r.status}: ${errText}` : `OpenAI ${r.status}`);
  }

  const out = await r.json();

  if (out?.output_parsed) return out.output_parsed;

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return JSON.parse(out.output_text); } catch {}
  }

  const maybeText = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybeText === "string" && maybeText.trim()) {
    try { return JSON.parse(maybeText); } catch {
      throw new Error("Sortie OpenAI non-JSON (mini).");
    }
  }

  throw new Error("Sortie OpenAI vide (mini).");
}

/** ====== OpenAI — mode FULL (json_schema) ====== */
async function callOpenAIfull({ prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante dans les variables d’environnement.");

  const { controller, timer } = mkAbort(timeoutMs);

  const body = {
    model: OPENAI_MODEL,
    temperature: 0.12,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(800, maxtok) : 1500,
    text: {
      format: "json_schema",
      json_schema: schemaFull
    },
    input: prompt
  };

  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body),
    signal: controller.signal
  }).catch((e) => {
    clearTimeout(timer);
    throw e;
  });

  clearTimeout(timer);

  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    throw new Error(debug ? `OpenAI ${r.status}: ${errText}` : `OpenAI ${r.status}`);
  }

  const out = await r.json();

  if (out?.output_parsed) return out.output_parsed;

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return JSON.parse(out.output_text); } catch {}
  }

  const maybeText = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybeText === "string" && maybeText.trim()) {
    try { return JSON.parse(maybeText); } catch {
      throw new Error("Sortie OpenAI non-JSON (full).");
    }
  }

  throw new Error("Sortie OpenAI vide (full).");
}

/** ====== Route handler ====== */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const book        = searchParams.get("book")        || "Genèse";
    const chapter     = searchParams.get("chapter")     || "1";
    const verse       = searchParams.get("verse")       || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId     = searchParams.get("bibleId")     || "";
    const mode        = (searchParams.get("mode") || "full").toLowerCase(); // "mini" | "full"
    const maxtok      = parseInt(searchParams.get("maxtok") || (mode === "mini" ? "700" : "1500"), 10);
    const timeout     = parseInt(searchParams.get("oaitimeout") || "30000", 10);
    const debug       = searchParams.get("debug") === "1";

    // 1) Passage via notre provider (même domaine)
    const base = absoluteBaseUrl(req);
    const url =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}` +
      `&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(url, { headers: { Accept: "application/json" } });
    if (!pRes.ok) {
      const t = await pRes.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `BibleProvider ${pRes.status}: ${t}` });
    }
    const pJson = await pRes.json().catch(() => null);
    if (!pJson?.ok || !pJson?.data?.passageText) {
      return NextResponse.json({ ok: false, error: pJson?.error || "BibleProvider: réponse invalide." });
    }

    const passage = pJson.data; // { reference, osis, passageText }

    // 2) Prompt unique (texte) → stable et compatible
    const must28 = mode === "full";
    const header =
      `Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON ${must28 ? "(schéma 28 sections)" : "(3 sections)"}.\n` +
      `Langue: français. Ton: pastoral et rigoureux. N'invente pas de versets, cite seulement le passage fourni.\n`;

    const guideFull =
      `Structure 28 sections (index 1..28) et titres exacts:\n` +
      `1.Thème central\n2.Résumé en une phrase\n3.Contexte historique\n4.Auteur et date\n5.Genre littéraire\n6.Structure du passage\n7.Plan détaillé\n8.Mots-clés\n9.Termes clés (définis)\n10.Personnages et lieux\n11.Problème / Question de départ\n12.Idées majeures (développement)\n13.Verset pivot (climax)\n14.Références croisées (AT)\n15.Références croisées (NT)\n16.Parallèles bibliques\n17.Lien avec l’Évangile (Christocentrique)\n18.Vérités doctrinales (3–5)\n19.Promesses et avertissements\n20.Principes intemporels\n21.Applications personnelles (3–5)\n22.Applications communautaires\n23.Questions pour petits groupes (6)\n24.Prière guidée\n25.Méditation courte\n26.Versets à mémoriser (2–3)\n27.Difficultés/objections & réponses\n28.Ressources complémentaires\n`;

    const guideMini =
      `Structure 3 sections EXACTES:\n1) Thème central\n2) Idées majeures (développement)\n3) Applications personnelles\n`;

    const schemaHint =
      `Schéma JSON attendu:\n` +
      `{\n  "meta": { "book": string, "chapter": string, "verse": string, "translation": string, "reference": string, "osis": string },\n` +
      `  "sections": [ { "index": number, "title": string, "content": string, "verses": string[]? }, ... ]\n}\n`;

    const prompt =
`${header}
Passage: ${passage.reference} (${translation})
OSIS: ${passage.osis}

Texte (source unique entre triples backticks):
\`\`\`
${passage.passageText}
\`\`\`

Contraintes:
${must28 ? guideFull : guideMini}
${schemaHint}
-> Réponds UNIQUEMENT avec l'objet JSON, aucun texte hors JSON.`;

    // 3) Appel OpenAI selon mode
    const parsed = must28
      ? await callOpenAIfull({ prompt, maxtok, timeoutMs: timeout, debug })
      : await callOpenAImini({ prompt, maxtok, timeoutMs: timeout, debug });

    // 4) Complète le bloc meta si besoin
    if (!parsed.meta) parsed.meta = {};
    parsed.meta.book        = parsed.meta.book        || book;
    parsed.meta.chapter     = parsed.meta.chapter     || chapter;
    parsed.meta.verse       = parsed.meta.verse       || verse;
    parsed.meta.translation = parsed.meta.translation || translation;
    parsed.meta.reference   = parsed.meta.reference   || passage.reference;
    parsed.meta.osis        = parsed.meta.osis        || passage.osis;

    // 5) En mode full, exige 28 sections
    if (must28) {
      if (!Array.isArray(parsed.sections)) {
        return NextResponse.json({ ok: false, error: "Le modèle n’a pas renvoyé de tableau sections." });
      }
      if (parsed.sections.length !== 28) {
        return NextResponse.json({
          ok: false,
          error: `Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`
        });
      }
    }

    return NextResponse.json({ ok: true, data: parsed });

  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) });
  }
}

// api/study-28.js
import { NextResponse } from "next/server";

/**
 * CONFIG
 */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4.1";

/**
 * Schéma JSON attendu (28 sections)
 * NB: On ne force pas explicitement la longueur à 28 ici (c’est le prompt qui l’impose),
 *     mais la structure est strictement contrôlée.
 */
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

/**
 * Appel OpenAI Responses API
 * - Utilise text.format=json_schema
 * - Parse d’abord `output_parsed`, sinon on tente `output_text`
 */
async function callOpenAI(sys, user, maxtok = 1500, timeoutMs = 30000) {
  if (!OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante dans les variables d’environnement.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, timeoutMs));

  try {
    const body = {
      model: OPENAI_MODEL,
      temperature: 0.15,
      max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 1500,
      text: {
        format: "json_schema",
        json_schema: schema
      },
      // Messages au format "Responses API" (forme compacte acceptée)
      input: [
        { role: "system", content: sys },
        { role: "user",   content: user }
      ]
      // ⚠️ PAS de `seed`, `modalities`, ou `response_format` ici
    };

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
      const errText = await r.text().catch(() => "");
      throw new Error(`OpenAI ${r.status}: ${errText || "Unknown error"}`);
    }

    const out = await r.json();

    // 1) Chemin standard si json_schema: `output_parsed`
    if (out?.output_parsed) {
      return out.output_parsed;
    }

    // 2) Fallback: concat de texte
    if (typeof out?.output_text === "string" && out.output_text.trim()) {
      try {
        return JSON.parse(out.output_text);
      } catch {
        // ignore, on tente un autre chemin
      }
    }

    // 3) Ancienne forme (selon implémentations) : output[0].content[0].text
    const maybeText = out?.output?.[0]?.content?.[0]?.text;
    if (typeof maybeText === "string" && maybeText.trim()) {
      try {
        return JSON.parse(maybeText);
      } catch {
        // si ce n'est pas du JSON, on lève une erreur explicite
        throw new Error("Sortie OpenAI non-JSON.");
      }
    }

    throw new Error("Sortie OpenAI vide.");
  } catch (err) {
    // AbortError → message plus clair
    if (err?.name === "AbortError") {
      throw new Error(`Timeout OpenAI après ${timeoutMs} ms.`);
    }
    throw err;
  }
}

/**
 * Utilitaire: construit l’URL absolue pour appeler bibleProvider depuis le serveur
 */
function serverBaseUrl(req) {
  const host = req.headers.get("x-forwarded-host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  // fallback local
  return "http://localhost:3000";
}

/**
 * Route handler
 * GET /api/study-28?book=...&chapter=...&verse=...&translation=...&bibleId=...&mode=full|mini&maxtok=1500&oaitimeout=30000
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const book        = searchParams.get("book")        || "Genèse";
    const chapter     = searchParams.get("chapter")     || "1";
    const verse       = searchParams.get("verse")       || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId     = searchParams.get("bibleId")     || "";
    const mode        = (searchParams.get("mode") || "full").toLowerCase();
    const maxtok      = parseInt(searchParams.get("maxtok") || "1500", 10);
    const timeout     = parseInt(searchParams.get("oaitimeout") || "30000", 10);

    // 1) Récupère le passage via notre provider interne
    const base = serverBaseUrl(req);
    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}` +
      `&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl, { headers: { Accept: "application/json" } });
    if (!pRes.ok) {
      const t = await pRes.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `BibleProvider ${pRes.status}: ${t}` });
    }

    const pJson = await pRes.json();
    if (!pJson?.ok) {
      return NextResponse.json({ ok: false, error: pJson?.error || "BibleProvider: réponse invalide." });
    }

    const passage = pJson.data; // { reference, osis, passageText, ... }

    // 2) Prompt (mode full/minI — on exige 28 sections en FULL)
    const must28 = mode !== "mini";
    const sys =
      `Tu es un bibliste pédagogue. Produis une étude ${must28 ? "en 28 sections EXACTES (1→28)" : "courte en 3 sections"} ` +
      `au format JSON strict (schéma fourni). Langue: français. Ton: pastoral, rigoureux. ` +
      `Ne pas inventer de versets, ne jamais sortir de la structure JSON.`;

    const guideFull =
      `Exige 28 sections numérotées (index 1..28) en suivant strictement: ` +
      `1.Thème central, 2.Résumé en une phrase, 3.Contexte historique, 4.Auteur et date, ` +
      `5.Genre littéraire, 6.Structure du passage, 7.Plan détaillé, 8.Mots-clés, 9.Termes clés (définis), ` +
      `10.Personnages et lieux, 11.Problème / Question de départ, 12.Idées majeures (développement), ` +
      `13.Verset pivot (climax), 14.Références croisées (AT), 15.Références croisées (NT), 16.Parallèles bibliques, ` +
      `17.Lien avec l’Évangile (Christocentrique), 18.Vérités doctrinales (3–5), 19.Promesses et avertissements, ` +
      `20.Principes intemporels, 21.Applications personnelles (3–5), 22.Applications communautaires, ` +
      `23.Questions pour petits groupes (6), 24.Prière guidée, 25.Méditation courte, ` +
      `26.Versets à mémoriser (2–3), 27.Difficultés/objections & réponses, 28.Ressources complémentaires.`;

    const guideMini =
      `Fais seulement 3 sections: 1) Thème central, 2) Idées majeures (développement), 3) Applications personnelles.`;

    const user =
      `Passage: ${passage.reference} (${translation})\n` +
      `OSIS: ${passage.osis}\n` +
      `Texte (source unique):\n${passage.passageText}\n\n` +
      `Contraintes: ${must28 ? guideFull : guideMini}\n` +
      `Respecte strictement le schéma JSON transmis (root: { meta, sections[] }).`;

    // 3) Appel OpenAI
    const parsed = await callOpenAI(sys, user, maxtok, timeout);

    // 4) Ajout/garantie du bloc meta
    if (!parsed.meta) parsed.meta = {};
    parsed.meta.book        = parsed.meta.book        || (searchParams.get("book") || "Genèse");
    parsed.meta.chapter     = parsed.meta.chapter     || (searchParams.get("chapter") || "1");
    parsed.meta.verse       = parsed.meta.verse       || (searchParams.get("verse") || "");
    parsed.meta.translation = parsed.meta.translation || translation;
    parsed.meta.reference   = parsed.meta.reference   || passage.reference;
    parsed.meta.osis        = parsed.meta.osis        || passage.osis;

    // 5) En mode FULL, on peut vérifier qu’on a bien 28 sections
    if (must28 && Array.isArray(parsed.sections) && parsed.sections.length !== 28) {
      return NextResponse.json({
        ok: false,
        error: `Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`
      });
    }

    return NextResponse.json({ ok: true, data: parsed });
  } catch (err) {
    return NextResponse.json({ ok: false, error: String(err?.message || err) });
  }
}

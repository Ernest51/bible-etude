// /api/study-28.js
export const config = { runtime: "edge" };

/**
 * ENV attendues (déjà validées via /api/env) :
 * - OPENAI_API_KEY
 * - OPENAI_MODEL (optionnel, défaut: gpt-4o-mini-2024-07-18)
 * - API_BIBLE_KEY (pour /api/bibleProvider côté serveur déjà OK)
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

// 28 titres fixes (ordre strict)
const STUDY_TITLES = [
  "Thème central",
  "Résumé en une phrase",
  "Contexte historique",
  "Auteur et date",
  "Genre littéraire",
  "Structure du passage",
  "Plan détaillé",
  "Mots-clés",
  "Termes clés (définis)",
  "Personnages et lieux",
  "Problème / Question de départ",
  "Idées majeures (développement)",
  "Verset pivot (climax)",
  "Références croisées (AT)",
  "Références croisées (NT)",
  "Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)",
  "Vérités doctrinales (3–5)",
  "Promesses et avertissements",
  "Principes intemporels",
  "Applications personnelles (3–5)",
  "Applications communautaires",
  "Questions pour petits groupes (6)",
  "Prière guidée",
  "Méditation courte",
  "Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses",
  "Ressources complémentaires"
];

// --------- utils ----------
function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function getQS(reqUrl) {
  const u = new URL(reqUrl);
  const g = (k, d = "") => u.searchParams.get(k)?.trim() || d;
  return {
    book: g("book"),
    chapter: g("chapter"),
    verse: g("verse"), // vide = chapitre entier
    translation: g("translation", "LSG"),
    bibleId: g("bibleId", ""), // si vide => provider prendra défaut
    mode: g("mode", "full"), // "mini" (3) ou "full" (28)
    maxtok: parseInt(g("maxtok", "1500"), 10),
    oaitimeout: parseInt(g("oaitimeout", "25000"), 10)
  };
}

function strictSystemInstruction() {
  return [
    "Tu es un bibliste pédagogue.",
    "Langue: français.",
    "Tu dois produire STRICTEMENT un JSON conforme au schéma, sans aucun texte hors JSON.",
    "N'invente aucun verset; cite seulement selon les bornes fournies.",
    "Si le passage est trop court, reste concis mais respecte le schéma."
  ].join(" ");
}

function userInstruction({ reference, translation, passageText, mode }) {
  const expectedCount = mode === "mini" ? 3 : 28;

  const schemaText = `
Schéma JSON à respecter à la lettre (aucune autre clé) :
{
  "meta": { "book": string, "chapter": string, "verse": string, "translation": string, "reference": string, "osis": string },
  "sections": Section[ ${expectedCount} ]
}
Section = {
  "index": number,                // 1..${expectedCount}
  "title": string,                // selon la liste imposée
  "content": string,              // 4–10 phrases, clair et actionnable
  "verses": string[]              // ex: ["v.1-3", "v.26"]
}
  `.trim();

  const titles =
    mode === "mini"
      ? ["Thème central", "Idées majeures (développement)", "Applications personnelles"]
      : STUDY_TITLES;

  const titlesNumbered = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    `Passage : ${reference} (${translation})`,
    "Base unique pour l’exégèse (n'ajoute pas d'autres sources) :",
    "```",
    passageText,
    "```",
    "",
    `Tu dois produire exactement ${expectedCount} sections, dans cet ordre strict :`,
    titlesNumbered,
    "",
    schemaText,
    "",
    "IMPORTANT : la sortie doit être UNIQUEMENT le JSON valide, sans commentaire ni balise."
  ].join("\n");
}

// --------- appels internes ----------
async function fetchPassage({ book, chapter, verse, bibleId }) {
  const qs = new URLSearchParams();
  qs.set("book", book);
  qs.set("chapter", chapter);
  if (verse) qs.set("verse", verse);
  if (bibleId) qs.set("bibleId", bibleId);

  const r = await fetch(new URL("/api/bibleProvider?" + qs.toString(), "http://internal").toString());
  // NOTE: sur Vercel Edge, URL absolue : on reconstruit avec l'origine de la requête
  // mais ici on va remplacer "http://internal" par l'origin réelle en runtime:
  // on ne la connaît pas ici, donc on fait un fetch relatif depuis le handler principal.
  // => Ce helper n'est pas utilisé directement; voir handle() plus bas.
  return r;
}

async function callOpenAI({ messages, maxtok, oaitimeout }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant");

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), Math.max(1000, oaitimeout || 25000));

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 1500,
        response_format: { type: "json_object" }, // <-- clé : force un JSON parsable
        messages
      })
    });

    const txt = await r.text();
    if (!r.ok) {
      // propage l’erreur brute pour debug
      throw new Error(`OpenAI ${r.status}: ${txt}`);
    }
    let payload;
    try { payload = JSON.parse(txt); } catch { throw new Error("OpenAI: réponse non-JSON (niveau 1)"); }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenAI: contenu vide");
    }

    // Parse du JSON retourné dans "content"
    let out;
    try {
      out = JSON.parse(content);
    } catch {
      // fallback : extrait le premier bloc {...}
      const m = content.match(/\{[\s\S]*\}$/m);
      if (m) {
        try { out = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }

    if (!out || typeof out !== "object") {
      throw new Error("Sortie OpenAI non-JSON.");
    }
    return out;
  } finally {
    clearTimeout(to);
  }
}

// --------- handler ----------
export default async function handler(req) {
  try {
    const { book, chapter, verse, translation, bibleId, mode, maxtok, oaitimeout } = getQS(req.url);

    if (!book || !chapter) {
      return json(400, { ok: false, error: "Paramètres requis: book, chapter" });
    }

    // ----- fetch passage via /api/bibleProvider (même domaine) -----
    const origin = new URL(req.url).origin;
    const qs = new URLSearchParams();
    qs.set("book", book);
    qs.set("chapter", chapter);
    if (verse) qs.set("verse", verse);
    if (bibleId) qs.set("bibleId", bibleId);

    const rBP = await fetch(`${origin}/api/bibleProvider?${qs.toString()}`, { headers: { "accept": "application/json" } });
    const bpTxt = await rBP.text();
    if (!rBP.ok) {
      return json(500, { ok: false, error: `BibleProvider ${rBP.status}: ${bpTxt}` });
    }
    let bp;
    try { bp = JSON.parse(bpTxt); } catch { return json(500, { ok: false, error: "BibleProvider: réponse non-JSON" }); }
    if (!bp.ok) {
      return json(500, { ok: false, error: bp.error || "BibleProvider: échec" });
    }

    const { reference, osis } = bp.data || {};
    const passageText = (bp.data?.passageText || "").trim();
    if (!passageText) {
      return json(500, { ok: false, error: "Passage vide depuis BibleProvider" });
    }

    // ----- messages pour OpenAI -----
    const messages = [
      { role: "system", content: strictSystemInstruction() },
      {
        role: "user",
        content: userInstruction({
          reference: reference || `${book} ${chapter}${verse ? ":" + verse : ""}`,
          translation,
          passageText,
          mode
        })
      }
    ];

    // ----- appel OpenAI -----
    const out = await callOpenAI({ messages, maxtok, oaitimeout });

    // Validation minimale (compte des sections)
    const sections = Array.isArray(out?.sections) ? out.sections : [];
    const expected = mode === "mini" ? 3 : 28;
    if (sections.length !== expected) {
      return json(200, {
        ok: false,
        error: `Sections attendues: ${expected}, reçues: ${sections.length}`,
        data: out
      });
    }

    // Inject meta normale si absente/incomplète
    const meta = out.meta || {};
    out.meta = {
      book: String(meta.book || book),
      chapter: String(meta.chapter || chapter),
      verse: String(meta.verse || (verse || "")),
      translation: String(meta.translation || translation || ""),
      reference: String(meta.reference || reference || `${book} ${chapter}${verse ? ":" + verse : ""}`),
      osis: String(meta.osis || osis || "")
    };

    return json(200, { ok: true, data: out });
  } catch (err) {
    return json(500, { ok: false, error: String(err?.message || err) });
  }
}

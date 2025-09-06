// /api/study-28.js
export const config = { runtime: "edge" };

/**
 * Étude exégétique en 28 sections
 * - Input: ?book=Genèse&chapter=1[&verse=1-5][&translation=JND][&bibleId=a93...]
 * - S'appuie sur /api/bibleProvider pour récupérer le texte propre (passageText)
 * - Force la sortie JSON (response_format: json_object)
 * - Fallback: injecte "verses" = ["v.<plage>"] si manquant et si verse=... fourni
 */

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- Utils ----------
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function badRequest(msg)  { return jsonResponse({ ok: false, error: msg }, 400); }
function serverError(msg) { return jsonResponse({ ok: false, error: msg }, 500); }

function safeParse(jsonText) {
  try { return JSON.parse(jsonText); } catch { return null; }
}

// Patch "verses" si vides et si une plage a été demandée
function addVersesFallback(sections, meta) {
  const def = meta?.verse ? [`v.${meta.verse}`] : null;
  if (!def) return sections;
  return (sections || []).map(s => {
    const has = Array.isArray(s?.verses) && s.verses.length > 0;
    return has ? s : { ...s, verses: def };
  });
}

// ---------- Prompt ----------
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

function buildPrompt({ passageText, passageRef, translation, meta }) {
  const titlesNumbered = STUDY_TITLES.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const system = [
    "Tu es un bibliste pédagogue.",
    "Produis une étude structurée et concise en 28 sections fixes.",
    "Langue: français, ton pastoral mais rigoureux.",
    "NE PAS inventer de versets; cite uniquement le passage fourni.",
    "Ta sortie DOIT être STRICTEMENT du JSON conforme au schéma demandé."
  ].join(" ");

  const constraints = [
    "Étude attendue : 28 sections exactement, dans cet ordre strict :",
    titlesNumbered,
    "",
    "Contraintes de sortie JSON :",
    '- root object: { "reference": string, "translation": string, "sections": Section[] }',
    '- Section: { "index": number (1..28), "title": string, "content": string, "verses": string[] }',
    "- `content` doit être clair et actionnable (4–10 phrases max par section).",
    '- `verses` = liste de références locales au passage (ex: ["v.1-3", "v.26"]).',
    "- Chaque section DOIT fournir au moins 1 entrée dans `verses` au format local,",
    '  sauf si vraiment inapplicable (alors "verses": []).',
    "- Si une plage de versets est fournie (ex: \"1-5\"), NE PAS citer hors plage ;",
    '  utiliser "v.1-5" ou des sous-plages (ex: "v.3").',
    "- Utilise la plage fournie comme référence par défaut si tu hésites.",
  ].join("\n");

  const user = [
    `Passage: ${passageRef}${translation ? ` (${translation})` : ""}.`,
    `Plage demandée: ${meta?.verse || "(chapitre entier)"}.`,
    "Texte à utiliser comme base unique pour l’analyse :",
    "```",
    passageText,
    "```",
    "",
    constraints
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user",   content: user   }
  ];
}

// ---------- OpenAI ----------
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const body = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages,
    response_format: { type: "json_object" } // << IMPORTANT (fixe l'erreur 'json' non supporté)
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI ${r.status}: ${t}`);
  }

  const data = await r.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI a renvoyé une réponse vide.");
  const json = safeParse(content);
  if (!json) throw new Error("La sortie OpenAI n’est pas un JSON valide.");

  // Validation minimale
  if (!Array.isArray(json.sections) || json.sections.length !== 28) {
    throw new Error("Le modèle n’a pas produit exactement 28 sections.");
  }
  return json;
}

// ---------- BibleProvider (même domaine) ----------
async function fetchPassageViaProvider(req, { book, chapter, verse, bibleId }) {
  const base = new URL(req.url);
  base.pathname = "/api/bibleProvider";
  const params = new URLSearchParams();
  params.set("book", book);
  params.set("chapter", String(chapter));
  if (verse)   params.set("verse", verse);
  if (bibleId) params.set("bibleId", bibleId);
  base.search = params.toString();

  const r = await fetch(base.toString(), { method: "GET" });
  const txt = await r.text();
  const payload = safeParse(txt) || { ok: false, error: txt };

  if (!r.ok || !payload?.ok) {
    const code = r.status || 500;
    const msg = payload?.error || `BibleProvider ${code}`;
    throw new Error(msg);
  }

  const data = payload.data;
  // attendu: { reference, osis, passageText }
  if (!data?.passageText) {
    throw new Error("BibleProvider: passageText manquant.");
  }
  return data;
}

// ---------- Handler ----------
export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const book        = (url.searchParams.get("book") || "").trim();
    const chapterRaw  = (url.searchParams.get("chapter") || "").trim();
    const verse       = (url.searchParams.get("verse") || "").trim();       // optionnel
    const translation = (url.searchParams.get("translation") || "").trim(); // label libre
    const bibleId     = (url.searchParams.get("bibleId") || "").trim();     // optionnel

    if (!book)    return badRequest('Paramètre "book" manquant.');
    if (!chapterRaw) return badRequest('Paramètre "chapter" manquant.');

    const chapter = Number(chapterRaw);
    if (!Number.isFinite(chapter) || chapter <= 0) {
      return badRequest('Paramètre "chapter" invalide (entier > 0 requis).');
    }

    // Récupère le passage via le provider interne
    const passage = await fetchPassageViaProvider(req, { book, chapter, verse, bibleId });
    const meta = {
      book,
      chapter: String(chapter),
      verse: verse || "",
      translation: translation || "",
      reference: passage?.reference || `${book} ${chapter}${verse ? `:${verse}` : ""}`,
      osis: passage?.osis || ""
    };

    const messages = buildPrompt({
      passageText: passage.passageText || "",
      passageRef: meta.reference,
      translation: meta.translation,
      meta
    });

    // Appel OpenAI
    let ai = await callOpenAI(messages);

    // Filet de sécurité : injection de verses par défaut quand une plage est fournie
    ai.sections = addVersesFallback(ai.sections, meta);

    // Réponse finale normalisée
    return jsonResponse({
      ok: true,
      data: {
        meta,
        sections: ai.sections
      }
    });

  } catch (err) {
    const msg = err?.message || String(err);
    return serverError(msg);
  }
}

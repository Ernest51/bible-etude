export const config = { runtime: "edge" };

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;              // ta clé OpenAI
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini"; // optionnel
const BIBLE_API_KEY  = process.env.BIBLE_API_KEY;               // ta clé api.bible
const BIBLE_ID       = process.env.BIBLE_ID; // ID de la traduction (LSG ou autre)

// ---------- 28 points (titres de ta trame) ----------
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

// ---------- Utils ----------
function jsonResponse(obj, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function stripHtml(html = "") {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, " ") // supprime numéros de versets
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Récupère un passage via API.Bible ----------
async function fetchPassageText(osis) {
  if (!BIBLE_API_KEY || !BIBLE_ID) {
    throw new Error("BIBLE_API_KEY ou BIBLE_ID manquant(s) dans les variables d’environnement.");
  }

  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(
    BIBLE_ID
  )}/passages/${encodeURIComponent(
    osis
  )}?contentType=text&includeVerseNumbers=false&includeChapterNumbers=false&includeTitles=false&paragraphs=false`;

  const r = await fetch(url, { headers: { "api-key": BIBLE_API_KEY } });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`BibleProvider ${r.status}: ${msg}`);
  }
  const data = await r.json();
  const text = stripHtml(data?.data?.content ?? "");
  const ref  = data?.data?.reference ?? osis;
  return { text, ref };
}

// ---------- Construit le prompt ----------
function buildPrompt({ passageText, passageRef, translation }) {
  const titlesNumbered = STUDY_TITLES.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue.",
        "Produis une étude structurée en **28 sections fixes**.",
        "Langue: français, ton pastoral mais rigoureux.",
        "NE PAS inventer de versets; cite uniquement le passage fourni.",
        "Sortie = STRICTEMENT JSON conforme au schéma demandé."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Passage: ${passageRef} (${translation}).`,
        "Texte du passage (base unique pour ton exégèse):",
        "```",
        passageText,
        "```",
        "",
        "Étude attendue : 28 sections exactement, dans cet ordre strict :",
        titlesNumbered,
        "",
        "Contraintes de sortie JSON:",
        "- root: { \"reference\": string, \"translation\": string, \"sections\": Section[] }",
        "- Section: { \"index\": number (1..28), \"title\": string, \"content\": string, \"verses\": string[] }",
        "- `content` = 4–10 phrases max par section.",
        "- `verses` = références locales au passage (ex: [\"v.1-3\", \"v.26\"]).",
        "Aucun texte hors JSON."
      ].join("\n")
    }
  ];
}

// ---------- Appel OpenAI ----------
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "authorization": `Bearer ${OPENAI_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages,
      response_format: { type: "json_object" } // ✅ CORRECTION ICI
    })
  });
  if (!r.ok) {
    const msg = await r.text();
    throw new Error(`OpenAI ${r.status}: ${msg}`);
  }
  const data = await r.json();
  let raw = data.choices?.[0]?.message?.content ?? "";
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("OpenAI JSON parse error. Contenu brut: " + raw.slice(0, 2000));
  }
}

// ---------- Handler ----------
export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Use POST." }, 405);
    }

    const body = await req.json();
    const book = body.book || "";
    const chapter = body.chapter || "";
    const verse = body.verse || "";
    const translation = body.translation || "LSG";

    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "book et chapter requis." }, 400);
    }

    // Conversion OSIS
    const osis = book.toLowerCase().startsWith("gen") ? `GEN.${chapter}` :
                 book.toLowerCase().startsWith("jean") ? `JHN.${chapter}${verse ? "."+verse : ""}` :
                 `${book}.${chapter}`;

    // 1. Passage texte
    const { text: passageText, ref: passageRef } = await fetchPassageText(osis);

    // 2. Prompt
    const messages = buildPrompt({ passageText, passageRef, translation });

    // 3. OpenAI
    const study = await callOpenAI(messages);

    return jsonResponse({ ok: true, data: study });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message }, 200);
  }
}

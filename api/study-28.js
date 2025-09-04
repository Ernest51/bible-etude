// api/study-28.js
export const config = { runtime: "edge" };

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;              // ta clé OpenAI
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini"; // optionnel
const BIBLE_API_KEY  = process.env.BIBLE_API_KEY;               // ta clé api.bible
// Id de la traduction (à mettre dans Vercel > Environment Variables)
// Ex: Louis Segond (LSG). Mets l'ID exact de ta Bible API.bible ici.
const BIBLE_ID       = process.env.BIBLE_ID; 

// ---------- 28 points (titres modifiables pour coller EXACTEMENT à ta trame) ----------
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
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

function stripHtml(html = "") {
  return html
    .replace(/<sup[^>]*>.*?<\/sup>/g, " ") // numéros de versets éventuels
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Récupère un passage via API.Bible avec un identifiant OSIS (ex: "GEN.1" ou "JHN.3")
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
    throw new Error(`API.Bible ${r.status}: ${msg}`);
  }
  const data = await r.json();
  // Selon la Bible/endpoint, le texte peut être dans data.data.content (HTML) ou data.data.content
  const text = stripHtml(data?.data?.content ?? data?.data?.content ?? "");
  const ref  = data?.data?.reference ?? osis;
  return { text, ref };
}

// Construit le prompt pour forcer une sortie stricte en 28 sections
function buildPrompt({ passageText, passageRef, translation }) {
  const titlesNumbered = STUDY_TITLES.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue. ",
        "Produis une étude *structurée et concise* en **28 sections** fixes.",
        "Langue: **français**, ton pastoral mais rigoureux.",
        "NE PAS inventer de versets; cite uniquement le passage fourni.",
        "Ta sortie DOIT être STRICTEMENT du JSON conforme au schéma demandé."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Passage: ${passageRef} (${translation}).`,
        "Texte ci-dessous (utilise-le comme base unique pour l’exégèse):",
        "```",
        passageText,
        "```",
        "",
        "Étude attendue : 28 sections exactement, dans cet ordre strict :",
        titlesNumbered,
        "",
        "Contraintes de sortie JSON:",
        "- root object:",
        '  { "reference": string, "translation": string, "sections": Section[] }',
        "- Section:",
        '  { "index": number (1..28), "title": string, "content": string, "verses": string[] }',
        "- `content` doit être clair et actionnable (4–10 phrases max par section).",
        "- `verses` = liste de références locales au passage (ex: [\"v.1-3\", \"v.26\"]).",
        "Aucune autre clé que celles indiquées. Aucun texte hors JSON."
      ].join("\n")
    }
  ];
}

// Appel OpenAI avec réponse forcée en JSON (json_schema si dispo)
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");
  const body = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    messages,
    // For

export const config = { runtime: "edge" };

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY; // ta clé OpenAI
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // modèle par défaut

// ---------- 28 points (titres fixes) ----------
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

// Construit la base same-origin à partir de la requête (évite VERCEL_URL et la protection)
function getBaseUrl(req) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  return `${proto}://${host}`;
}

// Appelle l’API interne /api/bibleProvider en same-origin
async function fetchPassage(req, { book, chapter, verse }) {
  const base = getBaseUrl(req);
  const qs = new URLSearchParams({ book, chapter: String(chapter) });
  if (verse) qs.set("verse", verse);

  const url = `${base}/api/bibleProvider?${qs.toString()}`;
  const r = await fetch(url, { headers: { "content-type": "application/json" } });
  if (!r.ok) throw new Error(`BibleProvider ${r.status}: ${await r.text()}`);

  const j = await r.json();
  if (!j.ok || !j.data?.passageText) throw new Error(j.error || "BibleProvider error");
  return { passageText: j.data.passageText, reference: j.data.reference };
}

// Prompt OpenAI
function buildPrompt({ passageText, passageRef, translation }) {
  const titlesNumbered = STUDY_TITLES.map((t, i) => `${i + 1}. ${t}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue.",
        "Produis une étude structurée et concise en 28 sections fixes.",
        "Langue: français, ton pastoral mais rigoureux.",
        "Ne pas inventer de versets; cite uniquement le passage fourni.",
        "Ta sortie doit être STRICTEMENT du JSON conforme au schéma demandé."
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
        "- Root object:",
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

// Appel OpenAI (sortie JSON)
async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      messages,
      response_format: { type: "json" }
    })
  });
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "{}";
}

// ---------- Handler ----------
export default async function handler(req) {
  try {
    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Use POST only" }, 405);
    }

    const body = await req.json().catch(() => ({}));
    const { book, chapter, verse = "", translation = "LSG" } = body || {};
    if (!book || !chapter) {
      return jsonResponse({ ok: false, error: "Paramètres requis: book, chapter (verse optionnel)." }, 400);
    }

    // 1) Passage (same-origin → évite 401)
    const { passageText, reference } = await fetchPassage(req, { book, chapter, verse });

    // 2) Prompt
    const messages = buildPrompt({ passageText, passageRef: reference, translation });

    // 3) OpenAI
    const raw = await callOpenAI(messages);

    // 4) Parse JSON
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return jsonResponse({ ok: false, error: "JSON parsing error", raw }, 500);
    }

    return jsonResponse({ ok: true, data: parsed });
  } catch (e) {
    return jsonResponse({ ok: false, error: e.message || String(e) }, 500);
  }
}

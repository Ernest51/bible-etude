// /api/study-28.js — Génération "28 sections" branchée sur /api/bibleProvider
// Runtime Node.js (compatible Vercel pages functions)
export const config = { runtime: "nodejs" };

/* ----------------------- ENV ----------------------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL   = process.env.OPENAI_MODEL   || "gpt-4o-mini";

/* ----------------------- Utils ----------------------- */
function json(res, status, obj) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(obj, null, 2));
  } catch {
    try { res.end('{"ok":false,"error":"send_failed"}'); } catch {}
  }
}

function required(v) { return typeof v === "string" && v.trim().length > 0; }

function hostBaseUrl(req) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const proto = (req.headers["x-forwarded-proto"] || "https");
  return `${proto}://${host}`;
}

function titles28() {
  return [
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
}

/* ----------------------- Provider (interne) ----------------------- */
/** Récupère passageText via notre /api/bibleProvider (même déploiement) */
async function getPassageFromProvider(req, { book, chapter, verse, bibleId }) {
  const base = hostBaseUrl(req);
  const usp = new URLSearchParams();
  usp.set("book", book);
  usp.set("chapter", String(chapter));
  if (required(verse)) usp.set("verse", verse);
  if (required(bibleId)) usp.set("bibleId", bibleId);

  const url = `${base}/api/bibleProvider?${usp.toString()}`;
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) {
    const err = j?.error || `BibleProvider ${r.status}`;
    throw new Error(err);
  }
  const d = j.data || {};
  const passageText = d.passageText || (Array.isArray(d.items) ? d.items[0]?.text : "");
  const reference = d.reference || `${book} ${chapter}${required(verse) ? ":" + verse : ""}`;
  if (!required(passageText)) throw new Error("Passage vide (provider).");
  return { passageText, reference, bibleId: d.bibleId, osis: d.osis };
}

/* ----------------------- OpenAI ----------------------- */
function buildPrompt({ passageText, reference, translationLabel }) {
  const numbered = titles28().map((t, i) => `${i + 1}. ${t}`).join("\n");

  return [
    {
      role: "system",
      content: [
        "Tu es un bibliste pédagogue.",
        "Produis une étude RIGOUREUSE et CONCISE en 28 sections fixes.",
        "Langue: FR. Ton pastoral mais précis.",
        "NE PAS inventer de versets; n'utilise que le texte fourni.",
        "La sortie DOIT être STRICTEMENT un objet JSON conforme au schéma demandé."
      ].join(" ")
    },
    {
      role: "user",
      content: [
        `Passage: ${reference} (${translationLabel}).`,
        "Texte (base unique pour l’analyse) :",
        "```",
        passageText,
        "```",
        "",
        "Rends exactement 28 sections dans cet ordre :",
        numbered,
        "",
        "Schéma JSON strict :",
        '{ "reference": string, "translation": string, "sections": Section[] }',
        'Section = { "index": number (1..28), "title": string, "content": string, "verses": string[] }',
        "- content: 4–10 phrases utiles (pas de puces), style clair et actionnable.",
        '- verses: références locales (ex: ["v.1-3","v.26"]).',
        "Aucune autre clé. AUCUN texte hors JSON."
      ].join("\n")
    }
  ];
}

async function callOpenAI(messages) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquant.");
  const body = {
    model: OPENAI_MODEL,
    temperature: 0.2,
    response_format: { type: "json_object" }, // ✅ format JSON object
    messages
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    throw new Error(`OpenAI ${r.status}: ${JSON.stringify(j, null, 2)}`);
  }
  const text = j?.choices?.[0]?.message?.content || "";
  if (!text.trim()) throw new Error("Réponse vide OpenAI.");
  let obj = null;
  try { obj = JSON.parse(text); } catch (e) {
    throw new Error("Parsing JSON OpenAI: " + (e?.message || e));
  }
  return obj;
}

/* ----------------------- Handler ----------------------- */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json(res, 405, { ok: false, error: "Method Not Allowed. Use GET or POST." });
    }

    // lecture params
    const q = req.method === "GET" ? (req.query || {}) : (req.body || {});
    const book        = String(q.book || "").trim();
    const chapter     = String(q.chapter ?? "").trim();
    const verse       = String(q.verse || "").trim(); // vide = chapitre entier
    const translation = String(q.translation || q.traduction || "LSG").trim() || "LSG";
    const bibleId     = String(q.bibleId || "").trim();

    if (!required(book) || !required(chapter)) {
      return json(res, 200, { ok: false, error: "Paramètres requis: book, chapter." });
    }

    // 1) passage
    const { passageText, reference, osis } = await getPassageFromProvider(req, {
      book, chapter, verse, bibleId
    });

    // 2) prompt + OpenAI
    const messages = buildPrompt({ passageText, reference, translationLabel: translation });
    const study = await callOpenAI(messages);

    // Valide structure basique
    const sections = Array.isArray(study?.sections) ? study.sections : [];
    if (sections.length !== 28) {
      return json(res, 200, {
        ok: false,
        error: "Le modèle n'a pas renvoyé 28 sections.",
        raw: study
      });
    }

    // Emballage final (avec un petit résumé pour ton test UI)
    const payload = {
      meta: {
        book, chapter, verse,
        translation,
        reference,
        osis
      },
      sections
    };

    return json(res, 200, { ok: true, data: payload });
  } catch (e) {
    return json(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

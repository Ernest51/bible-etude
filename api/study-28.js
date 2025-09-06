// /api/study-28.js
export const config = { runtime: "edge" };
export const maxDuration = 60;

// ---------- ENV ----------
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";

// ---------- Utils ----------
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
function bad(msg) { return json({ ok:false, error: msg }, 400); }
function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }

async function fetchWithTimeout(url, options={}, timeoutMs=8000) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(id);
  }
}

// ---------- Titles ----------
const FULL_TITLES = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte",
  "Versets à mémoriser (2–3)","Difficultés/objections & réponses","Ressources complémentaires"
];
const MINI_TITLES = [
  "Thème central","Idées majeures (développement)","Applications personnelles (3–5)"
];
const numbered = (titles) => titles.map((t,i)=>`${i+1}. ${t}`).join("\n");

// ---------- BibleProvider bridge ----------
async function getPassage(req, { book, chapter, verse, bibleId, bptimeout }) {
  const base = new URL(req.url);
  base.pathname = "/api/bibleProvider";
  const sp = new URLSearchParams();
  sp.set("book", book);
  sp.set("chapter", String(chapter));
  if (verse) sp.set("verse", verse);
  if (bibleId) sp.set("bibleId", bibleId);
  base.search = sp.toString();

  const r = await fetchWithTimeout(base.toString(), { method:"GET" }, bptimeout);
  const txt = await r.text();
  const payload = safeJSON(txt) || { ok:false, error: txt };
  if (!r.ok || !payload?.ok) {
    throw new Error(payload?.error || `BibleProvider ${r.status}`);
  }
  const passageText = payload?.data?.passageText;
  if (!passageText) throw new Error("BibleProvider: passageText manquant.");
  return payload.data; // { reference, osis, passageText, ... }
}

// ---------- Prompt ----------
function buildPrompt({ passageText, passageRef, translation, verse, mode, sentencesHint }) {
  const TITLES = mode === "mini" ? MINI_TITLES : FULL_TITLES;

  const sys = [
    "Tu es un bibliste pédagogue.",
    `Produis une étude structurée en ${TITLES.length} sections fixes.`,
    "Langue: français, ton pastoral mais rigoureux.",
    "NE PAS inventer de versets; cite uniquement le passage fourni.",
    "Réponds STRICTEMENT en JSON (aucun texte hors JSON)."
  ].join(" ");

  const rules = [
    `Sections attendues (${TITLES.length}) dans cet ordre strict :`,
    numbered(TITLES),
    "",
    "Schéma JSON :",
    '- root: { "reference": string, "translation": string, "sections": Section[] }',
    '- Section: { "index": number, "title": string, "content": string, "verses": string[] }',
    (mode === "mini"
      ? "- `content` = 1–2 phrases par section."
      : `- \`content\` = ${sentencesHint} phrases par section (courtes).`
    ),
    '- `verses` = références locales (ex: ["v.1-3","v.26"]).',
    verse ? '- NE PAS citer hors plage demandée.' : ""
  ].filter(Boolean).join("\n");

  const user = [
    `Passage : ${passageRef}${translation ? ` (${translation})` : ""}.`,
    `Plage demandée : ${verse || "(chapitre entier)"}.`,
    "Texte source :",
    "```",
    passageText,
    "```",
    "",
    rules
  ].join("\n");

  return [
    { role:"system", content: sys },
    { role:"user",   content: user }
  ];
}

// ---------- OpenAI ----------
async function callOpenAI(messages, { mode, maxtok, oaitimeout }) {
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");

  const r = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      max_tokens: maxtok,
      messages
    })
  }, oaitimeout);

  const txt = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${txt}`);

  const data = safeJSON(txt);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse OpenAI vide.");
  const json = safeJSON(content);
  if (!json) throw new Error("Sortie OpenAI non-JSON.");

  const expected = (mode === "mini") ? MINI_TITLES.length : FULL_TITLES.length;
  if (!Array.isArray(json.sections) || json.sections.length !== expected) {
    throw new Error(`Le modèle n’a pas produit exactement ${expected} sections.`);
  }
  return json;
}

// ---------- Handler ----------
export default async function handler(req) {
  try {
    const url = new URL(req.url);

    const book   = (url.searchParams.get("book") || "").trim();
    const chap   = (url.searchParams.get("chapter") || "").trim();
    const verse  = (url.searchParams.get("verse") || "").trim();
    const translation = (url.searchParams.get("translation") || "").trim();
    const bibleId = (url.searchParams.get("bibleId") || "").trim();

    const mode = ((url.searchParams.get("mode") || "full").trim().toLowerCase() === "mini") ? "mini" : "full";
    const maxtok = Math.max(200, parseInt(url.searchParams.get("maxtok") || "", 10) || (mode === "mini" ? 500 : 1500));
    const oaitimeout = Math.max(2000, parseInt(url.searchParams.get("oaitimeout") || "", 10) || 25000);
    const bptimeout  = Math.max(2000, parseInt(url.searchParams.get("bptimeout") || "", 10) || 8000);
    const sentencesHint = (url.searchParams.get("sentences") || (mode === "mini" ? "1–2" : "1–3")).trim();

    if (!book) return bad('Paramètre "book" manquant.');
    if (!chap) return bad('Paramètre "chapter" manquant.');
    const chapter = Number(chap);
    if (!Number.isFinite(chapter) || chapter <= 0) return bad('Paramètre "chapter" invalide.');

    // 1) Récupère le texte
    const passage = await getPassage(req, { book, chapter, verse, bibleId, bptimeout });

    // 2) Construit le prompt
    const reference = passage?.reference || `${book} ${chapter}${verse ? `:${verse}` : ""}`;
    const messages = buildPrompt({
      passageText: passage?.passageText || "",
      passageRef: reference,
      translation,
      verse,
      mode,
      sentencesHint
    });

    // 3) Appel OpenAI
    const ai = await callOpenAI(messages, { mode, maxtok, oaitimeout });

    // 4) Retour
    const meta = { book, chapter: String(chapter), verse, translation, reference, osis: passage?.osis || "" };
    return json({ ok:true, data: { meta, sections: ai.sections } });

  } catch (e) {
    return json({ ok:false, error: String(e?.message || e) }, 500);
  }
}

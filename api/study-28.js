// /api/study-28.js
export const config = { runtime: "edge" };
export const maxDuration = 60;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL   = process.env.OPENAI_MODEL || "gpt-4o-mini";

function j(obj, status=200){ return new Response(JSON.stringify(obj), { status, headers:{ "content-type":"application/json; charset=utf-8" } }); }
function bad(msg){ return j({ ok:false, error:msg }, 400); }
function safeJSON(s){ try { return JSON.parse(s); } catch { return null; } }

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

function numbered(titles){ return titles.map((t,i)=>`${i+1}. ${t}`).join("\n"); }

async function fetchWithTimeout(url, options={}, timeoutMs=8000){
  const ac = new AbortController();
  const to = setTimeout(()=>ac.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: ac.signal }); }
  finally { clearTimeout(to); }
}

async function getPassage(req, { book, chapter, verse, bibleId }){
  const base = new URL(req.url);
  base.pathname = "/api/bibleProvider";
  const sp = new URLSearchParams();
  sp.set("book", book); sp.set("chapter", String(chapter));
  if (verse) sp.set("verse", verse);
  if (bibleId) sp.set("bibleId", bibleId);
  base.search = sp.toString();

  const r = await fetchWithTimeout(base.toString(), { method:"GET" }, 8000);
  const txt = await r.text();
  const payload = safeJSON(txt) || { ok:false, error:txt };
  if (!r.ok || !payload?.ok) throw new Error(payload?.error || `BibleProvider ${r.status}`);
  if (!payload?.data?.passageText) throw new Error("BibleProvider: passageText manquant.");
  return payload.data; // { reference, osis, passageText, ... }
}

function buildPrompt({ passageText, passageRef, translation, verse, mode }){
  const TITLES = mode === "mini" ? MINI_TITLES : FULL_TITLES;
  const sys = [
    "Tu es un bibliste pédagogue.",
    `Produis une étude structurée en ${TITLES.length} sections fixes.`,
    "Langue: français, ton pastoral mais rigoureux.",
    "NE PAS inventer de versets; cite uniquement le passage fourni.",
    "Réponds STRICTEMENT en JSON."
  ].join(" ");

  const rules = [
    `Sections attendues (${TITLES.length}) dans cet ordre strict :`,
    numbered(TITLES),
    "",
    "Schéma JSON :",
    '- root: { "reference": string, "translation": string, "sections": Section[] }',
    '- Section: { "index": number, "title": string, "content": string, "verses": string[] }',
    (mode === "mini"
      ? "- `content` = 1–2 phrases par section (test rapide)."
      : "- `content` = 2–5 phrases par section."
    ),
    '- `verses` = références locales (ex: ["v.1-3","v.26"]).',
    verse ? '- NE PAS citer hors plage demandée.' : ""
  ].join("\n");

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

async function callOpenAI(messages, { mode }){
  if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY manquante.");
  const maxTokens = mode === "mini" ? 500 : 1900;

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{
      "content-type":"application/json",
      "authorization":`Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type:"json_object" },
      max_tokens: maxTokens,
      messages
    })
  });

  const txt = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${txt}`);

  const data = safeJSON(txt);
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse OpenAI vide.");
  const json = safeJSON(content);
  if (!json) throw new Error("Sortie OpenAI non-JSON.");

  const expected = (mode==="mini") ? MINI_TITLES.length : FULL_TITLES.length;
  if (!Array.isArray(json.sections) || json.sections.length !== expected) {
    throw new Error(`Le modèle n’a pas produit exactement ${expected} sections.`);
  }
  return json;
}

export default async function handler(req){
  try {
    const url = new URL(req.url);
    const book  = (url.searchParams.get("book") || "").trim();
    const chap  = (url.searchParams.get("chapter") || "").trim();
    const verse = (url.searchParams.get("verse") || "").trim();
    const translation = (url.searchParams.get("translation") || "").trim();
    const bibleId = (url.searchParams.get("bibleId") || "").trim();
    const mode = (url.searchParams.get("mode") || "").trim().toLowerCase() === "mini" ? "mini" : "full";

    if (!book) return bad('Paramètre "book" manquant.');
    if (!chap) return bad('Paramètre "chapter" manquant.');
    const chapter = Number(chap);
    if (!Number.isFinite(chapter) || chapter <= 0) return bad('Paramètre "chapter" invalide.');

    // 1) texte
    const passage = await getPassage(req, { book, chapter, verse, bibleId });

    // 2) prompt
    const reference = passage?.reference || `${book} ${chapter}${verse ? `:${verse}` : ""}`;
    const messages = buildPrompt({
      passageText: passage?.passageText || "",
      passageRef: reference,
      translation,
      verse,
      mode
    });

    // 3) OpenAI
    const ai = await callOpenAI(messages, { mode });

    // 4) retour
    const meta = { book, chapter:String(chapter), verse, translation, reference, osis: passage?.osis || "" };
    return j({ ok:true, data:{ meta, sections: ai.sections } });

  } catch (e) {
    return j({ ok:false, error: String(e?.message || e) }, 500);
  }
}

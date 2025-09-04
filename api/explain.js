// /api/explain.js — texte + explication verset par verset (FR)
// POST/GET: { book, chapter, verse? }  -> { ok, data:{ reference, items:[{v,text,html}]} }

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.OPENAI_KEY;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s="") => String(s).replace(/\s{2,}/g, " ").trim();

function refString(book, chapter, verse){
  const ch = clamp(parseInt(chapter,10), 1, 150);
  return verse ? `${book} ${ch}:${verse}` : `${book} ${ch}`;
}

// --- Récupération du passage via notre provider (déjà configuré) ---
async function fetchPassage({ book, chapter, verse }) {
  const usp = new URLSearchParams({ book, chapter, verse });
  const url = `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/bibleProvider?${usp.toString()}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Bible provider error");
  return j.data; // { reference, osis, items:[{v:0,text:"..."}] } (bloc texte)
}

// --- Découpage très simple en "pseudo versets" si l'API renvoie un bloc ---
function naiveSplitToVerses(text){
  // Les réponses JND arrivent souvent avec [1] [2] … On s'en sert pour splitter.
  // Fallback: on renvoie un seul bloc.
  const chunks = String(text).split(/\[(\d+)\]\s*/).filter(Boolean);
  // chunks = ["1", "Texte v1 ...", "2", "Texte v2 ...", ...] ou juste ["Texte"]
  if (chunks.length < 2) return [{ v: 0, text: clean(text) }];
  const out = [];
  for (let i=0; i<chunks.length-1; i+=2){
    const vnum = parseInt(chunks[i],10);
    const vtxt = clean(chunks[i+1] || "");
    if (vtxt) out.push({ v: vnum, text: vtxt });
  }
  return out.length ? out : [{ v: 0, text: clean(text) }];
}

// --- Appel OpenAI pour générer l'explication (HTML sûr) ---
async function explainVerses({ reference, items }) {
  if (!OPENAI_API_KEY) {
    // Fallback : explications simples si pas de clé (pour ne pas bloquer)
    return items.map(it => ({
      ...it,
      html: `<p><strong>Comprendre ${reference}${it.v ? " v."+it.v : ""}</strong> — ${clean(it.text)}</p>`
    }));
  }

  const system = `Tu es un bibliste pédagogue. Donne une explication courte, claire et édifiante en français, verset par verset.
- Style: pastoral, précis, sans jargon inutile.
- Forme: HTML sûr uniquement (<p>, <strong>, <em>, <ul>, <li>, <a>).
- Termine chaque verset par 1 application pratique (1 phrase).`;

  const user = [
    `Passage: ${reference}`,
    `Versets (JSON): ${JSON.stringify(items)}`
  ].join("\n");

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 900,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "";

  // On s'attend à une liste jointe; on mappe simplement 1:1 (même ordre)
  const lines = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  return items.map((it, idx) => ({
    ...it,
    html: lines[idx] ? lines[idx] : `<p><strong>${reference}${it.v ? " v."+it.v : ""}</strong> — ${clean(it.text)}</p>`
  }));
}

export default async function handler(req, res) {
  try {
    const q = req.method === "GET" ? req.query : (req.body || {});
    const book    = String(q.book || "");
    const chapter = q.chapter ?? "";
    const verse   = String(q.verse || "");

    if (!book || !chapter) {
      return res.status(400).json({ ok:false, error: "Paramètres requis: book, chapter (verse optionnel)." });
    }

    // 1) Texte
    const passage = await fetchPassage({ book, chapter, verse }); // via /api/bibleProvider
    const blocks  = passage.items?.length ? passage.items : [];
    const verses  = blocks.length ? naiveSplitToVerses(blocks[0].text) : [];

    // 2) Explication (OpenAI ou fallback)
    const explained = await explainVerses({ reference: passage.reference, items: verses });

    return res.status(200).json({
      ok: true,
      data: { reference: passage.reference, osis: passage.osis, items: explained }
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}

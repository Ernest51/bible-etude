// /api/explain.js — Texte + explication verset par verset (FR, IA réactivée)
// GET/POST: { book, chapter, verse? }
// Retour: { ok, data: { reference, osis, items: [ { v, text, html } ] } }

export const config = { runtime: "nodejs" };

/* ───────────── Utils ───────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const clean = (s = "") => String(s).replace(/\s{2,}/g, " ").trim();
const safeHtml = (s = "") =>
  String(s)
    // autoriser uniquement ces balises (p, strong, em, ul, ol, li, a)
    .replace(/<(?!\/?(p|strong|em|ul|ol|li|a)(\s|>|\/))/gi, "&lt;")
    // retirer tout attribut on* (onclick, onload…)
    .replace(/\son\w+="[^"]*"/gi, "");

function buildInternalUrl(path, params) {
  const usp = new URLSearchParams(params || {});
  const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  return `${base}${path}${usp.toString() ? "?" + usp.toString() : ""}`;
}

/* ───────────── 1) Récupérer le texte via /api/bibleProvider ───────────── */

async function fetchPassageViaProvider({ book, chapter, verse }) {
  const url = buildInternalUrl("/api/bibleProvider", { book, chapter, verse });
  const r = await fetch(url);
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || "Bible provider error");
  // attendu: { reference, osis, items:[{ v:0, text:"..." }] }
  return j.data;
}

/* ───────────── 2) Découper en versets (JND: marqueurs [n]) ───────────── */

function splitToVerses(text) {
  const t = String(text || "");

  // Cas fréquent JND : “[1] … [2] …”
  const parts = t.split(/\[(\d+)\]\s*/).filter(Boolean);
  if (parts.length >= 2) {
    const out = [];
    for (let i = 0; i < parts.length - 1; i += 2) {
      const vnum = parseInt(parts[i], 10);
      const vtxt = clean(parts[i + 1] || "");
      if (vtxt) out.push({ v: vnum, text: vtxt });
    }
    if (out.length) return out;
  }

  // Fallback: tentative naïve “1 … 2 …”
  const naive = t.split(/\s(?=\d+\s)/);
  if (naive.length > 1) {
    return naive.map(seg => {
      const m = seg.match(/^(\d+)\s+(.*)$/s);
      if (m) return { v: parseInt(m[1], 10), text: clean(m[2]) };
      return { v: 0, text: clean(seg) };
    });
  }

  // Dernier recours: un seul bloc
  return [{ v: 0, text: clean(t) }];
}

/* ───────────── 3) IA (OpenAI) + fallback sécurisé ───────────── */

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY || process.env.OPENAI_APIKEY || process.env.OPENAI_KEY;

async function explainVersesAI({ reference, items }) {
  const system =
    `Tu es un bibliste pédagogue. Explique en français, verset par verset, de manière claire et édifiante.
- Pour chaque verset: 1–2 phrases d'explication + 1 phrase d'application concrète.
- Style: pastoral mais rigoureux; évite le jargon.
- Réponds exclusivement en HTML sûr: <p>, <strong>, <em>, <ul>, <ol>, <li>, <a>.
- Ne réécris pas le texte biblique; commente seulement ce qui est fourni.`;

  const user =
    `Passage: ${reference}\n` +
    `Versets (JSON): ${JSON.stringify(items)}`;

  const body = {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 1100,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  if (!r.ok) {
    const txt = await r.text().catch(() => "");
    throw new Error(txt || `OpenAI HTTP ${r.status}`);
  }

  const j = await r.json();
  const raw = j.choices?.[0]?.message?.content || "";
  const chunks = raw.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

  return items.map((it, i) => ({
    ...it,
    html: safeHtml(
      chunks[i] ||
        `<p><strong>${reference}${it.v ? " v." + it.v : ""}</strong> — ${clean(it.text)}</p>`
    )
  }));
}

function explainVersesFallback({ reference, items }) {
  return items.map(it => {
    const head = `<strong>${reference}${it.v ? " v." + it.v : ""}</strong>`;
    const base = clean(it.text);
    const html =
      `<p>${head} — ${base}</p>` +
      `<ul>` +
      `<li><em>Sens :</em> Que révèle ce verset sur Dieu, sa volonté ou l’humain ?</li>` +
      `<li><em>Clé :</em> Repère un mot important (verbe/nom répété, promesse, ordre).</li>` +
      `<li><em>Application :</em> Une action simple à vivre aujourd’hui (forme “je vais …”).</li>` +
      `</ul>`;
    return { ...it, html: safeHtml(html) };
  });
}

/* ───────────── Handler ───────────── */

export default async function handler(req, res) {
  try {
    const q = req.method === "GET" ? req.query : (req.body || {});
    const book = String(q.book || "");
    const chapter = q.chapter ?? "";
    const verse = String(q.verse || "");

    if (!book || !chapter) {
      return res.status(400).json({
        ok: false,
        error: "Paramètres requis: book, chapter (verse optionnel)."
      });
    }

    // 1) Récupérer le texte (via OSIS) puis le découper
    const passage = await fetchPassageViaProvider({ book, chapter, verse });
    const blocks = passage?.items?.length ? passage.items : [];
    const verses = blocks.length ? splitToVerses(blocks[0].text) : [];

    // 2) Explication — IA si clé présente, sinon fallback
    let explained;
    if (OPENAI_API_KEY) {
      try {
        explained = await explainVersesAI({
          reference: passage.reference,
          items: verses
        });
      } catch (err) {
        // si l'IA échoue, on ne casse pas l'UX
        explained = explainVersesFallback({
          reference: passage.reference,
          items: verses
        });
      }
    } else {
      explained = explainVersesFallback({
        reference: passage.reference,
        items: verses
      });
    }

    return res.status(200).json({
      ok: true,
      data: {
        reference: passage.reference,
        osis: passage.osis,
        items: explained
      }
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

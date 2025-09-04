// /api/explain.js
// "Lire la Bible" — Lecture + mini-explication pédagogique
// GET: ?book=Genèse&chapter=1&verse=1-3

export const config = { runtime: "nodejs" };

/* ───────────── Utils ───────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verse ? `${cap(book)} ${ch}:${verse}` : `${cap(book)} ${ch}`;
}

function safeHtml(s = "") {
  return String(s)
    // on autorise <p>, <strong>, <em>, <a>
    .replace(/<(?!\/?(p|strong|em|a)(\s|>|\/))/gi, "&lt;")
    // supprime attributs "on*" dangereux
    .replace(/\son\w+="[^"]*"/gi, "")
    // normalise les liens
    .replace(/<a([^>]*?)>/gi, (m, attrs) => {
      const href = (attrs.match(/\shref="[^"]*"/i) || [""])[0];
      return `<a${href} target="_blank" rel="noopener">`;
    });
}

function proseBlock(inner) {
  return `<div class="prose prose-slate max-w-none">${inner}</div>`;
}

/* ───────────── Mini-‘exégèse’ procédurale ───────────── */

function buildExplainHTML(reference, rawText = "") {
  // Quelques repères simples : phrases courtes et pédagogiques
  const intro =
    `<p><strong>${reference}</strong> — Lire lentement le texte, relever les sujets/acteurs, les verbes d’action, et la progression (début → charnière → aboutissement).</p>`;

  const obs =
    `<p><strong>Observation.</strong> Qui parle ? À qui ? Où et quand cela se passe-t-il ? Quels mots se répètent ou structurent le passage (connecteurs : “or”, “ainsi”, “car”, “c’est pourquoi”)?</p>`;

  const sens =
    `<p><strong>Compréhension.</strong> Que révèle ce passage de Dieu et de l’humain ? Quelle promesse, quel avertissement, quel réconfort ? Comment s’articule la foi (ce que Dieu fait) et l’obéissance (ce que l’on fait) ?</p>`;

  const prière =
    `<p><strong>Prière.</strong> Demander que la Parole porte du fruit : gratitude, repentance, discernement, persévérance.</p>`;

  const texte =
    `<p><em>Texte (extrait):</em> ${rawText}</p>`;

  return safeHtml(proseBlock(intro + obs + sens + prière + texte));
}

/* ───────────── Handler ───────────── */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { book = "Genèse", chapter = "1", verse = "" } = req.query || {};
    const reference = refString(book, chapter, verse);

    // Appel à TON provider interne (même déploiement)
    const baseUrl =
      (req.headers["x-forwarded-proto"] || "https") +
      "://" +
      req.headers.host;

    const qs = new URLSearchParams({ book, chapter, verse }).toString();
    const url = `${baseUrl}/api/bibleProvider?${qs}`;

    const r = await fetch(url, { headers: { "x-internal": "1" } });
    if (!r.ok) {
      const body = await r.text();
      throw new Error(`bibleProvider ${r.status}: ${body}`);
    }
    const j = await r.json();
    if (!j.ok) {
      throw new Error(j.error || "Erreur provider");
    }

    // j.data.items : [{ v, text }]
    const items = Array.isArray(j.data?.items) ? j.data.items : [];
    const firstText = items[0]?.text || "";

    // On renvoie au widget le format attendu
    const payload = {
      ok: true,
      data: {
        reference,
        items: [
          {
            v: items[0]?.v || 0,
            text: firstText,
            html: buildExplainHTML(reference, firstText)
          }
        ]
      }
    };

    return res.status(200).json(payload);
  } catch (e) {
    // En cas d’erreur, renvoi propre pour l’UI
    return res
      .status(200)
      .json({ ok: false, error: String(e?.message || e || "Erreur inconnue") });
  }
}

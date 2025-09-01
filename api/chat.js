// api/chat.js — génération avec retries + diag clair (JSON)
const DEFAULT_VERSION = "LSG"; // version affichée dans la réponse JSON

// Fallback markdown très court si OpenAI indispo
function fallbackMarkdown(book = "Genèse", chapter = 1) {
  return `# ${book} ${chapter}

1. Prière d’ouverture

Seigneur, éclaire notre étude de ${book} ${chapter}. Amen.

2. Canon et testament

Le livre de ${book} appartient au canon biblique.

3. Questions du chapitre précédent

Préparer au moins 5 questions de révision (comprendre, appliquer, comparer, retenir).

4. Titre du chapitre

Titre synthétique.

...
28. Prière de fin

Merci Seigneur pour ta Parole. Amen.
`.trim();
}

function parseQ(q) {
  if (!q) return { book: "Genèse", chapter: 1 };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { book: m[1].trim(), chapter: Number(m[2]) };
  return { book: String(q).trim(), chapter: 1 };
}

async function askOpenAI_JSON({ book, chapter, version, apiKey, signal }) {
  // JSON strict: s1..s28
  const SYSTEM = `
Tu DOIS répondre en JSON strict (aucun texte hors JSON), avec 28 clés "s1"..."s28".
Style pastoral, en français. Version ${version} pour les citations.
`.trim();

  const USER = `Livre="${book}", Chapitre="${chapter}", Version="${version}". Renvoie uniquement un JSON valide.`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER },
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const text = await r.text();
  if (!r.ok) {
    throw new Error(`OpenAI ${r.status}: ${text.slice(0, 200)}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Réponse OpenAI invalide (JSON)");
  }

  const raw = data?.choices?.[0]?.message?.content || "";
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("Contenu non-JSON renvoyé par OpenAI");
  }

  // Validation simple
  for (let i = 1; i <= 28; i++) {
    if (typeof obj[`s${i}`] !== "string") {
      throw new Error(`Champ manquant s${i}`);
    }
  }

  const mapped = Array.from({ length: 28 }, (_, k) => ({
    id: k + 1,
    title: "", // on laisse l’UI gérer les titres fixes
    content: obj[`s${k + 1}`],
  }));

  return { reference: `${book} ${chapter}`, version, sections: mapped };
}

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fn(ctrl.signal);
  } finally {
    clearTimeout(to);
  }
}

async function tryOpenAI({ book, chapter, version, apiKey }) {
  // 3 tentatives rapides (timeouts courts) avant fallback
  const attempts = [12000, 16000, 20000]; // 12s, 16s, 20s
  let lastErr = null;
  for (const t of attempts) {
    try {
      return await withTimeout(t, (signal) =>
        askOpenAI_JSON({ book, chapter, version, apiKey, signal })
      );
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("OpenAI indisponible");
}

export default async function handler(req, res) {
  try {
    // lecture query/body
    let body = {};
    if (req.method === "POST") {
      body = await new Promise((resolve) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => {
          try {
            resolve(JSON.parse(b || "{}"));
          } catch {
            resolve({});
          }
        });
      });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());
    const probe = qp.probe === "1" || body.probe === true;

    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter);
    let version = body.version || qp.version || DEFAULT_VERSION;

    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }
    book = book || "Genèse";
    chapter = chapter || 1;

    // probe => renvoie le fallback direct
    if (probe) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        ok: true,
        source: "probe-fallback",
        data: {
          reference: `${book} ${chapter}`,
          version,
          sections: fallbackMarkdown(book, chapter)
            .split(/\n(?=\d{1,2}\.\s)/g)
            .map((blk, i) => ({
              id: i + 1,
              title: "",
              content: blk.replace(/^\d{1,2}\.\s+.*?\n?/, "").trim(),
            })),
        },
      });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Pas de clé => fallback JSON (lisible par l’app)
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        ok: true,
        source: "fallback:no_key",
        data: {
          reference: `${book} ${chapter}`,
          version,
          sections: fallbackMarkdown(book, chapter)
            .split(/\n(?=\d{1,2}\.\s)/g)
            .map((blk, i) => ({
              id: i + 1,
              title: "",
              content: blk.replace(/^\d{1,2}\.\s+.*?\n?/, "").trim(),
            })),
        },
      });
    }

    // OpenAI avec retries
    let data, source = "openai";
    try {
      data = await tryOpenAI({ book, chapter, version, apiKey });
    } catch (e) {
      // fallback si erreur/timeout OpenAI
      source = "fallback:openai_error";
      data = {
        reference: `${book} ${chapter}`,
        version,
        sections: fallbackMarkdown(book, chapter)
          .split(/\n(?=\d{1,2}\.\s)/g)
          .map((blk, i) => ({
            id: i + 1,
            title: "",
            content: blk.replace(/^\d{1,2}\.\s+.*?\n?/, "").trim(),
          })),
      };
      res.setHeader("X-OpenAI-Error", String(e?.message || e));
    }

    // Réponse JSON lisible par le front
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({ ok: true, source, data });
  } catch (e) {
    // Ultime repli : fallback pur texte (markdown)
    const url = new URL(req.url, `http://${req.headers.host}`);
    const { book, chapter } = parseQ(url.searchParams.get("q") || "Genèse 1");
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("X-Last-Error", String(e?.message || e));
    return res.status(200).send(fallbackMarkdown(book, chapter));
  }
}

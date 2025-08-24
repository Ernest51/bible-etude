// api/chat.js — Vercel Serverless Function (Node.js)
// Accepte GET (query) et POST (body)

export default async function handler(req, res) {
  try {
    // Autoriser GET et POST uniquement
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", ["GET", "POST"]);
      return res.status(405).json({ ok: false, error: "Method Not Allowed" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const projectId = process.env.OPENAI_PROJECT || ""; // optionnel

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY manquante dans Vercel > Project > Settings > Environment Variables",
      });
    }

    // Récupération des paramètres
    const params = req.method === "GET" ? req.query : (req.body || {});
    const livre = (params.livre || params.book || "").toString().trim();
    const chapitre = (params.chapitre || params.chapter || "").toString().trim();
    const points = Number(params.points || params.n || 8) || 8;

    if (!livre || !chapitre) {
      return res.status(400).json({
        ok: false,
        error: "Paramètres requis manquants : livre et chapitre",
        hint: "Exemple: /api/chat?livre=Jean&chapitre=3&points=8",
      });
    }

    // Prompt simple et clair
    const prompt = [
      `Prépare ${points} points d'étude biblique en français sur ${livre} ${chapitre}.`,
      `Style: clair, pastoral, 2-3 phrases par point, numéroté 1) 2) 3)...`,
      `Ne cite pas de texte biblique intégral, résume et commente.`,
    ].join(" ");

    // Appel OpenAI
    const url = "https://api.openai.com/v1/chat/completions";
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...(projectId ? { "OpenAI-Project": projectId } : {}),
    };
    const body = {
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: "Tu es un assistant d'étude biblique, prudent et précis." },
        { role: "user", content: prompt },
      ],
    };

    const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
    const raw = await r.text(); // lire brut pour logger en cas d'erreur

    if (!r.ok) {
      console.error("OpenAI error", r.status, raw);
      // renvoyer l'erreur au client pour debug
      return res.status(r.status).json({
        ok: false,
        error: "Erreur OpenAI",
        status: r.status,
        details: safeJson(raw),
      });
    }

    const data = safeJson(raw);
    const content = data?.choices?.[0]?.message?.content ?? "";

    return res.status(200).json({
      ok: true,
      livre, chapitre, points,
      content,                // texte utilisable directement
      provider: "openai",
      model: body.model,
    });

  } catch (e) {
    console.error("API /api/chat exception:", e);
    return res.status(500).json({
      ok: false,
      error: e?.message || "Erreur serveur inconnue",
    });
  }
}

function safeJson(txt) {
  try { return JSON.parse(txt); } catch { return txt; }
}

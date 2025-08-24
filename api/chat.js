// /api/chat.js  — Serverless function Vercel (Node.js runtime)
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Méthode non autorisée. Utiliser POST." });
    }

    // --------- Vérifs de base ----------
    const apiKey = process.env.OPENAI_API_KEY;
    const projectId = process.env.OPENAI_PROJECT; // facultatif

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "OPENAI_API_KEY manquante dans Vercel > Settings > Environment Variables.",
      });
    }

    const { book, chapter, points } = req.body || {};
    if (!book || !chapter) {
      return res.status(400).json({ ok: false, error: "Paramètres manquants (book, chapter)." });
    }

    // --------- Prompt minimal ----------
    const prompt = `Donne ${points || 8} points clés en français sur ${book} ${chapter}. Format: une liste simple.`;

    // --------- Appel OpenAI ----------
    const url = "https://api.openai.com/v1/chat/completions";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    };
    if (projectId) headers["OpenAI-Project"] = projectId; // optionnel

    const body = {
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        { role: "system", content: "Tu es un assistant concis pour étude biblique." },
        { role: "user", content: prompt },
      ],
    };

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const raw = await r.text(); // on lit d'abord en texte pour pouvoir logguer en cas d'erreur

    if (!r.ok) {
      // Log côté serveur (visible dans Vercel > Deployments > Runtime Logs)
      console.error("OpenAI error", r.status, raw);
      return res.status(r.status).json({
        ok: false,
        error: "OpenAI a renvoyé une erreur",
        status: r.status,
        details: safeJson(raw),
      });
    }

    const data = safeJson(raw);
    const content = data?.choices?.[0]?.message?.content ?? "";
    return res.status(200).json({ ok: true, content });
  } catch (e) {
    console.error("API /api/chat exception:", e);
    return res.status(500).json({ ok: false, error: e?.message || "Erreur serveur inconnue" });
  }
}

function safeJson(txt) {
  try {
    return JSON.parse(txt);
  } catch {
    return txt;
  }
}

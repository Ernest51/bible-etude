// /api/chat.js
export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Log de santé au premier chargement
if (typeof global !== "undefined" && !global._chat_health) {
  global._chat_health = true;
  console.log("[api/chat] endpoint chargé");
}

export default async function handler(req, res) {
  try {
    // Petit test de santé
    if (req.method === "GET" && req.query.ping !== undefined) {
      return res.status(200).json({ pong: true, model: MODEL });
    }

    // Vérification méthode
    if (req.method !== "POST") {
      return res
        .status(405)
        .json({ error: "Méthode non autorisée. Utilise POST." });
    }

    // Vérif clé API
    if (!OPENAI_API_KEY) {
      return res.status(500).json({ error: "OPENAI_API_KEY manquant" });
    }

    // Parsing body
    let body = {};
    try {
      body =
        typeof req.body === "object" ? req.body : JSON.parse(req.body || "{}");
    } catch {
      return res.status(400).json({ error: "JSON invalide" });
    }

    const { livre, chapitre, version = "LSG", subset } = body;

    if (!livre || !chapitre) {
      return res
        .status(400)
        .json({ error: "Paramètres requis : livre, chapitre" });
    }

    // Si subset n’est pas fourni → on génère les 28 points
    const points = Array.isArray(subset)
      ? subset
      : Array.from({ length: 28 }, (_, i) => i + 1);

    const messages = [
      {
        role: "system",
        content:
          "Tu es un assistant d’étude biblique rigoureux, pastoral et doctrinal. Réponds en français, structuré, fidèle aux Écritures.",
      },
      {
        role: "user",
        content: `Prépare une étude biblique détaillée sur ${livre} ${chapitre}, en suivant les points stricts (${points.join(
          ", "
        )}). Longueur minimale 2500 caractères par point. Format JSON obligatoire : { "1": "...", "2": "...", ... }`,
      },
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages,
      }),
    });

    const txt = await r.text();
    let j;
    try {
      j = JSON.parse(txt);
    } catch (e) {
      throw new Error("Réponse OpenAI invalide: " + txt.slice(0, 200));
    }

    if (!

// api/models.js
export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({
      models: [
        { id: "gpt-4o", description: "Modèle principal optimisé pour l'étude" },
        { id: "gpt-4o-mini", description: "Version plus rapide et légère" }
      ]
    });
  } else {
    res.status(405).json({ error: "Méthode non autorisée" });
  }
}

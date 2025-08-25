// /api/models.js
export const config = { runtime: "nodejs" };

// Log au premier chargement
if (typeof global !== "undefined" && !global._models_health) {
  global._models_health = true;
  console.log("[api/models] endpoint chargé");
}

export default function handler(req, res) {
  if (req.method === "GET") {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json({
      models: [
        { id: "gpt-4o", description: "Modèle principal optimisé pour l'étude" },
        {
          id: "gpt-4o-mini",
          description: "Version plus rapide et légère, idéale pour tests",
        },
      ],
    });
  }

  return res
    .status(405)
    .json({ error: "Méthode non autorisée. Utilise GET uniquement." });
}

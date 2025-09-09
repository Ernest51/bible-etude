// api/generate-study.js
// ESM — Vercel Functions (Node 20)
// But :
// - GET  => ping/infos
// - POST => renvoie squelette 28 rubriques (noms fixes) ou echo

export default function handler(req, res) {
  const allowed = ["GET", "POST"];
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed);
    return res.status(405).json({ error: "Method Not Allowed", allowed });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/generate-study",
      mode: "info",
      hint: "POST JSON { passage: 'Genèse 1', mode?: 'echo' }",
      timestamp: new Date().toISOString(),
    });
  }

  // POST
  try {
    const body = req.body ?? {};
    const {
      passage = "",
      mode = "skeleton", // 'skeleton' | 'echo'
      options = {},
    } = body;

    if (mode === "echo") {
      return res.status(200).json({
        ok: true,
        endpoint: "/api/generate-study",
        mode: "echo",
        echo: body,
        timestamp: new Date().toISOString(),
      });
    }

    // Tableau fixe des 28 rubriques
    const rubriqueTitles = [
      "1. Titre du passage",
      "2. Texte biblique",
      "3. Contexte historique",
      "4. Contexte culturel",
      "5. Contexte littéraire",
      "6. Contexte théologique",
      "7. Personnages principaux",
      "8. Mots-clés et termes importants",
      "9. Structure du passage",
      "10. Observations générales",
      "11. Questions de compréhension",
      "12. Doctrine et enseignement",
      "13. Promesses de Dieu",
      "14. Commandements de Dieu",
      "15. Exemples à suivre",
      "16. Exemples à éviter",
      "17. Application personnelle",
      "18. Application communautaire",
      "19. Application universelle",
      "20. Comparaisons avec autres passages",
      "21. Prophéties et accomplissements",
      "22. Typologie et symboles",
      "23. Lien avec Christ",
      "24. Lien avec l’Évangile",
      "25. Vérités éternelles",
      "26. Principes pratiques",
      "27. Commentaires de théologiens",
      "28. Prière finale"
    ];

    // Génère la structure
    const sections = rubriqueTitles.map((title, i) => ({
      id: i + 1,
      title,
      content: "", // à remplir plus tard par l’IA
    }));

    const payload = {
      ok: true,
      endpoint: "/api/generate-study",
      mode: "skeleton",
      meta: {
        passage,
        rubriques: 28,
        options,
        generatedAt: new Date().toISOString(),
      },
      study: {
        passage,
        sections,
      },
    };

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "Invalid JSON body",
      details: err?.message ?? String(err),
    });
  }
}

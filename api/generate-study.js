// api/generate-study.js
// ESM — Vercel Functions (Node 20)
// GET  => infos
// POST => squelette étude avec 28 rubriques personnelles (ou echo)

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

    // === Trame personnelle 28 rubriques ===
    const rubriqueTitles = [
      "1. Lecture du passage",
      "2. Contexte biblique",
      "3. Contexte historique",
      "4. Contexte culturel",
      "5. Contexte géographique",
      "6. Contexte littéraire",
      "7. Auteur et destinataires",
      "8. Structure du texte",
      "9. Thème principal",
      "10. Thèmes secondaires",
      "11. Mots-clés",
      "12. Difficultés du texte",
      "13. Observations générales",
      "14. Doctrine enseignée",
      "15. Promesses de Dieu",
      "16. Commandements de Dieu",
      "17. Péchés à éviter",
      "18. Exemples à suivre",
      "19. Exemples à ne pas suivre",
      "20. Leçons spirituelles",
      "21. Vérités éternelles",
      "22. Application personnelle",
      "23. Application pour l’Église",
      "24. Application pour le monde",
      "25. Lien avec Christ",
      "26. Lien avec l’Évangile",
      "27. Prière en rapport avec le texte",
      "28. Résumé et conclusion"
    ];

    const sections = rubriqueTitles.map((title, i) => ({
      id: i + 1,
      title,
      content: "", // vide pour IA ou remplissage ultérieur
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

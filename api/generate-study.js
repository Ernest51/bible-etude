// api/generate-study.js
// ESM — Vercel Functions (Node 20)
// GET  => infos
// POST => squelette étude avec tes 28 rubriques personnelles (issues du JSON)

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

    // === 28 rubriques personnelles ===
    const rubriques = [
      { id: 1,  titre: "Prière d’ouverture", description: "Invocation du Saint-Esprit pour éclairer l’étude.", image: true },
      { id: 2,  titre: "Canon et testament", description: "Identification du livre selon le canon biblique.", mode: "testament_uniquement" },
      { id: 3,  titre: "Questions du chapitre précédent", nombre_minimum: 5, reponse_integrale: true, elements_comprehension_exiges: true },
      { id: 4,  titre: "Titre du chapitre", description: "Résumé doctrinal synthétique du chapitre étudié." },
      { id: 5,  titre: "Contexte historique", description: "Période, géopolitique, culture, carte localisée à l’époque.", carte_visuelle: true },
      { id: 6,  titre: "Structure littéraire", description: "Séquençage narratif et composition interne du chapitre." },
      { id: 7,  titre: "Genre littéraire", description: "Type de texte : narratif, poétique, prophétique, etc." },
      { id: 8,  titre: "Auteur et généalogie", description: "Présentation de l’auteur et son lien aux patriarches.", genealogie: true },
      { id: 9,  titre: "Verset-clé doctrinal", description: "Verset central du chapitre avec lien cliquable." },
      { id: 10, titre: "Analyse exégétique", description: "Commentaire mot-à-mot avec références au grec/hébreu." },
      { id: 11, titre: "Analyse lexicale", description: "Analyse des mots-clés originaux et leur sens doctrinal." },
      { id: 12, titre: "Références croisées", description: "Passages parallèles ou complémentaires dans la Bible." },
      { id: 13, titre: "Fondements théologiques", description: "Doctrines majeures qui émergent du chapitre." },
      { id: 14, titre: "Thème doctrinal", description: "Lien entre le chapitre et les 22 grands thèmes doctrinaux.", correspondance_theme: "Au sujet d'un des thèmes des 22 thèmes, le livre étudié correspond à" },
      { id: 15, titre: "Fruits spirituels", description: "Vertus et attitudes inspirées par le chapitre." },
      { id: 16, titre: "Types bibliques", description: "Symboles ou figures typologiques présents." },
      { id: 17, titre: "Appui doctrinal", description: "Autres passages bibliques qui renforcent l'enseignement." },
      { id: 18, titre: "Comparaison entre versets", description: "Versets comparés au sein du chapitre pour mise en relief." },
      { id: 19, titre: "Comparaison avec Actes 2", description: "Parallèle avec le début de l’Église et le Saint-Esprit." },
      { id: 20, titre: "Verset à mémoriser", description: "Verset essentiel à retenir dans sa vie spirituelle." },
      { id: 21, titre: "Enseignement pour l’Église", description: "Implications collectives et ecclésiales." },
      { id: 22, titre: "Enseignement pour la famille", description: "Valeurs à transmettre dans le foyer chrétien." },
      { id: 23, titre: "Enseignement pour enfants", description: "Méthode simplifiée avec jeux, récits, symboles visuels." },
      { id: 24, titre: "Application missionnaire", description: "Comment le texte guide l’évangélisation." },
      { id: 25, titre: "Application pastorale", description: "Conseils pour les ministres, pasteurs et enseignants." },
      { id: 26, titre: "Application personnelle", description: "Examen de conscience et engagement individuel." },
      { id: 27, titre: "Versets à retenir", description: "Versets incontournables pour la prédication pastorale.", pastorale: true },
      { id: 28, titre: "Prière de fin", description: "Clôture spirituelle de l’étude avec reconnaissance." },
    ];

    const payload = {
      ok: true,
      endpoint: "/api/generate-study",
      mode: "skeleton",
      meta: {
        passage,
        rubriques: rubriques.length,
        options,
        generatedAt: new Date().toISOString(),
      },
      study: {
        passage,
        sections: rubriques,
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

// api/study-28.js
// Sert la liste des 28 points de TON étude (titres + descriptions) au format attendu par le front.
// Réponse: JSON Array [{ title, hint }]

/**
 * NB:
 * - HEAD => 200 (pour le badge "health")
 * - GET  => 200 + JSON [{ title, hint }]
 * - Cache 1h
 */

const POINTS = [
  { "title": "Prière d’ouverture", "hint": "Invocation du Saint-Esprit pour éclairer l’étude." },
  { "title": "Canon et testament", "hint": "Identification du livre selon le canon biblique." },
  { "title": "Questions du chapitre précédent", "hint": "" },
  { "title": "Lecture du texte", "hint": "Lecture attentive du passage ciblé." },
  { "title": "Contexte historique", "hint": "Époque, auteur, destinataires, situation." },
  { "title": "Contexte littéraire", "hint": "Genre, style, structure, liens au chapitre." },
  { "title": "Mots-clés", "hint": "Termes importants et champs lexicaux." },
  { "title": "Thématique principale", "hint": "Idée directrice du passage." },
  { "title": "Personnages et lieux", "hint": "Qui? Où? Rôle et symbolique éventuelle." },
  { "title": "Observations de détail", "hint": "Verbes, temps, répétitions, connecteurs." },
  { "title": "Parallèles bibliques", "hint": "Passages connexes OT/NT." },
  { "title": "Promesses et avertissements", "hint": "Ce que Dieu promet / avertit." },
  { "title": "Commandements et exhortations", "hint": "Ce que Dieu demande." },
  { "title": "Doctrine et vérités", "hint": "Attributs de Dieu, salut, sanctification, etc." },
  { "title": "Types et symboles", "hint": "Figures, images, typologie." },
  { "title": "Questions d’interprétation", "hint": "Points difficiles, variantes de sens." },
  { "title": "Appui des commentateurs", "hint": "Synthèse de théologiens fiables." },
  { "title": "Application personnelle", "hint": "Ce que je change, décide, prie." },
  { "title": "Application communautaire", "hint": "Église, groupe, famille." },
  { "title": "Prière de réponse", "hint": "Action de grâce, confession, supplication." },
  { "title": "Versets à mémoriser", "hint": "Sélection + plan de révision." },
  { "title": "Plan de diffusion", "hint": "Partager: discussion, audio, visuel." },
  { "title": "Mise en pratique", "hint": "Actions concrètes pour la semaine." },
  { "title": "Suivi et accountability", "hint": "Qui me suit? Quand? Indicateurs." },
  { "title": "Évaluation", "hint": "Auto-évaluation des objectifs fixés." },
  { "title": "Synthèse en 3 points", "hint": "Résumé court et clair." },
  { "title": "Questions ouvertes", "hint": "Ce qui reste à creuser." },
  { "title": "Prière de clôture", "hint": "Confier les fruits à Dieu." }
];

// Si jamais tu veux afficher exactement et textuellement le contenu de ton JSON
// (titres/labels différents), tu peux éditer la constante POINTS ci-dessus.

export default async function handler(req, res) {
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h

  // Format attendu par le front: [{ title, hint }]
  // (Le contenu provient de ton fichier "etude biblique 28 points.json")
  return res.status(200).json(POINTS);
}

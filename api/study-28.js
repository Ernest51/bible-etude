// api/study-28.js
// Sert les 28 points à partir de TON fichier ("points_etude": { "1": {...}, ..., "28": {...} })
// Réponse attendue par le front: JSON Array [{ title, hint }]
// - HEAD -> 200 (pour badge "health")
// - GET  -> 200 + JSON
// - Cache public 1h

const STUDY_JSON = {
  "points_etude": {
    "1":  { "titre": "Prière d’ouverture",                "description": "Invocation du Saint-Esprit pour éclairer l’étude.", "image": true },
    "2":  { "titre": "Canon et testament",                 "description": "Identification du livre selon le canon biblique.", "mode": "testament_uniquement" },
    "3":  { "titre": "Questions du chapitre précédent",    "nombre_minimum": 5, "reponse_integrale": true, "elements_comprehension_exiges": true },
    "4":  { "titre": "Titre du chapitre",                  "description": "Résumé doctrinal synthétique du chapitre étudié." },
    "5":  { "titre": "Contexte historique",                "carte_visuelle": true, "description": "Période, géopolitique, culture, carte localisée à l’époque." },
    "6":  { "titre": "Structure littéraire",               "description": "Séquençage narratif et composition interne du chapitre." },
    "7":  { "titre": "Genre littéraire",                   "description": "Type de texte : narratif, poétique, prophétique, etc." },
    "8":  { "titre": "Auteur et généalogie",               "genealogie": true, "description": "Présentation de l’auteur et son lien aux patriarches." },
    "9":  { "titre": "Verset-clé doctrinal",               "description": "Verset central du chapitre avec lien cliquable." },
    "10": { "titre": "Analyse exégétique",                 "description": "Commentaire mot-à-mot avec références au grec/hébreu." },
    "11": { "titre": "Analyse lexicale",                   "description": "Analyse des mots-clés originaux et leur sens doctrinal." },
    "12": { "titre": "Références croisées",                "description": "Passages parallèles ou complémentaires dans la Bible." },
    "13": { "titre": "Fondements théologiques",            "description": "Doctrines majeures qui émergent du chapitre." },
    "14": { "titre": "Thème doctrinal",                    "description": "Lien entre le chapitre et les 22 grands thèmes doctrinaux.", "correspondance_theme": "Au sujet d'un des thèmes des 22 thèmes, le livre étudié correspond à" },
    "15": { "titre": "Fruits spirituels",                  "description": "Vertus et attitudes inspirées par le chapitre." },
    "16": { "titre": "Types bibliques",                    "description": "Symboles ou figures typologiques présents." },
    "17": { "titre": "Appui doctrinal",                    "description": "Autres passages bibliques qui renforcent l'enseignement." },
    "18": { "titre": "Comparaison entre versets",          "description": "Versets comparés au sein du chapitre pour mise en relief." },
    "19": { "titre": "Comparaison avec Actes 2",           "description": "Parallèle avec le début de l’Église et le Saint-Esprit." },
    "20": { "titre": "Verset à mémoriser",                 "description": "Verset essentiel à retenir dans sa vie spirituelle." },
    "21": { "titre": "Enseignement pour l’Église",         "description": "Implications collectives et ecclésiales." },
    "22": { "titre": "Enseignement pour la famille",       "description": "Valeurs à transmettre dans le foyer chrétien." },
    "23": { "titre": "Enseignement pour enfants",          "description": "Méthode simplifiée avec jeux, récits, symboles visuels." },
    "24": { "titre": "Application missionnaire",           "description": "Comment le texte guide l’évangélisation." },
    "25": { "titre": "Application pastorale",              "description": "Conseils pour les ministres, pasteurs et enseignants." },
    "26": { "titre": "Application personnelle",            "description": "Examen de conscience et engagement individuel." },
    "27": { "titre": "Versets à retenir",                  "description": "Versets incontournables pour la prédication pastorale.", "pastorale": true },
    "28": { "titre": "Prière de fin",                      "description": "Clôture spirituelle de l’étude avec reconnaissance." }
  },
  "liens_cliquables": true,
  "structure_avec_liens_versets": true,
  "liens_cliquables_systematiques": true,
  "tableau_colonnes": true,
  "ordre_canonique": true,
  "mot_cle_activation": "ia [chapitre ou livre]",
  "style": "sobre, clair, spirituel, structuré",
  "memoire_automatique": true
};

// Transforme la structure { "1": {titre, description}, ... } en array [{title, hint}]
function makePoints(data) {
  const map = data && data.points_etude ? data.points_etude : {};
  const keys = Object.keys(map)
    .map(k => parseInt(k, 10))
    .filter(n => !Number.isNaN(n))
    .sort((a,b) => a - b);

  const arr = keys.map(n => {
    const p = map[String(n)] || {};
    return {
      title: p.titre || `Point ${n}`,
      hint: p.description || ""
    };
  });

  return arr;
}

const POINTS = makePoints(STUDY_JSON);

export default async function handler(req, res) {
  if (req.method === 'HEAD') {
    res.status(200).end();
    return;
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1h

  return res.status(200).json(POINTS);
}

// api/chat.js
// Remplacement complet — étape 1 : forcer un rendu Markdown strict 28 rubriques

import OpenAI from "openai";

/**
 * Attendu côté client (POST JSON):
 * {
 *   "book": "Genèse",
 *   "chapter": 1,
 *   "version": "LSG" // facultatif; par défaut LSG
 * }
 *
 * Réponse: texte/plain — Markdown strict prêt à sauvegarder dans GitHub.
 */

const SECTION_ORDER = [
  "1. Ouverture en prière",
  "2. Contexte historique",
  "3. Contexte littéraire",
  "4. Structure du passage",
  "5. Analyse exégétique et lexicale",
  "6. Personnages principaux",
  "7. Résumé du chapitre",
  "8. Thème théologique central",
  "9. Vérité spirituelle principale",
  "10. Verset-clé doctrinal",
  "11. Verset à mémoriser",
  "12. Références croisées",
  "13. Liens avec le reste de la Bible",
  "14. Jésus-Christ dans ce passage",
  "15. Questions de réflexion",
  "16. Applications pratiques",
  "17. Illustration",
  "18. Objections courantes",
  "19. Réponses",
  "20. Promesse de Dieu",
  "21. Commandement de Dieu",
  "22. Application communautaire",
  "23. Hymne ou chant suggéré",
  "24. Prière finale",
  "25. Pensée clé du jour",
  "26. Plan de lecture associé",
  "27. Limites et exceptions",
  "28. Conclusion",
];

// Gabarit de sortie OBLIGATOIRE — l’IA ne doit RIEN ajouter d’autre
const HARD_TEMPLATE = String.raw`
# {{LIVRE}} {{CHAPITRE}}

1. Ouverture en prière

{{PRIERRE_OUVERTURE}}

2. Contexte historique

{{CONTEXTE_HISTORIQUE}}

3. Contexte littéraire

{{CONTEXTE_LITTERAIRE}}

4. Structure du passage

{{STRUCTURE_PASSAGE}}

5. Analyse exégétique et lexicale

{{ANALYSE_LEXICALE}}

6. Personnages principaux

{{PERSONNAGES}}

7. Résumé du chapitre

{{RESUME}}

8. Thème théologique central

{{THEME_CENTRAL}}

9. Vérité spirituelle principale

{{VERITE_SPIRITUELLE}}

10. Verset-clé doctrinal

{{REF_VERSET_CLE}}
{{VERSET_CLE}}

11. Verset à mémoriser

{{REF_VERSET_MEMO}}
{{VERSET_MEMO}}

12. Références croisées

{{REFERENCES_CROISEES}}

13. Liens avec le reste de la Bible

{{LIENS_BIBLE}}

14. Jésus-Christ dans ce passage

{{CHRIST_PASSAGE}}

15. Questions de réflexion

{{QUESTIONS_REFLEXION}}

16. Applications pratiques

{{APPLICATIONS_PRATIQUES}}

17. Illustration

{{ILLUSTRATION}}

18. Objections courantes

{{OBJECTIONS}}

19. Réponses

{{REPONSES}}

20. Promesse de Dieu

{{PROMESSE}}

21. Commandement de Dieu

{{COMMANDEMENT}}

22. Application communautaire

{{APPLICATION_COMMUNAUTAIRE}}

23. Hymne ou chant suggéré

{{CHANT_SUGGERE}}

24. Prière finale

{{PRIERE_FINALE}}

25. Pensée clé du jour

{{PENSEE_CLE}}

26. Plan de lecture associé

{{PLAN_LECTURE}}

27. Limites et exceptions

{{LIMITES}}

28. Conclusion

{{CONCLUSION}}
`.trim();

const SYSTEM = `
Tu es un assistant théologique francophone chargé de produire des études bibliques
**strictement** au format Markdown selon un canevas en 28 rubriques (numérotées 1→28).
Contraintes non négociables:
- La sortie doit être EXCLUSIVEMENT du Markdown conforme au gabarit fourni (HARD_TEMPLATE).
- Pas de préambule, pas d'appendice, pas de commentaires hors canevas.
- Chaque rubrique doit contenir du texte rédigé (phrases complètes), pas de puces vides.
- Les versets cités doivent utiliser **Louis Segond 1910 (LSG)** par défaut.
- Quand tu donnes un verset (rubriques 10 et 11), affiche d'abord la référence sur une ligne,
  puis le verset sur la ligne suivante entre guillemets français « … », en LSG.
- Si une information est incertaine, écris « — ».
- Ajoute, lorsque pertinent, le lien YouVersion du chapitre sous forme
  (ex. pour Genèse 1 en LSG: https://www.bible.com/fr/bible/93/GEN.1.LSG).
- Tu respectes strictement l'ordre et les titres des 28 rubriques.
- Style: clair, pastoral, pédagogique, synthétique (3–6 phrases par rubrique en moyenne),
  avec précision doctrinale, sans polémiques inutiles.
`;

function youVersionLink(book, chapter) {
  // Map minimal pour quelques livres. Tu pourras étendre selon ton besoin.
  const map = {
    "Genèse": "GEN",
    "Exode": "EXO",
    "Lévitique": "LEV",
    "Nombres": "NUM",
    "Deutéronome": "DEU",
    // ...
  };
  const code = map[book] || "";
  if (!code) return "";
  // 93 = LSG sur YouVersion
  return `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const { book, chapter, version = "LSG" } = req.body || {};
    if (!book || !chapter) {
      res.status(400).send("Requête invalide: 'book' et 'chapter' sont requis.");
      return;
    }

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const link = youVersionLink(String(book), Number(chapter));

    // Message utilisateur ultra-spécifique et verrouillé sur notre gabarit
    const USER = `
Génère une étude **complète** pour

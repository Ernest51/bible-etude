// api/chat.js — Version unifiée Markdown 28 rubriques
// - Accepte { book, chapter, version } OU { q }
// - Répond TOUJOURS en text/markdown (canevas 28 sections)
// - Fallback déterministe si OPENAI_API_KEY absent (pas d'erreur 500)

import OpenAI from "openai";

// --- Constantes canevas ---
const SECTION_TITLES = [
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

const HARD_TEMPLATE = String.raw`
# {{BOOK}} {{CHAPTER}}

1. Ouverture en prière

{{PRAYER_OPEN}}

2. Contexte historique

{{HIST_CONTEXT}}

3. Contexte littéraire

{{LIT_CONTEXT}}

4. Structure du passage

{{STRUCTURE}}

5. Analyse exégétique et lexicale

{{LEX_ANALYSIS}}

6. Personnages principaux

{{PERSONS}}

7. Résumé du chapitre

{{SUMMARY}}

8. Thème théologique central

{{THEME}}

9. Vérité spirituelle principale

{{SPIRITUAL_TRUTH}}

10. Verset-clé doctrinal

{{REF_KEY}}
{{VERSE_KEY}}

11. Verset à mémoriser

{{REF_MEMO}}
{{VERSE_MEMO}}

12. Références croisées

{{CROSSREFS}}

13. Liens avec le reste de la Bible

{{BIBLE_LINKS}}

14. Jésus-Christ dans ce passage

{{CHRIST}}

15. Questions de réflexion

{{QUESTIONS}}

16. Applications pratiques

{{APPS}}

17. Illustration

{{ILLUSTRATION}}

18. Objections courantes

{{OBJECTIONS}}

19. Réponses

{{ANSWERS}}

20. Promesse de Dieu

{{PROMISE}}

21. Commandement de Dieu

{{COMMAND}}

22. Application communautaire

{{COMMUNITY_APP}}

23. Hymne ou chant suggéré

{{HYMN}}

24. Prière finale

{{PRAYER_CLOSE}}

25. Pensée clé du jour

{{KEY_THOUGHT}}

26. Plan de lecture associé

{{READING}}

27. Limites et exceptions

{{LIMITS}}

28. Conclusion

{{CONCLUSION}}
`.trim();

// --- Utilitaires ---
function parseQ(q) {
  // "Genèse 1" -> { book:"Genèse", chapter:1 }
  if (!q) return { book: "", chapter: NaN };
  const m = q.match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { book: m[1].trim(), chapter: Number(m[2]) };
  return { book: q.trim(), chapter: NaN };
}

function youVersionLink(book, chapter) {
  const map = {
    "Genèse": "GEN", "Exode": "EXO", "Lévitique": "LEV", "Nombres": "NUM", "Deutéronome": "DEU",
    "Josué": "JOS", "Juges": "JDG", "Ruth": "RUT", "1 Samuel": "1SA", "2 Samuel": "2SA",
    "1 Rois": "1KI", "2 Rois": "2KI", "1 Chroniques": "1CH", "2 Chroniques": "2CH",
    "Esdras": "EZR", "Néhémie": "NEH", "Esther": "EST", "Job": "JOB", "Psaumes": "PSA",
    "Proverbes": "PRO", "Ecclésiaste": "ECC", "Cantique des cantiques": "SNG", "Ésaïe": "ISA",
    "Jérémie": "JER", "Lamentations": "LAM", "Ézéchiel": "EZK", "Daniel": "DAN",
    "Osée": "HOS", "Joël": "JOL", "Amos": "AMO", "Abdias": "OBA", "Jonas": "JON",
    "Michée": "MIC", "Nahoum": "NAM", "Habacuc": "HAB", "Sophonie": "ZEP",
    "Aggée": "HAG", "Zacharie": "ZEC", "Malachie": "MAL",
    // (Ajoute NT si besoin)
  };
  const code = map[book];
  return code ? `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG` : "";
}

function fallbackMarkdown(book, chapter) {
  const ref = `${book} ${chapter}`;
  const link = youVersionLink(book, chapter) || "—";
  const md = HARD_TEMPLATE
    .replace("{{BOOK}}", book)
    .replace("{{CHAPTER}}", String(chapter))
    .replace("{{PRAYER_OPEN}}", `Seigneur Tout-Puissant, éclaire ma lecture de ${ref}. Ouvre mon cœur à ta Parole et conduis-moi dans l’obéissance. Amen.`)
    .replace("{{HIST_CONTEXT}}", `La ${book} s’inscrit dans l’histoire d’Israël. ${book} ${chapter} introduit des vérités fondatrices destinées au peuple de Dieu.`)
    .replace("{{LIT_CONTEXT}}", `Le passage présente une structure soignée, marquée par des répétitions qui soulignent l’ordre et l’intention.`)
    .replace("{{STRUCTURE}}", `—`)
    .replace("{{LEX_ANALYSIS}}", `—`)
    .replace("{{PERSONS}}", `—`)
    .replace("{{SUMMARY}}", `—`)
    .replace("{{THEME}}", `—`)
    .replace("{{SPIRITUAL_TRUTH}}", `—`)
    .replace("{{REF_KEY}}", `${book} ${chapter}:1`)
    .replace("{{VERSE_KEY}}", `« … » (LSG)`)
    .replace("{{REF_MEMO}}", `${book} ${chapter}:1`)
    .replace("{{VERSE_MEMO}}", `« … » (LSG)`)
    .replace("{{CROSSREFS}}", `YouVersion : ${link}`)
    .replace("{{BIBLE_LINKS}}", `—`)
    .replace("{{CHRIST}}", `—`)
    .replace("{{QUESTIONS}}", `—`)
    .replace("{{APPS}}", `—`)
    .replace("{{ILLUSTRATION}}", `—`)
    .replace("{{OBJECTIONS}}", `—`)
    .replace("{{ANSWERS}}", `—`)
    .replace("{{PROMISE}}", `—`)
    .replace("{{COMMAND}}", `—`)
    .replace("{{COMMUNITY_APP}}", `—`)
    .replace("{{HYMN}}", `—`)
    .replace("{{PRAYER_CLOSE}}", `Père, merci pour ta Parole. Donne-moi de la mettre en pratique et d’honorer le Christ en tout. Amen.`)
    .replace("{{KEY_THOUGHT}}", `Tout commence par Dieu.`)
    .replace("{{READING}}", `Lire ${book} ${chapter + 1 || chapter} ou Jean 1 pour prolonger.`)
    .replace("{{LIMITS}}", `Le texte vise d’abord la révélation théologique, pas la description scientifique.`)
    .replace("{{CONCLUSION}}", `${book} ${chapter} fonde notre

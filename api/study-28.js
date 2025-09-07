// --- Remplace la CONST des titres par l'ordre EXACT de ta colonne gauche ---
// (1 → 28)
const TITLES_FULL = [
  "Prière d’ouverture",
  "Canon et testament",
  "Questions du chapitre précédent",
  "Titre du chapitre",
  "Contexte historique",
  "Structure littéraire",
  "Genre littéraire",
  "Thème central",
  "Résumé en une phrase",
  "Mots-clés",
  "Termes clés (définis)",
  "Personnages et lieux",
  "Problème / Question de départ",
  "Idées majeures (développement)",
  "Verset pivot (climax)",
  "Références croisées (AT)",
  "Références croisées (NT)",
  "Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)",
  "Vérités doctrinales (3–5)",
  "Promesses et avertissements",
  "Principes intemporels",
  "Applications personnelles (3–5)",
  "Applications communautaires",
  "Questions pour petits groupes (6)",
  "Prière guidée",
  "Méditation courte",
  "Versets à mémoriser (2–3)"
];

const TITLES_MINI = [
  "Thème central",
  "Idées majeures (développement)",
  "Applications personnelles (3–5)"
];

// petit utilitaire déjà présent chez toi : on garde
function stripHtml(html){
  return String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

// --- Fonction qui fabrique le contenu de base pour CHAQUE titre ---
function contentFor(title, ref, firstSentence, keywords) {
  // mots saillants déjà extraits (tableau de 5 à 10 mots, optionnel)
  const kw = (keywords && keywords.length) ? "Mots saillants: " + keywords.slice(0,10).join(", ") + "." : "";

  switch (title) {
    case "Prière d’ouverture":
      return `Invocation du Saint-Esprit pour éclairer l’étude.`;
    case "Canon et testament":
      return `Identification du livre selon le canon biblique.`;
    case "Questions du chapitre précédent":
      return `Contexte immédiat et progression interne visibles à la lecture.`;
    case "Titre du chapitre":
      return `Attribution traditionnelle (présentée avec prudence) et place canonique.`;
    case "Contexte historique":
      return `Période, géopolitique, culture, carte localisée à l’époque.`;
    case "Structure littéraire":
      return `Séquençage narratif et composition interne du chapitre.`;
    case "Genre littéraire":
      return `Plan : Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).`;
    case "Thème central":
      return `Lecture de **${ref}**. ${kw}`.trim();
    case "Résumé en une phrase":
      return `En bref : ${firstSentence}`;
    case "Mots-clés":
      return `• ${ (keywords||[]).slice(0,10).join(" • ") }`;
    case "Termes clés (définis)":
      return (keywords||[]).slice(0,5).map(k=>`• **${k}** — définition/usage dans le passage.`).join("\n") || "—";
    case "Personnages et lieux":
      return `Acteurs et lieux repérables (noms propres, toponymes, fonctions).`;
    case "Problème / Question de départ":
      return `Question directrice posée par le texte lui-même.`;
    case "Idées majeures (développement)":
      return `Développement : enchaînement des idées majeures relevées.`;
    case "Verset pivot (climax)":
      return `Point pivot (climax) : ${firstSentence}`;
    case "Références croisées (AT)":
      return `AT : passages parallèles/échos prudents.`;
    case "Références croisées (NT)":
      return `NT : reprises/éclairages christologiques.`;
    case "Parallèles bibliques":
      return `Parallèles bibliques (motifs, structures, promesses/accomplissements).`;
    case "Lien avec l’Évangile (Christocentrique)":
      return `Lecture christocentrique mesurée (fonction christologique du passage).`;
    case "Vérités doctrinales (3–5)":
      return `3–5 vérités doctrinales mises en évidence.`;
    case "Promesses et avertissements":
      return `Promesses et avertissements implicites/explicites.`;
    case "Principes intemporels":
      return `Principes intemporels applicables aujourd’hui.`;
    case "Applications personnelles (3–5)":
      return `Applications personnelles (3–5 pas concrets).`;
    case "Applications communautaires":
      return `Applications communautaires/écclésiales.`;
    case "Questions pour petits groupes (6)":
      return `6 questions pour la discussion en groupe.`;
    case "Prière guidée":
      return `Prière guidée ancrée dans **${ref}**.`;
    case "Méditation courte":
      return `Méditation courte : relire la phrase clé, rendre grâce.`;
    case "Versets à mémoriser (2–3)":
      return `2–3 versets à mémoriser.`;
    default:
      return firstSentence || "";
  }
}

// --- Génération déterministe des sections, dans le bon ordre ---
function sectionsFrom(passageRef, passageText, mode, fallbackMsg) {
  const titles = mode === "mini" ? TITLES_MINI : TITLES_FULL;
  const txt = passageText || "";
  const firstSentence = (txt.match(/(.+?[.!?])(\s|$)/u)?.[1] || txt.slice(0, 120) || fallbackMsg).trim();
  // petite extraction de mots "saillants"
  const words = txt.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-zA-Zàâäéèêëîïôöùûüçœœ'\s-]/g,' ')
    .split(/\s+/).filter(w => w.length > 2);
  const freq = {};
  for (const w of words) freq[w] = (freq[w]||0)+1;
  const keywords = Object.entries(freq)
    .filter(([w]) => !["les","des","que","une","dans","avec","pour","qui","par","ses","sur","aux","est","tout","plus","mais","son","entre","leur","comme","nous","vous","elle","ils","elles","aussi","ainsi"].includes(w))
    .sort((a,b)=>b[1]-a[1]).map(([w])=>w).slice(0,10);

  return titles.map((title, i) => ({
    index: i + 1,
    title,
    content: contentFor(title, passageRef, firstSentence, keywords),
    verses: []
  }));
}

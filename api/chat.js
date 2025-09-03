// /api/chat.js
// Next.js / Vercel API Route
// - POST JSON: { book, chapter, verse?, version?, directives? }
// - Renvoie toujours 28 rubriques, avec rubrique 1 = prière d’ouverture *spécifique au chapitre*.
// - Génération IA en 2 étapes (extraction de motifs puis prière) pour éviter les prières génériques.
// - Fallback varié et contextuel (sans IA) pour ne plus avoir deux prières identiques.
// - Compatible avec le front existant (id 1..28, title, content). Gère { probe:true }.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ---------- Utils généraux ---------- */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}

function shortPara(t) {
  return `<p>${t}</p>`;
}

/* ---------- Heuristique de motifs (fallback sans IA) ---------- */
// Couvre Genèse 1 par plages de versets + catégories larges pour le reste.
// Objectif: éviter les doublons et coller au chapitre si l’IA n’est pas dispo.

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  // Focus : Genèse 1 (très demandé)
  if (b === "genèse" || b === "genese") {
    if (ch === 1) {
      if (!v) {
        return ["création", "Parole qui ordonne", "lumière et ténèbres", "séparations", "vie naissante", "image de Dieu"];
      }
      if (v === 1)  return ["cieux et terre", "commencement", "Parole créatrice"];
      if (v === 2)  return ["tohu-bohu", "ténèbres", "Esprit planant", "eaux profondes"];
      if (v <= 5)   return ["Que la lumière soit", "séparation lumière/ténèbres", "jour et nuit"];
      if (v <= 8)   return ["étendue", "séparation des eaux", "ciel"];
      if (v <= 13)  return ["réunion des eaux", "terre sèche", "végétation"];
      if (v <= 19)  return ["astres", "signes et saisons", "soleil et lune"];
      if (v <= 23)  return ["poissons", "oiseaux", "bénédiction de fécondité"];
      if (v <= 31)  return ["animaux terrestres", "homme et femme", "image de Dieu", "domination responsable"];
    }
  }

  // Catégories larges (OT / NT) si pas de cas spécifique
  const isOT = [
    "genèse","exode","lévitique","nombres","deutéronome","josué","juges","ruth","1 samuel","2 samuel","1 rois","2 rois",
    "1 chroniques","2 chroniques","esdras","néhémie","esther","job","psaumes","proverbes","ecclésiaste","cantique des cantiques",
    "Ésaïe","esaie","isaïe","isaie","jérémie","lamentations","Ézéchiel","ezekiel","ézéchiel","daniel","osée","joël","amos",
    "abdias","jonas","michée","nahoum","habacuc","sophonie","aggée","zacharie","malachie"
  ].includes(b);

  if (isOT) return ["Alliance", "fidélité de Dieu", "appel à l’obéissance", "justice et miséricorde"];

  // NT: évangiles, Actes, épîtres, Apocalypse
  if (["matthieu","marc","luc","jean"].includes(b)) {
    return ["Royaume de Die]()

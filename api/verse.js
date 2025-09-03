// pages/api/verse.js
// Next.js API Route — renvoie un verset unique (texte brut).
// Source = "local" si trouvé, sinon ok:true mais text:"" et warn.

export const config = { runtime: "nodejs" };

/* --- Normalisation livre FR --- */
const norm = (s) => String(s || "").trim()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase();

const ALIASES = {
  "genese": "Genèse", "genèse": "Genèse",
  "psaume": "Psaumes", "psaumes": "Psaumes",
  "esaie": "Ésaïe", "esaïe": "Ésaïe", "isaie": "Ésaïe", "isaïe": "Ésaïe",
  "ephesiens": "Éphésiens", "ephe­siens": "Éphésiens", "ephésiens": "Éphésiens",
  "colossiens": "Colossiens", "hebreux": "Hébreux", "hébreux": "Hébreux",
  "exode": "Exode", "josue": "Josué", "josué": "Josué",
  "jean": "Jean", "romains": "Romains"
};
function normalizeBook(frName) {
  const n = norm(frName);
  return ALIASES[n] || frName;
}

/* --- Mini cache local Louis Segond 1910 --- */
const LSG = {
  // Genèse 1
  "Genèse/1/1": "Au commencement, Dieu créa les cieux et la terre.",
  "Genèse/1/2": "La terre était informe et vide; il y avait des ténèbres à la surface de l’abîme, et l’Esprit de Dieu se mouvait au-dessus des eaux.",
  "Genèse/1/3": "Dieu dit: Que la lumière soit! Et la lumière fut.",
  "Genèse/1/9": "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.",

  // Psaumes 33
  "Psaumes/33/6": "Les cieux ont été faits par la parole de l’Éternel, Et toute leur armée par le souffle de sa bouche.",

  // Jean 1
  "Jean/1/1": "Au commencement était la Parole, et la Parole était avec Dieu, et la Parole était Dieu.",
  "Jean/1/2": "Elle était au commencement avec Dieu.",
  "Jean/1/3": "Toutes choses ont été faites par elle, et rien de ce qui a été fait n’a été fait sans elle.",

  // Hébreux 11
  "Hébreux/11/3": "C’est par la foi que nous reconnaissons que le monde a été formé par la parole de Dieu, en sorte que ce qu’on voit n’a pas été fait de choses visibles.",

  // Colossiens 1
  "Colossiens/1/16": "Car en lui ont été créées toutes les choses qui sont dans les cieux et sur la terre, les visibles et les invisibles, trônes, dignités, dominations, autorités. Tout a été créé par lui et pour lui.",

  // Psaumes 104
  "Psaumes/104/24": "Que tes œuvres sont en grand nombre, ô Éternel! Tu les as toutes faites avec sagesse. La terre est remplie de tes biens.",

  // Exode 34
  "Exode/34/6": "Et l’Éternel passa devant lui, et s’écria: L’Éternel! l’Éternel! Dieu miséricordieux et compatissant, lent à la colère, riche en bonté et en fidélité,",
  "Exode/34/7": "qui conserve son amour jusqu’à mille générations, qui pardonne l’iniquité, la rébellion et le péché, mais qui ne tient point le coupable pour innocent, et qui punit l’iniquité des pères sur les enfants et sur les enfants des enfants jusqu’à la troisième et la quatrième génération.",

  // Josué 1
  "Josué/1/8": "Que ce livre de la loi ne s’éloigne point de ta bouche; médite-le jour et nuit, pour agir fidèlement selon tout ce qui y est écrit; car c’est alors que tu auras du succès dans tes entreprises, c’est alors que tu réussiras.",
  "Josué/1/9": "Ne t’ai-je pas donné cet ordre: Fortifie-toi et prends courage? Ne t’effraie point et ne t’épouvante point, car l’Éternel, ton Dieu, est avec toi dans tout ce que tu entreprendras."
};

/* --- Handler --- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { book = "Genèse", chapter = 1, verse = 1, version = "LSG" } = req.body || {};
    const B = normalizeBook(book);
    const key = `${B}/${chapter}/${verse}`;
    const text = LSG[key] || "";

    if (text) {
      return res.status(200).json({
        ok: true,
        source: "local",
        book: B,
        chapter: Number(chapter),
        verse: Number(verse),
        reference: `${B} ${chapter}:${verse}`,
        version,
        text
      });
    } else {
      return res.status(200).json({
        ok: true,
        source: "none",
        book: B,
        chapter: Number(chapter),
        verse: Number(verse),
        reference: `${B} ${chapter}:${verse}`,
        version,
        text: "",
        warn: "Verset non disponible (local)"
      });
    }
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

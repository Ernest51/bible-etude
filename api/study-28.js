// api/study-28.js
// Étude biblique structurée en 28 points, sans OpenAI.
// Récupère le texte depuis api.bible (fallback passages → chapters).

export const config = { runtime: "nodejs" };

const API_KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || "";

// ----------------- helpers -----------------
function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

function makeSections(book, chapter, passageText) {
  const titles = [
    "Thème central",
    "Résumé en une phrase",
    "Contexte historique",
    "Auteur et date",
    "Genre littéraire",
    "Structure du passage",
    "Plan détaillé",
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
    "Versets à mémoriser (2–3)",
    "Difficultés/objections & réponses",
    "Ressources complémentaires",
  ];
  return titles.map((t, i) => ({
    index: i + 1,
    title: t,
    content: `${t} (${book} ${chapter}). ${passageText || "(Passage non récupéré)"}`,
    verses: []
  }));
}

// ----------------- api.bible fetch -----------------
async function fetchBible(endpoint) {
  const r = await fetch(`https://api.scripture.api.bible/v1${endpoint}`, {
    headers: { "api-key": API_KEY, accept: "application/json" }
  });
  const txt = await r.text();
  let j = {};
  try { j = JSON.parse(txt); } catch { j = { raw: txt }; }
  return { ok: r.ok, status: r.status, json: j };
}

async function getPassageSafe({ bibleId, osis }) {
  if (!bibleId) bibleId = DEFAULT_BIBLE_ID;
  if (!bibleId) throw new Error("Missing bibleId");

  // 1. try /passages
  let r = await fetchBible(`/bibles/${bibleId}/passages/${encodeURIComponent(osis)}`);
  if (r.ok && r.json?.data?.content) {
    return {
      reference: r.json?.data?.reference || osis,
      contentHtml: r.json?.data?.content || ""
    };
  }

  // 2. fallback /chapters
  r = await fetchBible(`/bibles/${bibleId}/chapters/${encodeURIComponent(osis)}`);
  if (r.ok && r.json?.data?.content) {
    return {
      reference: r.json?.data?.reference || osis,
      contentHtml: r.json?.data?.content || ""
    };
  }

  throw new Error(`api.bible failed for ${osis}: ${r.status}`);
}

// ----------------- handler -----------------
export default async function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, "http://x");
    const selftest = searchParams.get("selftest");
    if (selftest) {
      return send(res, 200, {
        ok: true,
        engine: "LLM-FREE",
        modes: ["mini", "full"],
        usesApiBible: !!API_KEY,
        source: "study-28"
      });
    }

    const book = searchParams.get("book") || "Genèse";
    const chapter = searchParams.get("chapter") || "1";
    const verse = searchParams.get("verse") || "";
    const bibleId = searchParams.get("bibleId") || DEFAULT_BIBLE_ID;
    const translation = searchParams.get("translation") || "LSG";
    const mode = searchParams.get("mode") || "full";
    const dry = searchParams.get("dry");

    let passageText = "";
    let ref = `${book} ${chapter}`;
    let osis = "";

    if (!dry) {
      try {
        osis = `${bookMap(book)}.${chapter}`; // convert livre → code OSIS
        const p = await getPassageSafe({ bibleId, osis });
        passageText = stripHtml(p.contentHtml).slice(0, 200); // tronqué pour test
        ref = p.reference || ref;
      } catch (e) {
        passageText = `(Passage non récupéré : ${e.message})`;
      }
    } else {
      passageText = `Exemple de texte.`;
    }

    const sections = makeSections(book, chapter, passageText);

    return send(res, 200, {
      ok: true,
      data: {
        meta: { book, chapter, verse, translation, reference: ref, osis },
        sections
      }
    });
  } catch (e) {
    return send(res, 500, { ok: false, error: e.message || "study28_failed" });
  }
}

// ----------------- utilitaires -----------------
function stripHtml(html) {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// table simplifiée Livre → code OSIS
function bookMap(name) {
  const map = {
    "Genèse": "GEN",
    "Exode": "EXO",
    "Lévitique": "LEV",
    "Nombres": "NUM",
    "Deutéronome": "DEU",
    "Josué": "JOS",
    "Juges": "JDG",
    "Ruth": "RUT",
    "1 Samuel": "1SA",
    "2 Samuel": "2SA",
    "1 Rois": "1KI",
    "2 Rois": "2KI",
    "1 Chroniques": "1CH",
    "2 Chroniques": "2CH",
    "Esdras": "EZR",
    "Néhémie": "NEH",
    "Esther": "EST",
    "Job": "JOB",
    "Psaumes": "PSA",
    "Proverbes": "PRO",
    "Ecclésiaste": "ECC",
    "Cantique des cantiques": "SNG",
    "Ésaïe": "ISA",
    "Jérémie": "JER",
    "Lamentations": "LAM",
    "Ézéchiel": "EZK",
    "Daniel": "DAN",
    "Osée": "HOS",
    "Joël": "JOL",
    "Amos": "AMO",
    "Abdias": "OBA",
    "Jonas": "JON",
    "Michée": "MIC",
    "Nahoum": "NAM",
    "Habacuc": "HAB",
    "Sophonie": "ZEP",
    "Aggée": "HAG",
    "Zacharie": "ZEC",
    "Malachie": "MAL",
    "Matthieu": "MAT",
    "Marc": "MRK",
    "Luc": "LUK",
    "Jean": "JHN",
    "Actes": "ACT",
    "Romains": "ROM",
    "1 Corinthiens": "1CO",
    "2 Corinthiens": "2CO",
    "Galates": "GAL",
    "Éphésiens": "EPH",
    "Philippiens": "PHP",
    "Colossiens": "COL",
    "1 Thessaloniciens": "1TH",
    "2 Thessaloniciens": "2TH",
    "1 Timothée": "1TI",
    "2 Timothée": "2TI",
    "Tite": "TIT",
    "Philémon": "PHM",
    "Hébreux": "HEB",
    "Jacques": "JAS",
    "1 Pierre": "1PE",
    "2 Pierre": "2PE",
    "1 Jean": "1JN",
    "2 Jean": "2JN",
    "3 Jean": "3JN",
    "Jude": "JUD",
    "Apocalypse": "REV"
  };
  return map[name] || name;
}

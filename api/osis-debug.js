// /api/osis-debug.js
export const config = { runtime: "nodejs" };

export default function handler(req, res) {
  try {
    const { searchParams } = new URL(req.url, "http://x");
    const book = (searchParams.get("book") || "Genèse").trim();
    const chapter = (searchParams.get("chapter") || "1").trim();

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
      "Apocalypse": "REV",
    };

    const osis = `${map[book] || book}.${chapter}`;
    res.status(200).json({ book, chapter, osis });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

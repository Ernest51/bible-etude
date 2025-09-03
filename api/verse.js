// /pages/api/verse.js
// POST JSON: { book, chapter, verse, version? }
// Réponse: { ok, source, book, chapter, verse, reference, version, text, warn? }
//
// - Utilise API.Bible (si API_BIBLE_KEY + API_BIBLE_ID sont définies) avec verseId USFM: GEN.1.2, etc.
// - Sinon fallback local LSG (Genèse 1:1–10).
// - Normalise l’output (book FR canonique + reference "Genèse 1:2").
// - Gère accents/alias (gn, 1 samuel, etc.).

export const config = { runtime: "nodejs" };

const API_BIBLE_KEY = process.env.API_BIBLE_KEY || "";
const API_BIBLE_ID  = process.env.API_BIBLE_ID  || "de4e12af7f28f599-02"; // LSG publique (API.Bible); change si besoin

/* ───────────── Mini-corpus local LSG (GN 1:1–10) ───────────── */
const LOCAL = {
  "GEN.1.1":  "Au commencement, Dieu créa les cieux et la terre.",
  "GEN.1.2":  "La terre était informe et vide; il y avait des ténèbres à la surface de l’abîme, et l’Esprit de Dieu se mouvait au-dessus des eaux.",
  "GEN.1.3":  "Dieu dit: Que la lumière soit! Et la lumière fut.",
  "GEN.1.4":  "Dieu vit que la lumière était bonne; et Dieu sépara la lumière d’avec les ténèbres.",
  "GEN.1.5":  "Dieu appela la lumière jour, et il appela les ténèbres nuit. Ainsi, il y eut un soir, et il y eut un matin: ce fut le premier jour.",
  "GEN.1.6":  "Dieu dit: Qu’il y ait une étendue entre les eaux, et qu’elle sépare les eaux d’avec les eaux.",
  "GEN.1.7":  "Et Dieu fit l’étendue, et il sépara les eaux qui sont au-dessous de l’étendue d’avec les eaux qui sont au-dessus de l’étendue. Et cela fut ainsi.",
  "GEN.1.8":  "Dieu appela l’étendue ciel. Ainsi, il y eut un soir, et il y eut un matin: ce fut le second jour.",
  "GEN.1.9":  "Dieu dit: Que les eaux qui sont au-dessous du ciel se rassemblent en un seul lieu, et que le sec paraisse. Et cela fut ainsi.",
  "GEN.1.10": "Dieu appela le sec terre, et il appela l’amas des eaux mers. Dieu vit que cela était bon."
};

/* ───────────── Mapping FR ⇄ USFM ───────────── */
const FR_TO_USFM = {
  "genèse":"GEN","genese":"GEN","gn":"GEN",
  "exode":"EXO","exo":"EXO",
  "lévitique":"LEV","levitique":"LEV","lev":"LEV",
  "nombres":"NUM","nb":"NUM","nom":"NUM",
  "deutéronome":"DEU","deuteronome":"DEU","dt":"DEU",
  "josué":"JOS","josue":"JOS","jos":"JOS",
  "juges":"JDG","jdc":"JDG","jdg":"JDG",
  "ruth":"RUT","rt":"RUT",
  "1 samuel":"1SA","2 samuel":"2SA",
  "1 rois":"1KI","2 rois":"2KI",
  "1 chroniques":"1CH","2 chroniques":"2CH",
  "esdras":"EZR","néhémie":"NEH","nehemie":"NEH",
  "esther":"EST","job":"JOB",
  "psaumes":"PSA","psaume":"PSA","ps":"PSA",
  "proverbes":"PRO","prov":"PRO",
  "ecclésiaste":"ECC","ecclesiaste":"ECC","qohelet":"ECC",
  "cantique des cantiques":"SNG","cantique":"SNG","ct":"SNG",
  "esaïe":"ISA","esaie":"ISA","isaïe":"ISA","isaie":"ISA","esa":"ISA","isa":"ISA",
  "jérémie":"JER","jeremie":"JER","jer":"JER",
  "lamentations":"LAM","la":"LAM",
  "ézéchiel":"EZK","ezechiel":"EZK","ezekiel":"EZK","ez":"EZK",
  "daniel":"DAN","dn":"DAN",
  "osée":"HOS","osee":"HOS","os":"HOS",
  "joël":"JOL","joel":"JOL","jl":"JOL",
  "amos":"AMO","am":"AMO",
  "abdias":"OBA","ab":"OBA",
  "jonas":"JON","jon":"JON",
  "michée":"MIC","michee":"MIC","mi":"MIC",
  "nahoum":"NAM","nahum":"NAM","na":"NAM",
  "habacuc":"HAB","hab":"HAB",
  "sophonie":"ZEP","sop":"ZEP","so":"ZEP",
  "aggée":"HAG","aggee":"HAG","ag":"HAG",
  "zacharie":"ZEC","zac":"ZEC","za":"ZEC",
  "malachie":"MAL","mal":"MAL",

  "matthieu":"MAT","mt":"MAT",
  "marc":"MRK","mc":"MRK",
  "luc":"LUK","lc":"LUK",
  "jean":"JHN","jn":"JHN",
  "actes":"ACT","ac":"ACT",
  "romains":"ROM","rm":"ROM",
  "1 corinthiens":"1CO","2 corinthiens":"2CO",
  "galates":"GAL","ga":"GAL",
  "éphésiens":"EPH","ephesiens":"EPH","ep":"EPH",
  "philippiens":"PHP","ph":"PHP",
  "colossiens":"COL","col":"COL",
  "1 thessaloniciens":"1TH","2 thessaloniciens":"2TH",
  "1 timothée":"1TI","2 timothée":"2TI",
  "tite":"TIT","tt":"TIT",
  "philémon":"PHM","philemon":"PHM","phm":"PHM",
  "hébreux":"HEB","heb":"HEB",
  "jacques":"JAS","jq":"JAS",
  "1 pierre":"1PE","2 pierre":"2PE",
  "1 jean":"1JN","2 jean":"2JN","3 jean":"3JN",
  "jude":"JUD","jd":"JUD",
  "apocalypse":"REV","apoc":"REV","ap":"REV"
};

// Canon FR canonique (pour sortie propre)
const USFM_TO_FR = {
  GEN:"Genèse", EXO:"Exode", LEV:"Lévitique", NUM:"Nombres", DEU:"Deutéronome",
  JOS:"Josué", JDG:"Juges", RUT:"Ruth", "1SA":"1 Samuel", "2SA":"2 Samuel",
  "1KI":"1 Rois", "2KI":"2 Rois", "1CH":"1 Chroniques", "2CH":"2 Chroniques",
  EZR:"Esdras", NEH:"Néhémie", EST:"Esther", JOB:"Job", PSA:"Psaumes",
  PRO:"Proverbes", ECC:"Ecclésiaste", SNG:"Cantique des cantiques",
  ISA:"Ésaïe", JER:"Jérémie", LAM:"Lamentations", EZK:"Ézéchiel", DAN:"Daniel",
  HOS:"Osée", JOL:"Joël", AMO:"Amos", OBA:"Abdias", JON:"Jonas", MIC:"Michée",
  NAM:"Nahoum", HAB:"Habacuc", ZEP:"Sophonie", HAG:"Aggée", ZEC:"Zacharie", MAL:"Malachie",
  MAT:"Matthieu", MRK:"Marc", LUK:"Luc", JHN:"Jean", ACT:"Actes",
  ROM:"Romains", "1CO":"1 Corinthiens", "2CO":"2 Corinthiens", GAL:"Galates",
  EPH:"Éphésiens", PHP:"Philippiens", COL:"Colossiens",
  "1TH":"1 Thessaloniciens", "2TH":"2 Thessaloniciens",
  "1TI":"1 Timothée", "2TI":"2 Timothée", TIT:"Tite", PHM:"Philémon",
  HEB:"Hébreux", JAS:"Jacques", "1PE":"1 Pierre", "2PE":"2 Pierre",
  "1JN":"1 Jean", "2JN":"2 Jean", "3JN":"3 Jean", JUD:"Jude", REV:"Apocalypse"
};

/* ───────────── Utils ───────────── */
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
function normFR(s){
  return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\./g," ").replace(/\s+/g," ").trim();
}
function getUsfm(bookFR){
  const k = normFR(bookFR);
  if (FR_TO_USFM[k]) return FR_TO_USFM[k];
  // essais "1samuel" → "1 samuel"
  const spaced = k.replace(/^([123])(\w)/, (_,d,rest)=>`${d} ${rest}`);
  return FR_TO_USFM[spaced] || null;
}
function frFromUsfm(usfm){ return USFM_TO_FR[usfm] || usfm; }

function makeRefFR(usfm, chapter, verse){
  const b = frFromUsfm(usfm);
  const ch = clamp(parseInt(chapter,10),1,200);
  if (verse) return `${b} ${ch}:${verse}`;
  return `${b} ${ch}`;
}

/* ───────────── API.Bible fetch (verseId direct) ───────────── */
async function fetchFromApiBible({ book, chapter, verse }) {
  if (!API_BIBLE_KEY || !API_BIBLE_ID) return null;

  const usfm = getUsfm(book);
  if (!usfm) throw new Error(`Livre non reconnu: “${book}” (ajoute un alias FR)`);

  const verseId = `${usfm}.${chapter}.${verse}`;
  const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(API_BIBLE_ID)}/verses/${encodeURIComponent(verseId)}?content-type=text&include-verse-numbers=false&include-titles=false&include-footnotes=false`;
  const r = await fetch(url, { headers: { "api-key": API_BIBLE_KEY } });
  if (!r.ok) {
    const msg = await r.text().catch(()=> "");
    throw new Error(`API.Bible ${r.status} — ${msg}`);
  }
  const j = await r.json().catch(()=>null);
  // j.data.content: HTML/text selon la Bible ; on fait simple (strip multi-spaces)
  const raw = j?.data?.content || "";
  const text = String(raw).replace(/\s+/g," ").trim();
  return { usfm, text };
}

/* ───────────── Handler ───────────── */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok:false, error:"Method Not Allowed" });
    return;
  }

  try {
    const { book="Genèse", chapter=1, verse=1, version="LSG" } = req.body || {};
    const C = clamp(+chapter, 1, 200);
    const V = clamp(+verse,   1, 300);

    let usfm = getUsfm(book);
    let text = null;
    let source = "";
    let warn = "";

    // 1) API.Bible si dispo
    try {
      const api = await fetchFromApiBible({ book, chapter:C, verse:V });
      if (api && api.text) {
        usfm = api.usfm;
        text = api.text;
        source = "api.bible";
      }
    } catch (e) {
      warn = `API.Bible KO — ${e.message}`;
    }

    // 2) Fallback local
    if (!text) {
      if (!usfm) usfm = "GEN";
      text = LOCAL[`${usfm}.${C}.${V}`] || null;
      if (text) source = "local";
    }

    if (!text) {
      const ref = makeRefFR(usfm || "GEN", C, V);
      res.status(404).json({ ok:false, error:"Verset non disponible", book: frFromUsfm(usfm||"GEN"), chapter:C, verse:V, reference:ref, version });
      return;
    }

    const outBook = frFromUsfm(usfm);
    const reference = makeRefFR(usfm, C, V);

    res.status(200).json({
      ok: true,
      source,
      book: outBook,
      chapter: C,
      verse: V,
      reference,
      version,
      text,
      ...(warn ? { warn } : {})
    });
  } catch (e) {
    res.status(500).json({ ok:false, error:String(e?.message || e) });
  }
}

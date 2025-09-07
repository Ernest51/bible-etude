// api/study-28.js
import { getPassage, resolveBibleId } from "./bibleProvider.js";

export const config = { runtime: "nodejs" };

// -------- FR → OSIS (tolérant)
const MAP = {
  "genese":"GEN","genèse":"GEN","gen":"GEN",
  "exode":"EXO","exo":"EXO",
  "levitique":"LEV","lévitique":"LEV","lev":"LEV",
  "nombres":"NUM","num":"NUM",
  "deuteronome":"DEU","deutéronome":"DEU","deu":"DEU",
  "josue":"JOS","josué":"JOS","jos":"JOS",
  "juges":"JDG","jdg":"JDG",
  "ruth":"RUT","rut":"RUT",
  "1samuel":"1SA","1 samuel":"1SA","1 sa":"1SA",
  "2samuel":"2SA","2 samuel":"2SA","2 sa":"2SA",
  "1rois":"1KI","1 rois":"1KI","1r":"1KI","1 roi":"1KI",
  "2rois":"2KI","2 rois":"2KI","2r":"2KI","2 roi":"2KI",
  "1chroniques":"1CH","1 chroniques":"1CH","1ch":"1CH",
  "2chroniques":"2CH","2 chroniques":"2CH","2ch":"2CH",
  "esdras":"EZR","esther":"EST","nehemie":"NEH","néhémie":"NEH",
  "job":"JOB","psaumes":"PSA","psaume":"PSA","ps":"PSA",
  "proverbes":"PRO","ecclesiaste":"ECC","ecclésiaste":"ECC",
  "cantique descantiques":"SNG","cantique des cantiques":"SNG","cantiques":"SNG","cantique":"SNG",
  "esaie":"ISA","esaïe":"ISA","ésaïe":"ISA","isaïe":"ISA","isa":"ISA",
  "jeremie":"JER","jérémie":"JER","lamentations":"LAM",
  "ezechiel":"EZK","ézéchiel":"EZK","ezk":"EZK",
  "daniel":"DAN","osee":"HOS","osée":"HOS","joel":"JOL","joël":"JOL",
  "amos":"AMO","abdias":"OBA","jonas":"JON","michee":"MIC","michée":"MIC",
  "nahum":"NAM","nahoum":"NAM","habacuc":"HAB","sophonie":"ZEP","aggee":"HAG","aggée":"HAG",
  "zacharie":"ZEC","malachie":"MAL",
  "matthieu":"MAT","marc":"MRK","luc":"LUK","jean":"JHN","actes":"ACT",
  "romains":"ROM","1corinthiens":"1CO","2corinthiens":"2CO","galates":"GAL",
  "ephesiens":"EPH","philippiens":"PHP","colossiens":"COL",
  "1thessaloniciens":"1TH","2thessaloniciens":"2TH",
  "1timothee":"1TI","2timothee":"2TI","tite":"TIT","philemon":"PHM",
  "hebreux":"HEB","jacques":"JAS","1pierre":"1PE","2pierre":"2PE",
  "1jean":"1JN","2jean":"2JN","3jean":"3JN","jude":"JUD","apocalypse":"REV"
};
function norm(s) {
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9 ]+/g,"")
    .replace(/\s+/g,"").trim();
}
function osisBook(book) {
  const key = norm(book);
  if (MAP[key]) return MAP[key];
  const hit = Object.keys(MAP).find(k => k.startsWith(key));
  return hit ? MAP[hit] : null;
}
function buildOsis({book, chapter, verse}) {
  const b = osisBook(book);
  if (!b) return null;
  const c = String(chapter||"1").trim();
  const v = String(verse||"").trim();
  if (!v) return `${b}.${c}`;
  if (/^\d+([\-–]\d+)?$/.test(v)) {
    if (v.includes("-") || v.includes("–")) {
      const [a,bv] = v.split(/[\-–]/).map(s=>s.trim());
      return `${b}.${c}.${a}-${b}.${c}.${bv}`;
    }
    return `${b}.${c}.${v}`;
  }
  return `${b}.${c}`;
}

function stripHtml(html){
  return String(html||"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

const TITLES = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)","Références croisées (AT)",
  "Références croisées (NT)","Parallèles bibliques","Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)",
  "Promesses et avertissements","Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];

function sectionsFrom(passageRef, passageText) {
  const firstSentence = passageText
    ? (passageText.match(/(.+?[.!?])(\s|$)/u)?.[1] || passageText.slice(0, 160))
    : "";
  const kw = (passageText || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-zàâäéèêëîïôöùûüçœ ]+/g," ")
    .split(/\s+/)
    .filter(w => w.length >= 3)
    .reduce((acc,w)=>{acc[w]=(acc[w]||0)+1;return acc;},{});
  const top10 = Object.entries(kw).sort((a,b)=>b[1]-a[1]).slice(0,10).map(([w])=>w);

  return TITLES.map((t, i) => {
    let content = "";
    switch (t) {
      case "Thème central":
        content = `Lecture de **${passageRef}**. Mots saillants: ${top10.join(", ")}.`; break;
      case "Résumé en une phrase":
        content = `En bref : ${firstSentence}`; break;
      case "Idées majeures (développement)":
        content = `Développement : enchaînement des idées majeures relevées.`; break;
      case "Verset pivot (climax)":
        content = `Point pivot (climax) : ${firstSentence}`; break;
      case "Prière guidée":
        content = `Prière guidée ancrée dans **${passageRef}**.`; break;
      case "Mots-clés":
        content = `• ${top10.join(" • ")}`; break;
      case "Termes clés (définis)":
        content = top10.slice(0,5).map(w => `• **${w}** — définition/usage dans le passage.`).join("\n"); break;
      default:
        // gabarit par défaut (sobre)
        content = {
          "Contexte historique": "Contexte immédiat et progression interne visibles à la lecture.",
          "Auteur et date": "Attribution traditionnelle (présentée avec prudence) et place canonique.",
          "Genre littéraire": "Type de texte (narratif/poétique/prophétique/discours) et ses indices formels.",
          "Structure du passage": "Structure : Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).",
          "Plan détaillé": "Plan : Découpage observé par répétitions et transitions (suggérer 3–6 mouvements).",
          "Personnages et lieux": "Acteurs et lieux repérables (noms propres, toponymes, fonctions).",
          "Problème / Question de départ": "Question directrice posée par le texte lui-même.",
          "Références croisées (AT)": "AT : passages parallèles/échos prudents.",
          "Références croisées (NT)": "NT : reprises/éclairages christologiques.",
          "Parallèles bibliques": "Parallèles bibliques (motifs, structures, promesses/accomplissements).",
          "Lien avec l’Évangile (Christocentrique)": "Lecture christocentrique mesurée (fonction christologique du passage).",
          "Vérités doctrinales (3–5)": "3–5 vérités doctrinales mises en évidence.",
          "Promesses et avertissements": "Promesses et avertissements implicites/explicites.",
          "Principes intemporels": "Principes intemporels applicables aujourd’hui.",
          "Applications personnelles (3–5)": "Applications personnelles (3–5 pas concrets).",
          "Applications communautaires": "Applications communautaires/écclésiales.",
          "Questions pour petits groupes (6)": "6 questions pour la discussion en groupe.",
          "Méditation courte": "Méditation courte : relire la phrase clé, rendre grâce.",
          "Versets à mémoriser (2–3)": "2–3 versets à mémoriser.",
          "Difficultés/objections & réponses": "Difficultés possibles et pistes de réponse.",
          "Ressources complémentaires": "Ressources complémentaires (intro, notes)."
        }[t] || `${t} — ${firstSentence}`;
    }
    return { index: i + 1, title: t, content, verses: [] };
  });
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

export default async function handler(req, res) {
  const trace = [];
  try {
    const url = new URL(req.url, "http://x");
    const sp = url.searchParams;

    const selftest = sp.get("selftest") === "1";
    if (selftest) return send(res, 200, { ok: true, engine: "LLM-FREE", source: "study-28", modes: ["full"] });

    const book = sp.get("book") || "Genèse";
    const chapter = sp.get("chapter") || "1";
    const verse = sp.get("verse") || "";
    const translation = sp.get("translation") || "JND";
    const bibleIdParam = sp.get("bibleId") || "";
    const wantTrace = sp.get("trace") === "1";

    const osis = buildOsis({ book, chapter, verse });
    const meta = { book, chapter: String(chapter), verse: String(verse || ""), translation, reference: `${book} ${chapter}${verse ? ":" + verse : ""}`, osis: osis || "" };

    if (!osis) {
      const sections = sectionsFrom(meta.reference, "");
      return send(res, 200, { ok: true, data: { meta, sections }, trace: wantTrace ? trace : undefined });
    }

    const effectiveBibleId = await resolveBibleId(bibleIdParam, trace);

    const p = await getPassage({ bibleId: effectiveBibleId, ref: osis, includeVerseNumbers: true }, trace);
    const passageRef = p.reference || meta.reference;
    const passageText = stripHtml(p.contentHtml);

    meta.reference = passageRef;
    meta.osis = osis;
    const sections = sectionsFrom(passageRef, passageText);

    return send(res, 200, { ok: true, data: { meta, sections }, trace: wantTrace ? trace : undefined });
  } catch (e) {
    return send(res, e?.status || 500, { ok: false, error: { code: String(e?.status || 500), message: String(e?.message || e) } });
  }
}

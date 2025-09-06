// api/study-28.js
export const config = { runtime: "nodejs" };

/**
 * Étude 28 rubriques (LLM-free) avec récupération du passage via api.bible.
 * Correctif majeur : conversion Livre (FR) -> OSIS (ex: "Genèse" -> "GEN")
 */

import { getPassage } from "./bibleProvider.js";

function send(res, status, payload) {
  res.status(status).setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}

// --- mapping FR -> OSIS (66 livres) ---
const FR_TO_OSIS = {
  "genèse": "GEN", "exode": "EXO", "lévitique": "LEV", "nombres": "NUM", "deutéronome": "DEU",
  "josué": "JOS", "juges": "JDG", "ruth": "RUT",
  "1 samuel": "1SA", "2 samuel": "2SA",
  "1 rois": "1KI", "2 rois": "2KI",
  "1 chroniques": "1CH", "2 chroniques": "2CH",
  "esdras": "EZR", "néhémie": "NEH", "esther": "EST",
  "job": "JOB", "psaumes": "PSA", "proverbes": "PRO", "ecclésiaste": "ECC", "cantique des cantiques": "SNG",
  "ésaïe": "ISA", "esaïe": "ISA", "esaie": "ISA", "isaïe": "ISA", "isaie": "ISA",
  "jérémie": "JER", "lamentations": "LAM", "ézéchiel": "EZK", "ezéchiel": "EZK", "ezechiel": "EZK",
  "daniel": "DAN", "osée": "HOS", "joël": "JOL", "amos": "AMO", "abdias": "OBA",
  "jonas": "JON", "michée": "MIC", "nahoum": "NAM", "habacuc": "HAB", "sophonie": "ZEP",
  "aggée": "HAG", "zacharie": "ZEC", "malachie": "MAL",
  "matthieu": "MAT", "marc": "MRK", "luc": "LUK", "jean": "JHN", "actes": "ACT",
  "romains": "ROM", "1 corinthiens": "1CO", "2 corinthiens": "2CO", "galates": "GAL",
  "éphésiens": "EPH", "ephésiens": "EPH", "ephesiens": "EPH",
  "philippiens": "PHP", "colossiens": "COL", "1 thessaloniciens": "1TH", "2 thessaloniciens": "2TH",
  "1 timothée": "1TI", "2 timothée": "2TI", "tite": "TIT", "philémon": "PHM",
  "hébreux": "HEB", "jacques": "JAS",
  "1 pierre": "1PE", "2 pierre": "2PE",
  "1 jean": "1JN", "2 jean": "2JN", "3 jean": "3JN",
  "jude": "JUD", "apocalypse": "REV",

  // variantes usuelles
  "cantique": "SNG",
  "cantiques": "SNG",
  "psaume": "PSA",
  "1 chr": "1CH", "2 chr": "2CH",
  "1 cor": "1CO", "2 cor": "2CO",
  "1 th": "1TH", "2 th": "2TH",
  "1 ti": "1TI", "2 ti": "2TI",
  "1 pi": "1PE", "2 pi": "2PE",
};

function toOsis(book) {
  if (!book) return null;
  const key = String(book).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  // essaie correspondance exacte puis commence-avec (ex: "1 Cor" -> "1 corinthiens")
  if (FR_TO_OSIS[key]) return FR_TO_OSIS[key];
  const hit = Object.keys(FR_TO_OSIS).find(k => k.startsWith(key));
  return hit ? FR_TO_OSIS[hit] : null;
}

const FIXED_TITLES = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];

// Construit "GEN.1", "GEN.1.3" ou "GEN.1.3-8" selon book/chapter/verse
function buildOsisRef(book, chapter, verse) {
  const osis = toOsis(book);
  if (!osis) return null;
  const chap = String(chapter || "1").trim();
  const vers = String(verse || "").trim();
  if (!vers) return `${osis}.${chap}`;
  // autoriser formes "1", "1-5", "1,3" (mais pour api.bible sur /passages, l’intervalle doit être continu)
  // On garde la première plage si virgules
  const main = vers.split(",")[0].trim();
  return `${osis}.${chap}.${main}`;
}

export default async function handler(req, res) {
  try {
    // GET (query) et POST (json) supportés
    let body = {};
    const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
    const selftest = searchParams.get("selftest") === "1";
    const dry = searchParams.get("dry") === "1";
    const mode = (searchParams.get("mode") || "").toLowerCase() || "full";

    if (selftest) {
      return send(res, 200, { ok: true, engine: "LLM-FREE", modes: ["mini","full"], usesApiBible: true, source: "study-28" });
    }

    if (req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      try { body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); } catch {}
    } else {
      body = {
        book: searchParams.get("book") || "",
        chapter: searchParams.get("chapter") || "",
        verse: searchParams.get("verse") || "",
        translation: searchParams.get("translation") || "LSG",
        bibleId: searchParams.get("bibleId") || "",
      };
    }

    const book = body.book || "";
    const chapter = body.chapter || "";
    const verse = body.verse || "";
    const translation = body.translation || "LSG";
    const bibleId = body.bibleId || "";

    if (!book || !chapter) return send(res, 400, { ok: false, error: "book et chapter requis" });

    // Meta de base (sera enrichie si api.bible répond)
    const meta = {
      book,
      chapter: String(chapter),
      verse: String(verse || ""),
      translation,
      reference: `${book} ${chapter}${verse ? ":" + verse : ""}`,
      osis: ""
    };

    // mode dry => pas d'appel api.bible
    if (dry) {
      const sections = FIXED_TITLES.map((t, i) => ({
        index: i + 1,
        title: t,
        content: `${t} (${meta.reference}).`,
        verses: []
      }));
      return send(res, 200, { ok: true, data: { meta, sections } });
    }

    // ----- Récupération du passage -----
    let passageText = "";
    let displayRef = meta.reference;
    let osisRef = buildOsisRef(book, chapter, verse);

    if (!osisRef) {
      // Si le nom ne matche pas, on renvoie une réponse "gracieuse"
      const sections = FIXED_TITLES.map((t, i) => ({
        index: i + 1,
        title: t,
        content: `${t} (${meta.reference}). (Passage non récupéré : livre inconnu)`,
        verses: []
      }));
      return send(res, 200, { ok: true, data: { meta, sections } });
    }

    try {
      const got = await getPassage({ bibleId, ref: osisRef, includeVerseNumbers: true });
      // `got.contentHtml` est du HTML; on le nettoie en texte simple court
      const clean = String(got.contentHtml || "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      passageText = clean;
      displayRef = got.reference || displayRef;
      meta.reference = displayRef;
      meta.osis = osisRef;
    } catch (e) {
      // Afficher le statut précis si fourni par bibleProvider
      const code = e?.status ? `api.bible ${e.status}` : String(e?.message || e);
      passageText = `(Passage non récupéré : ${code})`;
    }

    // ----- Génération des 28 rubriques -----
    const prefix = mode === "mini"
      ? ["Thème central","Idées majeures (développement)","Applications personnelles (3–5)"]
      : FIXED_TITLES;

    const sections = prefix.map((t, i) => ({
      index: i + 1,
      title: t,
      content: `${t} (${meta.reference}). ${passageText ? passageText.slice(0, 120) + "..." : ""}`,
      verses: []
    }));

    // Si on est en mode "full", on s’assure d’avoir 28 entrées (par sécurité)
    if (mode === "full" && sections.length < FIXED_TITLES.length) {
      for (let k = sections.length; k < FIXED_TITLES.length; k++) {
        sections.push({
          index: k + 1,
          title: FIXED_TITLES[k],
          content: `${FIXED_TITLES[k]} (${meta.reference}). ${passageText ? passageText.slice(0, 120) + "..." : ""}`,
          verses: []
        });
      }
    }

    return send(res, 200, { ok: true, data: { meta, sections } });
  } catch (e) {
    return send(res, 500, { ok: false, error: String(e?.message || e) });
  }
}

// app/api/study-28/route.js  (App Router)
// ou: pages/api/study-28.js   (Pages Router, export default handler)

import { NextResponse } from "next/server";

/**
 * LLM-FREE version
 * - Ne requiert AUCUNE clé OpenAI
 * - Lit le passage via /api/bibleProvider (que tu as déjà fonctionnel)
 * - Produit un JSON strict conforme à ton schéma:
 *   {
 *     meta: { book, chapter, verse, translation, reference, osis },
 *     sections: [{ index, title, content, verses: string[] }]
 *   }
 * - Supporte: ?mode=mini|full  et ?dry=1  et ?selftest=1
 */

// ----------------------------------------------------
// Utilitaires communs
// ----------------------------------------------------
function respond(payload, status = 200) {
  return NextResponse.json(payload, { status });
}

function clip(s, max = 240) {
  if (!s) return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max - 1).trimEnd() + "…" : t;
}

function firstSentence(text) {
  if (!text) return "";
  const clean = text.replace(/\s+/g, " ").trim();
  const m = clean.match(/(.+?[.!?])(\s|$)/u);
  return m ? m[1].trim() : clip(clean, 180);
}

function fallbackOsis(book, chapter) {
  // Très simple: prend 3 premières lettres du livre + chapitre (si pas fourni par bibleProvider)
  const code = (book || "BOOK").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (code.slice(0,3).toUpperCase() + "." + String(chapter || "1")).trim();
}

// ----------------------------------------------------
// Générateurs de contenu (sans IA)
// ----------------------------------------------------
const TITLES_FULL = [
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
  "Ressources complémentaires"
];

const TITLES_MINI = [
  "Thème central",
  "Idées majeures (développement)",
  "Applications personnelles"
];

// Heuristiques très prudentes: on ne “devine” pas des versets exacts.
// On se contente de phrases génériques qui s’appuient sur le passage et sa référence.
function makeMiniSections(reference, passageText) {
  const s1 = firstSentence(passageText) || `Lecture de ${reference}.`;
  return [
    {
      index: 1,
      title: TITLES_MINI[0],
      content: clip(`Passage étudié : ${reference}. ${s1}`),
      verses: []
    },
    {
      index: 2,
      title: TITLES_MINI[1],
      content: clip(`Idées maîtresses observables dans ${reference} : ordre du texte, thèmes récurrents, et progression interne du passage, sans extrapoler au-delà de ce qui est lu.`),
      verses: []
    },
    {
      index: 3,
      title: TITLES_MINI[2],
      content: clip(`À partir de ${reference}, appliquer de façon pratique ce qui ressort du passage (respect du texte, prière, mise en pratique sobre et mesurée).`),
      verses: []
    }
  ];
}

function makeFullSections(reference, passageText) {
  // Contenus concis (2 phrases max) qui ne sortent pas du texte et restent génériques.
  const intro = firstSentence(passageText) || `Lecture de ${reference}.`;
  const generic = (t) => clip(`${t} (${reference}).`);
  const qn = (q) => clip(`${q} — en s’appuyant uniquement sur ${reference}.`);

  const contents = [
    clip(`Passage étudié : ${reference}. ${intro}`),
    generic("Résumé bref du passage lu, sous forme factuelle"),
    generic("Contexte littéraire immédiat du passage (ce que le texte lui-même laisse entrevoir)"),
    generic("Attribution traditionnelle mentionnée prudemment, sans s’aventurer au-delà du texte"),
    generic("Nature générale du texte (récit, discours, poésie), d’après sa forme littéraire"),
    generic("Découpage interne observé à la simple lecture (mouvements/paragraphes)"),
    generic("Plan de lecture sobre (étapes logiques internes au passage)"),
    generic("Termes ou expressions saillants relevés dans le passage"),
    generic("Explications brèves de quelques expressions récurrentes du passage"),
    generic("Acteurs évoqués et espace du récit tels qu’ils apparaissent"),
    qn("Question directrice de lecture"),
    generic("Développement des idées qui émergent naturellement du texte"),
    generic("Point culminant interne du passage tel qu’il ressort de la lecture"),
    generic("Renvois internes éventuels à l’Ancien Testament mentionnés prudemment"),
    generic("Renvois internes éventuels au Nouveau Testament mentionnés prudemment"),
    generic("Échos ou parallèles scripturaires prudents (sans extrapolation)"),
    generic("Lecture christocentrique mesurée, en respectant le texte lu"),
    generic("Vérités doctrinales implicites ou explicites suggérées par le passage"),
    generic("Promesses et mises en garde telles que le passage les laisse entendre"),
    generic("Principes généraux que l’on peut déduire sobrement du passage"),
    generic("Applications personnelles possibles, en respectant le cadre du passage"),
    generic("Applications communautaires possibles, toujours ancrées dans le texte"),
    generic("Questions simples pour un partage en petit groupe sur le passage"),
    generic("Prière guidée ancrée dans le passage lu"),
    generic("Brève méditation pour prolonger la lecture"),
    generic("Quelques versets marquants à mémoriser dans ce passage"),
    generic("Difficultés possibles du passage et pistes de lecture sobres"),
    generic("Ressources complémentaires de lecture (sans prescrire de sources)")
  ];

  return contents.map((content, i) => ({
    index: i + 1,
    title: TITLES_FULL[i],
    content,
    verses: []
  }));
}

// ----------------------------------------------------
// Handler principal
// ----------------------------------------------------
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  // Entrées
  const book = searchParams.get("book") || "Genèse";
  const chapter = searchParams.get("chapter") || "1";
  const verse = searchParams.get("verse") || "";
  const translation = searchParams.get("translation") || "JND";
  const bibleId = searchParams.get("bibleId") || "";
  const mode = (searchParams.get("mode") || "full").toLowerCase(); // mini | full
  const dry = searchParams.get("dry") || "";
  const selftest = searchParams.get("selftest") === "1";

  try {
    // Self test
    if (selftest) {
      return respond({
        ok: true,
        engine: "LLM-FREE",
        modes: ["mini", "full"],
        source: "api.bibleProvider",
      });
    }

    // Dry-run (sans access API)
    const referenceDry = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    if (dry) {
      if (mode === "mini") {
        return respond({
          ok: true,
          data: {
            meta: { book, chapter, verse, translation, reference: referenceDry, osis: "" },
            sections: makeMiniSections(referenceDry, "Exemple de texte.")
          }
        });
      }
      return respond({
        ok: true,
        data: {
          meta: { book, chapter, verse, translation, reference: referenceDry, osis: "" },
          sections: makeFullSections(referenceDry, "Exemple de texte.")
        }
      });
    }

    // Appel BibleProvider
    const base = req.headers.get("x-forwarded-host")
      ? `https://${req.headers.get("x-forwarded-host")}`
      : "http://localhost:3000";

    const passageUrl =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    const pRes = await fetch(passageUrl);
    if (!pRes.ok) {
      return respond({ ok: false, error: `BibleProvider HTTP ${pRes.status}: ${await pRes.text()}` }, 502);
    }
    const pJson = await pRes.json();
    if (!pJson.ok) {
      return respond({ ok: false, error: pJson.error || "BibleProvider error" }, 502);
    }

    const passage = pJson.data || {};
    const osis = passage.osis || fallbackOsis(book, chapter);
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    const passageText = passage.passageText || "";

    // Génération LLM-FREE
    let sections;
    if (mode === "mini") {
      sections = makeMiniSections(reference, passageText);
    } else {
      sections = makeFullSections(reference, passageText);
    }

    // Meta + réponse
    const data = {
      meta: { book, chapter, verse, translation, reference, osis },
      sections
    };

    return respond({ ok: true, data });
  } catch (e) {
    return respond({ ok: false, error: String(e) }, 500);
  }
}

// Pages Router fallback (décommente si tu es en /pages)
// export default async function handler(req, res) {
//   const url = new URL(req.url, `http://${req.headers.host}`);
//   const r = await GET({ url, headers: new Map(Object.entries(req.headers)) });
//   const json = await r.json();
//   res.status(r.status || 200).json(json);
// }

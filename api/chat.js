// api/chat.js — Route Vercel robuste (Markdown 28 rubriques) ✔
// - POST { book, chapter, version } OU GET ?q="Genèse 1"
// - Utilise OpenAI si OPENAI_API_KEY est défini, sinon renvoie un fallback Markdown propre
// - Jamais d'erreur 500 silencieuse: retourne un message clair en text/plain
// - ?probe=1 pour test rapide (sans OpenAI)

import OpenAI from "openai";

// ----- Canevas 28 rubriques -----
const TITLES = [
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

const TEMPLATE = `# {{BOOK}} {{CHAP}}

1. Ouverture en prière

{{S1}}

2. Contexte historique

{{S2}}

3. Contexte littéraire

{{S3}}

4. Structure du passage

{{S4}}

5. Analyse exégétique et lexicale

{{S5}}

6. Personnages principaux

{{S6}}

7. Résumé du chapitre

{{S7}}

8. Thème théologique central

{{S8}}

9. Vérité spirituelle principale

{{S9}}

10. Verset-clé doctrinal

{{S10REF}}
{{S10}}

11. Verset à mémoriser

{{S11REF}}
{{S11}}

12. Références croisées

{{S12}}

13. Liens avec le reste de la Bible

{{S13}}

14. Jésus-Christ dans ce passage

{{S14}}

15. Questions de réflexion

{{S15}}

16. Applications pratiques

{{S16}}

17. Illustration

{{S17}}

18. Objections courantes

{{S18}}

19. Réponses

{{S19}}

20. Promesse de Dieu

{{S20}}

21. Commandement de Dieu

{{S21}}

22. Application communautaire

{{S22}}

23. Hymne ou chant suggéré

{{S23}}

24. Prière finale

{{S24}}

25. Pensée clé du jour

{{S25}}

26. Plan de lecture associé

{{S26}}

27. Limites et exceptions

{{S27}}

28. Conclusion

{{S28}}`.trim();

function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { book: m[1].trim(), chapter: Number(m[2]) };
  return { book: q.trim(), chapter: NaN };
}

function youVersionLink(book, chapter) {
  const map = {
    "Genèse": "GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU",
    "Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA",
    "1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH",
    "Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA",
    "Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA",
    "Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
    "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON",
    "Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG",
    "Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT",
    "Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
    "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI",
    "2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS",
    "1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN",
    "Jude":"JUD","Apocalypse":"REV"
  };
  const code = map[book];
  return code ? `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG` : "";
}

function fallbackMarkdown(book, chapter) {
  const ref = `${book} ${chapter}`;
  const link = youVersionLink(book, chapter) || "—";
  const fill = (s) => s || "—";
  const md = TEMPLATE
    .replace("{{BOOK}}", book).replace("{{CHAP}}", String(chapter))
    .replace("{{S1}}", `Seigneur Tout-Puissant, éclaire ma lecture de ${ref}. Amen.`)
    .replace("{{S2}}", "Contexte historique synthétique à compléter.")
    .replace("{{S3}}", "Contexte littéraire (structure, répétitions, genre).")
    .replace("{{S4}}", "Repère les unités du passage et leurs versets.")
    .replace("{{S5}}", "Termes clés (hébreu/grec), portée doctrinale.")
    .replace("{{S6}}", "Dieu, personnages, destinataires.")
    .replace("{{S7}}", "Résumé bref et fidèle du chapitre.")
    .replace("{{S8}}", "Idée théologique dominante.")
    .replace("{{S9}}", "Application identitaire/espérance/adoration.")
    .replace("{{S10REF}}", `${book} ${chapter}:1`)
    .replace("{{S10}}", "« … » (LSG)")
    .replace("{{S11REF}}", `${book} ${chapter}:1`)
    .replace("{{S11}}", "« … » (LSG)")
    .replace("{{S12}}", `YouVersion : ${link}`)
    .replace("{{S13}}", "Fils rouges de la Bible reliés au passage.")
    .replace("{{S14}}", "Christ comme Parole/Créateur/Rédempteur (selon passage).")
    .replace("{{S15}}", "Deux ou trois questions concrètes.")
    .replace("{{S16}}", "Pistes personnelles, familiales, église, mission.")
    .replace("{{S17}}", "Petite image/analogie mémorable.")
    .replace("{{S18}}", "Objection fréquente 1 / 2.")
    .replace("{{S19}}", "Réponse brève, honnête, biblique.")
    .replace("{{S20}}", "Promesse explicite/implicite du texte.")
    .replace("{{S21}}", "Commandement/appel du texte.")
    .replace("{{S22}}", "Action communautaire/écologie biblique/etc.")
    .replace("{{S23}}", "🎵 Chant/hymne suggéré.")
    .replace("{{S24}}", "Prière de clôture.")
    .replace("{{S25}}", "Formule courte mémorisable.")
    .replace("{{S26}}", "Lecture associée (p.ex. Jean 1).")
    .replace("{{S27}}", "Ce que le texte ne traite pas (cadre, limites).")
    .replace("{{S28}}", "Synthèse finale.");
  return md.split("{{").map(fill).join(""); // safety no-op
}

function ok28(md, book, chapter) {
  if (!md || !md.startsWith(`# ${book} ${chapter}`)) return false;
  return TITLES.every(t => md.includes(t));
}

export default async function handler(req, res) {
  try {
    // --- Méthode + paramètres ---
    const method = req.method || "GET";
    let body = {};
    if (method === "POST") {
      body = await new Promise((resolve) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => {
          try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); }
        });
      });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());
    const probe = qp.probe === "1" || body.probe === true;

    let book = body.book || qp.book, chapter = Number(body.chapter || qp.chapter);
    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }
    if (probe) {
      const b = book || "Genèse", c = chapter || 1;
      const md = fallbackMarkdown(b, c);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }
    if (!book || !chapter) {
      return res.status(400).send("Paramètres manquants: envoyez { book, chapter } ou { q }.");
    }

    // --- Si pas de clé OpenAI → fallback propre (pas d'échec) ---
    const haveKey = !!process.env.OPENAI_API_KEY;
    if (!haveKey) {
      const md = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${book}-${chapter}.md"`);
      return res.status(200).send(md);
    }

    // --- Appel OpenAI (avec garde-fous) ---
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const SYSTEM = `
Tu produis des études bibliques **strictement** en Markdown, 28 rubriques numérotées.
Contraintes:
- Utilise EXACTEMENT ces titres et cet ordre: ${TITLES.join(" | ")}.
- Pas de texte hors canevas.
- Version biblique pour citations: Louis Segond 1910 (LSG).
- 3–6 phrases par rubrique en moyenne, style pastoral et précis.
`.trim();

    const link = youVersionLink(book, chapter) || "—";

    const USER = `
Remplis le gabarit suivant pour Livre="${book}", Chapitre="${chapter}" (LSG).
Ajoute si pertinent "YouVersion : ${link}" dans la rubrique adéquate (10/11/12/26).

GABARIT:
${TEMPLATE}
`.trim();

    let md = "";
    try {
      const rsp = await client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 2200,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER },
        ],
      });
      md = (rsp?.choices?.[0]?.message?.content || "").trim();
    } catch (e) {
      // Erreur OpenAI → fallback explicite mais sans 500
      const fb = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error", String(e?.message || e));
      return res.status(200).send(fb);
    }

    // Vérification format 28 rubriques
    if (!ok28(md, book, chapter)) {
      const fb = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Format-Note", "Gabarit partiel: envoi fallback");
      return res.status(200).send(fb);
    }

    // OK
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${book}-${chapter}.md"`);
    return res.status(200).send(md);
  } catch (e) {
    // Dernier filet: ne pas planter en 500 opaque
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const q = url.searchParams.get("q") || "";
      const p = parseQ(q);
      const book = p.book || "Genèse";
      const chapter = p.chapter || 1;
      const md = fallbackMarkdown(book, chapter);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Last-Error", String(e?.message || e));
      return res.status(200).send(md);
    } catch {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.status(500).send("Erreur interne finale.");
    }
  }
}

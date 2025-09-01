// api/chat.js — Version REST (sans dépendance "openai"), zéro import, Node 20 compatible
// - GET ?q="Genèse 1" ou POST {book, chapter, version}; ?probe=1 pour test
// - Génère du Markdown 28 rubriques exactement comme l’UI
// - Utilise fetch() vers l’API OpenAI si OPENAI_API_KEY est présent
// - Jamais de 500 opaque: toujours une réponse Markdown valide

// ---------- Titres EXACTS (UI) ----------
const TITLES = [
  "1. Prière d’ouverture",
  "2. Canon et testament",
  "3. Questions du chapitre précédent",
  "4. Titre du chapitre",
  "5. Contexte historique",
  "6. Structure littéraire",
  "7. Genre littéraire",
  "8. Auteur et généalogie",
  "9. Verset-clé doctrinal",
  "10. Analyse exégétique",
  "11. Analyse lexicale",
  "12. Références croisées",
  "13. Fondements théologiques",
  "14. Thème doctrinal",
  "15. Fruits spirituels",
  "16. Types bibliques",
  "17. Appui doctrinal",
  "18. Comparaison entre versets",
  "19. Comparaison avec Actes 2",
  "20. Verset à mémoriser",
  "21. Enseignement pour l’Église",
  "22. Enseignement pour la famille",
  "23. Enseignement pour enfants",
  "24. Application missionnaire",
  "25. Application pastorale",
  "26. Application personnelle",
  "27. Versets à retenir",
  "28. Prière de fin",
];

// ---------- Gabarit Markdown ----------
const TEMPLATE = `# {{BOOK}} {{CHAP}}

1. Prière d’ouverture

{{S1}}

2. Canon et testament

{{S2}}

3. Questions du chapitre précédent

{{S3}}

4. Titre du chapitre

{{S4}}

5. Contexte historique

{{S5}}

6. Structure littéraire

{{S6}}

7. Genre littéraire

{{S7}}

8. Auteur et généalogie

{{S8}}

9. Verset-clé doctrinal

{{S9}}

10. Analyse exégétique

{{S10}}

11. Analyse lexicale

{{S11}}

12. Références croisées

{{S12}}

13. Fondements théologiques

{{S13}}

14. Thème doctrinal

{{S14}}

15. Fruits spirituels

{{S15}}

16. Types bibliques

{{S16}}

17. Appui doctrinal

{{S17}}

18. Comparaison entre versets

{{S18}}

19. Comparaison avec Actes 2

{{S19}}

20. Verset à mémoriser

{{S20}}

21. Enseignement pour l’Église

{{S21}}

22. Enseignement pour la famille

{{S22}}

23. Enseignement pour enfants

{{S23}}

24. Application missionnaire

{{S24}}

25. Application pastorale

{{S25}}

26. Application personnelle

{{S26}}

27. Versets à retenir

{{S27}}

28. Prière de fin

{{S28}}`.trim();

// ---------- Utils ----------
function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  if (m) return { book: m[1].trim(), chapter: Number(m[2]) };
  return { book: q.trim(), chapter: NaN };
}

function youVersionLink(book, chapter) {
  const map = {
    "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU",
    "Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA",
    "1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH",
    "Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA",
    "Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA",
    "Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
    "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC",
    "Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM",
    "1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP",
    "Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI",
    "2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS",
    "1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
  };
  const code = map[book];
  return code ? `https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG` : "";
}

function fallbackMarkdown(book, chapter) {
  const ref = `${book} ${chapter}`;
  const link = youVersionLink(book, chapter) || "—";
  const md = TEMPLATE
    .replace("{{BOOK}}", book).replace("{{CHAP}}", String(chapter))
    .replace("{{S1}}", `Père céleste, éclaire notre lecture de ${ref} par ton Esprit. Amen.`)
    .replace("{{S2}}", `Le livre de ${book} dans le canon biblique (AT/NT) et sa place théologique.`)
    .replace("{{S3}}", `(Préparer au moins 5 questions de révision sur le chapitre précédent.)`)
    .replace("{{S4}}", `Résumé doctrinal synthétique du chapitre (1–3 phrases).`)
    .replace("{{S5}}", `Période, contexte géopolitique et culturel. Carte si possible.`)
    .replace("{{S6}}", `Séquençage narratif et composition interne du chapitre.`)
    .replace("{{S7}}", `Nature du texte (narratif/poétique/prophétique…).`)
    .replace("{{S8}}", `Auteur probable et liens généalogiques utiles.`)
    .replace("{{S9}}", `Référence + citation LSG. Ajouter: YouVersion : ${link}`)
    .replace("{{S10}}", `Commentaire mot-à-mot (mots clés, structures).`)
    .replace("{{S11}}", `Mots originaux (hébreu/grec), champ sémantique, portée doctrinale.`)
    .replace("{{S12}}", `Passages parallèles ou complémentaires (3–6).`)
    .replace("{{S13}}", `Doctrines majeures dégagées du chapitre.`)
    .replace("{{S14}}", `Lien avec les 22 grands thèmes doctrinaux.`)
    .replace("{{S15}}", `Vertus et attitudes à cultiver.`)
    .replace("{{S16}}", `Symboles/Figures typologiques et leur sens.`)
    .replace("{{S17}}", `Autres textes qui renforcent l’enseignement.`)
    .replace("{{S18}}", `Comparer des versets du chapitre pour mise en relief.`)
    .replace("{{S19}}", `Parallèles avec Actes 2 (Esprit, communauté…).`)
    .replace("{{S20}}", `Verset à retenir (référence + LSG).`)
    .replace("{{S21}}", `Implications ecclésiales concrètes.`)
    .replace("{{S22}}", `Valeurs/pratiques à transmettre en famille.`)
    .replace("{{S23}}", `Approche enfants (histoires, visuels).`)
    .replace("{{S24}}", `Application missionnaire (annonce, service).`)
    .replace("{{S25}}", `Conseils pour pasteurs/enseignants.`)
    .replace("{{S26}}", `Examen de conscience et engagements personnels.`)
    .replace("{{S27}}", `Versets incontournables pour la prédication.`)
    .replace("{{S28}}", `Prière de reconnaissance et de consécration.`);
  return md;
}

function ok28(md, book, chapter) {
  if (!md || !md.startsWith(`# ${book} ${chapter}`)) return false;
  return TITLES.every(t => md.includes(t));
}

// ---------- OpenAI REST helper ----------
async function openaiChatMarkdown({ book, chapter }) {
  const SYSTEM = `
Tu produis des études bibliques **strictement** en Markdown avec 28 rubriques.
Contraintes:
- Utilise EXACTEMENT ces titres et cet ordre: ${TITLES.join(" | ")}.
- Pas de texte hors canevas, pas d'en-tête/footers annexes.
- Citations bibliques en Louis Segond 1910 (LSG).
- Style clair, pastoral et rigoureux (3–6 phrases par rubrique).
`.trim();

  const link = youVersionLink(book, chapter) || "—";
  const USER = `
Remplis le gabarit pour Livre="${book}", Chapitre="${chapter}" (LSG).
Ajoute la ligne "YouVersion : ${link}" dans la rubrique la plus pertinente.

GABARIT:
${TEMPLATE}
`.trim();

  const apiKey = process.env.OPENAI_API_KEY;
  const url = "https://api.openai.com/v1/chat/completions";
  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 2200,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await resp.text();
  if (!resp.ok) {
    // On renvoie l'erreur pour basculer en fallback propre
    const msg = text.slice(0, 300).replace(/\s+/g, " ");
    throw new Error(`OpenAI HTTP ${resp.status}: ${msg}`);
  }

  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Réponse OpenAI invalide"); }
  const content = data?.choices?.[0]?.message?.content || "";
  return String(content).trim();
}

// ---------- Handler ----------
export default async function handler(req, res) {
  try {
    const method = req.method || "GET";
    let body = {};
    if (method === "POST") {
      body = await new Promise((resolve) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); }});
      });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());

    const probe = qp.probe === "1" || body.probe === true;

    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter);
    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }
    const b = book || "Genèse";
    const c = chapter || 1;

    // Probe: réponse immédiate
    if (probe) {
      const md = fallbackMarkdown(b, c);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }

    // Si pas de clé → fallback propre (aucun crash)
    if (!process.env.OPENAI_API_KEY) {
      const md = fallbackMarkdown(b, c);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition", `inline; filename="${b}-${c}.md"`);
      return res.status(200).send(md);
    }

    // Appel REST OpenAI
    let md = "";
    try {
      md = await openaiChatMarkdown({ book: b, chapter: c });
    } catch (e) {
      const fb = fallbackMarkdown(b, c);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error", String(e?.message || e));
      return res.status(200).send(fb);
    }

    // Vérif stricte 28 rubriques
    if (!ok28(md, b, c)) {
      const fb = fallbackMarkdown(b, c);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Format-Note", "Gabarit partiel: fallback");
      return res.status(200).send(fb);
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${b}-${c}.md"`);
    return res.status(200).send(md);
  } catch (e) {
    // Dernier filet: toujours renvoyer quelque chose d’utilisable
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const p = parseQ(url.searchParams.get("q") || "");
      const md = fallbackMarkdown(p.book || "Genèse", p.chapter || 1);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader("X-Last-Error", String(e?.message || e));
      return res.status(200).send(md);
    } catch {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      return res.status(200).send(fallbackMarkdown("Genèse", 1));
    }
  }
}

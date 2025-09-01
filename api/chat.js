// /api/chat.js — canonical + (optionnel) openai-rich
export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      // Compat GET ?q= "Genèse 1"
      const q = (req.query.q || "").trim();
      let book = "Genèse", chapter = 1;
      if (q) {
        const m = q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)/);
        if (m) { book = m[1].trim(); chapter = Number(m[2]); }
      }
      const data = canonicalStudy({ book, chapter, version: "LSG" });
      return res.status(200).json({ ok: true, source: "canonical", warn: "", data });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const body = await readJson(req);
    const book    = String(body.book || "Genèse");
    const chapter = Number(body.chapter || 1);
    const version = String(body.version || "LSG");
    const mode    = String(body.mode || "canonical");

    if (mode !== "openai-rich") {
      const data = canonicalStudy({ book, chapter, version });
      return res.status(200).json({
        ok: true,
        source: "canonical",
        warn: "AI content adjusted to canonical",
        data
      });
    }

    // “enrichi” — ici on étoffe (sans casser la forme). Remplace par ton vrai appel modèle si besoin.
    const data = openaiRichStudy({ book, chapter, version });
    return res.status(200).json({
      ok: true,
      source: "openai",
      warn: "",
      data
    });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
}

/* -------- helpers I/O -------- */
function readJson(req) {
  return new Promise((resolve, reject) => {
    try {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        try { resolve(raw ? JSON.parse(raw) : {}); }
        catch (e) { reject(e); }
      });
    } catch (e) { reject(e); }
  });
}

/* --------- CANONICAL (stable) --------- */
function canonicalStudy({ book, chapter, version }) {
  const reference = `${book} ${chapter}`;
  const sections = [
    { id: 1,  title: "Prière d’ouverture", content: "Seigneur Tout-Puissant, Créateur du ciel et de la terre, éclaire ma lecture. Ouvre mon cœur pour que je voie ta grandeur et que je reçoive la vérité de ta Parole avec humilité et obéissance. Amen." },
    { id: 2,  title: "Canon et testament", content: `${book}, historiquement reçu comme Écriture, établit des fondations doctrinales majeures. Le chapitre ${chapter} situe l’action et affirme Dieu comme acteur principal.` },
    { id: 3,  title: "Questions du chapitre précédent", content: "À remplir par l’animateur : préparer au moins 5 questions de révision (comprendre, appliquer, comparer, retenir)." },
    { id: 4,  title: "Titre du chapitre", content: `${book} ${chapter} — Dieu agit par sa Parole : titre doctrinal synthétique.` },
    { id: 5,  title: "Contexte historique", content: "Contexte Proche-Orient ancien ; distinction entre le Dieu unique et les cosmologies païennes." },
    { id: 6,  title: "Structure littéraire", content: "Découpage en unités : (ex.) 1:1–5 ; 1:6–8 ; 1:9–13 ; 1:14–19 ; 1:20–23 ; 1:24–31 ; 2:1–3." },
    { id: 7,  title: "Genre littéraire", content: "Narratif théologique solennel." },
    { id: 8,  title: "Auteur et généalogie", content: "Tradition : Moïse ; rattachement aux patriarches ; transmission à Israël." },
    { id: 9,  title: "Verset-clé doctrinal", content: "Choisir 1 verset-clef et le noter ici (citation)." },
    { id: 10, title: "Analyse exégétique", content: "Refrains, parallélismes, rythme, progression, syntaxe significative." },
    { id: 11, title: "Analyse lexicale", content: "Termes-clés et portée doctrinale (ex. bara’, image de Dieu, etc.)." },
    { id: 12, title: "Références croisées", content: "Jean 1 ; Col 1 ; Hé 11 ; Ps 8 ; Ps 104…" },
    { id: 13, title: "Fondements théologiques", content: "Dieu souverain, bonté de la création, dignité humaine, mandat culturel, repos." },
    { id: 14, title: "Thème doctrinal", content: "Dieu crée, ordonne et bénit — l’ordre et la bonté sont voulus." },
    { id: 15, title: "Fruits spirituels", content: "Gratitude, adoration, responsabilité, espérance." },
    { id: 16, title: "Types bibliques", content: "Repos/sabbat ; ordre/chaos ; parole/lumière." },
    { id: 17, title: "Appui doctrinal", content: "Ps 8 ; Ps 104 ; Ap 4:11 ; Hé 11:3." },
    { id: 18, title: "Comparaison entre versets", content: "Comparer ouverture, image de Dieu, « très bon », repos." },
    { id: 19, title: "Comparaison avec Actes 2", content: "Parole, communauté, Esprit — nouvelle création." },
    { id: 20, title: "Verset à mémoriser", content: "Notez ici 1 verset court (version " + version + ")." },
    { id: 21, title: "Enseignement pour l’Église", content: "Créateur, dignité, sabbat, mission." },
    { id: 22, title: "Enseignement pour la famille", content: "Transmettre : Dieu est Créateur ; éducation à la gérance." },
    { id: 23, title: "Enseignement pour enfants", content: "Dieu a tout fait ; nous sommes précieux ; prenons soin de la terre." },
    { id: 24, title: "Application missionnaire", content: "Annoncer que le monde a un Auteur et un sens ; relier au Christ." },
    { id: 25, title: "Application pastorale", content: "Accompagner le soin de la création et de la dignité humaine." },
    { id: 26, title: "Application personnelle", content: "Examen : où je méprise la création ou l’image de Dieu ? Décision concrète." },
    { id: 27, title: "Versets à retenir", content: "Liste courte (références)." },
    { id: 28, title: "Prière de fin", content: "Père Créateur, merci pour la vie et la dignité… Amen." }
  ];
  return { reference, version, sections };
}

/* --------- ENRICHI (texte développé, sans casser la forme) --------- */
function openaiRichStudy({ book, chapter, version }) {
  const reference = `${book} ${chapter}`;
  const canonical = canonicalStudy({ book, chapter, version });
  const richer = canonical.sections.map((s) => {
    if (s.id === 3) {
      s.content = makePrevChapterQuestions(reference);
    } else if ([2,5,10,11].includes(s.id)) {
      s.content = (s.content + "\n\n" +
        "Développement : explication plus détaillée, exemples concrets, et implications doctrinales " +
        "pour la formation, la liturgie et la mission.").trim();
    }
    return s;
  });
  return { reference, version, sections: richer };
}

// même logique que côté front
function makePrevChapterQuestions(reference) {
  const ref = String(reference || "").trim() || "le chapitre précédent";
  return [
    `**Révision sur ${ref} — 5 questions**`,
    "",
    `1) **Observation :** Quels sont les 3 faits ou événements principaux du texte ? Quelles expressions reviennent (refrains, mots-clés) ?`,
    `2) **Compréhension :** Que révèle ce chapitre sur Dieu (attributs, intentions) et sur l’homme (vocation, limites) ?`,
    `3) **Interprétation :** Quel est le verset-clef du chapitre et pourquoi ? Comment s’articule-t-il avec le reste du passage ?`,
    `4) **Connexions bibliques :** Citez un ou deux passages parallèles/échos (dans l’AT ou le NT) et expliquez le lien.`,
    `5) **Application :** Quelle mise en pratique concrète cette semaine (personnelle, famille, église) découle de ce chapitre ?`,
    "",
    `*(Bonus)* : Un verset à **mémoriser** du chapitre et une courte **prière** de réponse.`
  ].join("\n");
}

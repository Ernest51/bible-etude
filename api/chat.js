// /api/chat.js
// Next.js / Vercel API Route
// - POST JSON: { book, chapter, verse?, version?, directives? }
// - Renvoie toujours 28 rubriques, avec rubrique 1 = prière d’ouverture *spécifique au chapitre*
// - Utilise OpenAI si clé présente; sinon fallback varié (non répétitif).
// - Compatible avec ton front (sections[id 1..28], champs: id, title, content)

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ---------- utils ---------- */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));

function cap(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}

/* ---------- Fallback varié pour la prière d’ouverture (sans IA) ---------- */

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
function pick(arr, seed, salt = 0) {
  return arr[(seed + salt) % arr.length];
}

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  // Fallback déterministe mais varié selon la réf + version
  const ref = refString(book, chapter, verse);
  const seed = simpleHash(`${ref}|${version||"LSG"}`);

  const invocations = [
    "Père des lumières",
    "Dieu très-haut",
    "Seigneur éternel",
    "Père de miséricorde",
    "Dieu de vérité",
  ];
  const attributs = [
    "Créateur", "Libérateur", "Juge juste", "Père compatissant", "Dieu fidèle"
  ];
  const verbes1 = [
    "éclaire notre intelligence",
    "façonne nos pensées",
    "purifie nos intentions",
    "affermis notre foi",
    "rends droit notre regard"
  ];
  const verbes2 = [
    "ouvre nos yeux sur tes œuvres",
    "apprends-nous à discerner ta voie",
    "oriente nos pas vers l’obéissance",
    "ranime en nous l’espérance",
    "donne-nous un cœur docile"
  ];
  const conclusions = [
    "Au nom de Jésus, amen.",
    "Par Jésus-Christ notre Seigneur, amen.",
    "Dans la paix du Christ, amen.",
    "Par ton Esprit, amen.",
    "Nous te prions au nom de Jésus, amen."
  ];

  const head = pick(invocations, seed);
  const attr = pick(attributs, seed, 1);
  const v1 = pick(verbes1, seed, 2);
  const v2 = pick(verbes2, seed, 3);
  const end = pick(conclusions, seed, 4);

  // HTML simple (ton front sait nettoyer et garder <strong>/<em>)
  return [
    `<p><strong>${head}</strong>, ${attr}, nous venons à toi pour méditer <strong>${ref}</strong>.`,
    `Par ton Esprit, ${v1} et ${v2}.`,
    `Que ta Parole forme en nous la prière, la sagesse et la décision droite. ${end}</p>`
  ].join(" ");
}

/* ---------- Rubrique 3 (Révision) — canevas HTML ---------- */

function buildRubrique3(book, chapter) {
  const ref = refString(book, chapter);
  return [
    `<h3>Révision sur ${ref} — 5 questions</h3>`,
    `<p><strong>1) Observation.</strong> Quels sont les faits majeurs du passage ? Identifier le <em>contexte immédiat</em> (avant/après), les <em>acteurs</em>, les <em>verbes</em> dominants de Dieu et de l’homme, et les procédés littéraires (répétitions, contrastes).</p>`,
    `<p><strong>Réponse (exemple).</strong> Le texte met en valeur l’initiative divine et l’ordre instauré par Dieu ; l’homme est placé dans une vocation précise. On observe des formules récurrentes qui scandent la progression. Le passage s’insère dans une séquence plus large où Dieu révèle sa sagesse et ses desseins.</p>`,
    `<p><strong>2) Compréhension.</strong> Que dit ce chapitre sur Dieu (attributs, intentions) et sur l’homme (vocation, limites) ?</p>`,
    `<p><strong>Réponse (exemple).</strong> Dieu se révèle <em>souverain</em> et <em>bon</em> : sa parole structure la réalité et oriente l’histoire. L’homme reçoit une <em>dignité</em> et une <em>mission</em> (écouter, répondre, garder, servir). Ses limites indiquent sa dépendance au Créateur et la nécessité d’un cadre pour la vie juste.</p>`,
    `<p><strong>3) Interprétation.</strong> Quel est le verset-clef et pourquoi ? Comment s’articule-t-il avec le reste du passage ?</p>`,
    `<p><strong>Réponse (exemple).</strong> Un verset-charnière met en lumière l’initiative de Dieu et l’obéissance attendue. Il relie l’ouverture du passage à sa conclusion en dessinant la logique théologique (promesse → appel → réponse). Ce verset éclaire l’unité du chapitre.</p>`,
    `<p><strong>4) Connexions bibliques.</strong> Relever un ou deux parallèles/échos pertinents (AT/NT) et expliquer le lien (promesse, motif, accomplissement).</p>`,
    `<p><strong>Réponse (exemple).</strong> On retrouve un motif analogue dans un autre passage de la Torah et un écho christologique dans le NT, où le Christ récapitule et mène à l’accomplissement ce que le chapitre annonce en germe.</p>`,
    `<p><strong>5) Application.</strong> Définir une mise en pratique <em>concrète</em> cette semaine (personnelle, famille, église) et une courte prière de réponse.</p>`,
    `<p><strong>Réponse (exemple).</strong> Personnellement : planifier un temps de lecture et de prière en lien avec le passage. En famille : partager une promesse et un acte concret (servir, bénir, encourager). En église : participer à l’édification mutuelle (prière, service). <em>Prière :</em> “Seigneur, grave ta Parole dans mon cœur et donne-moi de la mettre en pratique.”</p>`,
    `<p><strong>(Bonus)</strong> Verset à mémoriser : choisir un verset du chapitre et l’apprendre par cœur. <em>Exercice</em> : rédiger en deux lignes ce que ce verset révèle de Dieu, et une réponse de louange/obéissance.</p>`
  ].join("\n");
}

function shortPara(t) {
  return `<p>${t}</p>`;
}

/* ---------- 28 rubriques (sûr) ---------- */

function canonicalStudy(book, chapter, verse, version) {
  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: shortPara("…") }); // sera remplacé plus bas
  data.push({
    id: 2, title: "Canon et testament",
    content: shortPara(`${cap(book)} s’inscrit dans la révélation progressive de Dieu. Le chapitre ${chapter} met en valeur l’initiative divine et la vocation humaine dans l’économie du salut.`)
  });
  data.push({ id: 3, title: "Questions du chapitre précédent", content: buildRubrique3(book, chapter) });
  data.push({
    id: 4, title: "Titre du chapitre",
    content: shortPara(`${cap(book)} ${chapter} — <strong>Dieu parle et l’homme répond</strong> : un thème structurant pour lire et appliquer le passage.`)
  });
  data.push({
    id: 5, title: "Contexte historique",
    content: shortPara(`Ce passage prend place dans une histoire sainte où Dieu se fait connaître, appelle, et façonne un peuple mis à part.`)
  });
  data.push({
    id: 6, title: "Structure littéraire",
    content: `<ul><li>Ouverture : initiative divine</li><li>Développement : réponse humaine et effets</li><li>Conclusion : signe, bénédiction, ou jugement</li></ul>`
  });
  data.push({
    id: 7, title: "Genre littéraire",
    content: shortPara(`Récit théologique à visée formative : le texte ne vise pas seulement à informer, mais à conformer le lecteur à la volonté de Dieu.`)
  });
  data.push({
    id: 8, title: "Auteur et généalogie",
    content: shortPara(`Attribué à la tradition mosaïque ou à une source ancienne reçue par Israël ; le chapitre s’articule avec la vocation des pères et la lignée de la promesse.`)
  });
  data.push({
    id: 9, title: "Verset-clé doctrinal",
    content: shortPara(`Choisir un verset pivot du chapitre et l’expliquer : ce qu’il dit de Dieu, ce qu’il demande à l’homme, et comment il éclaire le reste.`)
  });
  data.push({
    id:10, title: "Analyse exégétique",
    content: shortPara(`Repérer les marqueurs littéraires (répétitions, formules, inclusions). Situer les verbes et les sujets : qui agit ? dans quel ordre ? avec quel effet ?`)
  });
  data.push({
    id:11, title: "Analyse lexicale",
    content: shortPara(`Éclairer 1–2 termes-clés (promesse, alliance, sagesse, justice…) au service du sens du passage.`)
  });
  data.push({
    id:12, title: "Références croisées",
    content: shortPara(`Repérer 2–3 textes en écho (AT/NT) pour montrer l’unité du dessein de Dieu.`)
  });
  data.push({
    id:13, title: "Fondements théologiques",
    content: shortPara(`Dieu est Créateur/Rédempteur/Juge qui parle et agit ; l’homme est image/serviteur/adorateur appelé à l’obéissance de la foi.`)
  });
  data.push({
    id:14, title: "Thème doctrinal",
    content: shortPara(`Thème principal : Dieu ordonne le réel et appelle son peuple à vivre devant sa face.`)
  });
  data.push({
    id:15, title: "Fruits spirituels",
    content: shortPara(`Gratitude, sagesse, obéissance, espérance : l’Évangile nourrit la vie.`)
  });
  data.push({
    id:16, title: "Types bibliques",
    content: shortPara(`Préfigurations : motifs, lieux, personnes qui annoncent et convergent vers le Christ.`)
  });
  data.push({
    id:17, title: "Appui doctrinal",
    content: shortPara(`Psaumes de louange, prophètes, et Épîtres consolident la lecture et son application.`)
  });
  data.push({
    id:18, title: "Comparaison entre versets",
    content: shortPara(`Comparer l’ouverture/charnière/conclusion du chapitre pour dégager l’axe théologique.`)
  });
  data.push({
    id:19, title: "Comparaison avec Actes 2",
    content: shortPara(`Actes 2 illustre la dynamique Parole-Esprit-communauté : pertinence pour aujourd’hui.`)
  });
  data.push({
    id:20, title: "Verset à mémoriser",
    content: shortPara(`Choisir un verset du chapitre ; rédiger une phrase de méditation et une prière-réponse.`)
  });
  data.push({
    id:21, title: "Enseignement pour l’Église",
    content: shortPara(`Annonce, édification, discipline et mission : comment ce chapitre équipe le peuple de Dieu.`)
  });
  data.push({
    id:22, title: "Enseignement pour la famille",
    content: shortPara(`Transmettre la Parole : lecture, prière, service, bénédiction, pardon.`)
  });
  data.push({
    id:23, title: "Enseignement pour enfants",
    content: shortPara(`Dieu parle, il est bon ; nous l’aimons et nous apprenons à lui obéir.`)
  });
  data.push({
    id:24, title: "Application missionnaire",
    content: shortPara(`Témoigner humblement : vie cohérente, parole claire, amour concret.`)
  });
  data.push({
    id:25, title: "Application pastorale",
    content: shortPara(`Accompagner dans la prière, le conseil biblique, la consolation et la persévérance.`)
  });
  data.push({
    id:26, title: "Application personnelle",
    content: shortPara(`Nommer 1–2 décisions concrètes pour la semaine, avec un “quand/quoi/comment”.`)
  });
  data.push({
    id:27, title: "Versets à retenir",
    content: shortPara(`Lister 3–5 versets du chapitre à relire ; noter une clé de compréhension pour chacun.`)
  });
  data.push({
    id:28, title: "Prière de fin",
    content: shortPara(`Seigneur, que ta Parole devienne en nous foi, prière et obéissance ; et que notre vie te glorifie. Amen.`)
  });
  return data;
}

/* ---------- OpenAI (optionnel) ---------- */

async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 600 }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ],
    temperature,
    max_tokens
  };
  const r = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildOpeningPrayerPrompt({ book, chapter, verse, version, customDirectives }) {
  const ref = refString(book, chapter, verse);
  const baseBrief = `
OBJECTIF: Écrire une "Prière d’ouverture" ADAPTÉE au chapitre étudié (${ref}, ${version||"LSG"}).
EXIGENCES:
- Mentionner explicitement ${ref}.
- Intégrer 2 à 3 motifs/thèmes spécifiques au chapitre (mots-clés, actions, images, contrastes).
- Nommer Dieu avec un attribut cohérent avec ces motifs (ex: Créateur, Libérateur, Juste, Miséricordieux).
- Ton: adorant, humble, précis; 3 à 5 phrases; éviter les clichés et répétitions.
- ZÉRO copier-coller reusable entre chapitres: varier l’angle, les verbes, les attributs.
- Sortie en HTML simple <p> avec possibilité de <strong>/<em> (pas d'autres balises, pas de listes).
- Un seul paragraphe, pas de titre, pas d’introduction hors prière.
${customDirectives ? `DIRECTIVES SUPPLÉMENTAIRES:\n${customDirectives}` : ""}`.trim();

  return {
    system: "Tu es un bibliste pastoral. Tu écris des prières d'ouverture précises, ancrées dans le texte, en HTML simple (<p>, <strong>, <em>) uniquement. Français.",
    user: baseBrief
  };
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    // Debug / probe depuis le front (panel)
    if (req.body && req.body.probe) {
      res.status(200).json({ ok: true, source: "probe", warn: "" });
      return;
    }

    const {
      book = "Genèse",
      chapter = 1,
      verse = "",
      version = "LSG",
      directives = {}
    } = req.body || {};

    let sections = canonicalStudy(book, chapter, verse, version);
    let source = "canonical";
    let warn = "";

    // 1) Construire la prière d’ouverture
    let opening = "";
    if (OPENAI_API_KEY) {
      try {
        const { system, user } = buildOpeningPrayerPrompt({
          book, chapter, verse, version,
          customDirectives: directives.priere_ouverture || ""
        });
        opening = await callOpenAI({
          system,
          user,
          model: "gpt-4o-mini",
          temperature: 0.85,           // plus de variation
          max_tokens: 500
        });
        source = "openai";
      } catch (e) {
        // Fallback varié si IA ko
        opening = buildOpeningPrayerFallback(book, chapter, verse, version);
        source = "canonical";
        warn = "OpenAI indisponible — prière d’ouverture en fallback varié";
      }
    } else {
      // Pas d'IA -> fallback varié non répétitif
      opening = buildOpeningPrayerFallback(book, chapter, verse, version);
      source = "canonical";
      warn = "AI désactivée — prière d’ouverture en fallback varié";
    }

    // 2) Injecter la prière dans la rubrique 1 (toujours)
    if (sections && sections[0]) {
      sections[0].content = opening;
    }

    // 3) Réponse JSON attendue par le front
    res.status(200).json({
      ok: true,
      source,
      warn,
      data: {
        reference: refString(book, chapter, verse),
        version: (version || "LSG"),
        sections
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

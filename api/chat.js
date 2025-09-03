// /api/chat.js
// Next.js / Vercel API Route
// - POST JSON: { book, chapter, verse?, version?, directives? }
// - Renvoie toujours 28 rubriques, avec rubrique 1 = prière d’ouverture *spécifique au chapitre*.
// - Génération IA en 2 étapes (extraction de motifs puis prière) pour éviter les prières génériques.
// - Fallback varié et contextuel (sans IA) pour ne plus avoir deux prières identiques.
// - Compatible avec le front existant (id 1..28, title, content). Gère { probe:true }.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ---------- Utils généraux ---------- */

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

function shortPara(t) {
  return `<p>${t}</p>`;
}

/* ---------- Heuristique de motifs (fallback sans IA) ---------- */
// Couvre Genèse 1 par plages de versets + catégories larges pour le reste.
// Objectif: éviter les doublons et coller au chapitre si l’IA n’est pas dispo.

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  // Focus : Genèse 1 (très demandé)
  if (b === "genèse" || b === "genese") {
    if (ch === 1) {
      if (!v) {
        return ["création", "Parole qui ordonne", "lumière et ténèbres", "séparations", "vie naissante", "image de Dieu"];
      }
      if (v === 1)  return ["cieux et terre", "commencement", "Parole créatrice"];
      if (v === 2)  return ["tohu-bohu", "ténèbres", "Esprit planant", "eaux profondes"];
      if (v <= 5)   return ["Que la lumière soit", "séparation lumière/ténèbres", "jour et nuit"];
      if (v <= 8)   return ["étendue", "séparation des eaux", "ciel"];
      if (v <= 13)  return ["réunion des eaux", "terre sèche", "végétation"];
      if (v <= 19)  return ["astres", "signes et saisons", "soleil et lune"];
      if (v <= 23)  return ["poissons", "oiseaux", "bénédiction de fécondité"];
      if (v <= 31)  return ["animaux terrestres", "homme et femme", "image de Dieu", "domination responsable"];
    }
  }

  // Catégories larges (OT / NT) si pas de cas spécifique
  const isOT = [
    "genèse","exode","lévitique","nombres","deutéronome","josué","juges","ruth","1 samuel","2 samuel","1 rois","2 rois",
    "1 chroniques","2 chroniques","esdras","néhémie","esther","job","psaumes","proverbes","ecclésiaste","cantique des cantiques",
    "Ésaïe","esaie","isaïe","isaie","jérémie","lamentations","Ézéchiel","ezekiel","ézéchiel","daniel","osée","joël","amos",
    "abdias","jonas","michée","nahoum","habacuc","sophonie","aggée","zacharie","malachie"
  ].includes(b);

  if (isOT) return ["Alliance", "fidélité de Dieu", "appel à l’obéissance", "justice et miséricorde"];

  // NT: évangiles, Actes, épîtres, Apocalypse
  if (["matthieu","marc","luc","jean"].includes(b)) {
    return ["Royaume de Dieu", "paroles de Jésus", "signes et guérisons", "appel à suivre le Christ"];
  }
  if (b === "actes") return ["Esprit Saint", "témoignage", "Église naissante", "communauté et mission"];
  if (["romains","1 corinthiens","2 corinthiens","galates","éphésiens","philippiens","colossiens",
       "1 thessaloniciens","2 thessaloniciens","1 timothée","2 timothée","tite","philémon","hébreux",
       "jacques","1 pierre","2 pierre","1 jean","2 jean","3 jean","jude"].includes(b)) {
    return ["Évangile", "sainteté", "espérance", "vie dans l’Esprit", "charité fraternelle"];
  }
  if (b === "apocalypse") return ["Agneau", "victoire", "persévérance", "nouvelle création"];

  return ["Dieu parle", "réponse de foi", "espérance", "sagesse pour vivre"];
}

/* ---------- Prière d’ouverture Fallback varié (sans IA) ---------- */

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}
function pick(arr, seed, salt = 0) {
  return arr[(seed + salt) % arr.length];
}

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  const ref = refString(book, chapter, verse);
  const motifs = guessMotifs(book, chapter, verse);
  const seed = simpleHash(`${ref}|${version||"LSG"}|${motifs.join("|")}`);

  const invocations = [
    "Dieu de vérité", "Père des lumières", "Seigneur éternel", "Dieu fidèle", "Père de miséricorde"
  ];
  const attributs = [
    "Créateur", "Libérateur", "Souverain juste", "Dieu compatissant", "Dieu qui ordonne le chaos"
  ];
  const conclusions = [
    "Par Jésus-Christ notre Seigneur, amen.",
    "Dans la paix du Christ, amen.",
    "Nous te prions au nom de Jésus, amen.",
    "Au nom de Jésus, que cela soit, amen.",
    "Par ton Esprit Saint, amen."
  ];

  const head = pick(invocations, seed);
  const attr = pick(attributs, seed, 1);
  const end  = pick(conclusions, seed, 2);

  // Compose la phrase centrale à partir de 2–3 motifs
  const m = motifs.slice(0, 3).join(", ");
  // ATTENTION: on bannit les tournures répétitives connues
  return [
    `<p><strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. `,
    `Tu fais surgir un sens précis dans ce passage — ${m}. `,
    `Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse. ${end}</p>`
  ].join("");
}

/* ---------- Rubrique 3 (Révision) ---------- */

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

/* ---------- 28 rubriques “sûres” ---------- */

function canonicalStudy(book, chapter, verse, version) {
  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: shortPara("…") }); // sera remplacé
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

/* ---------- OpenAI Helpers ---------- */

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

/* Étape A: extraction de motifs (JSON strict) */
function buildMotifsPrompt(ref, version, custom = "") {
  return {
    system:
      "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide. Pas de texte hors JSON.",
    user: `
Donne 6 à 10 motifs *concrets* du passage ${ref} (${version||"LSG"}).
- Motifs = noms courts: événements, images, objets, actions clés.
- Évite les généralités (“Dieu est bon”, “prière”...).
- Exemple de format: {"motifs":["motif1","motif2","motif3"],"attributsDivins":["Créateur","Libérateur"]}
${custom ? `Contrainte additionnelle:\n${custom}` : ""}

Réponds UNIQUEMENT:
{"motifs":[...],"attributsDivins":[...]}
    `.trim()
  };
}

function safeParseJSON(str) {
  try { return JSON.parse(str); } catch { return null; }
}

/* Étape B: prière d’ouverture (avec motifs imposés) */
function buildPrayerPrompt(ref, version, motifs, attrs, custom = "", seed = 0) {
  // On bannit les tournures qui se répètent dans ton système
  const forbidden = [
    "nous nous approchons de toi pour méditer",
    "ouvre notre intelligence",
    "purifie nos intentions",
    "fais naître en nous l’amour de ta volonté",
    "Que ta Parole façonne notre pensée, notre prière et nos décisions."
  ];
  return {
    system:
      "Tu es un bibliste pastoral. Écris en français, HTML simple autorisé: <p>, <strong>, <em> uniquement.",
    user: `
Écris une *Prière d’ouverture* spécifique à ${ref} (${version||"LSG"}).
Contraintes:
- Utiliser EXPLICITEMENT au moins 2 éléments de: ${JSON.stringify(motifs || [])}
- Nommer Dieu avec un attribut de: ${JSON.stringify(attrs || ["Créateur","Libérateur","Juste","Miséricordieux"])}
- 1 paragraphe, 70 à 120 mots, ton humble et adorant, précis au passage.
- Varier le lexique; ne pas réutiliser de formules toutes faites.
- Interdictions (NE PAS utiliser): ${forbidden.map(s=>`“${s}”`).join(", ")}.
- Commencer par une invocation (“Dieu de…”, “Père…”, etc.) + un attribut lié aux motifs.
- Terminer par une conclusion brève (variante de “amen”) sans reprendre les interdictions.
- Uniquement du HTML autorisé (<p>, <strong>, <em>), pas de listes, pas de titres.

Graines de variation: ${seed}. ${custom ? `\nDirectives supplémentaires:\n${custom}` : ""}
`.trim()
  };
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method Not Allowed" });
    return;
  }

  try {
    // Probe depuis le front
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

    const reference = refString(book, chapter, verse);
    let sections = canonicalStudy(book, chapter, verse, version);
    let source = "canonical";
    let warn = "";

    // Génération de la prière d’ouverture
    let opening = "";

    if (OPENAI_API_KEY) {
      try {
        // Étape A : motifs
        const motifsPrompt = buildMotifsPrompt(reference, version, directives.priere_ouverture || "");
        const motifsRaw = await callOpenAI({
          system: motifsPrompt.system,
          user: motifsPrompt.user,
          model: "gpt-4o-mini",
          temperature: 0.2,
          max_tokens: 250
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        const motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        const attrs  = Array.isArray(motifsJson.attributsDivins) ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6) : ["Créateur","Libérateur","Juste","Miséricordieux"];

        // Étape B : prière à partir des motifs
        const seed = simpleHash(`${reference}|${version}|${motifs.join("|")}`);
        const prayerPrompt = buildPrayerPrompt(reference, version, motifs, attrs, directives.priere_ouverture || "", seed);
        opening = await callOpenAI({
          system: prayerPrompt.system,
          user: prayerPrompt.user,
          model: "gpt-4o-mini",
          temperature: 0.9,
          max_tokens: 450
        });

        // Sécurité minimale: si l'IA renvoie vide/illisible, fallback
        if (!opening || typeof opening !== "string" || opening.length < 40) {
          opening = buildOpeningPrayerFallback(book, chapter, verse, version);
          warn = "IA: motifs/prière trop courts — fallback varié appliqué";
        } else {
          source = "openai";
        }
      } catch (e) {
        // IA KO -> fallback contextuel
        opening = buildOpeningPrayerFallback(book, chapter, verse, version);
        source = "canonical";
        warn = "OpenAI indisponible — prière d’ouverture en fallback varié";
      }
    } else {
      // Pas d’IA -> fallback contextuel
      opening = buildOpeningPrayerFallback(book, chapter, verse, version);
      source = "canonical";
      warn = "AI désactivée — prière d’ouverture en fallback varié";
    }

    // Injection rubrique 1
    if (sections && sections[0]) {
      sections[0].content = opening;
    }

    res.status(200).json({
      ok: true,
      source,
      warn,
      data: {
        reference,
        version: (version || "LSG"),
        sections
      }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

// api/generate-study.js
// Générateur d'étude biblique — 28 rubriques (sans doublons), longueurs 500/1500/2500,
// liens YouVersion cliquables, rubrique 3 en Q/R doctrinales.
// Fonctionne en Node (Vercel Serverless). Aucune dépendance externe.

const TITLES = {
  1:  "Prière d’ouverture",
  2:  "Canon et testament",
  3:  "Questions du chapitre précédent",
  4:  "Titre du chapitre",
  5:  "Contexte historique",
  6:  "Structure littéraire",
  7:  "Genre littéraire",
  8:  "Auteur et généalogie",
  9:  "Verset-clé doctrinal",
  10: "Analyse exégétique",
  11: "Analyse lexicale",
  12: "Références croisées",
  13: "Fondements théologiques",
  14: "Thème doctrinal",
  15: "Fruits spirituels",
  16: "Types bibliques",
  17: "Appui doctrinal",
  18: "Comparaison entre versets",
  19: "Parallèle avec Actes 2",
  20: "Verset à mémoriser",
  21: "Enseignement pour l’Église",
  22: "Enseignement pour la famille",
  23: "Enseignement pour enfants",
  24: "Application missionnaire",
  25: "Application pastorale",
  26: "Application personnelle",
  27: "Versets à retenir",
  28: "Prière de fin"
};

const DESCS = {
  1:  "Invocation du Saint-Esprit pour éclairer l’étude.",
  2:  "Place dans le canon (AT/NT) et continuité biblique.",
  3:  "Questions clés et réponses doctrinales.",
  4:  "Formulation doctrinale fidèle au texte.",
  5:  "Cadre temporel, culturel et géographique.",
  6:  "Découpage, progression et marqueurs rhétoriques.",
  7:  "Incidences herméneutiques du genre.",
  8:  "Auteur humain, inspiration divine, ancrage généalogique.",
  9:  "Pivot théologique du chapitre.",
  10: "Explication de texte (grammaire, contexte).",
  11: "Termes clés et portée doctrinale.",
  12: "Passages parallèles/complémentaires dans l’Écriture.",
  13: "Attributs de Dieu, création, alliance, salut…",
  14: "Rattachement aux grands thèmes systématiques.",
  15: "Vertus et attitudes que la doctrine produit.",
  16: "Typologie, symboles et figures.",
  17: "Textes d’appui confirmant l’interprétation.",
  18: "Harmonisation interne du chapitre.",
  19: "Continuité de la révélation et de l’Église.",
  20: "Formulation brève et structurante pour la mémoire.",
  21: "Implications pour la vie d’Église.",
  22: "Implications pour la famille.",
  23: "Pédagogie adaptée aux enfants.",
  24: "Annonce, contextualisation fidèle, espérance.",
  25: "Conseil, avertissement, consolation.",
  26: "Repentance, foi, obéissance, prière.",
  27: "Sélection utile pour méditation et témoignage.",
  28: "Action de grâces et demande de bénédiction."
};

// ---- Utilitaires ------------------------------------------------------------

// YouVersion (LSG=93 par défaut). Si tu veux forcer DARBY, remplace "LSG" par "DBY"
// et adapte l’ID si besoin.
const YV_VERSION_TAG = "LSG"; // ou "DBY"
const YV_VERSION_ID  = "93";  // LSG=93 ; (tu peux changer si tu le souhaites)

function yv(bookCode3, chap, versesOpt) {
  const v = versesOpt ? `.${versesOpt}` : "";
  return `https://www.bible.com/fr/bible/${YV_VERSION_ID}/${bookCode3}.${chap}.${YV_VERSION_TAG}`;
}

// Mappage minimal (Genèse 1). Tu peux étendre si tu veux plus tard.
const BOOK3 = {
  "Genèse": "GEN",
  "Exode": "EXO",
  "Psaumes": "PSA",
  "Jean": "JHN",
  "Hébreux": "HEB",
  "Colossiens": "COL",
  "Actes": "ACT",
  "Apocalypse": "REV",
  "Romains": "ROM",
  "Proverbes": "PRO"
};

// Lien Markdown vers un verset (affichage « Genèse 1:3 » qui pointe vers YouVersion).
function ref(book, chap, vr) {
  const code = BOOK3[book] || "GEN";
  const text = `${book} ${chap}${vr ? ":" + vr : ""}`;
  return `[${text}](${yv(code, chap, vr)})`;
}

function clampLen(len) {
  return [500,1500,2500].includes(len) ? len : 1500;
}

// Concatène des blocs uniques jusqu’à la longueur-cible SANS répéter.
function growToLength(targetLen, blocks) {
  const out = [];
  let acc = 0;
  for (const b of blocks) {
    if (!b) continue;
    out.push(b);
    acc += b.length;
    if (acc >= targetLen) break;
  }
  return out.join("\n\n").trim();
}

// ---- Génération par rubrique (qualitative & sans doublon) -------------------

function section1(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Prière d’ouverture\n\n*Référence :* ${passage}\n\nPère, nous venons écouter ta Parole. Comme au commencement, que ta lumière chasse nos ténèbres et que ton Esprit plane sur nos pensées (${ref("Genèse", chap, "1-2")}). Donne-nous une intelligence humble et obéissante, pour ta gloire et le service du prochain.`,
    `Ta voix distingue et ordonne ce qui est informe : « Dieu dit… » et l’être advient (${ref("Genèse", chap, "3")}). Que ta Parole nous crée de nouveau, éclaire notre lecture et affermit notre foi.`,
    `Éloigne de nous les lectures arbitraires et accorde une interprétation ecclésiale, enracinée dans tout le canon. Que notre méditation soit nourrie par l’Esprit et nous conduise à l’adoration et à l’obéissance.`
  ];
  return growToLength(0, blocks);
}

function section2(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Canon et testament\n\n*Référence :* ${passage}\n\n« Au commencement, Dieu créa » (${ref("Genèse", chap, "1")}) ouvre l’Écriture entière : l’univers dépend radicalement du Créateur.`,
    `Le Nouveau Testament confirme ce primat : « Tout a été fait par elle » (${ref("Jean", 1, "1-3")}) ; « le monde a été formé par la parole de Dieu » (${ref("Hébreux", 11, "3")}). Le psalmiste chante : « Les cieux ont été faits par la parole de l’Éternel » (${ref("Psaumes", 33, "6")}).`,
    `Le canon oriente donc la lecture : Genèse 1 n’est pas un texte isolé mais le seuil d’une révélation qui culmine en Christ, par qui « tout subsiste » (${ref("Colossiens", 1, "16-17")}).`
  ];
  return growToLength(0, blocks);
}

function section3(passage) {
  const [book, chap] = passage.split(/\s+/);
  // Q/R doctrinales
  const blocks = [
    `### Questions du chapitre précédent — Réponses doctrinales\n\n*Référence :* ${passage}`,
    `**Q.** Que signifie la formule récurrente « Dieu dit » ?\n**R.** Elle affirme l’efficacité performative de la Parole divine : dire, c’est faire. Chaque ordre fonde l’être (lumière ${ref("Genèse", chap, "3")}, firmament ${ref("Genèse", chap, "6")}, terre ${ref("Genèse", chap, "9")}).`,
    `**Q.** Pourquoi l’être humain est-il créé « à l’image de Dieu » ?\n**R.** Pour refléter l’autorité du Créateur en gouvernant la création avec responsabilité et dépendance (${ref("Genèse", chap, "26-27")}). Cette dignité fonde l’éthique biblique et interdit toute dépréciation de la vie.`,
    `**Q.** Que signifie « Dieu vit que cela était bon » ?\n**R.** La bonté désigne la conformité de l’œuvre au dessein divin, le « très bon » final manifestant l’orientation de la création vers la gloire de Dieu (${ref("Genèse", chap, "31")}).`,
    `**Q.** Quel lien entre la création et le temps ?\n**R.** La structure en jours institue le rythme de la vie et prépare le sabbat, signe du repos de Dieu (${ref("Genèse", 2, "1-3")}).`
  ];
  return growToLength(0, blocks);
}

function section4(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Titre du chapitre\n\n*Référence :* ${passage}\n\n**« La Parole qui crée, ordonne et confie la vocation de l’homme »** — Genèse ${chap} présente la souveraineté du Dieu vivant, l’ordre du monde et la dignité de l’image.`
  ];
  return growToLength(0, blocks);
}

function section5(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Contexte historique\n\n*Référence :* ${passage}\n\nLe chapitre s’inscrit dans la Torah de Moïse. Le récit combat les cosmogonies polythéistes en affirmant un Dieu unique, transcendant et libre. Les astres ne sont pas des divinités, mais des luminaires établis pour « marquer les époques » (${ref("Genèse", chap, "14")}).`
  ];
  return growToLength(0, blocks);
}

function section6(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Structure littéraire\n\n*Référence :* ${passage}\n\nLa semaine en six œuvres + un jour de repos : formations (jours 1-3) puis remplissages (jours 4-6), avec refrain « Dieu dit… il y eut un soir, il y eut un matin ». La clôture par le sabbat fonde la cadence de l’existence (${ref("Genèse", 2, "1-3")}).`
  ];
  return growToLength(0, blocks);
}

function section7(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Genre littéraire\n\n*Référence :* ${passage}\n\nRécit théologique à portée universelle : langage simple, structure soignée, visée catéchétique. Le genre ne vise ni mythe ni chronique, mais proclamation doctrinale du Dieu créateur.`;
}

function section8(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Auteur et généalogie\n\n*Référence :* ${passage}\n\nTradition mosaïque : la Torah présente une architecture généalogique (« générations ») situant l’humanité devant Dieu. La création prépare la vocation d’Israël et, ultimement, le Christ (${ref("Romains", 11, "36")}).`;
}

function section9(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Verset-clé doctrinal\n\n*Référence :* ${passage}\n\n> « Au commencement, Dieu créa les cieux et la terre » (${ref("Genèse", chap, "1")}).\n\nTout découle de ce principe : Dieu seul est source, mesure et but de l’être.`;
}

function section10(passage) {
  const [book, chap] = passage.split(/\s+/);
  const blocks = [
    `### Analyse exégétique\n\n*Référence :* ${passage}\n\nLe verbe « créa » (bara) est réservé à l’action divine. L’alternance « Dieu dit / et il fut » souligne la puissance efficace de la Parole (${ref("Genèse", chap, "3")}).`,
    `La progression sépare puis remplit : lumière/ténèbres, eaux d’en haut/d’en bas, mer/terre sèche ; puis luminaires, oiseaux/poissons, animaux/humains. L’ordre n’est pas arbitraire, il sert la vie.`
  ];
  return growToLength(0, blocks);
}

function section11(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Analyse lexicale\n\n*Référence :* ${passage}\n\nTermes clés : *parole*, *séparer*, *béni*, *image*, *dominer*. « Image » n’abolit pas la transcendance : elle confère une vocation de représentation responsable (${ref("Genèse", chap, "26-28")}).`;
}

function section12(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Références croisées\n\n*Référence :* ${passage}\n\n${ref("Jean", 1, "1-3")} ; ${ref("Hébreux", 11, "3")} ; ${ref("Psaumes", 33, "6")} ; ${ref("Colossiens", 1, "16-17")} ; ${ref("Apocalypse", 4, "11")} — convergence canonique : la création par la Parole, en Christ et pour Christ.`;
}

function section13(passage) {
  return `### Fondements théologiques\n\n*Référence :* ${passage}\n\nDieu créateur, liberté souveraine, bonté de l’être, dignité de l’image, finalité doxologique. La création n’est ni divine ni absurde : elle reçoit son sens de Dieu et pour Dieu.`;
}

function section14(passage) {
  return `### Thème doctrinal\n\n*Référence :* ${passage}\n\n**Doctrine de la création** : ex nihilo, par la Parole, structurée, bénie, orientée vers le sabbat. Le chapitre donne un cadre pour l’écologie, l’éthique et l’adoration.`;
}

function section15(passage) {
  return `### Fruits spirituels\n\n*Référence :* ${passage}\n\nAdoration, action de grâces, responsabilité, humilité, espérance. La contemplation de l’ordre créé façonne la patience et la joie du service.`;
}

function section16(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Types bibliques\n\n*Référence :* ${passage}\n\nLumière/obscurité (révélation/jugement), eaux/terre (chaos/ordre), sabbat (repos eschatologique). Ces figures préparent la venue du Christ, lumière du monde (${ref("Jean", 1, "4-5")}).`;
}

function section17(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Appui doctrinal\n\n*Référence :* ${passage}\n\n${ref("Psaumes", 33, "6")} ; ${ref("Hébreux", 11, "3")} ; ${ref("Colossiens", 1, "16-17")} — textes d’appui confirmant la lecture christocentrique de la création.`;
}

function section18(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Comparaison entre versets\n\n*Référence :* ${passage}\n\nComparer ${ref("Genèse", chap, "1")}, ${ref("Genèse", chap, "3")}, ${ref("Genèse", chap, "26-28")} et ${ref("Genèse", chap, "31")} : principe, efficacité, vocation humaine et final « très bon ». L’ensemble compose une théologie unifiée.`;
}

function section19(passage) {
  return `### Parallèle avec Actes 2\n\n*Référence :* ${passage}\n\nComme l’Esprit planait au commencement, l’Esprit est répandu sur toute chair (${ref("Actes", 2, "17")}). La nouvelle création commence par la Parole prêchée, qui appelle à la repentance et à la vie.`;
}

function section20(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Verset à mémoriser\n\n*Référence :* ${passage}\n\n**${ref("Genèse", chap, "1")}** — À apprendre par cœur comme pilier de la foi et porte d’entrée de toute théologie.`;
}

function section21(passage) {
  return `### Enseignement pour l’Église\n\n*Référence :* ${passage}\n\nCulte centré sur la Parole, rythme hebdomadaire ancré dans le repos de Dieu, mission comme prolongement de la bénédiction créatrice.`;
}

function section22(passage) {
  return `### Enseignement pour la famille\n\n*Référence :* ${passage}\n\nTransmission de la foi, sanctification du temps (travail/repos), respect de la création et de la dignité de chacun.`;
}

function section23(passage) {
  return `### Enseignement pour enfants\n\n*Référence :* ${passage}\n\nRaconter la semaine de la création, montrer que Dieu dit et que cela arrive, apprendre à remercier pour la lumière, la vie, les saisons.`;
}

function section24(passage) {
  return `### Application missionnaire\n\n*Référence :* ${passage}\n\nAnnonce d’un Dieu créateur et bon ; critique des idoles ; espérance offerte à toute créature. La création prépare l’Évangile de la réconciliation.`;
}

function section25(passage) {
  return `### Application pastorale\n\n*Référence :* ${passage}\n\nConseiller dans la détresse : Dieu n’est pas l’auteur du chaos ; sa Parole met en ordre, bénit et envoie. Accompagner vers le repos en Dieu.`;
}

function section26(passage) {
  return `### Application personnelle\n\n*Référence :* ${passage}\n\nRecevoir sa journée comme un don ; ordonner son temps ; travailler et se reposer devant Dieu ; cultiver et garder avec gratitude.`;
}

function section27(passage) {
  const [book, chap] = passage.split(/\s+/);
  return `### Versets à retenir\n\n*Référence :* ${passage}\n\n- ${ref("Genèse", chap, "1")}\n- ${ref("Genèse", chap, "3")}\n- ${ref("Genèse", chap, "26-28")}\n- ${ref("Genèse", chap, "31")}`;
}

function section28(passage) {
  return `### Prière de fin\n\n*Référence :* ${passage}\n\nDieu de la création, nous te bénissons : ta Parole donne l’être, ton Esprit vivifie, ton repos nous appelle. Fais de nous des témoins humbles et constants. Amen.`;
}

// Assembleur avec paliers de longueur (500/1500/2500)
function buildContent(n, passage, targetLen) {
  // Base de chaque rubrique
  const factories = {
    1: section1,  2: section2,  3: section3,  4: section4,  5: section5,
    6: section6,  7: section7,  8: section8,  9: section9, 10: section10,
    11: section11,12: section12,13: section13,14: section14,15: section15,
    16: section16,17: section17,18: section18,19: section19,20: section20,
    21: section21,22: section22,23: section23,24: section24,25: section25,
    26: section26,27: section27,28: section28
  };
  const base = factories[n](passage);

  // Extensions qualitatives (distinctes, jamais répétées).
  // Elles s’ajoutent suivant le palier demandé.
  const extCommon = [
    `La théologie biblique lit Genèse comme seuil d’une histoire du salut qui progresse jusqu’au Christ, en gardant l’unité de l’Écriture et la diversité de ses livres.`,
    `La doctrine de la création fonde une éthique de la responsabilité : cultiver et garder, dans la gratitude et l’espérance, en refusant les idoles qui défigurent l’humain.`,
    `L’orientation doxologique est décisive : « Tu es digne… car tu as créé toutes choses » (${ref("Apocalypse", 4, "11")}).`
  ];
  const extDeeper = [
    `Le rythme des jours marque une pédagogie divine : alternance de séparation et de remplissage, puis couronnement par le repos — matrice d’une vie ordonnée au service de Dieu.`,
    `La confession « par lui et pour lui » (${ref("Colossiens", 1, "16-17")}) interdit de séparer cosmologie et christologie : la création est déjà christocentrique.`,
    `Le langage de bénédiction enracine la mission : recevoir de Dieu pour transmettre la vie, dans l’Alliance qui porte l’histoire.`
  ];

  // Palier de longueur
  const target = clampLen(targetLen || 1500);
  if (target === 500) {
    return base.length > 480 ? base.slice(0, 480) + "…" : base;
  }
  if (target === 1500) {
    return growToLength(1500, [base, ...extCommon]);
  }
  // 2500
  return growToLength(2500, [base, ...extCommon, ...extDeeper]);
}

// Construit l’objet « section »
function makeSection(n, passage, len) {
  return {
    id: n,
    title: TITLES[n],
    description: DESCS[n],
    content: buildContent(n, passage, len)
  };
}

// ---- Handler HTTP -----------------------------------------------------------

module.exports = async (req, res) => {
  try {
    if (req.method === "GET") {
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({
        ok: true,
        route: "/api/generate-study",
        method: "GET",
        hint: "POST { passage, options:{ length: 500|1500|2500 } }"
      });
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ ok:false, error: "Méthode non autorisée" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const passage = String(body.passage || "").trim() || "Genèse 1";
    const lengthOpt = body.options && body.options.length ? Number(body.options.length) : 1500;
    const len = clampLen(lengthOpt);

    // 28 rubriques
    const sections = [];
    for (let i = 1; i <= 28; i++) {
      sections.push(makeSection(i, passage, len));
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({
      study: { sections },
    });

  } catch (err) {
    console.error("[/api/generate-study] ERROR:", err);
    return res.status(500).json({
      ok: false,
      error: "INTERNAL_ERROR",
      message: "La génération a échoué côté serveur."
    });
  }
};

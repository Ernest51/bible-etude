// /api/generate-study.js — Serverless (CommonJS) robuste
// - GET  : smoke test
// - POST : génère 28 rubriques, chacune *distincte*, ton narratif + doctrinal
// - Densité par rubrique (500 | 1500 | 2500) via options.length
// - Références bibliques entre crochets [Livre X:Y] pour être linkifiées côté front
// - Aucune dépendance externe. Jamais d'exception non catchée -> pas de 500.

const RUBRICS = {
  1:  { t: "Prière d’ouverture",          d: "Invocation du Saint-Esprit pour éclairer l’étude." },
  2:  { t: "Canon et testament",           d: "Place dans le canon (AT/NT) et continuité biblique." },
  3:  { t: "Questions du chapitre précédent", d: "Points à reprendre et tensions ouvertes." },
  4:  { t: "Titre du chapitre",            d: "Formulation doctrinale synthétique et fidèle au texte." },
  5:  { t: "Contexte historique",          d: "Cadre temporel, culturel, géographique, destinataires." },
  6:  { t: "Structure littéraire",         d: "Découpage, progression et marqueurs rhétoriques." },
  7:  { t: "Genre littéraire",             d: "Narratif, poétique, prophétique… incidences herméneutiques." },
  8:  { t: "Auteur et généalogie",         d: "Auteur humain, inspiration divine, ancrage généalogique." },
  9:  { t: "Verset-clé doctrinal",         d: "Pivot théologique du chapitre." },
  10: { t: "Analyse exégétique",           d: "Explication de texte : grammaire, syntaxe, contexte immédiat." },
  11: { t: "Analyse lexicale",             d: "Termes clés, champs sémantiques, portée doctrinale." },
  12: { t: "Références croisées",          d: "Passages parallèles/complémentaires dans l’Écriture." },
  13: { t: "Fondements théologiques",      d: "Attributs de Dieu, création, alliance, salut…" },
  14: { t: "Thème doctrinal",              d: "Rattachement aux grands thèmes systématiques." },
  15: { t: "Fruits spirituels",            d: "Vertus et attitudes produites par la doctrine." },
  16: { t: "Types bibliques",              d: "Typologie, symboles et figures." },
  17: { t: "Appui doctrinal",              d: "Textes d’appui validant l’interprétation." },
  18: { t: "Comparaison entre versets",    d: "Harmonisation interne du chapitre." },
  19: { t: "Parallèle avec Actes 2",       d: "Continuité de la révélation et de l’Église." },
  20: { t: "Verset à mémoriser",           d: "Formulation brève et structurante pour la mémoire." },
  21: { t: "Enseignement pour l’Église",   d: "Gouvernance, culte, mission, édification." },
  22: { t: "Enseignement pour la famille", d: "Transmission, sainteté, consolation." },
  23: { t: "Enseignement pour enfants",    d: "Pédagogie, récits, symboles, jeux sérieux." },
  24: { t: "Application missionnaire",     d: "Annonce, contextualisation fidèle, espérance." },
  25: { t: "Application pastorale",        d: "Conseil, avertissement, consolation." },
  26: { t: "Application personnelle",      d: "Repentance, foi, obéissance, prière." },
  27: { t: "Versets à retenir",            d: "Sélection utile pour la méditation et l’évangélisation." },
  28: { t: "Prière de fin",                d: "Action de grâces et demande de bénédiction." }
};

// Expansions doctrinales variées par rubrique (évite les doublons)
const EXPANDERS = {
  1: [
    "Nous reconnaissons Dieu comme Créateur et Seigneur, source de toute lumière.", 
    "Que nos cœurs se soumettent humblement à la Parole inspirée.",
    "Accorde clarté et discernement pour comprendre le dessein divin.",
    "Que cette lecture nous conduise à la louange et à l’obéissance."
  ],
  2: [
    "Ce chapitre s’inscrit dans l’unité organique de l’Écriture, de la création à la nouvelle création.",
    "L’Ancien et le Nouveau Testaments se répondent sans se contredire.",
    "La doctrine de l’inspiration garantit l’autorité du texte sacré.",
    "Le témoignage apostolique confirme la continuité de la révélation."
  ],
  3: [
    "Identifier les questions ouvertes permet de mieux recevoir l’éclairage du présent chapitre.",
    "Les tensions interprétatives invitent à l’humilité et à la rigueur.",
    "Le fil narratif précédent prépare la compréhension de ce qui suit.",
    "Les zones d’ombre deviennent des occasions de croissance théologique."
  ],
  4: [
    "Le titre doit résumer la vérité centrale en une phrase mémorable.",
    "Il doit respecter le sens littéral tout en montrant sa portée doctrinale.",
    "Une bonne formulation sert l’enseignement et l’édification de l’Église.",
    "Éviter les lectures réductrices, respecter le contexte du chapitre."
  ],
  5: [
    "La réception historique du texte nourrit l’intelligence de la foi.",
    "Les destinataires premiers n’annulent pas l’universalité du message.",
    "Le contexte éclaire les nuances, sans relativiser la vérité divine.",
    "Les données culturelles servent le sens, sans le gouverner."
  ],
  6: [
    "Observer la progression aide à saisir l’intention de l’auteur.",
    "Les répétitions et parallélismes sont pédagogiques et théologiques.",
    "Le découpage révèle la cohérence d’ensemble et les pivots du récit.",
    "Les inclusions encadrent la lecture et orientent l’interprétation."
  ],
  7: [
    "Chaque genre possède des codes, utiles à l’interprétation fidèle.",
    "Le genre n’annule pas la factualité, il en règle la lecture.",
    "Les procédés littéraires servent le propos théologique.",
    "L’Écriture parle vrai dans les formes qu’elle choisit."
  ],
  8: [
    "L’inspiration n’abolit pas la personnalité de l’auteur humain.",
    "Dieu conduit l’histoire et les généalogies vers son dessein.",
    "La lignée et la transmission soulignent la fidélité de l’alliance.",
    "Le canon reconnaît ce texte comme norme de foi et de vie."
  ],
  9: [
    "Le verset pivot gouverne le sens des passages voisins.",
    "Il exprime une vérité doctrinale cardinale pour toute l’Église.",
    "Le mémoriser aide à garder le fil directeur de l’exégèse.",
    "Son vocabulaire est stratégiquement choisi par l’auteur sacré."
  ],
  10: [
    "L’analyse syntaxique évite les surinterprétations arbitraires.",
    "Le contexte immédiat règle la portée des affirmations.",
    "Les connecteurs logiques marquent les avancées du raisonnement.",
    "Les temps verbaux éclairent l’aspect et la dynamique du récit."
  ],
  11: [
    "Les champs sémantiques guident la théologie d’ensemble.",
    "Comparer les occurrences du même terme dans le canon éclaire le sens.",
    "Les termes techniques ne sont jamais gratuits dans l’Écriture.",
    "La nuance lexicale sert un propos précis et inspiré."
  ],
  12: [
    "Les parallèles confirment l’unité de la révélation.",
    "Les textes clairs éclairent les passages difficiles.",
    "La meilleure herméneutique est canonique et christocentrique.",
    "Les échos bibliques enrichissent l’intelligence doctrinale."
  ],
  13: [
    "La doctrine de Dieu s’y déploie dans ses attributs et ses œuvres.",
    "La création révèle sa puissance, sa sagesse et sa bonté.",
    "L’alliance ordonne l’histoire au salut en Christ.",
    "La théologie systématique reçoit, non n’impose, le sens du texte."
  ],
  14: [
    "Les grands thèmes (création, révélation, salut, Église, fin) se répondent.",
    "Chaque thème doit être lu dans sa trame canonique.",
    "La cohérence doctrinale protège contre les excès spéculatifs.",
    "Le centre christologique ordonne les doctrines périphériques."
  ],
  15: [
    "La doctrine embrase la piété et façonne le caractère.",
    "Les vertus naissent de la contemplation de la vérité divine.",
    "La vie nouvelle reflète l’ordre et la bonté de Dieu.",
    "La foi agit par l’amour, dans l’espérance."
  ],
  16: [
    "La typologie ne fabrique pas des sens, elle reconnaît des anticipations.",
    "Les figures renvoient à l’accomplissement en Christ.",
    "Les symboles servent la mémoire et l’adoration.",
    "La lecture typologique reste disciplinée par le texte."
  ],
  17: [
    "Les textes d’appui confirment, ils ne forcent pas le sens.",
    "Un faisceau d’indices l’emporte sur une preuve isolée.",
    "La convergence canonique vaut plus que l’argument isolé.",
    "La doctrine se fonde sur l’ensemble de l’Écriture."
  ],
  18: [
    "Comparer les versets évite les lectures fragmentaires.",
    "Les variations servent souvent une même ligne directrice.",
    "Les tensions apparentes appellent une harmonisation loyale.",
    "L’unité thématique se vérifie dans les répétitions clés."
  ],
  19: [
    "Le don de l’Esprit réalise ce que le texte annonce en germe.",
    "La mission de l’Église prolonge l’intention créatrice de Dieu.",
    "Actes 2 éclaire la dimension communautaire et cultuelle.",
    "La parole créatrice devient parole proclamée."
  ],
  20: [
    "Choisis un verset bref et structurant, facile à citer.",
    "La mémorisation est un moyen de grâce pour l’âme.",
    "Le verset pivot devient prière et confession.",
    "Répéter grave la vérité dans le cœur."
  ],
  21: [
    "Le culte répond à l’initiative de Dieu qui parle le premier.",
    "La mission découle de l’identité reçue et envoyée.",
    "La communion s’édifie par la Parole et la prière.",
    "La discipline ecclésiale protège la vérité et l’amour."
  ],
  22: [
    "La famille reflète l’ordre et la bonté du Créateur.",
    "La transmission dans le foyer précède l’assemblée.",
    "La sainteté domestique sert le témoignage public.",
    "Consoler, corriger, encourager : un ministère quotidien."
  ],
  23: [
    "Raconter simplement, avec des images qui parlent aux enfants.",
    "Faire goûter la beauté de la vérité et de l’obéissance.",
    "Les symboles et jeux sérieux fixent la mémoire.",
    "La pédagogie suit la croissance de l’enfant."
  ],
  24: [
    "Annoncer fidèlement sans trahir le message biblique.",
    "Contextualiser, c’est clarifier sans dénaturer.",
    "L’espérance transforme le regard sur le monde.",
    "La mission jaillit de l’adoration."
  ],
  25: [
    "Conseiller avec douceur et fermeté, à la lumière du texte.",
    "Avertir sans écraser, consoler sans relativiser.",
    "Le soin d’âmes s’enracine dans la vérité biblique.",
    "La prière accompagne tout acte pastoral."
  ],
  26: [
    "La repentance ouvre à la joie de l’obéissance.",
    "La foi s’appuie sur les promesses de Dieu.",
    "La prière engage le cœur tout entier.",
    "La sanctification est une marche persévérante."
  ],
  27: [
    "Choisir des versets qui éclairent, consolent et envoient.",
    "La sélection sert la méditation et le témoignage.",
    "La Parole mémorisée devient ressource en tout temps.",
    "Diffuser les versets nourrit l’édification mutuelle."
  ],
  28: [
    "Nous te rendons grâce pour ta Parole qui vivifie.",
    "Scelle en nous ce que tu as enseigné.",
    "Conduis ton Église dans l’obéissance joyeuse.",
    "Par Jésus-Christ, Amen."
  ]
};

// Quelques références canoniques souvent pertinentes pour Genèse 1.
// (Restent valides même si 'passage' change : elles servent de croisements.)
const COMMON_CROSS = [
  "[Genèse 1:1–3]", "[Psaumes 19:2]", "[Psaumes 33:6]", "[Jean 1:1–3]",
  "[Colossiens 1:16–17]", "[Hébreux 11:3]", "[Apocalypse 4:11]"
];

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function cutAtSentence(text, max) {
  if (text.length <= max) return text;
  const s = text.slice(0, max);
  const cut = Math.max(s.lastIndexOf("."), s.lastIndexOf("!"), s.lastIndexOf("?"));
  return cut > max * 0.6 ? s.slice(0, cut + 1) : s + "…";
}

function padWithExpansions(base, target, pool) {
  const min = Math.round(target * 0.92);
  const max = Math.round(target * 1.08);
  let out = String(base || "").trim();

  // Ajoute des expansions variées jusqu’à atteindre ~min
  let i = 0;
  while (out.length < min && pool && pool.length) {
    const sent = pool[i % pool.length];
    // évite la répétition immédiate de la même phrase
    if (!out.endsWith(sent)) out += (out.endsWith(".") ? " " : " ") + sent;
    i++;
    if (i > pool.length * 3) break; // garde-fou
  }
  if (out.length > max) out = cutAtSentence(out, max);
  return out;
}

function titleBlock(title, passage) {
  return `### ${title}\n\n*Référence :* ${passage}\n`;
}

function buildForRubric(id, passage) {
  // Corps de base spécifique à chaque rubrique (narratif + doctrinal + références)
  // NB: pas de citations longues; on renvoie vers les versets par des balises [Livre X:Y]
  switch (id) {
    case 1:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Père saint, nous nous approchons de ta Parole avec respect. Donne-nous de discerner ton dessein dans ce chapitre, " +
        "de recevoir humblement la vérité et d’y conformer nos vies. Que la lecture de ce texte oriente notre prière et notre obéissance, " +
        "dans la clarté que donne l’Esprit. "
      );
    case 2:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Ce chapitre s’inscrit dans le grand récit biblique, où l’Ancien et le Nouveau Testaments se répondent harmonieusement. " +
        "La confession de Dieu Créateur éclaire l’ensemble du canon et prépare la christologie du Nouveau Testament (" +
        COMMON_CROSS.join(", ") + "). "
      );
    case 3:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Relevons les questions ouvertes par l’étude précédente : quelles notions restent à éclairer ? quelles tensions " +
        "apparentes demandent une harmonisation fidèle ? Cette mise au point affine notre écoute du présent chapitre et prépare une " +
        "réception plus mûre de son message. "
      );
    case 4:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Proposer un titre doctrinal revient à condenser l’axe du chapitre : Dieu parle, le monde est ordonné, l’homme reçoit sa vocation. " +
        "Le titre sert la mémoire et protège d’une lecture fragmentaire, en respectant le fil narratif voulu par l’auteur sacré. "
      );
    case 5:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Situer ce chapitre dans son contexte permet d’entendre ses nuances sans relativiser la vérité qu’il porte. " +
        "Les destinataires premiers, la culture et la géographie éclairent la portée du message, sans en diminuer l’autorité divine. "
      );
    case 6:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "La progression interne du chapitre – ouvertures, répétitions, jalons – révèle l’intention théologique. " +
        "Observer le rythme, les refrains et les transitions donne accès aux pivots du propos. "
      );
    case 7:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Le genre littéraire oriente la lecture : il ne relativise pas la vérité, il en règle la réception. " +
        "Les procédés stylistiques servent la doctrine plutôt qu’ils ne la masquent. "
      );
    case 8:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "L’auteur humain écrit sous l’inspiration divine : la personnalité n’est pas abolie, elle est assumée et guidée. " +
        "La généalogie et la transmission manifestent la fidélité de Dieu dans l’histoire. "
      );
    case 9:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Identifier le verset pivot aide à tenir le fil doctrinal. On cherchera le point où l’intention théologique se concentre " +
        "et éclaire les passages voisins (ex. " + COMMON_CROSS.slice(0,3).join(", ") + "). "
      );
    case 10:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "L’exégèse observe la syntaxe et les connecteurs, puis situe chaque proposition dans son contexte immédiat. " +
        "Les temps verbaux, les parallélismes et la logique du discours supportent la lecture théologique. "
      );
    case 11:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Certains termes clés organisent le champ sémantique du chapitre. Les comparer dans le canon permet d’éviter " +
        "les surcharges interprétatives et de conserver la justesse doctrinale. "
      );
    case 12:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Les références croisées confirment que l’Écriture s’explique par l’Écriture : " + COMMON_CROSS.join(", ") + ". " +
        "Les textes clairs éclairent les passages difficiles et laissent émerger la cohérence christocentrique. "
      );
    case 13:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Ce chapitre déploie de grands axes : Dieu, Créateur et Seigneur ; l’ordre et la bonté de la création ; " +
        "l’alliance qui orientera l’histoire du salut. Ces fondements nourrissent toute la théologie chrétienne. "
      );
    case 14:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Le thème doctrinal se rattache aux grands ensembles de la foi : création, révélation, salut, Église, fin. " +
        "L’ensemble est relié au centre christologique qui unifie la doctrine. "
      );
    case 15:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "La doctrine porte des fruits : adoration, humilité, obéissance, espérance. " +
        "Le chapitre ne transmet pas qu’un savoir : il façonne une manière d’être devant Dieu et devant les hommes. "
      );
    case 16:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Les types et symboles n’inventent rien : ils reconnaissent dans l’Histoire sainte des anticipations de l’accomplissement en Christ. " +
        "La lecture typologique reste disciplinée par le texte et par l’ensemble du canon. "
      );
    case 17:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Un bon appui doctrinal convoque plusieurs témoins bibliques convergents, plutôt qu’une preuve isolée. " +
        "La doctrine naît de la totalité de l’Écriture, reçue dans l’Église. "
      );
    case 18:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Comparer les versets entre eux fait apparaître l’unité du propos. Les variations de forme servent " +
        "souvent la même ligne directrice et se clarifient par l’harmonisation. "
      );
    case 19:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Le parallèle avec [Actes 2:1–4] montre comment la parole créatrice rejoint l’histoire de l’Église par le don de l’Esprit. " +
        "La mission découle de cette œuvre divine inaugurale. "
      );
    case 20:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Choisir un verset bref et lumineux, facile à retenir, pour nourrir la prière quotidienne et la confession de foi (ex. " +
        COMMON_CROSS[0] + "). La mémorisation grave la vérité dans le cœur. "
      );
    case 21:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Pour l’Église : culte centré sur Dieu qui parle le premier ; mission reçue ; édification mutuelle " +
        "par la Parole, les sacrements et la prière. L’ordre du chapitre inspire l’ordre ecclésial. "
      );
    case 22:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Pour la famille : transmettre la foi, rechercher la sainteté, consoler les faibles. " +
        "Le foyer devient un lieu de parole et d’obéissance, en cohérence avec le message du chapitre. "
      );
    case 23:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Avec les enfants : raconter simplement, utiliser des images, des symboles, des gestes qui aident à retenir. " +
        "Faire goûter la beauté de la vérité et de l’obéissance au Dieu Créateur. "
      );
    case 24:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Mission : annoncer fidèlement sans trahir, contextualiser sans diluer, témoigner avec douceur et respect. " +
        "L’espérance nouvelle transforme le regard sur le monde. "
      );
    case 25:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Pastoralement : conseiller dans la vérité, avertir avec humilité, consoler avec compassion. " +
        "La Parole reçue façonne la sagesse pratique au service des âmes. "
      );
    case 26:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Personnellement : entrer dans la repentance, s’appuyer par la foi sur les promesses, " +
        "persévérer dans la prière et l’obéissance joyeuse. "
      );
    case 27:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Sélectionner des versets pour la méditation et le témoignage (ex. " + COMMON_CROSS.slice(1, 4).join(", ") + "). " +
        "Les garder à portée de cœur et de bouche. "
      );
    case 28:
      return (
        titleBlock(RUBRICS[id].t, passage) +
        "Nous te bénissons, Seigneur, pour la lumière de ta Parole. " +
        "Scelle en nous ce que tu as enseigné et conduis-nous dans l’obéissance. Amen. "
      );
    default:
      return titleBlock("Rubrique", passage) + "Contenu à développer.";
  }
}

function buildSections(passage, per) {
  const out = [];
  for (let i = 1; i <= 28; i++) {
    const meta = RUBRICS[i];
    const base = buildForRubric(i, passage);
    const content = padWithExpansions(base, per, EXPANDERS[i] || []);
    out.push({
      id: i,
      title: meta.t,
      description: meta.d,
      content
    });
  }
  return out;
}

function send(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  try {
    const method = req.method || "GET";

    if (method === "GET") {
      return send(res, 200, {
        ok: true,
        route: "/api/generate-study",
        method: "GET",
        hint: "POST { passage, options:{ length: 500|1500|2500, translation?: 'DARBY' } }"
      });
    }

    if (method !== "POST") {
      return send(res, 405, { error: "Method not allowed" });
    }

    // Lecture body sans body-parser
    let passage = "Genèse 1";
    let per = 1500;
    let translation = "DARBY";

    try {
      let raw = "";
      await new Promise((resolve) => {
        req.on("data", (c) => (raw += c));
        req.on("end", resolve);
        req.on("error", resolve);
      });
      if (raw && typeof raw === "string") {
        const b = JSON.parse(raw);
        if (b.passage) passage = String(b.passage);
        if (b.options && b.options.length) per = clamp(Number(b.options.length), 300, 6000);
        if (b.options && b.options.translation) translation = String(b.options.translation).toUpperCase();
      }
    } catch (_) {
      // en cas d'erreur de parsing, on garde les defaults
    }

    // Génération : contenu narratif/doctrinal, références cliquables côté front
    const sections = buildSections(passage, per);
    return send(res, 200, { study: { sections }, meta: { passage, lengthPerSection: per, translation } });

  } catch (e) {
    const fallback = buildSections("Genèse 1", 1200);
    return send(res, 200, { study: { sections: fallback }, info: { emergency: true, error: String(e && e.message || e) } });
  }
};

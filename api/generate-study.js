// /api/generate-study.cjs — Génération narrative propre (sans doublons, sans titres)
// - CommonJS (compatible Vercel Node 22)
// - GET  : smoke test
// - POST : { passage, options:{ length: 500|1500|2500 } } -> { study:{ sections:[{id,title,description,content}] } }

const RUBRICS = {
  1:{title:"Prière d’ouverture",desc:"Invocation du Saint-Esprit pour éclairer l’étude."},
  2:{title:"Canon et testament",desc:"Appartenance au canon (AT/NT)."},
  3:{title:"Questions du chapitre précédent",desc:"Questions à reprendre de l’étude précédente."},
  4:{title:"Titre du chapitre",desc:"Résumé doctrinal synthétique du chapitre."},
  5:{title:"Contexte historique",desc:"Période, géopolitique, culture, carte."},
  6:{title:"Structure littéraire",desc:"Séquençage narratif et composition."},
  7:{title:"Genre littéraire",desc:"Type de texte : narratif, poétique, prophétique…"},
  8:{title:"Auteur et généalogie",desc:"Auteur et lien aux patriarches (généalogie)."},
  9:{title:"Verset-clé doctrinal",desc:"Verset central du chapitre."},
  10:{title:"Analyse exégétique",desc:"Commentaire exégétique (original si utile)."},
  11:{title:"Analyse lexicale",desc:"Mots-clés et portée doctrinale."},
  12:{title:"Références croisées",desc:"Passages parallèles et complémentaires."},
  13:{title:"Fondements théologiques",desc:"Doctrines majeures qui émergent du chapitre."},
  14:{title:"Thème doctrinal",desc:"Correspondance avec les grands thèmes doctrinaux."},
  15:{title:"Fruits spirituels",desc:"Vertus / attitudes visées."},
  16:{title:"Types bibliques",desc:"Figures typologiques et symboles."},
  17:{title:"Appui doctrinal",desc:"Passages d’appui concordants."},
  18:{title:"Comparaison entre versets",desc:"Comparaison interne des versets."},
  19:{title:"Parallèle avec Actes 2",desc:"Parallèle avec Actes 2."},
  20:{title:"Verset à mémoriser",desc:"Verset à mémoriser."},
  21:{title:"Enseignement pour l’Église",desc:"Implications pour l’Église."},
  22:{title:"Enseignement pour la famille",desc:"Applications familiales."},
  23:{title:"Enseignement pour enfants",desc:"Pédagogie enfants (jeux, récits, symboles)."},
  24:{title:"Application missionnaire",desc:"Applications mission/évangélisation."},
  25:{title:"Application pastorale",desc:"Applications pastorales/enseignement."},
  26:{title:"Application personnelle",desc:"Application personnelle engagée."},
  27:{title:"Versets à retenir",desc:"Versets utiles à retenir."},
  28:{title:"Prière de fin",desc:"Prière de clôture."},
};

// Petits “granulés” doctrinaux pour allonger intelligemment sans répéter.
// On n’insère jamais deux fois la même ligne dans un même contenu.
const EXPANSIONS = {
  common: [
    "Dieu se révèle en parlant, et sa Parole crée, ordonne et bénit.",
    "L’alliance traverse l’Écriture comme un fil rouge qui unit promesse et accomplissement.",
    "La lecture canonique éclaire l’unité de la foi, de la Loi aux Prophètes jusqu’au Christ.",
    "La vérité biblique appelle l’obéissance confiante, personnelle et communautaire.",
    "La théologie naît de l’Écriture, sert l’Église et façonne la vie chrétienne.",
    "Le salut s’enracine dans la grâce de Dieu et se manifeste dans la sanctification.",
  ],
  prayer: [
    "Nous confessons que sans Toi nous ne comprenons pas tes voies.",
    "Purifie nos intentions, mets dans nos cœurs la joie d’obéir.",
    "Que ta lumière dirige nos pas et apaise nos doutes.",
  ],
  history: [
    "Le contexte ancien proche-oriental aide à situer les pratiques et les symboles.",
    "Les repères temporels servent la lecture, sans enfermer le texte dans l’époque.",
    "L’économie de l’alliance explique la pédagogie progressive de Dieu.",
  ],
  structure: [
    "Les répétitions rythment et mémorisent l’essentiel.",
    "Les mouvements ouverture-développement-accomplissement structurent la pensée.",
    "Les inclusions et parallélismes mettent en relief les centres doctrinaux.",
  ],
  lexic: [
    "Les mots récurrents orientent l’interprétation vers le dessein de Dieu.",
    "Le champ sémantique éclaire la nuance de chaque occurrence.",
    "Comparer versions et traductions évite les contresens.",
  ],
  church: [
    "La communauté est édifiée par l’écoute et la mise en pratique.",
    "Les ministères servent l’unité dans la diversité des dons.",
    "La mission jaillit de l’adoration et de la compassion.",
  ],
  family: [
    "La transmission se vit par le récit, la prière et l’exemple.",
    "Un temps biblique régulier nourrit les liens et la foi.",
    "La douceur et la vérité marchent ensemble pour corriger et encourager.",
  ],
  kids: [
    "Raconter simplement, mimer et illustrer les images clés.",
    "Faire reformuler l’idée centrale et prier avec des mots d’enfant.",
    "Associer une action concrète pour retenir le message.",
  ],
  personal: [
    "Nommer une application mesurable pour la semaine.",
    "Chercher un compagnon de prière pour rendre des comptes.",
    "Remercier Dieu pour un signe de sa fidélité.",
  ],
};

// Fabrique un paragraphe à partir de phrases uniques (pas de doublon)
function uniqueParagraph(seedList, maxSentences) {
  const out = [];
  for (let i = 0; i < seedList.length && out.length < maxSentences; i++) {
    out.push(seedList[i]);
  }
  return out.join(" ");
}

// Alonge proprement vers la longueur cible en ajoutant des expansions non répétées
function extendContent(base, target, pools) {
  const used = new Set(
    base
      .replace(/\n+/g, " ")
      .split(/[.!?]\s+/)
      .map(s => s.trim())
      .filter(Boolean)
  );

  function takeFrom(list) {
    for (const s of list) {
      if (!used.has(s)) {
        used.add(s);
        base += (base.endsWith("\n") ? "" : " ") + s;
        if (base.length >= target) return true;
      }
    }
    return false;
  }

  // ordre de priorité : spécifique -> commun
  for (const p of pools) {
    if (takeFrom(p)) return base;
  }
  takeFrom(EXPANSIONS.common);
  return base;
}

// Génération narrative par rubrique (sans titres, le front gère le H3)
function buildBody(id, passage, len) {
  switch (id) {
    case 1: {
      let txt = `Père, nous venons méditer ${passage}. Ouvre nos yeux, affermis nos cœurs, dirige notre intelligence et notre volonté. Accorde-nous la clarté pour recevoir ta Parole, l’humilité pour y répondre et la persévérance pour la vivre.`;
      return extendContent(txt, len, [EXPANSIONS.prayer, EXPANSIONS.common]);
    }
    case 2: {
      let txt = `Ce chapitre s’inscrit dans le canon de l’Écriture sainte et fonde la lecture de l’ensemble biblique. Il appartient à l’Ancien Testament, dont la théologie converge vers le Christ. ${passage} présente une vérité normative pour la foi.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 3: {
      let txt = `Avant d’aborder ${passage}, rappelons brièvement les questions laissées ouvertes lors de l’étude précédente : quels attributs de Dieu étaient mis en relief ? quels repères d’alliance avaient été établis ? quels appels à la foi avaient été formulés ?`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 4: {
      let txt = `« ${passage} — Dieu parle, crée et ordonne ; l’homme reçoit, répond et adore. » Ce titre doctrinal résume le mouvement principal du chapitre : la souveraineté de Dieu et la vocation responsable de l’humanité.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 5: {
      let txt = `Le cadre historique et littéraire de ${passage} ne vise pas une curiosité antiquaire mais le sens théologique : Dieu se révèle de manière adaptée, dans une culture donnée, pour conduire son peuple à la vérité.`;
      return extendContent(txt, len, [EXPANSIONS.history, EXPANSIONS.common]);
    }
    case 6: {
      let txt = `La composition de ${passage} suit une progression intentionnelle : ouverture, développement, puis point culminant. Les répétitions et les symétries ne sont pas décoratives ; elles martèlent le cœur du message.`;
      return extendContent(txt, len, [EXPANSIONS.structure, EXPANSIONS.common]);
    }
    case 7: {
      let txt = `Le genre littéraire de ${passage} oriente la lecture : narration théologique structurée. On reçoit donc un récit porteur de doctrine, où la forme sert le fond.`;
      return extendContent(txt, len, [EXPANSIONS.structure, EXPANSIONS.common]);
    }
    case 8: {
      let txt = `L’auteur sacré, inspiré par l’Esprit, transmet fidèlement la révélation. Les attaches généalogiques et la mémoire d’alliance situent ${passage} dans la continuité du peuple de Dieu.`;
      return extendContent(txt, len, [EXPANSIONS.history, EXPANSIONS.common]);
    }
    case 9: {
      let txt = `Le verset-clé oriente la compréhension doctrinale du chapitre. Dans ${passage}, on retient le verset qui concentre l’affirmation majeure et éclaire la totalité du passage.`;
      return extendContent(txt, len, [EXPANSIONS.lexic, EXPANSIONS.common]);
    }
    case 10: {
      let txt = `L’analyse exégétique suit la forme du texte pour dégager le sens voulu. On observe les liens, le vocabulaire récurrent et la dynamique de l’alliance avant d’actualiser pour l’Église.`;
      return extendContent(txt, len, [EXPANSIONS.lexic, EXPANSIONS.common]);
    }
    case 11: {
      let txt = `Sur le plan lexical, certains termes de ${passage} orientent la théologie. Leur fréquence et leur champ sémantique confirment l’axe principal du chapitre.`;
      return extendContent(txt, len, [EXPANSIONS.lexic, EXPANSIONS.common]);
    }
    case 12: {
      let txt = `Les références croisées renforcent l’unité biblique. On rapproche ${passage} d’autres passages afin de laisser l’Écriture interpréter l’Écriture.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 13: {
      let txt = `Des fondements théologiques émergent : Dieu, sujet principal ; la Parole efficace ; l’alliance qui structure l’histoire du salut ; la vocation de l’homme à répondre par la foi et l’obéissance.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 14: {
      let txt = `Le thème doctrinal de ${passage} s’insère dans les grands axes de la dogmatique : révélation, création, providence, alliance, éthique de l’adoration.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 15: {
      let txt = `Les fruits spirituels attendus : adoration, gratitude, humilité, patience et fidélité. La doctrine engendre une vie transformée, personnelle et communautaire.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 16: {
      let txt = `Les types bibliques et symboles orientent l’espérance : motifs, figures et anticipations qui convergent vers le Christ donnent profondeur à la lecture de ${passage}.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 17: {
      let txt = `L’appui doctrinal provient d’autres textes concordants. On confirme les lignes majeures de ${passage} par une polyphonie scripturaire cohérente.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 18: {
      let txt = `Comparer les versets internes du chapitre affine le sens : l’argument se déploie, se précise et se conclut ; chaque segment sert l’ensemble.`;
      return extendContent(txt, len, [EXPANSIONS.lexic, EXPANSIONS.common]);
    }
    case 19: {
      let txt = `Un parallèle avec Actes 2 souligne la continuité de l’action de Dieu : la Parole annoncée, l’Esprit à l’œuvre, un peuple rassemblé et envoyé.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 20: {
      let txt = `Choisir un verset à mémoriser dans ${passage} : qu’il accompagne la prière, la décision et la mission. La mémorisation nourrit la persévérance.`;
      return extendContent(txt, len, [EXPANSIONS.common]);
    }
    case 21: {
      let txt = `Pour l’Église : écouter la Parole, célébrer Dieu, servir le prochain. ${passage} appelle une communauté centrée sur l’Évangile.`;
      return extendContent(txt, len, [EXPANSIONS.church, EXPANSIONS.common]);
    }
    case 22: {
      let txt = `Pour la famille : instaurer une liturgie simple, régulière et joyeuse. L’étude de ${passage} se traduit par des choix concrets, paisibles et fidèles.`;
      return extendContent(txt, len, [EXPANSIONS.family, EXPANSIONS.common]);
    }
    case 23: {
      let txt = `Pour les enfants : raconter ${passage} avec des images et des gestes, souligner une idée, prier simplement et proposer une action facile à vivre.`;
      return extendContent(txt, len, [EXPANSIONS.kids, EXPANSIONS.common]);
    }
    case 24: {
      let txt = `Application missionnaire : témoigner humblement de la vérité reçue dans ${passage}, servir les personnes concrètes que Dieu place sur notre route.`;
      return extendContent(txt, len, [EXPANSIONS.church, EXPANSIONS.common]);
    }
    case 25: {
      let txt = `Application pastorale : enseigner le cœur du texte, accompagner les consciences, relier doctrine et consolation.`;
      return extendContent(txt, len, [EXPANSIONS.church, EXPANSIONS.common]);
    }
    case 26: {
      let txt = `Application personnelle : écrire une prière, prendre une résolution précise et mesurable, puis l’ancrer dans un rythme de vie.`;
      return extendContent(txt, len, [EXPANSIONS.personal, EXPANSIONS.common]);
    }
    case 27: {
      let txt = `Versets à retenir : sélectionner quelques versets de ${passage} qui résument la doctrine et soutiennent la prière quotidienne.`;
      return extendContent(txt, len, [EXPANSIONS.lexic, EXPANSIONS.common]);
    }
    case 28: {
      let txt = `Seigneur, tu nous as parlé par ta Parole. Confirme en nous la foi, affermis notre espérance et dilate notre amour. Fais de nous des témoins humbles et persévérants. Amen.`;
      return extendContent(txt, len, [EXPANSIONS.prayer, EXPANSIONS.common]);
    }
    default:
      return extendContent(`${passage}.`, len, [EXPANSIONS.common]);
  }
}

function clamp(n,a,b){ return Math.max(a,Math.min(b,n)); }

function makeSections(passage, per) {
  const sections = [];
  for (let i = 1; i <= 28; i++) {
    const meta = RUBRICS[i];
    const content = buildBody(i, passage, per);
    sections.push({
      id: i,
      title: meta.title,
      description: meta.desc,
      content // IMPORTANT : pas de "### Titre" ici (le front l’ajoute déjà)
    });
  }
  return sections;
}

function send(res, status, obj){
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  try{
    const method = req.method || "GET";

    if (method === "GET") {
      return send(res, 200, { 
        ok:true, 
        route:"/api/generate-study", 
        method:"GET", 
        hint:"POST { passage, options:{ length: 500|1500|2500 } }" 
      });
    }

    if (method !== "POST") {
      return send(res, 405, { error:"Method not allowed" });
    }

    let passage = "Genèse 1";
    let per = 1500;

    try {
      if (req.body && typeof req.body === "object") {
        const b = req.body;
        if (b.passage) passage = String(b.passage);
        if (b.options && b.options.length) per = clamp(Number(b.options.length), 300, 5000);
      }
    } catch (_) { /* ignore */ }

    const sections = makeSections(passage, per);
    return send(res, 200, { study: { sections } });

  } catch (e) {
    const sections = makeSections("Genèse 1", 1500);
    return send(res, 200, { study: { sections }, info:{ emergency:true, err: String(e && e.message || e) } });
  }
};

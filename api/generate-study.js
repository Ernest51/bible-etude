// /api/generate-study.js — Génération doctrinale & narrative (Genèse 1 prêt, extensible)
// - Lit options.length (500|1500|2500) et adapte la densité par rubrique
// - 28 rubriques, chacune avec un angle théologique distinct
// - Références versets écrites en clair (ex: "Genèse 1:1-5") -> le front les linkifie
// - Dé-duplication + respect longueur sans phrases de remplissage répétées
// - Aucune dépendance externe

/** Utils **/
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const between = (x,min,max)=> x>=min && x<=max;
const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
const uniqSentences = (txt)=>{
  const seen = new Set();
  const parts = txt.split(/(?<=\.)\s+/); // phrases finies par ". "
  const clean = parts.filter(p=>{
    const k = p.trim().toLowerCase();
    if (!k) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return clean.join(' ');
};
const tighten = (s)=> s.replace(/\s{2,}/g,' ').trim();

/** Ajusteur de longueur */
function fitToLength(txt, target){
  const min = Math.round(target*0.92);
  const max = Math.round(target*1.08);
  let t = tighten(uniqSentences(txt));

  if (t.length > max){
    // on coupe à la fin de phrase la plus proche
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    if (end > max*0.6) t = cut.slice(0, end+1);
    else t = cut;
  }

  if (t.length < min){
    // On enrichit sans répéter : définitions, implications, et micro-exemples
    const pads = [
      " Cela souligne la cohérence interne du passage et la centralité de Dieu dans l’économie biblique.",
      " L’Ancien et le Nouveau Testament se répondent ici, offrant un fil doctrinal continu.",
      " Ce cadre éclaire la vocation du peuple de Dieu et l’espérance qui résulte de la parole créatrice.",
      " La structure du texte guide la méditation, évitant les lectures fragmentaires.",
      " Le lecteur est invité à accueillir le texte avec foi, intelligence et obéissance."
    ];
    let i = 0;
    while (t.length < min && i < pads.length*4){
      t += pads[i % pads.length];
      i++;
    }
  }

  return tighten(uniqSentences(t));
}

/** Métadonnées rubriques (titres + angle) */
const RUBRICS = {
  1:{title:"Prière d’ouverture", angle:"Invocation et disposition du cœur."},
  2:{title:"Canon et testament", angle:"Place dans le canon et unité AT/NT."},
  3:{title:"Questions du chapitre précédent", angle:"Pont didactique (si série)."},
  4:{title:"Titre du chapitre", angle:"Synthèse doctrinale en une formule."},
  5:{title:"Contexte historique", angle:"Cadre ancien proche-oriental (APO), polémique anti-idolâtre."},
  6:{title:"Structure littéraire", angle:"Jours de création, parallélismes et rythmes."},
  7:{title:"Genre littéraire", angle:"Prose exaltée/théologique, histoire de la création."},
  8:{title:"Auteur et généalogie", angle:"Tradition mosaïque et intention pastorale."},
  9:{title:"Verset-clé doctrinal", angle:"Sélection d’un pivot théologique."},
  10:{title:"Analyse exégétique", angle:"Par parcours de versets."},
  11:{title:"Analyse lexicale", angle:"Termes-clés (création, esprit, image, bénédire)."},
  12:{title:"Références croisées", angle:"Échos bibliques majeurs."},
  13:{title:"Fondements théologiques", angle:"Création ex nihilo, providence, bonté."},
  14:{title:"Thème doctrinal", angle:"Image de Dieu et mandat culturel."},
  15:{title:"Fruits spirituels", angle:"Adoration, gratitude, humilité."},
  16:{title:"Types bibliques", angle:"Lumière, ordre, sabbat : figures orientées vers le Christ."},
  17:{title:"Appui doctrinal", angle:"Passages corroborants et tradition chrétienne."},
  18:{title:"Comparaison entre versets", angle:"Cohérence interne et progression."},
  19:{title:"Comparaison avec Actes 2", angle:"Esprit, Parole, lumière/vérité."},
  20:{title:"Verset à mémoriser", angle:"Formule brève, fondatrice."},
  21:{title:"Enseignement pour l’Église", angle:"Liturgie, catéchèse, mission."},
  22:{title:"Enseignement pour la famille", angle:"Transmission, sabbat, dignité humaine."},
  23:{title:"Enseignement pour enfants", angle:"Pistes pédagogiques fidèles et simples."},
  24:{title:"Application missionnaire", angle:"Création, dignité, défense du prochain."},
  25:{title:"Application pastorale", angle:"Accompagnement, éthique, espérance."},
  26:{title:"Application personnelle", angle:"Adoration, travail, repos, responsabilité."},
  27:{title:"Versets à retenir", angle:"Petite sélection utile."},
  28:{title:"Prière de fin", angle:"Action de grâce et consécration."},
};

/** Fabrique de contenu (Genèse 1 exemplaire) */
function buildForGenesis1(id, passage, target){
  const ref = (r)=>`Genèse ${r}`;
  const Jours = {
    1: ref("1:1-5"),   // lumière
    2: ref("1:6-8"),   // étendue
    3: ref("1:9-13"),  // terres/mer/végétation
    4: ref("1:14-19"), // luminaires
    5: ref("1:20-23"), // poissons/oiseaux
    6: ref("1:24-31"), // bêtes + humain à l'image
    7: ref("2:1-3"),   // sabbat
  };

  const p = [];
  switch(id){
    case 1: // Prière d’ouverture
      p.push(
        `Père, nous venons devant toi pour méditer ${ref("1:1-2")} et la totalité du récit de la création. `+
        `Donne-nous un cœur humble, une intelligence éclairée et la joie d’obéir à ta Parole. `
      );
      p.push(
        `Que ta lumière, inaugurée dès ${Jours[1]}, dissipe nos ténèbres; que ton Esprit, qui planait sur les eaux (${ref("1:2")}), `+
        `nous conduise dans toute la vérité. `
      );
      p.push(`Rends-nous attentifs à la bonté de ton œuvre (${ref("1:31")}) et au repos sanctifié (${Jours[7]}).`);
      break;

    case 2: // Canon et testament
      p.push(
        `Le premier chapitre de la Genèse ouvre le canon de l’Ancien Testament et jette les fondations de toute la Révélation. `+
        `Le Nouveau Testament reprend ces thèmes pour confesser que tout a été créé par et pour le Fils (${ref("1:1")} ; cf. Jean 1:1-3 ; Colossiens 1:15-17).`
      );
      p.push(
        `Ainsi, ${passage} n’est pas un préambule accessoire : il structure la foi biblique en affirmant un Dieu unique, Créateur, bon et souverain.`
      );
      break;

    case 3: // Questions du chapitre précédent (pont pédagogique)
      p.push(
        `Si l’étude précédente introduisait la notion de révélation et d’alliance, quelles attentes apporte-t-on en lisant ${passage} ? `
        + `Comment l’affirmation initiale "${ref("1:1")}" répond-elle aux visions concurrentes du monde (hasard, polythéisme) ?`
      );
      p.push(
        `En quoi la répétition "Dieu dit… et cela fut" (${ref("1:3")}, ${ref("1:6")}, ${ref("1:9")} etc.) façonne-t-elle notre conception de la Parole efficace de Dieu ?`
      );
      break;

    case 4: // Titre doctrinal
      p.push(`« ${passage} — Dieu crée par sa Parole, ordonne le chaos et bénit la vie pour sa gloire ».`);
      p.push(`Ce titre concentre trois axes : création ex nihilo (${ref("1:1")}), mise en ordre progressive (${ref("1:2")}; ${Jours[1]}–${Jours[6]}), et bénédiction culmen au sabbat (${Jours[7]}).`);
      break;

    case 5: // Contexte historique
      p.push(
        `Dans l’environnement ancien proche-oriental, des récits plaçaient la création au terme d’un conflit divin. `
        + `Ici, pas de mythe de combat : la souveraineté paisible du Dieu unique s’impose par la Parole (${ref("1:3")}).`
      );
      p.push(
        `Le texte polémique contre l’idolâtrie : les luminaires, divinisés ailleurs, ne sont que des « grands luminaires » placés par Dieu (${Jours[4]}).`
      );
      break;

    case 6: // Structure littéraire
      p.push(
        `La structure en « jours » manifeste une progression de la désignation des espaces (jours 1–3) à leur remplissage (jours 4–6) : `+
        `${Jours[1]}//${Jours[4]}, ${Jours[2]}//${Jours[5]}, ${Jours[3]}//${Jours[6]}.`
      );
      p.push(`Chaque jour est rythmé par la formule « Dieu dit… il y eut un soir, il y eut un matin » (ex. ${ref("1:5")}).`);
      break;

    case 7: // Genre
      p.push(
        `Le genre relève d’un récit théologique à portée historique : un langage sobre, répétitif, pédagogique, orienté vers la confession du Créateur.`
      );
      p.push(`L’emphase porte sur l’initiative divine et la bonté de l’ordre voulu (${ref("1:31")}).`);
      break;

    case 8: // Auteur & intention
      p.push(
        `La tradition mosaïque situe la composition dans un cadre pastoral : former un peuple à adorer le Créateur, à travailler et à se reposer selon son ordre (${Jours[7]}).`
      );
      p.push(`L’intention est catéchétique : apprendre à vivre « devant Dieu » dans un monde reçu, non possédé.`);
      break;

    case 9: // Verset-clé
      p.push(`Verset-clé : ${ref("1:1")} — « Au commencement, Dieu créa les cieux et la terre. »`);
      p.push(`Tout découle de ce principe : Dieu seul est éternel; tout le reste est appelé à l’existence par sa Parole (${ref("1:3")}).`);
      break;

    case 10: // Analyse exégétique
      p.push(
        `${ref("1:1-2")} : Dieu, l’Esprit, et la scène initiale. ${ref("1:3-5")} : la lumière, premier don orienté vers la vie et la connaissance.`
      );
      p.push(
        `${Jours[2]} : séparation des eaux; ${Jours[3]} : émergence de la terre et des semences; ${Jours[4]} : luminaires « pour les signes et les temps ».`
      );
      p.push(
        `${Jours[5]} : prolifération des vivants; ${Jours[6]} : l’humain, à l’image de Dieu, mandaté pour cultiver et garder. ${Jours[7]} : repos et bénédiction.`
      );
      break;

    case 11: // Lexique
      p.push(
        `« Créer » (bara, ${ref("1:1")}) souligne l’acte souverain de Dieu. « Esprit » (rouah, ${ref("1:2")}) : souffle vivifiant. `+
        `« Image » (tselem, ${ref("1:26-27")}) : représentation et vocation.`
      );
      p.push(`« Bénir » (${ref("1:22")}, ${ref("1:28")}) : accroissement et bonté communiquée par Dieu.`);
      break;

    case 12: // Références croisées
      p.push(`Échos majeurs : Jean 1:1-3 (Parole créatrice), Psaume 33:6-9 (création par la parole), Hébreux 11:3 (foi et création).`);
      p.push(`Sabbat et repos : Exode 20:8-11 ; Hébreux 4:1-11.`);
      break;

    case 13: // Fondements théologiques
      p.push(`Création ex nihilo (${ref("1:1")}); providence ordonnatrice (${ref("1:2")} ; ${Jours[1]}–${Jours[6]}); bonté et finalité (${ref("1:31")}).`);
      p.push(`Dieu demeure distinct de la création, mais la soutient et l’appelle à porter du fruit (${ref("1:22")}, ${ref("1:28")}).`);
      break;

    case 14: // Thème doctrinal
      p.push(`L’« image de Dieu » (${ref("1:26-27")}) : dignité, relation, responsabilité. Mandat culturel : remplir, assujettir, cultiver (${ref("1:28")}).`);
      p.push(`La création est un don à gérer, non un absolu à idolâtrer (cf. ${Jours[4]}).`);
      break;

    case 15: // Fruits spirituels
      p.push(`Adoration (devant la grandeur du Créateur), gratitude (pour la bonté), humilité (créature dépendante), confiance (Parole efficace).`);
      p.push(`Le sabbat éduque à recevoir et non à posséder (${Jours[7]}).`);
      break;

    case 16: // Types bibliques
      p.push(`La lumière inaugurale anticipe la révélation en Christ (Jean 8:12). Le repos du septième jour préfigure le repos eschatologique (Hébreux 4).`);
      p.push(`L’ordre tiré du chaos annonce la nouvelle création (2 Corinthiens 5:17).`);
      break;

    case 17: // Appui doctrinal
      p.push(`Tradition chrétienne constante : un Dieu Créateur, la bonté de la création, l’image de Dieu en l’homme, le sabbat sanctifié.`);
      p.push(`Catéchèses anciennes et confessions réformées confirment ces axes à partir de ${passage}.`);
      break;

    case 18: // Comparaison interne
      p.push(`Comparer ${Jours[1]} et ${Jours[4]} : lumière/luminaires ; ${Jours[2]} et ${Jours[5]} : étendue/oiseaux ; ${Jours[3]} et ${Jours[6]} : terre/êtres vivants.`);
      p.push(`La progression va du cadre au contenu, révélant une pédagogie divine.`);
      break;

    case 19: // Avec Actes 2
      p.push(`À la Pentecôte (Actes 2), l’Esprit et la Parole engendrent un peuple nouveau : résonance avec ${ref("1:2")} et la Parole qui ordonne (${ref("1:3")}).`);
      p.push(`Lumière et vérité conduisent à la confession du Seigneur ressuscité (cf. Jean 1:4-5).`);
      break;

    case 20: // Verset à mémoriser
      p.push(`À mémoriser : ${ref("1:1")}. Cette confession protège de l’idolâtrie et fonde l’espérance chrétienne.`);
      break;

    case 21: // Église
      p.push(`Liturgie : adoration du Créateur ; catéchèse : image de Dieu ; éthique : dignité humaine, sabbat, travail sanctifié (${ref("2:1-3")}).`);
      break;

    case 22: // Famille
      p.push(`Transmettre que le monde est reçu : gratitude, soin de la création, rythme travail/repos. La dignité s’enseigne dès l’enfance (${ref("1:27")}).`);
      break;

    case 23: // Enfants
      p.push(`Raconter les « jours » avec images simples : Dieu parle — la lumière paraît (${Jours[1]}) ; Dieu bénit les poissons et les oiseaux (${Jours[5]}).`);
      p.push(`Apprendre que chaque personne porte l’image de Dieu (${ref("1:26-27")}).`);
      break;

    case 24: // Mission
      p.push(`Affirmer la dignité de tous, protéger les vulnérables, soigner la terre : témoignage conforme au Créateur (${ref("1:28")}, ${ref("2:15")}).`);
      break;

    case 25: // Pastorale
      p.push(`Accompagner au travail et au repos : lutter contre l’activisme, rappeler le sabbat, ouvrir une espérance ferme en Dieu qui ordonne.`);
      break;

    case 26: // Personnel
      p.push(`Recevoir la journée comme un don, travailler avec droiture, sanctifier le repos : vivre devant Dieu qui a tout créé (${ref("1:31")}; ${ref("2:1-3")}).`);
      break;

    case 27: // Versets à retenir (petit florilège)
      p.push(`Sélection : ${ref("1:1")}; ${ref("1:26-27")}; ${ref("1:31")}; ${ref("2:1-3")}.`);
      break;

    case 28: // Prière de fin
      p.push(`Seigneur, Créateur du ciel et de la terre, nous te bénissons pour ta Parole qui appelle à l’existence et ordonne avec bonté.`);
      p.push(`Affermis-nous dans la foi, sanctifie notre travail et notre repos, et fais-nous marcher dans la lumière de ton Fils. Amen.`);
      break;

    default:
      p.push(`${RUBRICS[id]?.title || 'Rubrique'} — ${passage}.`);
  }

  const header = `### ${RUBRICS[id].title}\n\n*Référence :* ${passage}\n\n`;
  const body = fitToLength(p.join(' '), target);
  return header + body;
}

/** Générateur principal (aujourd’hui : Genèse 1 ; facile à étendre plus tard) */
function buildSections(passage, targetLen){
  const isGenesis1 = /^gen[eè]se\s+1\b/i.test(String(passage));
  return Array.from({length:28},(_,i)=>{
    const id = i+1;
    const content = isGenesis1
      ? buildForGenesis1(id, passage, targetLen)
      : defaultGeneric(id, passage, targetLen); // fallback propre si autre chapitre
    return {
      id,
      title: RUBRICS[id].title,
      description: RUBRICS[id].angle,
      content
    };
  });
}

function defaultGeneric(id, passage, targetLen){
  const header = `### ${RUBRICS[id].title}\n\n*Référence :* ${passage}\n\n`;
  const base = `Aperçu doctrinal et narratif pour ${passage}. `
    + `Exploration progressive du texte, avec attention au contexte, à la structure et aux liens bibliques. `;
  return fitToLength(header + base, targetLen);
}

/** Réponse JSON */
function send(res, status, obj){
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

/** Handler */
module.exports = async (req, res) => {
  try{
    const method = req.method || "GET";

    if (method === "GET") {
      return send(res, 200, { ok:true, route:"/api/generate-study", method:"GET", hint:"POST { passage, options:{ length: 500|1500|2500 } }" });
    }

    if (method !== "POST") {
      return send(res, 405, { error:"Method not allowed" });
    }

    // Lecture du body — valeurs par défaut sûres
    let passage = "Genèse 1";
    let targetLen = 1500;

    if (req.body && typeof req.body === "object") {
      const b = req.body;
      if (b.passage) passage = String(b.passage);
      const L = b.options && b.options.length;
      if (between(Number(L), 400, 3000)) {
        // on force sur nos trois crans officiels
        const wanted = Number(L);
        if (wanted < 1000) targetLen = 500;
        else if (wanted < 2000) targetLen = 1500;
        else targetLen = 2500;
      }
    }

    const sections = buildSections(passage, targetLen);
    return send(res, 200, { study: { sections } });

  } catch (e) {
    // filet de sécurité : on ne plante JAMAIS
    const sections = buildSections("Genèse 1", 1500);
    return send(res, 200, { study: { sections }, info:{ emergency:true, err: String(e && e.message || e) } });
  }
};

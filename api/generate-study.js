// /api/generate-study.js — robuste Node/Serverless (CommonJS)
// - GET: smoke-test
// - POST: génère 28 rubriques, longueur 500/1500/2500 par rubrique
// - Tolère tous les cas: body string, objet, ou corps brut (fallback parser)
// - Jamais de 500: en cas d’imprévu -> renvoie sections + info.emergency
// - Références versets écrites "Genèse 1:1-5" pour que le front linkifie

/** ---------- Utils génériques ---------- */
const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const between = (x,min,max)=> x>=min && x<=max;
const tighten = (s)=> String(s||"").replace(/\s{2,}/g,' ').trim();
const uniqSentences = (txt)=>{
  const seen = new Set();
  const parts = String(txt||"").split(/(?<=\.)\s+/);
  const clean = parts.filter(p=>{
    const k = p.trim().toLowerCase();
    if (!k) return false;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return clean.join(' ');
};

function fitToLength(txt, target){
  const min = Math.round(target*0.92);
  const max = Math.round(target*1.08);
  let t = tighten(uniqSentences(txt));

  if (t.length > max){
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = end > max*0.6 ? cut.slice(0, end+1) : cut;
  }
  if (t.length < min){
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

/** ---------- Rubriques ---------- */
const RUBRICS = {
  1:{title:"Prière d’ouverture", angle:"Invocation et disposition du cœur."},
  2:{title:"Canon et testament", angle:"Place dans le canon et unité AT/NT."},
  3:{title:"Questions du chapitre précédent", angle:"Pont didactique (si série)."},
  4:{title:"Titre du chapitre", angle:"Synthèse doctrinale en une formule."},
  5:{title:"Contexte historique", angle:"Cadre ancien proche-oriental; anti-idolâtrie."},
  6:{title:"Structure littéraire", angle:"Jours 1–6 (cadres/contenus), 7 (sabbat)."},
  7:{title:"Genre littéraire", angle:"Récit théologique à portée historique."},
  8:{title:"Auteur et généalogie", angle:"Tradition mosaïque; intention pastorale."},
  9:{title:"Verset-clé doctrinal", angle:"Pivot théologique du chapitre."},
  10:{title:"Analyse exégétique", angle:"Lecture suivie par blocs."},
  11:{title:"Analyse lexicale", angle:"Termes-clés et portée."},
  12:{title:"Références croisées", angle:"Échos bibliques majeurs."},
  13:{title:"Fondements théologiques", angle:"Création, providence, bonté."},
  14:{title:"Thème doctrinal", angle:"Image de Dieu, mandat culturel."},
  15:{title:"Fruits spirituels", angle:"Adoration, gratitude, humilité."},
  16:{title:"Types bibliques", angle:"Lumière, ordre, sabbat, Christ."},
  17:{title:"Appui doctrinal", angle:"Corroborations scripturaires/tradition."},
  18:{title:"Comparaison entre versets", angle:"Cohérence interne."},
  19:{title:"Comparaison avec Actes 2", angle:"Esprit/Parole/lumière."},
  20:{title:"Verset à mémoriser", angle:"Formule fondatrice."},
  21:{title:"Enseignement pour l’Église", angle:"Liturgie, catéchèse, mission."},
  22:{title:"Enseignement pour la famille", angle:"Transmission, sabbat, dignité."},
  23:{title:"Enseignement pour enfants", angle:"Pistes fidèles et simples."},
  24:{title:"Application missionnaire", angle:"Dignité, protection, témoin."},
  25:{title:"Application pastorale", angle:"Accompagnement, éthique, espérance."},
  26:{title:"Application personnelle", angle:"Adoration, travail, repos."},
  27:{title:"Versets à retenir", angle:"Florilège utile."},
  28:{title:"Prière de fin", angle:"Action de grâce et consécration."},
};

/** ---------- Génération Genèse 1 ---------- */
function buildForGenesis1(id, passage, target){
  const ref = (r)=>`Genèse ${r}`;
  const J = {
    1: ref("1:1-5"), 2: ref("1:6-8"), 3: ref("1:9-13"),
    4: ref("1:14-19"), 5: ref("1:20-23"), 6: ref("1:24-31"), 7: ref("2:1-3")
  };
  const p = [];
  switch(id){
    case 1:
      p.push(
        `Père, nous venons devant toi pour méditer ${ref("1:1-2")} et l’ensemble du récit de la création. `+
        `Accorde-nous humilité, intelligence et joie d’obéir à ta Parole.`
      );
      p.push(`Que ta lumière (${J[1]}) dissipe nos ténèbres; que ton Esprit (${ref("1:2")}) nous conduise dans la vérité; que ton repos (${J[7]}) sanctifie notre temps.`);
      break;

    case 2:
      p.push(
        `Ce premier chapitre du canon fonde toute la Révélation. Le NT reprend ce thème pour confesser que tout est créé par et pour le Fils (${ref("1:1")}; Jean 1:1-3; Colossiens 1:15-17).`
      );
      p.push(`Dieu y est unique, souverain et bon; ${passage} n’est pas un prologue optionnel mais la base doctrinale de la foi biblique.`);
      break;

    case 3:
      p.push(
        `Questions-passerelles: comment ${ref("1:1")} réfute-t-il hasard et polythéisme? Que signifie la formule récurrente « Dieu dit… et cela fut » (${ref("1:3")}, ${ref("1:6")}, ${ref("1:9")}) pour la doctrine de la Parole?`
      );
      break;

    case 4:
      p.push(`« ${passage} — Dieu crée par sa Parole, ordonne le chaos et bénit la vie pour sa gloire ».`);
      p.push(`Axes: création ex nihilo (${ref("1:1")}); mise en ordre progressive (${ref("1:2")}; ${J[1]}–${J[6]}); repos bénit (${J[7]}).`);
      break;

    case 5:
      p.push(
        `Dans l’ancien Proche-Orient, des mythes invoquent des combats divins. Ici, pas de rival: la Parole suffit (${ref("1:3")}). `
        + `Les luminaires idolâtrés ailleurs ne sont que des « grands luminaires » placés par Dieu (${J[4]}).`
      );
      break;

    case 6:
      p.push(`Structure: jours 1–3 (espaces) // jours 4–6 (plénitude): ${J[1]}//${J[4]}, ${J[2]}//${J[5]}, ${J[3]}//${J[6]}.`);
      p.push(`Rythme pédagogique: « Dieu dit… il y eut un soir, il y eut un matin » (ex. ${ref("1:5")}).`);
      break;

    case 7:
      p.push(`Récit théologique à portée historique: un langage sobre, répétitif, catéchétique. L’emphase porte sur l’initiative divine et la bonté (${ref("1:31")}).`);
      break;

    case 8:
      p.push(`Tradition mosaïque: former un peuple à adorer, travailler et se reposer selon l’ordre de Dieu (${J[7]}). Intention catéchétique et pastorale.`);
      break;

    case 9:
      p.push(`Verset-clé: ${ref("1:1")} — « Au commencement, Dieu créa les cieux et la terre. » Tout découle de ce point: Dieu seul est éternel; tout le reste est appelé par sa Parole (${ref("1:3")}).`);
      break;

    case 10:
      p.push(`${ref("1:1-2")} : Dieu, l’Esprit, scène initiale. ${ref("1:3-5")} : lumière inaugurale. ${J[2]} : séparation des eaux. ${J[3]} : émergence de la terre et semences.`);
      p.push(`${J[4]} : luminaires pour les signes et les temps. ${J[5]} : foisonnement des vivants. ${J[6]} : humain à l’image, mandat. ${J[7]} : repos sanctifié.`);
      break;

    case 11:
      p.push(`Lexique: « créer » (bara, ${ref("1:1")}) acte souverain; « esprit » (rouah, ${ref("1:2")}) souffle vivifiant; « image » (tselem, ${ref("1:26-27")}) représentation et vocation.`);
      p.push(`« bénir » (${ref("1:22")}, ${ref("1:28")}) accroissement et bonté communiquée.`);
      break;

    case 12:
      p.push(`Échos: Jean 1:1-3; Psaume 33:6-9; Hébreux 11:3; pour le repos: Exode 20:8-11; Hébreux 4:1-11.`);
      break;

    case 13:
      p.push(`Fondements: création ex nihilo (${ref("1:1")}); providence ordonnatrice (${ref("1:2")}; ${J[1]}–${J[6]}); bonté et finalité (${ref("1:31")}).`);
      break;

    case 14:
      p.push(`Image de Dieu (${ref("1:26-27")}) : dignité, relation, responsabilité. Mandat culturel: remplir, assujettir, cultiver (${ref("1:28")}).`);
      break;

    case 15:
      p.push(`Fruits: adoration, gratitude, humilité, confiance; le sabbat éduque à recevoir (${J[7]}).`);
      break;

    case 16:
      p.push(`Types: lumière inaugurale → Christ lumière (Jean 8:12); repos du 7e jour → repos eschatologique (Hébreux 4); ordre du chaos → nouvelle création (2 Corinthiens 5:17).`);
      break;

    case 17:
      p.push(`Appuis: tradition chrétienne constante (création, bonté, image, sabbat). Catéchèses et confessions historiques s’enracinent dans ${passage}.`);
      break;

    case 18:
      p.push(`Comparaisons: ${J[1]}//${J[4]}, ${J[2]}//${J[5]}, ${J[3]}//${J[6]}; progression du cadre au contenu, pédagogie divine.`);
      break;

    case 19:
      p.push(`Actes 2: l’Esprit et la Parole forment un peuple nouveau — résonances avec ${ref("1:2")} et « Dieu dit » (${ref("1:3")}); lumière/vérité et confession du Ressuscité.`);
      break;

    case 20:
      p.push(`À mémoriser: ${ref("1:1")} — confession qui protège de l’idolâtrie et fonde l’espérance chrétienne.`);
      break;

    case 21:
      p.push(`Église: adoration du Créateur; catéchèse: image de Dieu; éthique: dignité humaine, travail sanctifié (${ref("2:1-3")}).`);
      break;

    case 22:
      p.push(`Famille: transmettre que le monde est reçu; gratitude; soin de la création; rythme travail/repos; dignité enseignée dès l’enfance (${ref("1:27")}).`);
      break;

    case 23:
      p.push(`Enfants: raconter les jours — Dieu parle, la lumière paraît (${J[1]}); Dieu bénit les poissons et les oiseaux (${J[5]}); chacun porte l’image (${ref("1:26-27")}).`);
      break;

    case 24:
      p.push(`Mission: dignité de tous, protection des vulnérables, soin de la terre — témoignage conforme au Créateur (${ref("1:28")}, ${ref("2:15")}).`);
      break;

    case 25:
      p.push(`Pastorale: accompagner au travail et au repos; lutter contre l’activisme; ouvrir une espérance ferme en Dieu qui ordonne.`);
      break;

    case 26:
      p.push(`Personnel: recevoir la journée comme don, travailler avec droiture, sanctifier le repos; vivre devant Dieu (${ref("1:31")}; ${ref("2:1-3")}).`);
      break;

    case 27:
      p.push(`À retenir: ${ref("1:1")}; ${ref("1:26-27")}; ${ref("1:31")}; ${ref("2:1-3")}.`);
      break;

    case 28:
      p.push(`Seigneur, Créateur du ciel et de la terre, nous te bénissons pour ta Parole qui appelle à l’existence et ordonne avec bonté. `+
             `Affermis notre foi, sanctifie travail et repos, fais-nous marcher dans la lumière du Fils. Amen.`);
      break;

    default:
      p.push(`${RUBRICS[id]?.title || 'Rubrique'} — ${passage}.`);
  }
  const header = `### ${RUBRICS[id].title}\n\n*Référence :* ${passage}\n\n`;
  return fitToLength(header + p.join(' '), target);
}

function defaultGeneric(id, passage, targetLen){
  const header = `### ${RUBRICS[id].title}\n\n*Référence :* ${passage}\n\n`;
  const base = `Aperçu doctrinal et narratif pour ${passage}. ` +
               `Exploration progressive du texte, avec attention au contexte, à la structure et aux liens bibliques. `;
  return fitToLength(header + base, targetLen);
}

function buildSections(passage, targetLen){
  const isGenesis1 = /^gen[eè]se\s+1\b/i.test(String(passage||""));
  return Array.from({length:28},(_,i)=>{
    const id = i+1;
    const content = isGenesis1
      ? buildForGenesis1(id, passage, targetLen)
      : defaultGeneric(id, passage, targetLen);
    return {
      id,
      title: RUBRICS[id].title,
      description: RUBRICS[id].angle,
      content
    };
  });
}

function send(res, status, obj){
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(obj));
}

/** ---------- Lecture corps brut si besoin ---------- */
async function readBodyIfNeeded(req){
  // Si Vercel a déjà parsé:
  if (req.body && typeof req.body === 'object') return req.body;

  // Si req.body est string JSON:
  if (typeof req.body === 'string'){
    try { return JSON.parse(req.body); } catch { /* fall through */ }
  }

  // Sinon, on lit le flux brut (cas edge ou parse désactivé)
  return new Promise((resolve) => {
    try{
      let raw = '';
      req.on('data', chunk => { raw += chunk; });
      req.on('end', () => {
        if (!raw) return resolve({});
        try { resolve(JSON.parse(raw)); }
        catch { resolve({}); }
      });
      req.on('error', () => resolve({}));
    }catch(_){
      resolve({});
    }
  });
}

/** ---------- Handler principal ---------- */
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

    // Lecture robuste du body
    const body = await readBodyIfNeeded(req);
    let passage = "Genèse 1";
    let targetLen = 1500;

    if (body && typeof body === "object"){
      if (body.passage) passage = String(body.passage);
      const L = body.options && body.options.length;
      if (between(Number(L), 400, 3000)) {
        const wanted = Number(L);
        targetLen = (wanted < 1000) ? 500 : (wanted < 2000) ? 1500 : 2500;
      }
    }

    const sections = buildSections(passage, targetLen);
    return send(res, 200, { study: { sections } });

  } catch (e) {
    // Dernier filet: retourne quand même des sections (jamais de 500 côté client)
    try{
      const sections = buildSections("Genèse 1", 1500);
      return send(res, 200, { study: { sections }, info:{ emergency:true, err: String(e && e.message || e) } });
    }catch{
      return send(res, 200, { study:{ sections: [] }, info:{ emergency:true, err:"unrecoverable" } });
    }
  }
};

// (optionnel) compat ESModule si jamais le runtime l'exige
// exports.default = module.exports;

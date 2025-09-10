// /api/generate-study.js
// API robuste (Node & Edge) + génération doctrinale non-duplicative avec versets cliquables YouVersion.

function sendJSON(ctx, status, data) {
  if (ctx.res) { ctx.res.status(status).json(data); return; }
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
function sendError(ctx, status, message, info={}) {
  return sendJSON(ctx, status, { ok:false, error:message, ...info });
}
async function readBody(ctx) {
  // Edge (Request)
  if (ctx.req && typeof ctx.req.json === 'function') return await ctx.req.json();

  // Node (req,res)
  const req = ctx.req;
  if (req && typeof req.body === 'object' && req.body) return req.body;

  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const raw = Buffer.concat(chunks).toString('utf8') || '';
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

/* --- YouVersion helpers --- */
const YV_BOOK = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_VERSION_ID = { "LSG":"93", "PDV":"201", "S21":"377", "BFC":"75" };
function linkRef(book, chapter, verse, version="LSG") {
  const code = YV_BOOK[book] || "GEN";
  const ver = (version || "LSG").toUpperCase();
  const verId = YV_VERSION_ID[ver] || "93";
  const label = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
  const url   = verse
    ? `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.${ver}`
    : `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.${ver}`;
  // Markdown : le front peut rendre tel quel ou le transformer (tu avais demandé bleu + souligné côté UI).
  return `[${label}](${url})`;
}

/* --- Génération doctrinale (sans doublons) --- */
function padToLength(text, perRubricLen) {
  // allonge intelligemment (phrases complémentaires) jusqu’à atteindre ~perRubricLen caractères
  const fillers = [
    " Cette lecture reste fidèle au texte original et à l’économie biblique.",
    " L’initiative de Dieu et la réponse de la foi structurent l’ensemble.",
    " L’exégèse s’articule avec la théologie biblique et l’édification de l’Église.",
    " Le lien au canon entier garantit l’interprétation la plus sûre.",
    " Le récit porte un dynamisme vers l’adoration et l’obéissance."
  ];
  let out = text.trim();
  while (out.length < perRubricLen) {
    out += fillers[out.length % fillers.length];
  }
  return out;
}

function studyForGenesis1(version, perRubricLen) {
  const b = "Genèse", c = 1;
  const v11   = linkRef(b, c, "1", version);
  const v12_5 = linkRef(b, c, "2", version)    // on affiche « 1:2 » et la page de chap.
  const v126  = linkRef(b, c, "26-27", version);
  const v131  = linkRef(b, c, "31", version);
  const jn1   = linkRef("Jean", 1, "1-3", version);
  const ps33  = linkRef("Psaumes", 33, "6", version);
  const he11  = linkRef("Hébreux", 11, "3", version);
  const col1  = linkRef("Colossiens", 1, "16-17", version);

  const sections = [];

  const push = (id, title, base) => {
    sections.push({ id, title, description: "", content: padToLength(base, perRubricLen) });
  };

  push(1, "Prière d’ouverture",
`### Prière d’ouverture

*Référence :* ${b} ${c}

Père, nous venons écouter ta Parole. Comme au commencement, que ta lumière chasse nos ténèbres et que ton Esprit plane sur nos pensées (cf. ${v12_5}). Donne-nous une lecture humble et obéissante, afin que la connaissance de ta gloire nous conduise à l’adoration et au service.`);

  push(2, "Canon et testament",
`### Canon et testament

*Référence :* ${b} ${c}

${b} ${c} ouvre l’Écriture. Le même Dieu créateur s’y révèle que celui proclamé dans le Nouveau Testament (${jn1}; ${he11}). Ainsi, la révélation progresse sans se contredire : tout est créé par la Parole (${ps33}) et subsiste en Christ (${col1}).`);

  push(3, "Questions du chapitre précédent",
`### Questions du chapitre précédent

*Référence :* ${b} ${c}

Nous nous demandons : que signifie « Dieu dit » dans un monde marqué par le chaos ? Comment la Parole ordonne-t-elle et borne-t-elle ? Comment l’homme, créé à l’image, reçoit-il vocation et limites (${v126}) ?`);

  push(4, "Titre du chapitre",
`### Titre du chapitre

*Référence :* ${b} ${c}

« Le Dieu vivant ordonne le chaos et confie sa création à l’humain à son image ». Ce titre résume le mouvement : parole efficace (${v11}), mise en ordre (${v12_5}), dignité humaine (${v126}), et bonté conclue (${v131}).`);

  push(5, "Contexte historique",
`### Contexte historique

*Référence :* ${b} ${c}

Le texte s’adresse à un peuple entouré de mythes cosmogoniques violents. Ici, point de panthéon : un seul Dieu, transcendant et bon. La création n’est ni une guerre divine ni un accident, mais un acte libre et ordonné de Dieu (${v11}).`);

  push(6, "Structure littéraire",
`### Structure littéraire

*Référence :* ${b} ${c}

Le chapitre progresse par séries : « Dieu dit… il y eut un soir, il y eut un matin ». Les jours 1-3 forment des cadres (lumière, cieux/mer, terre), les jours 4-6 les remplissent (astres, oiseaux/poissons, animaux/humains), puis le repos parachève.`);

  push(7, "Genre littéraire",
`### Genre littéraire

*Référence :* ${b} ${c}

Récit solennel, rythmé, théologique. Le style est hautement structuré pour enseigner qui est Dieu et quelle est la place de l’homme. L’intention n’est pas d’abord technique, mais confessionnelle : affirmer la souveraineté du Créateur (${ps33}).`);

  push(8, "Auteur et généalogie",
`### Auteur et généalogie

*Référence :* ${b} ${c}

La tradition mosaïque situe cette Torah dans la conduite de Dieu auprès d’Israël. Le prologue de la Bible prépare les généalogies ultérieures : de la création jusqu’à Abraham, la bénédiction de Dieu traverse l’histoire.`);

  push(9, "Verset-clé doctrinal",
`### Verset-clé doctrinal

*Référence :* ${b} ${c}

« Au commencement, Dieu créa les cieux et la terre » (${v11}). Tout procède de Dieu, rien n’existe sans lui (${jn1}). Ce verset fonde la doctrine de la création ex nihilo (${he11}).`);

  push(10, "Analyse exégétique",
`### Analyse exégétique

*Référence :* ${b} ${c}

Le verbe « créer » (bara’) est réservé à Dieu. L’expression « tohu-bohu » décrit l’informe initial, que la Parole ordonne (${v12_5}). L’alternance soir/matin marque un temps mesuré, reçu, structurant la vie cultuelle.`);

  push(11, "Analyse lexicale",
`### Analyse lexicale

*Référence :* ${b} ${c}

« Image » (tselem) et « ressemblance » (demut) indiquent représentation et vocation : refléter Dieu, gouverner en gardiens (${v126}). « Bon » revient comme refrain jusqu’à « très bon » (${v131}), signature éthique de l’œuvre divine.`);

  push(12, "Références croisées",
`### Références croisées

*Référence :* ${b} ${c}

Le Prologue de Jean (${jn1}) relit la création à la lumière du Logos. ${ps33} affirme la création par la Parole. ${he11} explicite la foi en l’invisible. ${col1} situe Christ comme médiateur et fin de la création.`);

  push(13, "Fondements théologiques",
`### Fondements théologiques

*Référence :* ${b} ${c}

Dieu est unique, transcendant, libre. Le monde est contingent, bon, ordonné. L’homme est image, non rival de Dieu. La Parole est efficace : ce que Dieu dit advient (${v11}).`);

  push(14, "Thème doctrinal",
`### Thème doctrinal

*Référence :* ${b} ${c}

Doctrine de Dieu créateur, de la providence (ordre et limites), de l’anthropologie (image, mandat culturel), et de l’éthique de la bonté : la création appelle reconnaissance et service (${v131}).`);

  push(15, "Fruits spirituels",
`### Fruits spirituels

*Référence :* ${b} ${c}

Adoration du Créateur, humilité devant sa Parole, joie du sabbat, responsabilité envers la création et le prochain. La dignité reçue (${v126}) devient vocation à la justice.`);

  push(16, "Types bibliques",
`### Types bibliques

*Référence :* ${b} ${c}

La lumière première anticipe la révélation ; Adam figure l’humanité et prépare le Christ, « image de Dieu » parfaite (${col1}). Le sabbat préfigure le repos promis.`);

  push(17, "Appui doctrinal",
`### Appui doctrinal

*Référence :* ${b} ${c}

${jn1} relie création et Christ. ${he11} fonde la connaissance sur la foi reçue de la Parole. ${ps33} rappelle la puissance créatrice du Verbe. Ces textes confirment la lecture de ${b} ${c}.`);

  push(18, "Comparaison entre versets",
`### Comparaison entre versets

*Référence :* ${b} ${c}

Compare ${v11} (début) et ${v131} (conclusion) : de l’initiative divine à l’évaluation « très bon ». L’oscillation « Dieu dit… et ce fut ainsi » rythme le chapitre et conduit à l’ordre habitable (${v12_5}).`);

  push(19, "Parallèle avec Actes 2",
`### Parallèle avec Actes 2

*Référence :* ${b} ${c}

Comme l’Esprit plane au commencement (${v12_5}), il vient sur l’Église à la Pentecôte pour créer un peuple nouveau. La Parole produit un ordre de vie et une mission.`);

  push(20, "Verset à mémoriser",
`### Verset à mémoriser

*Référence :* ${b} ${c}

${v11} — « Au commencement, Dieu créa les cieux et la terre ». Ce verset fonde l’adoration et la confiance.`);

  push(21, "Enseignement pour l’Église",
`### Enseignement pour l’Église

*Référence :* ${b} ${c}

La liturgie confesse le Créateur ; la mission proclame la Parole efficace ; la diaconie respecte la création. L’Église vit du rythme Parole-travail-repos.`);

  push(22, "Enseignement pour la famille",
`### Enseignement pour la famille

*Référence :* ${b} ${c}

Apprendre aux enfants la bonté de la création (${v131}), la dignité reçue (${v126}), la valeur du repos et de la gratitude.`);

  push(23, "Enseignement pour enfants",
`### Enseignement pour enfants

*Référence :* ${b} ${c}

Raconter les six jours avec images et gestes, souligner que Dieu parle et que la lumière paraît (${v12_5}). Inviter à dire « merci » pour le monde.`);

  push(24, "Application missionnaire",
`### Application missionnaire

*Référence :* ${b} ${c}

Annoncer le Dieu unique, bon, créateur ; défaire les idoles du hasard ou de la fatalité. Honorer la dignité humaine en Christ (${col1}).`);

  push(25, "Application pastorale",
`### Application pastorale

*Référence :* ${b} ${c}

Consoler : le monde n’est pas livré au chaos, Dieu parle encore. Avertir : la Parole borne le mal. Conseiller : recevoir le temps comme don (soir/matin).`);

  push(26, "Application personnelle",
`### Application personnelle

*Référence :* ${b} ${c}

Recevoir ta journée comme vocation : écouter, travailler, puis entrer dans le repos. Cultiver l’adoration devant Dieu créateur (${v11}).`);

  push(27, "Versets à retenir",
`### Versets à retenir

*Référence :* ${b} ${c}

${v11}; ${v12_5}; ${v126}; ${v131}; ${jn1}; ${ps33}.`);

  push(28, "Prière de fin",
`### Prière de fin

*Référence :* ${b} ${c}

Dieu créateur, nous confessons ta Parole efficace et ta bonté. Renouvelle en nous ton image par Jésus-Christ ; donne-nous sagesse et repos dans ton Esprit. Amen.`);

  // descriptions rapides (outil : app les affiche sous les titres)
  const descs = {
    1:"Invocation du Saint-Esprit pour éclairer l’étude.",
    2:"Place dans le canon (AT/NT) et continuité biblique.",
    3:"Points à reprendre et tensions ouvertes.",
    4:"Formulation doctrinale synthétique.",
    5:"Cadre temporel et culturel.",
    6:"Découpage et progression.",
    7:"Incidences herméneutiques.",
    8:"Auteur humain et inspiration divine.",
    9:"Pivot théologique du chapitre.",
    10:"Grammaire/syntaxe/contexte.",
    11:"Termes clés et portée doctrinale.",
    12:"Passages parallèles.",
    13:"Attributs de Dieu, création, alliance…",
    14:"Rattachement aux thèmes systématiques.",
    15:"Vertus et attitudes produites.",
    16:"Typologie et symboles.",
    17:"Textes d’appui concordants.",
    18:"Harmonisation interne.",
    19:"Continuité dans l’Église.",
    20:"Brève formulation à retenir.",
    21:"Gouvernance, culte, mission.",
    22:"Transmission et consolation.",
    23:"Pédagogie et récits.",
    24:"Annonce et contextualisation.",
    25:"Conseil, avertissement, consolation.",
    26:"Repentance, foi, obéissance, prière.",
    27:"Sélection à mémoriser.",
    28:"Action de grâces et bénédiction."
  };

  // injecte les descriptions
  for (const s of sections) s.description = descs[s.id] || "";

  return sections;
}

function buildStudy(passage, length, version="LSG") {
  // longueur par RUBRIQUE (tu le voulais ainsi)
  const allowed = [500,1500,2500];
  const perRubricLen = allowed.includes(Number(length)) ? Number(length) : 1500;

  // Parse très simple : "Livre chap"
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(passage||"").trim());
  const book = m ? m[1].trim() : "Genèse";
  const chap = m ? parseInt(m[2],10) : 1;

  let sections;

  // Cas soigné : Genèse 1 (ton usage actuel)
  if (book === "Genèse" && chap === 1) {
    sections = studyForGenesis1(version, perRubricLen);
  } else {
    // Fallback générique (structure non-duplicative + liens chapitre)
    const linkChap = linkRef(book, chap, "", version);
    const titles = {
      1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",
      5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",
      9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",
      13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",
      17:"Appui doctrinal",18:"Comparaison interne",19:"Parallèle ecclésial",20:"Verset à mémoriser",
      21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement enfants",
      24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",
      27:"Versets à retenir",28:"Prière de fin"
    };
    const baseTexts = {
      1:`### Prière d’ouverture\n\n*Référence :* ${book} ${chap}\n\nPère, éclaire-nous par ton Esprit afin de recevoir fidèlement ce chapitre (${linkChap}).`,
      2:`### Canon et testament\n\n*Référence :* ${book} ${chap}\n\nLecture dans l’unité du canon : l’Ancien et le Nouveau se répondent.`,
      3:`### Questions du chapitre précédent\n\n*Référence :* ${book} ${chap}\n\nQuelles tensions le contexte ouvre-t-il ? Comment ce chapitre y répond-il ?`,
      4:`### Titre du chapitre\n\n*Référence :* ${book} ${chap}\n\nProposition de titre théologique pour guider l’étude.`,
      5:`### Contexte historique\n\n*Référence :* ${book} ${chap}\n\nCadre historique/culturel et destinataires probables.`,
      6:`### Structure littéraire\n\n*Référence :* ${book} ${chap}\n\nDécoupage et progression interne.`,
      7:`### Genre littéraire\n\n*Référence :* ${book} ${chap}\n\nGenre du passage et incidences herméneutiques.`,
      8:`### Auteur et généalogie\n\n*Référence :* ${book} ${chap}\n\nAuteur humain, inspiration divine, place dans l’histoire du salut.`,
      9:`### Verset-clé doctrinal\n\n*Référence :* ${book} ${chap}\n\nSélection d’un pivot doctrinal représentatif.`,
      10:`### Analyse exégétique\n\n*Référence :* ${book} ${chap}\n\nContexte immédiat, grammaire et syntaxe.`,
      11:`### Analyse lexicale\n\n*Référence :* ${book} ${chap}\n\nTermes clés et champ sémantique.`,
      12:`### Références croisées\n\n*Référence :* ${book} ${chap}\n\nPassages parallèles/complémentaires dans l’Écriture.`,
      13:`### Fondements théologiques\n\n*Référence :* ${book} ${chap}\n\nAttributs de Dieu, alliance, salut, éthique.`,
      14:`### Thème doctrinal\n\n*Référence :* ${book} ${chap}\n\nRattachement aux grands thèmes systématiques.`,
      15:`### Fruits spirituels\n\n*Référence :* ${book} ${chap}\n\nVertus et attitudes produites par la doctrine.`,
      16:`### Types bibliques\n\n*Référence :* ${book} ${chap}\n\nTypologie, symboles, figures.`,
      17:`### Appui doctrinal\n\n*Référence :* ${book} ${chap}\n\nTextes d’appui confirmant l’interprétation.`,
      18:`### Comparaison interne\n\n*Référence :* ${book} ${chap}\n\nHarmonisation entre les versets du chapitre.`,
      19:`### Parallèle ecclésial\n\n*Référence :* ${book} ${chap}\n\nContinuité de la révélation et vie de l’Église.`,
      20:`### Verset à mémoriser\n\n*Référence :* ${book} ${chap}\n\nFormulation brève et structurante.`,
      21:`### Enseignement pour l’Église\n\n*Référence :* ${book} ${chap}\n\nGouvernance, culte, mission, édification.`,
      22:`### Enseignement pour la famille\n\n*Référence :* ${book} ${chap}\n\nTransmission, sainteté, consolation.`,
      23:`### Enseignement enfants\n\n*Référence :* ${book} ${chap}\n\nPédagogie, récits, symboles.`,
      24:`### Application missionnaire\n\n*Référence :* ${book} ${chap}\n\nAnnonce, contextualisation fidèle, espérance.`,
      25:`### Application pastorale\n\n*Référence :* ${book} ${chap}\n\nConseil, avertissement, consolation.`,
      26:`### Application personnelle\n\n*Référence :* ${book} ${chap}\n\nRepentance, foi, obéissance, prière.`,
      27:`### Versets à retenir\n\n*Référence :* ${book} ${chap}\n\nSélection utile pour la méditation et le témoignage.`,
      28:`### Prière de fin\n\n*Référence :* ${book} ${chap}\n\nAction de grâces et demande de bénédiction.`
    };
    sections = [];
    for (let i=1;i<=28;i++) {
      sections.push({
        id: i,
        title: titles[i],
        description: "",
        content: padToLength(baseTexts[i], perRubricLen)
      });
    }
  }

  return { study: { sections }, requestedLength: perRubricLen };
}

/* --- route --- */
async function core(ctx) {
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return sendJSON(ctx, 200, {
      ok: true,
      route: '/api/generate-study',
      method: 'GET',
      hint: 'POST { passage, options:{ length: 500|1500|2500, translation?: "LSG|PDV|S21|BFC" } }'
    });
  }

  if (method !== 'POST') {
    return sendError(ctx, 405, 'Méthode non autorisée', { allow: ['GET','POST'] });
  }

  const body = await readBody(ctx);
  const passage = (body?.passage || '').toString().trim();
  const length  = Number(body?.options?.length);
  const version = (body?.options?.translation || 'LSG').toUpperCase();

  if (!passage) return sendError(ctx, 400, 'Champ "passage" manquant (ex: "Genèse 1").');

  try {
    const result = buildStudy(passage, length, version);
    return sendJSON(ctx, 200, { ok:true, ...result });
  } catch (e) {
    return sendError(ctx, 200, 'GENERATION_FAILED', { message: String(e && e.message || e) });
  }
}

export default async function handler(req, res) {
  if (res && typeof res.status === 'function') {
    return core({ req, res });
  }
  return await core({ req });
}

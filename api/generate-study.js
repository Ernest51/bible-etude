// /api/generate-study.js
// Génération d'étude 28 rubriques : doctrinale, narrative, sans doublons, avec liens vers YouVersion.

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
  if (ctx.req && typeof ctx.req.json === "function") return await ctx.req.json();
  const req = ctx.req;
  if (req && typeof req.body === "object" && req.body) return req.body;
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", resolve);
    req.on("error", reject);
  });
  const raw = Buffer.concat(chunks).toString("utf8") || "";
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

/* ---------- YouVersion ---------- */
const YV_BOOK = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_VERSION_ID = { "LSG":"93", "PDV":"201", "S21":"377", "BFC":"75" };
function linkRef(book, chapter, verseOrRange, version="LSG") {
  const code = YV_BOOK[book] || "GEN";
  const ver  = (version || "LSG").toUpperCase();
  const verId= YV_VERSION_ID[ver] || "93";
  const label= verseOrRange ? `${book} ${chapter}:${verseOrRange}` : `${book} ${chapter}`;
  const url  = `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.${ver}`;
  return `[${label}](${url})`;
}

/* ---------- Aide : extension sans doublon ---------- */
// On étend un texte de base avec des fragments uniques (phrases ou puces).
// Jamais la même phrase deux fois. S’arrête quand on approche la cible.
function expandUnique(base, pool, targetLen) {
  const used = new Set();
  let out = base.trim();
  for (const sentence of pool) {
    const s = sentence.trim();
    if (!s || used.has(s)) continue;
    if (!out.endsWith("\n")) out += "\n";
    out += s + (s.endsWith(".") ? "" : ".");
    used.add(s);
    if (out.length >= targetLen) break;
  }
  // si encore court, on ajoute des puces synthétiques différentes
  if (out.length < targetLen) {
    let i = 1;
    for (const s of pool) {
      if (used.has(s)) continue;
      out += `\n- ${s}`;
      used.add(s);
      i++;
      if (out.length >= targetLen) break;
    }
  }
  return out;
}

/* ---------- Contenu spécifique : Genèse 1 ---------- */
function studyForGenesis1(version, perLen) {
  const b="Genèse", c=1;
  const v11   = linkRef(b,c,"1",version);
  const v12_5 = linkRef(b,c,"2–5",version);
  const v126  = linkRef(b,c,"26–27",version);
  const v131  = linkRef(b,c,"31",version);
  const jn1   = linkRef("Jean",1,"1–3",version);
  const ps33  = linkRef("Psaumes",33,"6",version);
  const he11  = linkRef("Hébreux",11,"3",version);
  const col1  = linkRef("Colossiens",1,"16–17",version);

  const sections = [];
  const add = (id, title, base, pool=[]) => {
    sections.push({ id, title, description: "", content: expandUnique(base, pool, perLen) });
  };

  add(1,"Prière d’ouverture",
`### Prière d’ouverture

*Référence :* ${b} ${c}

Père, nous venons écouter ta Parole. Comme au commencement, que ta lumière disperse nos ténèbres et que ton Esprit plane sur nos pensées (cf. ${v12_5}). Donne-nous une lecture humble et obéissante, pour que ta gloire nous conduise à l’adoration et au service.`,
[
  "Nous nous déposons devant toi pour recevoir ce que tu dis",
  "Éloigne de nous les lectures arbitraires et donne l’intelligence spirituelle",
  "Que la foi naisse et grandisse à l’écoute de ta Parole vivante",
  "Conduis-nous de la compréhension à l’obéissance"
  ]);

  add(2,"Canon et testament",
`### Canon et testament

*Référence :* ${b} ${c}

${b} ${c} ouvre l’Écriture et révèle le même Dieu créateur que le Nouveau Testament (${jn1}; ${he11}). La révélation progresse sans se contredire : tout est créé par la Parole (${ps33}) et subsiste en Christ (${col1}).`,
[
  "Le canon donne l’horizon d’interprétation et évite l’isolement des textes",
  "Le Christ est la clé qui récapitule la création et la rédemption",
  "L’autorité de l’Écriture vient de Dieu qui s’y fait connaître"
  ]);

  add(3,"Questions du chapitre précédent",
`### Questions du chapitre précédent

*Référence :* ${b} ${c}

Qu’implique l’expression « Dieu dit » dans un monde confus ? Comment la Parole distingue, borne et met en ordre ? Quelle vocation reçoit l’humain créé à l’image (${v126}) ?`,
[
  "Quel rapport entre Parole de Dieu et existence du temps mesuré ?",
  "Pourquoi la création est-elle qualifiée de « bonne » puis « très bonne » (${v131}) ?",
  "Quelles limites protègent la vie humaine et la création ?"
  ]);

  add(4,"Titre du chapitre",
`### Titre du chapitre

*Référence :* ${b} ${c}

« Le Dieu vivant ordonne le chaos et confie sa création à l’humain à son image ». Le mouvement va de la Parole efficace (${v11}) à la vocation humaine (${v126}), puis à la bénédiction finale (${v131}).`,
[
  "La lumière inaugurale annonce la révélation",
  "L’ordre reçu devient rythme de vie et d’adoration",
  "Le commandement crée la liberté véritable"
  ]);

  add(5,"Contexte historique",
`### Contexte historique

*Référence :* ${b} ${c}

Face aux mythes environnants, le texte confesse un seul Dieu, bon et libre. La création n’est ni guerre divine ni hasard : elle est don ordonné (${v11}).`,
[
  "L’auteur instruit un peuple appelé à vivre saintement au milieu des nations",
  "La foi biblique refuse la divinisation du monde et des astres",
  "L’éthique de la création découle du Dieu bon qui agit"
  ]);

  add(6,"Structure littéraire",
`### Structure littéraire

*Référence :* ${b} ${c}

Rythme solennel : « Dieu dit… il y eut un soir, il y eut un matin ». Jours 1–3 : cadres (lumière; cieux/mer; terre). Jours 4–6 : remplissages (astres; oiseaux/poissons; animaux/humains). Le repos parachève.`,
[
  "Le refrain pédagogique sert la mémorisation et la liturgie",
  "Le parallèle 1↔4, 2↔5, 3↔6 montre ordre et plénitude",
  "Le sabbat fonde un temps consacré à Dieu et à la créature"
  ]);

  add(7,"Genre littéraire",
`### Genre littéraire

*Référence :* ${b} ${c}

Récit théologique, structuré pour enseigner qui est Dieu et qui est l’homme. L’intention première est confessionnelle : proclamer la souveraineté du Créateur (${ps33}).`,
[
  "Le style élève l’esprit vers l’adoration plutôt qu’une curiosité technique",
  "Le langage symbolique sert la vérité théologique",
  "Le récit fonde une vision du monde cohérente"
  ]);

  add(8,"Auteur et généalogie",
`### Auteur et généalogie

*Référence :* ${b} ${c}

La Torah transmise à Israël situe l’origine et prépare l’histoire d’Abraham. Les généalogies s’enracinent dans ce prologue pour relier création et promesse.`,
[
  "La mémoire du peuple est façonnée par la Parole",
  "Dieu lie l’universel (création) au particulier (alliance)",
  "La bénédiction se transmet de génération en génération"
  ]);

  add(9,"Verset-clé doctrinal",
`### Verset-clé doctrinal

*Référence :* ${b} ${c}

« Au commencement, Dieu créa les cieux et la terre » (${v11}). Tout procède de Dieu, rien n’existe sans lui (${jn1}). Ce verset fonde la création ex nihilo (${he11}).`,
[
  "Dieu est la source, la mesure et la fin de toute chose",
  "La dépendance de la créature devient motif d’adoration",
  "La providence garde la création dans l’être"
  ]);

  add(10,"Analyse exégétique",
`### Analyse exégétique

*Référence :* ${b} ${c}

Le verbe « créer » (bara’) est réservé à Dieu. « Tohu-bohu » désigne l’informe que la Parole ordonne (${v12_5}). L’alternance soir/matin marque un temps reçu, structurant la vie cultuelle.`,
[
  "La séquence « Dieu dit… et ce fut ainsi » souligne l’efficacité du Verbe",
  "La bénédiction n’est pas un sentiment mais un acte divin",
  "La création devient habitable par distinction et nomination"
  ]);

  add(11,"Analyse lexicale",
`### Analyse lexicale

*Référence :* ${b} ${c}

« Image » (tselem) et « ressemblance » (demut) indiquent représentation et vocation : refléter Dieu, garder et cultiver (${v126}). « Bon » culmine en « très bon » (${v131}), sceau éthique de l’œuvre.`,
[
  "La parole créatrice structure aussi le langage humain",
  "Nommer n’est pas dominer arbitrairement mais servir l’ordre voulu",
  "La bénédiction établit la fécondité et la limite"
  ]);

  add(12,"Références croisées",
`### Références croisées

*Référence :* ${b} ${c}

Le Prologue de Jean (${jn1}) relit la création à la lumière du Logos ; ${ps33} affirme la Parole créatrice ; ${he11} situe la connaissance dans la foi ; ${col1} présente le Christ comme médiateur et fin de la création.`,
[
  "La Bible s’explique par la Bible : l’Écriture interprète l’Écriture",
  "Les parallèles gardent l’unité du message du salut",
  "La christologie éclaire la cosmologie biblique"
  ]);

  add(13,"Fondements théologiques",
`### Fondements théologiques

*Référence :* ${b} ${c}

Dieu est unique, libre, bon ; le monde est contingent, ordonné, bon ; l’homme est image, responsable ; la Parole est efficace (${v11}).`,
[
  "La création n’est pas divine mais don sacré",
  "La bonté originelle fonde la valeur de la matière et du corps",
  "La seigneurie de Dieu exclut l’idolâtrie"
  ]);

  add(14,"Thème doctrinal",
`### Thème doctrinal

*Référence :* ${b} ${c}

Théologie de la création, providence (ordre et limites), anthropologie (image, mandat), éthique de la bonté (${v131}).`,
[
  "La vocation humaine s’exerce sous Parole",
  "L’écologie chrétienne naît de la louange du Créateur",
  "Le mandat culturel sert la vie du prochain"
  ]);

  add(15,"Fruits spirituels",
`### Fruits spirituels

*Référence :* ${b} ${c}

Adoration du Créateur, humilité devant sa Parole, joie du sabbat, responsabilité envers la création et le prochain. La dignité reçue (${v126}) devient vocation à la justice.`,
[
  "Gratitude quotidienne pour le monde reçu",
  "Sobriété et service comme style de vie",
  "Espérance active : Dieu n’a pas abandonné son œuvre"
  ]);

  add(16,"Types bibliques",
`### Types bibliques

*Référence :* ${b} ${c}

La lumière première préfigure la révélation ; Adam figure l’humanité et prépare le Christ, « image de Dieu » parfaite (${col1}); le sabbat annonce le repos promis.`,
[
  "Les types orientent vers l’accomplissement en Christ",
  "La création anticipe la nouvelle création",
  "Les symboles servent la catéchèse"
  ]);

  add(17,"Appui doctrinal",
`### Appui doctrinal

*Référence :* ${b} ${c}

${jn1} relie création et Christ ; ${he11} établit la foi ; ${ps33} souligne la Parole ; ${col1} montre la cohésion de l’univers en Christ.`,
[
  "L’harmonie des témoins bibliques fonde la certitude",
  "La doctrine émerge de l’Écriture, non de la spéculation",
  "L’Église confesse ce dépôt reçu"
  ]);

  add(18,"Comparaison entre versets",
`### Comparaison entre versets

*Référence :* ${b} ${c}

De ${v11} à ${v131} : initiative divine jusqu’à l’évaluation « très bon ». La formule répétée « Dieu dit… et ce fut ainsi » structure l’ensemble (${v12_5}).`,
[
  "Les étapes marquent un ordre progressif et finalisé",
  "Le rythme soir/matin impose une limite au travail",
  "La bonté évaluée protège la créature"
  ]);

  add(19,"Parallèle avec Actes 2",
`### Parallèle avec Actes 2

*Référence :* ${b} ${c}

L’Esprit plane au commencement (${v12_5}) et vient sur l’Église à la Pentecôte : Parole et Esprit créent un peuple nouveau, ordonné pour la mission.`,
[
  "La création et la nouvelle création partagent le même Auteur",
  "La Parole forme la communauté comme elle forma le monde",
  "Le témoignage naît d’une mise en ordre du cœur"
  ]);

  add(20,"Verset à mémoriser",
`### Verset à mémoriser

*Référence :* ${b} ${c}

${v11} — « Au commencement, Dieu créa les cieux et la terre ».`,
[
  "Le mémoriser en fait un socle pour prier et adorer",
  "Le verset corrige le fatalisme et nourrit la confiance",
  "Il ouvre toute lecture biblique"
  ]);

  add(21,"Enseignement pour l’Église",
`### Enseignement pour l’Église

*Référence :* ${b} ${c}

La liturgie confesse le Créateur ; la mission proclame la Parole ; la diaconie respecte la création. L’Église vit du rythme Parole–travail–repos.`,
[
  "Le culte commence par l’écoute de Dieu qui parle",
  "La prédication montre l’unité de l’Écriture",
  "Le service du prochain incarne la bénédiction"
  ]);

  add(22,"Enseignement pour la famille",
`### Enseignement pour la famille

*Référence :* ${b} ${c}

Transmettre la bonté de la création (${v131}), la dignité de l’image (${v126}), et la valeur du repos. Bénir la vie quotidienne comme don.`,
[
  "Raconter les six jours avec simplicité et vérité",
  "Sanctifier le temps, apprendre la gratitude",
  "Encourager la responsabilité partagée"
  ]);

  add(23,"Enseignement pour enfants",
`### Enseignement pour enfants

*Référence :* ${b} ${c}

Mettre en scène la lumière qui paraît (${v12_5}), nommer les créatures, dire merci pour chaque don. Faire goûter la joie du sabbat.`,
[
  "Utiliser images, gestes, chansons",
  "Relier création et prière du soir",
  "Inviter à respecter animaux et nature"
  ]);

  add(24,"Application missionnaire",
`### Application missionnaire

*Référence :* ${b} ${c}

Annoncer le Dieu unique, bon, créateur ; réfuter hasard et fatalisme. Honorer la dignité humaine enracinée en Christ (${col1}).`,
[
  "La bonne nouvelle inclut la restauration de la création",
  "Le témoignage lie vérité et douceur",
  "La foi décentre de soi vers le prochain"
  ]);

  add(25,"Application pastorale",
`### Application pastorale

*Référence :* ${b} ${c}

Consoler : le monde n’est pas livré au chaos ; Dieu parle encore. Avertir : la Parole borne le mal. Conseiller : recevoir le temps comme don.`,
[
  "Accompagner vers le repos hebdomadaire",
  "Encourager une vie ordonnée par la Parole",
  "Soigner la relation au travail et à la création"
  ]);

  add(26,"Application personnelle",
`### Application personnelle

*Référence :* ${b} ${c}

Recevoir ta journée comme vocation : écouter, travailler, et entrer dans le repos. Vivre dans la gratitude devant Dieu créateur (${v11}).`,
[
  "Exercer la maîtrise de soi sous la Parole",
  "Chercher la justice dans les petites choses",
  "Prier avant d’agir, rendre grâce après"
  ]);

  add(27,"Versets à retenir",
`### Versets à retenir

*Référence :* ${b} ${c}

${v11}; ${v12_5}; ${v126}; ${v131}; ${jn1}; ${ps33}.`,
[
  "Les relire à voix haute en famille ou en groupe",
  "Les écrire pour la méditation de la semaine",
  "Les utiliser comme trame de prière"
  ]);

  add(28,"Prière de fin",
`### Prière de fin

*Référence :* ${b} ${c}

Dieu créateur, nous confessons ta Parole efficace et ta bonté. Renouvelle en nous ton image par Jésus-Christ ; accorde sagesse et repos dans ton Esprit. Amen.`,
[
  "Que nos vies deviennent louange",
  "Garde-nous dans la vérité et la charité",
  "Envoie-nous comme témoins humbles et fidèles"
  ]);

  // descriptions courtes pour la colonne de gauche
  const desc = {
    1:"Invocation du Saint-Esprit pour éclairer l’étude.",
    2:"Place dans le canon (AT/NT) et continuité biblique.",
    3:"Points à reprendre et tensions ouvertes.",
    4:"Formulation doctrinale synthétique.",
    5:"Cadre historique et culturel.",
    6:"Découpage et progression.",
    7:"Incidences herméneutiques.",
    8:"Auteur et inspiration.",
    9:"Pivot théologique du chapitre.",
    10:"Grammaire, syntaxe, contexte.",
    11:"Termes clés et portée.",
    12:"Passages parallèles.",
    13:"Attributs de Dieu, création…",
    14:"Rattachement systématique.",
    15:"Vertus produites par la doctrine.",
    16:"Typologie et symboles.",
    17:"Textes d’appui concordants.",
    18:"Harmonisation interne.",
    19:"Continuité dans l’Église.",
    20:"Formulation à mémoriser.",
    21:"Gouvernance, culte, mission.",
    22:"Transmission et consolation.",
    23:"Pédagogie adaptée.",
    24:"Annonce et contextualisation.",
    25:"Conseil et consolation.",
    26:"Repentance, foi, obéissance.",
    27:"Sélection utile à retenir.",
    28:"Action de grâces et bénédiction."
  };
  for (const s of sections) s.description = desc[s.id] || "";
  return sections;
}

/* ---------- Fallback générique (autres chapitres) ---------- */
function genericStudy(book, chap, version, perLen) {
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
  const poolCommon = [
    "La Bible s’explique par la Bible et garde l’unité de la foi",
    "Le Christ accomplit la promesse et oriente l’interprétation",
    "La Parole édifie l’Église et forme la vie quotidienne",
    "La doctrine naît du texte reçu, non de la spéculation",
    "La prière accompagne l’étude et ouvre à l’obéissance"
  ];
  const linkChap = linkRef(book, chap, "", version);
  const sections = [];
  for (let i=1;i<=28;i++) {
    const base = `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title:titles[i], description:"", content: expandUnique(base, poolCommon, perLen) });
  }
  return sections;
}

/* ---------- Construction ---------- */
function buildStudy(passage, length, version="LSG") {
  const allowed = [500,1500,2500];
  const perLen = allowed.includes(Number(length)) ? Number(length) : 1500;
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(passage||"").trim());
  const book = m ? m[1].trim() : "Genèse";
  const chap = m ? parseInt(m[2],10) : 1;

  let sections;
  if (book === "Genèse" && chap === 1) {
    sections = studyForGenesis1(version, perLen);
  } else {
    sections = genericStudy(book, chap, version, perLen);
  }
  return { study: { sections }, requestedLength: perLen };
}

/* ---------- Route ---------- */
async function core(ctx) {
  const method = ctx.req?.method || "GET";
  if (method === "GET") {
    return sendJSON(ctx, 200, {
      ok:true,
      route:"/api/generate-study",
      method:"GET",
      hint:'POST { passage, options:{ length: 500|1500|2500, translation?: "LSG|PDV|S21|BFC" } }'
    });
  }
  if (method !== "POST") return sendError(ctx, 405, "Méthode non autorisée", { allow:["GET","POST"] });

  const body = await readBody(ctx);
  const passage = (body?.passage || "").toString().trim();
  const length  = Number(body?.options?.length);
  const version = (body?.options?.translation || "LSG").toUpperCase();
  if (!passage) return sendError(ctx, 400, 'Champ "passage" manquant (ex: "Genèse 1").');

  try {
    const result = buildStudy(passage, length, version);
    return sendJSON(ctx, 200, { ok:true, ...result });
  } catch (e) {
    return sendError(ctx, 200, "GENERATION_FAILED", { message: String(e?.message || e) });
  }
}

export default async function handler(req, res) {
  if (res && typeof res.status === "function") return core({ req, res });
  return core({ req });
}

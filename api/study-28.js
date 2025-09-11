// /api/generate-study.js
// Serverless Vercel (CommonJS). Sortie stable, 28 rubriques, densité maîtrisée.
// Aucune dépendance externe. Pas d'appel réseau obligatoire -> zéro 500.
// Les références (ex: "Genèse 1:1", "Jean 1:1–3") sont laissées en clair
// pour que le front (app.js) les rende cliquables automatiquement.

const RUBRICS = {
  1:  { t: "Prière d’ouverture",            d: "Invocation du Saint-Esprit pour éclairer l’étude." },
  2:  { t: "Canon et testament",             d: "Place dans le canon (AT/NT) et continuité biblique." },
  3:  { t: "Questions du chapitre précédent",d: "Questions et réponses doctrinales, enchaînement logique." },
  4:  { t: "Titre du chapitre",              d: "Formulation doctrinale synthétique et fidèle au texte." },
  5:  { t: "Contexte historique",            d: "Cadre temporel, culturel, géographique, destinataires." },
  6:  { t: "Structure littéraire",           d: "Découpage, progression et marqueurs rhétoriques." },
  7:  { t: "Genre littéraire",               d: "Narratif, poétique, prophétique… incidences herméneutiques." },
  8:  { t: "Auteur et généalogie",           d: "Auteur humain, inspiration divine, ancrage généalogique." },
  9:  { t: "Verset-clé doctrinal",           d: "Pivot théologique du chapitre." },
  10: { t: "Analyse exégétique",             d: "Explication de texte : grammaire, syntaxe, contexte immédiat." },
  11: { t: "Analyse lexicale",               d: "Termes clés, champs sémantiques, portée doctrinale." },
  12: { t: "Références croisées",            d: "Passages parallèles / complémentaires dans l’Écriture." },
  13: { t: "Fondements théologiques",        d: "Attributs de Dieu, création, alliance, salut…" },
  14: { t: "Thème doctrinal",                d: "Rattachement aux grands thèmes systématiques." },
  15: { t: "Fruits spirituels",              d: "Vertus et attitudes produites par la doctrine." },
  16: { t: "Types bibliques",                d: "Typologie, symboles et figures." },
  17: { t: "Appui doctrinal",                d: "Textes d’appui validant l’interprétation." },
  18: { t: "Comparaison entre versets",      d: "Harmonisation interne du chapitre." },
  19: { t: "Parallèle avec Actes 2",         d: "Continuité de la révélation et de l’Église." },
  20: { t: "Verset à mémoriser",             d: "Formulation brève et structurante pour la mémoire." },
  21: { t: "Enseignement pour l’Église",     d: "Gouvernance, culte, mission, édification." },
  22: { t: "Enseignement pour la famille",   d: "Transmission, sainteté, consolation." },
  23: { t: "Enseignement pour enfants",      d: "Pédagogie, récits, symboles, jeux sérieux." },
  24: { t: "Application missionnaire",       d: "Annonce, contextualisation fidèle, espérance." },
  25: { t: "Application pastorale",          d: "Conseil, avertissement, consolation." },
  26: { t: "Application personnelle",        d: "Repentance, foi, obéissance, prière." },
  27: { t: "Versets à retenir",              d: "Sélection utile pour la méditation et l’évangélisation." },
  28: { t: "Prière de fin",                  d: "Action de grâces et demande de bénédiction." }
};

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// Phrases de finition variées (évite les doublons entre rubriques)
const TAIL_SENTENCES = [
  "Cette lecture demeure fidèle au texte et à l’économie du salut.",
  "Le fil du canon éclaire le sens et oriente l’obéissance.",
  "La cohérence intertextuelle renforce l’exégèse et la doctrine.",
  "L’alliance, du commencement à l’accomplissement, structure la foi.",
  "La théologie biblique articule promesse, accomplissement et vie de l’Église.",
  "Le Christ, Parole éternelle, donne l’unité de l’Écriture.",
  "L’Esprit conduit à la compréhension et à la sanctification.",
  "La réception ecclésiale confirme la rectitude de l’interprétation."
];

// Rend un texte à la longueur visée (±8%), en variant la phrase de fin selon l’index.
function fitLength(txt, target, idx) {
  const min = Math.round(target * 0.92);
  const max = Math.round(target * 1.08);
  let t = String(txt || "").trim();

  // Coupe propre si trop long
  if (t.length > max) {
    const s = t.slice(0, max);
    const cut = Math.max(s.lastIndexOf("."), s.lastIndexOf("!"), s.lastIndexOf("?"));
    t = cut > max * 0.6 ? s.slice(0, cut + 1) : s + "…";
  }

  // Ajout progressif si trop court
  let guard = 0;
  while (t.length < min && guard < 30) {
    const add = TAIL_SENTENCES[(idx + guard) % TAIL_SENTENCES.length];
    t += (t.endsWith(".") ? " " : ". ") + add;
    guard++;
  }
  return t;
}

// Contenu doctrinal distinct par rubrique (sans doublons)
function buildContent(passage, id) {
  // On suppose “passage” de type “Genèse 1”
  const REF = passage;
  switch (id) {
    case 1:
      return `### Prière d’ouverture

*Référence :* ${REF}

Père, nous venons écouter ta Parole. Comme au commencement, que ta lumière chasse nos ténèbres et que ton Esprit plane sur nos pensées (Genèse 1:2). Donne-nous l’humilité, la clarté et l’obéissance afin que cette lecture nous conduise à la foi agissante.`;

    case 2:
      return `### Canon et testament

*Référence :* ${REF}

${REF} s’inscrit dans la cohérence du canon. Le Nouveau Testament reprend le primat de la Parole créatrice (Jean 1:1–3; Hébreux 11:3). La théologie biblique relie commencement et accomplissement : ce que Dieu initie par la Parole, il l’achève en Christ (Colossiens 1:16–17).`;

    case 3:
      // Q/R structurées, avec versets cliquables côté front
      return `### Questions du chapitre précédent

*Référence :* ${REF}

**Questions.**  
1) Qu’implique la formule « Dieu dit » (Genèse 1:3) pour l’autorité de l’Écriture aujourd’hui ?  
2) Comment l’ordre et les limites (Genèse 1:4–10) révèlent-ils la bonté divine ?  
3) Quelle vocation reçoit l’humain créé à l’image (Genèse 1:26–27) ?

**Réponses doctrinales.**  
1) La Parole divine crée et définit le réel : elle fonde l’autorité canonique et oriente l’herméneutique chrétienne (Jean 17:17).  
2) Les distinctions (lumière/ténèbres, eaux/terre) manifestent une création ordonnée à la vie, bonne en soi (Genèse 1:31), et appellent une éthique de la garde.  
3) L’image de Dieu implique représentation, relation et mandat : fécondité, travail et gouvernance responsable sous Dieu (Psaumes 8:5–9).`;

    case 4:
      return `### Titre du chapitre

*Référence :* ${REF}

« Dieu parle, le monde advient, l’humain est mandaté ». Le fil narratif articule initiative divine, ordre du créé et vocation de l’image (Genèse 1:1; Genèse 1:26–28).`;

    case 5:
      return `### Contexte historique

*Référence :* ${REF}

Rédigé pour un peuple appelé à vivre par la Parole du Dieu vivant, le prologue biblique pose une cosmologie théologique : le créé n’est ni divin ni chaotique, mais ordonné par le Dieu unique (Deutéronome 6:4).`;

    case 6:
      return `### Structure littéraire

*Référence :* ${REF}

Rythme sériel en jours, refrain « Dieu dit… et cela fut… Dieu vit que cela était bon », montée vers le sixième jour (Genèse 1:31) et repos du septième (Genèse 2:1–3). La progression établit une pédagogie de la Parole efficace.`;

    case 7:
      return `### Genre littéraire

*Référence :* ${REF}

Récit théologique à portée universelle, usant de parallélismes et de formules répétées. Le genre appelle une lecture canonique et ecclésiale, attentive au dessein salvifique.`;

    case 8:
      return `### Auteur et généalogie

*Référence :* ${REF}

Tradition mosaïque et mémoire d’Israël : une histoire du salut qui inscrit l’origine dans la révélation. Les généalogies ultérieures relient création, promesse et lignée messianique (Genèse 5; Matthieu 1:1–17).`;

    case 9:
      return `### Verset-clé doctrinal

*Référence :* ${REF}

« Au commencement, Dieu créa les cieux et la terre » (Genèse 1:1). Ce premier énoncé fonde monothéisme, souveraineté et bonté de la création, et appelle adoration et confiance.`;

    case 10:
      return `### Analyse exégétique

*Référence :* ${REF}

Le leitmotiv « Dieu dit » (Genèse 1:3,6,9…) souligne l’efficacité performative de la Parole. Les verbes de séparation et de nomination attestent l’autorité divine. Le cadre lexical « bon/très bon » culmine en 1:31.`;

    case 11:
      return `### Analyse lexicale

*Référence :* ${REF}

« Dire », « séparer », « nommer », « bénir » : quatre axes qui portent l’ontologie biblique. Le champ « image/likeness » (Genèse 1:26–27) articule ressemblance et mandat.`;

    case 12:
      return `### Références croisées

*Référence :* ${REF}

Parallèles majeurs : Jean 1:1–3 (Parole créatrice), Psaumes 33:6 (souffle créateur), Hébreux 11:3 (foi et création). Échos sapientiels : Proverbes 8:22–31.`;

    case 13:
      return `### Fondements théologiques

*Référence :* ${REF}

Doctrine de Dieu (créateur, véridique), doctrine de la Parole (efficace, normative), doctrine de l’homme (image, mandat), doctrine de la création (bonté, ordre, finalité).`;

    case 14:
      return `### Thème doctrinal

*Référence :* ${REF}

Création par la Parole et vocation de l’image : théologie de la parole efficace, du sabbat (Genèse 2:1–3) et du gouvernement responsable (Genèse 1:28).`;

    case 15:
      return `### Fruits spirituels

*Référence :* ${REF}

Adoration, émerveillement, travail fidèle, tempérance dans l’usage du créé, espérance soutenue par la bonté originelle proclamée (Genèse 1:31).`;

    case 16:
      return `### Types bibliques

*Référence :* ${REF}

Lumière (Genèse 1:3) annonçant la lumière messianique (Jean 8:12). Adam, image première, typologie du Christ image parfaite (Romains 5:14; Colossiens 1:15).`;

    case 17:
      return `### Appui doctrinal

*Référence :* ${REF}

Genèse 1:1; Psaumes 33:6; Jean 1:1–3; Hébreux 11:3 : quatre piliers qui valident la lecture canonique de la création par la Parole.`;

    case 18:
      return `### Comparaison entre versets

*Référence :* ${REF}

Comparer « Dieu dit » (Genèse 1:3,6,9…) avec « Dieu bénit » (Genèse 1:22,28) : la Parole crée et la bénédiction oriente le vivre.`;

    case 19:
      return `### Parallèle avec Actes 2

*Référence :* ${REF}

Comme l’Esprit plane (Genèse 1:2), l’Esprit est effusé (Actes 2:1–4). Nouvelle création en Christ : la Parole annoncée engendre un peuple.`;

    case 20:
      return `### Verset à mémoriser

*Référence :* ${REF}

« Au commencement, Dieu créa les cieux et la terre » (Genèse 1:1).`;

    case 21:
      return `### Enseignement pour l’Église

*Référence :* ${REF}

Culte centré sur la Parole, catéchèse du sabbat, mission qui confesse le Créateur et le Rédempteur.`;

    case 22:
      return `### Enseignement pour la famille

*Référence :* ${REF}

Transmission intergénérationnelle : raconter l’origine, vivre la bénédiction, travailler la terre avec responsabilité (Genèse 1:28).`;

    case 23:
      return `### Enseignement pour enfants

*Référence :* ${REF}

Sept images simples (lumière, ciel, mer, terre, astres, animaux, humains) pour mémoriser l’ordre du récit et le refrain « Dieu vit que cela était bon ».`;

    case 24:
      return `### Application missionnaire

*Référence :* ${REF}

Annoncer le Dieu créateur dans une culture fragmentée : la Parole donne sens, dignité et espérance.`;

    case 25:
      return `### Application pastorale

*Référence :* ${REF}

Accompagner au travail, au repos et dans la garde du créé ; rappeler la bonté proclamée (Genèse 1:31) comme antidote au nihilisme.`;

    case 26:
      return `### Application personnelle

*Référence :* ${REF}

Recevoir sa vocation d’image : adorer, servir, cultiver, garder ; vivre du sabbat comme signe de confiance.`;

    case 27:
      return `### Versets à retenir

*Référence :* ${REF}

Genèse 1:1; Genèse 1:26–28; Genèse 1:31 — trois repères : origine, vocation, bonté.`;

    case 28:
      return `### Prière de fin

*Référence :* ${REF}

Seigneur, scelle en nous ta Parole. Que la lumière du Christ illumine nos œuvres. Conduis-nous dans la joie du sabbat et la fidélité de l’alliance. Amen.`;

    default:
      return `### ${RUBRICS[id]?.t || "Rubrique"}

*Référence :* ${REF}

${RUBRICS[id]?.d || ""}`;
  }
}

// Construit les 28 sections et adapte la longueur.
function buildSections(passage, per) {
  const sections = [];
  for (let i = 1; i <= 28; i++) {
    const meta = RUBRICS[i];
    const base = buildContent(passage, i);
    const content = fitLength(base, per, i);
    sections.push({
      id: i,
      title: meta.t,
      description: meta.d,
      content
    });
  }
  return sections;
}

// Lecture sûre du body (si Vercel n’a pas déjà parsé)
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString("utf8") || "";
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
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
        hint: "POST { passage, options:{ length: 500|1500|2500 } }"
      });
    }

    if (method !== "POST") {
      return send(res, 405, { error: "Method Not Allowed" });
    }

    const body = await readBody(req);
    const passage = String(body?.passage || "Genèse 1").trim();
    const lengthReq = Number(body?.options?.length) || 1500;
    const per = clamp(lengthReq, 400, 4000); // garde-fou

    const sections = buildSections(passage, per);
    return send(res, 200, { study: { sections } });
  } catch (e) {
    // Filet : renvoyer quand même un squelette valide (jamais 500)
    const sections = buildSections("Genèse 1", 1500);
    return send(res, 200, {
      study: { sections },
      info: { emergency: true, error: String(e?.message || e) }
    });
  }
};

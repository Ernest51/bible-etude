
// api/chat.js — canonical generator (28 rubriques) with directive support
// Works as a Next.js API route or a simple Node handler (req,res).
// Always returns: { ok, source: "canonical", warn, data: { reference, version, sections } }

function toRef(book, chapter, verse) {
  return verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
}

function htmlEscape(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

function prayerFromDirective({book, chapter, verse, directive}) {
  const ref = toRef(book, chapter, verse);
  if (!directive) return null;
  const d = directive.trim().toLowerCase();

  // If the directive explicitly asks for "Amen." at the end, honor it exactly.
  const endsWithAmenDot = /amen\.\s*$/.test(d);

  // Heuristics to keep it short and on-topic
  if (d.includes("faire court") || d.includes("court")) {
    const lines = [
      `<p><strong>Dieu d'amour</strong>, nous venons à toi devant <strong>${htmlEscape(ref)}</strong>.</p>`,
      `<p>Merci pour ton amour et la foi qui reçoit ta grâce en Jésus-Christ.</p>`,
      endsWithAmenDot ? `<p>Amen.</p>` : `<p>Amen</p>`
    ];
    return lines.join("\n");
  }

  // If the directive mentions "Par ton Esprit Saint, amen.", end exactly like that.
  if (d.includes("par ton esprit saint") && d.includes("amen")) {
    const lines = [
      `<p><strong>Dieu fidèle</strong>, nous venons à toi devant <strong>${htmlEscape(ref)}</strong>.</p>`,
      `<p>Par ta Parole qui ordonne, fais luire ta lumière au milieu des ténèbres.</p>`,
      `<p>Par ton Esprit Saint, amen.</p>`
    ];
    return lines.join("\n");
  }

  // Fallback: echo the intent but stay concise
  const lines = [
    `<p><strong>Seigneur</strong>, nous venons à toi devant <strong>${htmlEscape(ref)}</strong>.</p>`,
    `<p>Conduis-nous par ta Parole et ta lumière.</p>`,
    `<p>Amen.</p>`
  ];
  return lines.join("\n");
}

function openingPrayer({book, chapter, verse, directives}) {
  const ref = toRef(book, chapter, verse);
  if (directives && directives.priere_ouverture) {
    return prayerFromDirective({book, chapter, verse, directive: directives.priere_ouverture});
  }
  // Default sober prayer
  return [
    `<p><strong>Dieu trois fois saint</strong>, nous venons à toi devant <strong>${htmlEscape(ref)}</strong>.</p>`,
    `<p>Par ta Parole qui ordonne, fais luire ta lumière et donne-nous d'obéir avec foi.</p>`,
    `<p>Amen.</p>`
  ].join("\n");
}

function isNT(book) {
  const nt = ["Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"];
  return nt.includes(book);
}

function asList(arr) {
  return arr.map(x => htmlEscape(x)).join("·");
}

function buildSections({book, chapter, verse, version, directives}) {
  const ref = toRef(book, chapter, verse);
  const isJean316 = (book === "Jean" && String(chapter) === "3" && String(verse || "") === "16");
  const isGen1 = (book === "Genèse" && String(chapter) === "1" && (verse === "" || verse === undefined || verse === null));

  // Themes
  const themes = isJean316
    ? ["amour de Dieu", "foi", "don du Fils", "vie éternelle"]
    : isGen1
      ? ["Parole qui ordonne", "lumière et ténèbres", "création", "image de Dieu"]
      : isNT(book)
        ? ["Évangile", "foi", "grâce"]
        : ["Alliance", "fidélité de Dieu", "sagesse"];

  // Helpers for richer content
  function p(txt) { return `<p>${txt}</p>`; }

  function s1() {
    return { id: 1, title: "Prière d’ouverture", content: openingPrayer({book, chapter, verse, directives}) };
  }

  function s2() {
    const bullets = isJean316
      ? [
          "Jean appartient au Nouveau Testament; genre: évangile à visée théologique.",
          "Contexte immédiat: entretien de Jésus avec Nicodème (Jean 3:1-21).",
          "Axes: amour de Dieu, foi, vie éternelle."
        ]
      : isGen1
      ? [
          "Genèse appartient au Premier Testament; genre: récit des origines.",
          "Axes: Parole créatrice, ordres/limites, lumière/ténèbres."
        ]
      : [
          `${book} appartient au ${isNT(book) ? "Nouveau" : "Premier"} Testament; genre principal: narratif.`
        ];
    const reps = isJean316
      ? ["Jean 3:16", "Romains 5:8", "1 Jean 4:9-10", "Éphésiens 2:8-9"]
      : isGen1
      ? ["Genèse 1:1-5", "Psaume 33:6", "Jean 1:1-3", "Hébreux 11:3"]
      : [ref];
    return {
      id: 2,
      title: "Canon et testament",
      content: [
        p(htmlEscape(bullets[0])),
        bullets[1] ? p(htmlEscape(bullets[1])) : "",
        bullets[2] ? p(htmlEscape(bullets[2])) : "",
        p(`Repères canoniques: ${asList(reps)}.`),
        p("<em>Glossaire</em>: foi: confiance qui s’en remet à Dieu ; grâce: faveur imméritée ; alliance: relation de fidélité établie par Dieu.")
      ].filter(Boolean).join("\n")
    };
  }

  function s3() {
    const lines = [
      "<strong>Observation.</strong> Qui parle, à qui, où et quand ? Noter répétitions, contrastes, connecteurs.",
      isJean316 ? "<strong>Repère.</strong> Les verbes « aimer », « donner », « croire », « périr/avoir la vie » structurent le verset." : "",
      "<strong>Compréhension.</strong> Que révèle le texte de Dieu et de l’humain ?",
      "<strong>Interprétation.</strong> Quelle idée centrale tient ensemble le passage ?",
      "<strong>Application.</strong> Quelle réponse concrète aujourd’hui ?"
    ].filter(Boolean).map(p).join("\n");
    return { id: 3, title: "Questions du chapitre précédent", content: lines };
  }

  function s4() {
    const orient = isJean316
      ? "L’amour qui donne le Fils et la foi qui reçoit la vie"
      : isGen1 ? "La Parole qui ordonne et la séparation lumière/ténèbres"
      : themes.slice(0,2).join(", ");
    return {
      id: 4,
      title: "Titre du chapitre",
      content: [
        p(`${htmlEscape(ref)} — <strong>Orientation</strong>: lire à la lumière de ${htmlEscape(orient)}.`),
        p(`Appuis: ${asList(isJean316 ? ["Luc 24:27","2 Timothée 3:16-17"] : ["Psaume 19:8-10","Psaume 119:105"])}.`),
        p("Méthode: énoncer le thème en une phrase, justifier par 2–3 indices textuels.")
      ].join("\n")
    };
  }

  function s5() {
    const content = isJean316
      ? [
          "Fin du Ier siècle; communauté johannique confrontée à l’incrédulité et aux clivages.",
          "Cadre: Jérusalem, un docteur de la loi (Nicodème) vient de nuit interroger Jésus.",
          "Place dans l’histoire du salut: révélation de l’amour universel de Dieu en son Fils, pour la vie du monde."
        ]
      : isGen1
      ? [
          "Origines d’Israël; affirmation de Dieu comme Créateur unique face aux récits du Proche-Orient ancien.",
          "Place: ouverture de la Torah; fondation du sabbat et des vocations humaines."
        ]
      : [
          "Situer l’époque, les destinataires, et la question pastorale majeure du livre."
        ];
    return { id: 5, title: "Contexte historique", content: content.map(p).join("\n") };
  }

  function s6() {
    const lines = isJean316
      ? [
          "Structure locale (Jean 3:1-21): dialogue (3:1-15), déclaration théologique (3:16-21).",
          "Connecteurs clés: « car » (explication), « afin que » (finalité).",
          "Champ lexical: amour, don, croire, périr, vie."
        ]
      : [
          "Repérer ouverture, charnières et conclusion; noter les connecteurs (« car », « afin que », « mais »)."
        ];
    return { id: 6, title: "Structure littéraire", content: lines.map(p).join("\n") };
  }

  function s7() {
    return {
      id: 7,
      title: "Genre littéraire",
      content: [
        isJean316 ? p("Évangile (récit + discours). Le verset 16 est une maxime théologique condensée.") : p("Genre: narratif/poétique/discipulaire selon le livre."),
        p("Conséquence: lire le propos théologique et l’appel à la réponse.")
      ].join("\n")
    };
  }

  function s8() {
    const lines = isJean316
      ? [
          "Tradition johannique (apôtre Jean ou son école).",
          "Destinataires: croyants et chercheurs de vérité.",
          "Insertion: prologue (1:1-18) — signes — discours; Jean 3 éclaire la nouvelle naissance."
        ]
      : [
          "Auteur, destinataires, enracinement canonique et trajectoire théologique."
        ];
    return { id: 8, title: "Auteur et généalogie", content: lines.map(p).join("\n") };
  }

  function s9() {
    const lines = isJean316
      ? [
          "Pivot: « Dieu a tant aimé le monde qu’il a donné son Fils unique, afin que quiconque croit en lui ne périsse point, mais qu’il ait la vie éternelle. »",
          "Organisation: amour (motif) → don (acte) → foi (réponse) → vie (but)."
        ]
      : [
          "Identifier un verset-pivot qui concentre le propos théologique et organise la lecture."
        ];
    return { id: 9, title: "Verset-clé doctrinal", content: lines.map(p).join("\n") };
  }

  function s10() {
    const lines = isJean316
      ? [
          "Répétitions: « le monde », « croire », « vie »; antithèse: « périr »/« vie éternelle ».",
          "Syntaxe: cause (« car ») et finalité (« afin que ») structurent l’argument.",
          "Vérifier l’arrière-plan dans 3:14-15 (serpent élevé par Moïse) annonçant l’élévation du Fils."
        ]
      : [
          "Relever répétitions, inclusions, champs lexicaux, et tester l’hypothèse de lecture sur l’ensemble."
        ];
    return { id: 10, title: "Analyse exégétique", content: lines.map(p).join("\n") };
  }

  function s11() {
    const lines = isJean316
      ? [
          "<em>Agapaō / agapē</em> (aimer/amour): amour qui se donne; source en Dieu.",
          "<em>Pisteuō</em> (croire): s’en remettre, faire confiance; dimension relationnelle.",
          "<em>Aiōnios</em> (éternel): qualité de vie liée à la communion avec Dieu, dès maintenant."
        ]
      : [
          "Éclairer 1–2 termes décisifs (p.ex. « créer », « sagesse », « grâce », « foi ») par leur usage dans la Bible."
        ];
    return { id: 11, title: "Analyse lexicale", content: lines.map(p).join("\n") };
  }

  function s12() {
    const lines = isJean316
      ? [
          "1 Jean 4:9-10 (amour manifesté), Romains 5:8 (Dieu prouve son amour), Éphésiens 2:8-9 (salut par grâce, par la foi).",
          "Nombres 21:8-9 (serpent élevé) comme arrière-plan typologique."
        ]
      : [
          "Relier le passage aux témoins majeurs du canon pour confirmer et nuancer la lecture."
        ];
    return { id: 12, title: "Références croisées", content: lines.map(p).join("\n") };
  }

  function s13() {
    const lines = isJean316
      ? [
          "Dieu est amour et il prend l’initiative du salut.",
          "Le salut est don (grâce) reçu par la foi, non par les œuvres.",
          "Universalité de l’offre (« le monde ») et particularité de la réponse (« quiconque croit »)."
        ]
      : [
          "Synthétiser ce que le texte affirme de Dieu et de l’humain (création, chute, rédemption, espérance)."
        ];
    return { id: 13, title: "Fondements théologiques", content: lines.map(p).join("\n") };
  }

  function s14() {
    const lines = isJean316
      ? [
          "Actes de Dieu: aimer, donner le Fils, offrir la vie.",
          "Réponse humaine: croire/faire confiance, recevoir la vie, marcher dans la lumière."
        ]
      : [
          "Articuler ce que Dieu fait et ce que l’homme est appelé à faire en réponse."
        ];
    return { id: 14, title: "Thème doctrinal", content: lines.map(p).join("\n") };
  }

  function s15() {
    const lines = [
      "Gratitude, assurance, joie.",
      "Repentance et confiance renouvelée.",
      "Charité envers le prochain."
    ];
    return { id: 15, title: "Fruits spirituels", content: lines.map(p).join("\n") };
  }

  function s16() {
    const lines = isJean316
      ? [
          "Moïse élevant le serpent (Nb 21) préfigure l’élévation du Christ; regarder avec foi conduit à la vie."
        ]
      : [
          "Repérer motifs et figures qui annoncent le Christ, sans forcer le sens littéral."
        ];
    return { id: 16, title: "Types bibliques", content: lines.map(p).join("\n") };
  }

  function s17() {
    const lines = isJean316
      ? [
          "Jean 1:12; 1 Jean 4:9-10; Romains 8:32; Tite 3:4-7; Psaume 103:8."
        ]
      : [
          "Rassembler des témoins majeurs (Torah, Prophètes, Sagesse, Évangiles, Épîtres) en renfort."
        ];
    return { id: 17, title: "Appui doctrinal", content: lines.map(p).join("\n") };
  }

  function s18() {
    const lines = isJean316
      ? [
          "Comparer 3:16 avec 3:17-21 (but non pour juger mais sauver) et 1 Jean 4:9-10.",
          "Observer l’évolution du champ sémantique de « vie » dans l’Évangile de Jean (3:16; 10:10; 17:3)."
        ]
      : [
          "Comparer ouverture/charnière/conclusion; noter l’évolution d’un mot-clé dans le livre."
        ];
    return { id: 18, title: "Comparaison entre versets", content: lines.map(p).join("\n") };
  }

  function s19() {
    const lines = isJean316
      ? [
          "Actes 2 annonce un salut offert « à vous, à vos enfants et à tous au loin »; la foi naît à l’écoute de la Parole et par l’Esprit.",
        ]
      : [
          "Relier le passage à Parole–Esprit–Communauté pour la vie d’Église."
        ];
    return { id: 19, title: "Comparaison avec Actes 2", content: lines.map(p).join("\n") };
  }

  function s20() {
    const lines = isJean316
      ? [
          "Jean 3:16 (texte entier).",
          "Phrase-mémo: « Aimés, nous croyons et nous vivons. »",
          "Prière: « Seigneur, enracine ma foi dans ton amour manifesté en Jésus. »"
        ]
      : [
          "Choisir un verset du passage; écrire une phrase-mémo et une prière-réponse."
        ];
    return { id: 20, title: "Verset à mémoriser", content: lines.map(p).join("\n") };
  }

  function s21() {
    const lines = [
      "Annonce: centrer la prédication sur l’initiative de Dieu et l’appel à la foi.",
      "Édification: encourager l’assurance du salut et la vie nouvelle.",
      "Mission: ouvrir largement l’invitation (« quiconque »)."
    ];
    return { id: 21, title: "Enseignement pour l’Église", content: lines.map(p).join("\n") };
  }

  function s22() {
    const lines = [
      "Lire le verset ensemble, expliquer « Dieu aime », « Dieu donne », « nous croyons ».",
      "Prière familiale: remercier pour l’amour de Dieu et nommer une confiance concrète."
    ];
    return { id: 22, title: "Enseignement pour la famille", content: lines.map(p).join("\n") };
  }

  function s23() {
    const lines = [
      "Raconter: « Dieu nous aime tellement qu’il a donné Jésus »; mimer « donner » et « recevoir ».",
      "Mémoriser en rythme; prier simplement: « Merci Jésus »."
    ];
    return { id: 23, title: "Enseignement pour enfants", content: lines.map(p).join("\n") };
  }

  function s24() {
    const lines = [
      "Témoigner sans crainte: parler de l’amour de Dieu centré sur la personne de Jésus.",
      "Relier parole et actes d’amour concrets."
    ];
    return { id: 24, title: "Application missionnaire", content: lines.map(p).join("\n") };
  }

  function s25() {
    const lines = [
      "Conseiller: revenir à la grâce; lutter contre la culpabilité stérile par la foi au Fils.",
      "Consoler: Dieu a aimé — cette déclaration précède nos mérites et nos faiblesses."
    ];
    return { id: 25, title: "Application pastorale", content: lines.map(p).join("\n") };
  }

  function s26() {
    const lines = [
      "Cette semaine: 1) remercier chaque jour pour l’amour de Dieu; 2) poser un acte d’amour gratuit; 3) partager le verset à quelqu’un."
    ];
    return { id: 26, title: "Application personnelle", content: lines.map(p).join("\n") };
  }

  function s27() {
    const lines = isJean316
      ? [
          "Jean 3:16 — amour/don/foi/vie.",
          "Romains 5:8 — amour prouvé.",
          "1 Jean 4:9-10 — amour manifesté.",
          "Éphésiens 2:8-9 — salut par grâce."
        ]
      : [
          "Lister 3–5 versets clés du chapitre et noter la clé thématique pour chacun."
        ];
    return { id: 27, title: "Versets à retenir", content: lines.map(p).join("\n") };
  }

  function s28() {
    const closing = isJean316
      ? "Que la Parole reçue en Jean 3:16 enracine notre foi dans ton amour, et qu’elle devienne prière et obéissance. Amen."
      : "Que ta Parole devienne en nous foi, prière et obéissance. Amen.";
    return { id: 28, title: "Prière de fin", content: p(closing) };
  }

  const sections = [
    s1(), s2(), s3(), s4(), s5(), s6(), s7(), s8(), s9(), s10(),
    s11(), s12(), s13(), s14(), s15(), s16(), s17(), s18(), s19(), s20(),
    s21(), s22(), s23(), s24(), s25(), s26(), s27(), s28()
  ];

  return sections;
}

async function readBody(req) {
  // Next.js (Node) provides req.body; Edge/Fetch may require parsing
  if (req && typeof req.body === 'object' && req.body !== null) return req.body;
  if (req && typeof req.text === 'function') {
    const raw = await req.text();
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }
  return {};
}

async function handler(req, res) {
  // Allow GET probe as well, but prefer POST
  let body = await readBody(req);
  if (body && body.probe === true) {
    const payload = { ok: true, source: "probe", warn: "" };
    if (res && typeof res.status === 'function') return res.status(200).json(payload);
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (!body || Object.keys(body).length === 0) {
    body = {}; // avoid crash
  }

  const book = body.book || "Genèse";
  const chapter = body.chapter ?? 1;
  const verse = body.verse ?? "";
  const version = body.version || "LSG";
  const directives = body.directives || {};

  const reference = toRef(book, chapter, verse);
  const sections = buildSections({ book, chapter, verse, version, directives });

  const payload = {
    ok: true,
    source: "canonical",
    warn: "",
    data: { reference, version, sections }
  };

  if (res && typeof res.status === 'function') {
    res.setHeader?.("content-type", "application/json; charset=utf-8");
    return res.status(200).json(payload);
  } else if (typeof Response !== "undefined") {
    return new Response(JSON.stringify(payload), { status: 200, headers: { "content-type": "application/json" } });
  } else {
    // Fallback: return payload (for unit tests)
    return payload;
  }
}

// CommonJS + ESM compatibility
module.exports = handler;
module.exports.default = handler;

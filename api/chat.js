
/**
 * /api/chat.js — canonical generator (28 rubriques) with robust error handling.
 * Runtime: Next.js "pages" API route / Vercel serverless (CommonJS).
 * No external deps, no network calls.
 */

// ---------------------- helpers ----------------------
function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload, null, 2));
  } catch (e) {
    // Last-chance fallback
    try {
      res.end('{"ok":false,"source":"canonical","warn":"send_failed"}');
    } catch {}
  }
}

async function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const obj = JSON.parse(data);
        resolve(obj);
      } catch (e) {
        resolve({ __parse_error: e.message, __raw: data });
      }
    });
    req.on('error', (err) => resolve({ __stream_error: err?.message || String(err) }));
  });
}

function normalizePayload(body) {
  const probe = body && body.probe === true;
  const book = (body?.book ?? '').toString().trim();
  const chapter = body?.chapter === "" ? null : (body?.chapter ?? null);
  const chapterNum = chapter === null ? null : Number.parseInt(chapter, 10);
  const verse = (body?.verse ?? "").toString().trim();
  const version = (body?.version ?? "LSG").toString().trim() || "LSG";
  const directives = (typeof body?.directives === 'object' && body?.directives) ? body.directives : {};

  return { probe, book, chapter: chapterNum, verse, version, directives };
}

function nonEmptyString(s) {
  return typeof s === 'string' && s.trim().length > 0;
}

// -------------- content builders (28 sections) --------------
function makeSection(id, title, contentHtml) {
  return { id, title, content: contentHtml };
}

function buildPrayer({reference, directives, defaultFocus}) {
  // Use directives.priere_ouverture if present, to influence tone/length/emphases
  const d = directives || {};
  const raw = (d.priere_ouverture || "").toLowerCase();

  // Very short prayer when directive contains "faire court"
  const short = raw.includes("faire court");
  const endAmen = raw.includes("amen") || raw.includes("amen.");
  const mentionParole = raw.includes("parole");
  const mentionLumiere = raw.includes("lumière") || raw.includes("lumiere");
  const mentionEsprit = raw.includes("esprit");

  if (short) {
    // tailor for Jean 3:16 shortcut
    return [
      `<p><strong>Dieu d'amour</strong>, nous venons à toi devant <strong>${reference}</strong>.</p>`,
      `<p>Apprends-nous à accueillir ton amour par la foi et à vivre selon ta Parole.</p>`,
      `<p>${endAmen ? "Amen." : "Amen."}</p>`
    ].join('\n');
  }

  // directive for "Parole qui ordonne" + "lumière/ténèbres" + "Par ton Esprit Saint, amen."
  if (mentionParole || mentionLumiere || mentionEsprit) {
    const lines = [];
    lines.push(`<p><strong>Seigneur</strong>, nous venons à toi devant <strong>${reference}</strong>.</p>`);
    lines.push(`<p>Donne-nous d'accueillir ta <em>Parole qui ordonne</em> et de marcher dans la clarté face à <em>lumière et ténèbres</em>.</p>`);
    lines.push(`<p>Apprends-nous l'obéissance simple et joyeuse, selon ta Parole. ${mentionEsprit ? "Par ton Esprit Saint, amen." : "Amen."}</p>`);
    return lines.join('\n');
  }

  // default
  return [
    `<p><strong>Dieu trois fois saint</strong>, nous venons à toi devant <strong>${reference}</strong>.</p>`,
    `<p>Éclaire-nous par ta Parole afin de discerner et d'obéir.</p>`,
    `<p>${endAmen ? "Amen." : "Amen."}</p>`
  ].join('\n');
}

function commonBlocks({ref, book, chapter, verse}) {
  const refInline = ref;
  return {
    canon: [
      `<p>${book} appartient au ${book.toLowerCase() === "jean" ? "Nouveau" : "Premier"} Testament; genre: narratif.</p>`,
      `<p>${refInline} s’éclaire par des thèmes structurants (Parole, foi, lumière/tenèbres, création/renouveau) selon le passage.</p>`,
      `<p>Repères canoniques: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(refInline)}&version=LSG" target="_blank" rel="noopener">${refInline}</a></span>.</p>`
    ].join('\n'),
    scaffold: (theme) => `<p>${refInline} — thème(s): ${theme}.</p>`
  };
}

// ---- Specific content for Genèse 1 ----
function buildGenesis1({version, directives}) {
  const reference = `Genèse 1`;
  const ref = reference;
  const { canon, scaffold } = commonBlocks({ref, book: "Genèse", chapter: 1, verse: ""});

  const sections = [];
  sections.push(makeSection(1, "Prière d’ouverture", buildPrayer({reference: ref, directives, defaultFocus: "Parole/lumière/ténèbres"})));

  sections.push(makeSection(2, "Canon et testament",
    [
      `<p>Genèse appartient au Premier Testament; genre: narratif.</p>`,
      `<p>${ref} s’éclaire par <em>Parole qui ordonne</em> et <em>séparation lumière/ténèbres</em>, marquant l’ordre issu du chaos.</p>`,
      `<p>Repères canoniques: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Gen%C3%A8se%201%3A1-5&version=LSG" target="_blank" rel="noopener">Genèse 1:1-5</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%2033%3A6&version=LSG" target="_blank" rel="noopener">Psaumes 33:6</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20104%3A24&version=LSG" target="_blank" rel="noopener">Psaumes 104:24</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Jean%201%3A1-3&version=LSG" target="_blank" rel="noopener">Jean 1:1-3</a></span>.</p>`,
      `<p>Glossaire: <em>alliance</em> (relation de fidélité instituée par Dieu), <em>sagesse</em> (art de vivre selon Dieu), <em>sanctification</em> (mise à part et transformation).</p>`
    ].join('\n')
  ));

  sections.push(makeSection(3, "Questions du chapitre précédent",
    [
      `<p><strong>Observation.</strong> Acteurs, lieux, procédés (répétitions, inclusions, parallélismes). Verbes-clés; questions: “qui fait quoi, où, quand, pourquoi ?”.</p>`,
      `<p><strong>Compréhension.</strong> Que révèle ${ref} de Dieu et de l’humain ? Quelles intentions dominent ?</p>`,
      `<p><strong>Interprétation.</strong> Identifier un verset-charnière; expliciter la logique et la place dans l’Alliance.</p>`,
      `<p><strong>Connexions.</strong> Échos canoniques: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Gen%C3%A8se%201%3A1-5&version=LSG" target="_blank" rel="noopener">Genèse 1:1-5</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20104%3A24&version=LSG" target="_blank" rel="noopener">Psaumes 104:24</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Colossiens%201%3A16&version=LSG" target="_blank" rel="noopener">Colossiens 1:16</a></span>.</p>`,
      `<p><strong>Application.</strong> Décision concrète (quoi/quand/comment) et prière-réponse.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(4, "Titre du chapitre",
    [
      `<p>${ref} — <strong>Orientation</strong>: lire à la lumière des <em>séparations</em> et de l’<em>image de Dieu</em>.</p>`,
      `<p>Appuis: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%2019%3A8-10&version=LSG" target="_blank" rel="noopener">Psaumes 19:8-10</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20119%3A105&version=LSG" target="_blank" rel="noopener">Psaumes 119:105</a></span>.</p>`,
      `<p>Méthodologie: énoncer le thème en une phrase puis justifier par 2–3 indices textuels.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(5, "Contexte historique",
    [
      `<p>Situer ${ref}: peuple, époque, contexte cultuel; place dans l’histoire du salut.</p>`,
      `<p>Textes de contexte: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%2033%3A6&version=LSG" target="_blank" rel="noopener">Psaumes 33:6</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Colossiens%201%3A16&version=LSG" target="_blank" rel="noopener">Colossiens 1:16</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Jean%201%3A1-3&version=LSG" target="_blank" rel="noopener">Jean 1:1-3</a></span>.</p>`,
      `<p>Conseil: distinguer coutume/commandement; noter institutions et fêtes.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(6, "Structure littéraire",
    `<p>Rechercher ouverture, péripéties, charnières, résolution; noter connecteurs, inclusions, changements de scène.</p>`
  ));
  sections.push(makeSection(7, "Genre littéraire",
    `<p>Genre: narratif. Adapter attentes d’application et prise de notes selon le genre.</p>`
  ));
  sections.push(makeSection(8, "Auteur et généalogie",
    [
      `<p>Auteur/tradition, destinataires, enracinement canonique pour ${ref}.</p>`,
      `<p>Lien aux pères: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Gen%C3%A8se%2015%3A6&version=LSG" target="_blank" rel="noopener">Genèse 15:6</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Exode%2034%3A6-7&version=LSG" target="_blank" rel="noopener">Exode 34:6-7</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20103%3A17-18&version=LSG" target="_blank" rel="noopener">Psaumes 103:17-18</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(9, "Verset-clé doctrinal",
    [
      `<p>Choisir un pivot lié à <em>création</em>, <em>lumière et ténèbres</em> et montrer comment il organise le passage.</p>`,
      `<p>Aide: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%20119%3A11&version=LSG" target="_blank" rel="noopener">Psaumes 119:11</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Colossiens%203%3A16&version=LSG" target="_blank" rel="noopener">Colossiens 3:16</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(10, "Analyse exégétique",
    [
      `<p>Relever marqueurs (répétitions, inclusions), champs lexicaux et verbes gouverneurs; confronter hypothèses.</p>`,
      `<p>Aides: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=N%C3%A9h%C3%A9mie%208%3A8&version=LSG" target="_blank" rel="noopener">Néhémie 8:8</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Luc%2024%3A27&version=LSG" target="_blank" rel="noopener">Luc 24:27</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=2%20Timoth%C3%A9e%202%3A15&version=LSG" target="_blank" rel="noopener">2 Timothée 2:15</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(11, "Analyse lexicale",
    [
      `<p>Éclairer 1–2 termes associés à <em>lumière/ténèbres</em>, <em>Parole qui ordonne</em>; noter sens, contexte et réemploi ailleurs.</p>`,
      `<p>Voir aussi: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Proverbes%201%3A7&version=LSG" target="_blank" rel="noopener">Proverbes 1:7</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Mich%C3%A9e%206%3A8&version=LSG" target="_blank" rel="noopener">Michée 6:8</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Jean%201%3A14&version=LSG" target="_blank" rel="noopener">Jean 1:14</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Romains%203%3A24-26&version=LSG" target="_blank" rel="noopener">Romains 3:24-26</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(12, "Références croisées",
    [
      `<p>Relier ${ref} à l’unité du canon via <em>lumière/ténèbres</em> et <em>séparations</em>.</p>`,
      `<p>Vers le NT: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Jean%201%3A1-3&version=LSG" target="_blank" rel="noopener">Jean 1:1-3</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Colossiens%201%3A16&version=LSG" target="_blank" rel="noopener">Colossiens 1:16</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Josu%C3%A9%201%3A8-9&version=LSG" target="_blank" rel="noopener">Josué 1:8-9</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(13, "Fondements théologiques",
    [
      `<p>Dieu agit comme Guide du peuple; l’humain est appelé à la foi agissante. Sous cette action naissent gratitude, repentance, discernement, persévérance.</p>`,
      `<p>Ancrages: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Deut%C3%A9ronome%206%3A4-5&version=LSG" target="_blank" rel="noopener">Deutéronome 6:4-5</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Habacuc%202%3A4&version=LSG" target="_blank" rel="noopener">Habacuc 2:4</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(14, "Thème doctrinal",
    [
      `<p>Actes de Dieu et réponse humaine: <em>Parole qui ordonne</em>, <em>séparations</em> conduisant à vocation humaine.</p>`,
      `<p>Appuis: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Romains%2012%3A1-2&version=LSG" target="_blank" rel="noopener">Romains 12:1-2</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Philippiens%202%3A12-13&version=LSG" target="_blank" rel="noopener">Philippiens 2:12-13</a></span>.</p>`
    ].join('\n')
  ));

  sections.push(makeSection(15, "Fruits spirituels", `<p>Gratitude, repentance, discernement, persévérance.</p>`));
  sections.push(makeSection(16, "Types bibliques",
    `<p>Repérer motifs qui préfigurent le Christ (lumière, Parole) et leur accomplissement; éviter la sur-interprétation.</p>`
  ));
  sections.push(makeSection(17, "Appui doctrinal",
    [
      `<p>Psaumes/Prophètes en renfort: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%20104%3A24&version=LSG" target="_blank" rel="noopener">Psaumes 104:24</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=H%C3%A9breux%2011%3A3&version=LSG" target="_blank" rel="noopener">Hébreux 11:3</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=%C3%89sa%C3%AFe%2040%3A8&version=LSG" target="_blank" rel="noopener">Ésaïe 40:8</a></span>.</p>`,
      `<p>Usage: ancrer une doctrine dans plusieurs témoins scripturaires.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(18, "Comparaison entre versets",
    `<p>Comparer ouverture/charnière/conclusion; suivre l’évolution d’un mot-clé; vérifier l’unité du passage.</p>`
  ));
  sections.push(makeSection(19, "Comparaison avec Actes 2",
    [
      `<p>Parole – Esprit – Communauté; pertinence pour la vie d’Église.</p>`,
      `<p><span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Actes%202%3A1-4&version=LSG" target="_blank" rel="noopener">Actes 2:1-4</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Actes%202%3A42-47&version=LSG" target="_blank" rel="noopener">Actes 2:42-47</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(20, "Verset à mémoriser",
    [
      `<p>Choisir un verset de ${ref}; formuler une phrase-mémo et une prière-réponse.</p>`,
      `<p>Aide: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%20119%3A11&version=LSG" target="_blank" rel="noopener">Psaumes 119:11</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Colossiens%203%3A16&version=LSG" target="_blank" rel="noopener">Colossiens 3:16</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(21, "Enseignement pour l’Église",
    [
      `<p>Impact communautaire (${ref}): annonce, édification, mission.</p>`,
      `<p>Repères: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=%C3%89ph%C3%A9siens%204%3A11-16&version=LSG" target="_blank" rel="noopener">Éphésiens 4:11-16</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=H%C3%A9breux%2010%3A24-25&version=LSG" target="_blank" rel="noopener">Hébreux 10:24-25</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Jean%2017%3A17&version=LSG" target="_blank" rel="noopener">Jean 17:17</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(22, "Enseignement pour la famille",
    [
      `<p>Transmettre ${ref}: lecture, prière, service, pardon, bénédiction.</p>`,
      `<p>Textes: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Deut%C3%A9ronome%206%3A6-7&version=LSG" target="_blank" rel="noopener">Deutéronome 6:6-7</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Josu%C3%A9%2024%3A15&version=LSG" target="_blank" rel="noopener">Josué 24:15</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=%C3%89ph%C3%A9siens%206%3A4&version=LSG" target="_blank" rel="noopener">Éphésiens 6:4</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(23, "Enseignement pour enfants",
    [
      `<p>Raconter simplement ${ref}; utiliser images/gestes; inviter à prier et mémoriser.</p>`,
      `<p>Aide: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Marc%2010%3A14-16&version=LSG" target="_blank" rel="noopener">Marc 10:14-16</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=2%20Timoth%C3%A9e%203%3A15&version=LSG" target="_blank" rel="noopener">2 Timothée 3:15</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(24, "Application missionnaire",
    [
      `<p>Témoignage humble et cohérent à partir de ${ref}: parole claire, amour concret.</p>`,
      `<p>Repères: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Matthieu%205%3A13-16&version=LSG" target="_blank" rel="noopener">Matthieu 5:13-16</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=1%20Pierre%203%3A15&version=LSG" target="_blank" rel="noopener">1 Pierre 3:15</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Actes%201%3A8&version=LSG" target="_blank" rel="noopener">Actes 1:8</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(25, "Application pastorale",
    [
      `<p>Accompagnement: prière, consolation, conseil, persévérance éclairés par ${ref}.</p>`,
      `<p>Textes: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=1%20Thessaloniciens%205%3A14&version=LSG" target="_blank" rel="noopener">1 Thessaloniciens 5:14</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Galates%206%3A1-2&version=LSG" target="_blank" rel="noopener">Galates 6:1-2</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=2%20Timoth%C3%A9e%204%3A2&version=LSG" target="_blank" rel="noopener">2 Timothée 4:2</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(26, "Application personnelle",
    [
      `<p>Décider 1–2 actions concrètes (quoi/quand/comment) pour la semaine avec ${ref}.</p>`,
      `<p>Aide: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Jacques%201%3A22-25&version=LSG" target="_blank" rel="noopener">Jacques 1:22-25</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20139%3A23-24&version=LSG" target="_blank" rel="noopener">Psaumes 139:23-24</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(27, "Versets à retenir",
    [
      `<p>Lister 3–5 versets du chapitre; pour chacun, noter une clé (création, Parole qui ordonne).</p>`,
      `<p>Suggestions hors chapitre: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%2033%3A6&version=LSG" target="_blank" rel="noopener">Psaumes 33:6</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20104%3A24&version=LSG" target="_blank" rel="noopener">Psaumes 104:24</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%2019%3A8-10&version=LSG" target="_blank" rel="noopener">Psaumes 19:8-10</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(28, "Prière de fin",
    `<p>Que la Parole reçue en ${ref} devienne en nous foi, prière et obéissance. Amen.</p>`
  ));

  return {
    reference: ref,
    version,
    sections
  };
}

// ---- Specific content for Jean 3:16 ----
function buildJohn316({version, directives}) {
  const reference = `Jean 3:16`;
  const ref = reference;
  const sections = [];
  sections.push(makeSection(1, "Prière d’ouverture", buildPrayer({reference: ref, directives, defaultFocus: "amour/foi"})));
  sections.push(makeSection(2, "Canon et testament",
    [
      `<p>Jean appartient au Nouveau Testament; genre: narratif (Évangile).</p>`,
      `<p>${ref} s’inscrit dans l’entretien avec Nicodème; thèmes: <em>amour de Dieu</em>, <em>don du Fils</em>, <em>foi</em>, <em>vie éternelle</em>.</p>`,
      `<p>Repères canoniques: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Jean%203%3A16&version=LSG" target="_blank" rel="noopener">Jean 3:16</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(3, "Questions du chapitre précédent",
    `<p><strong>Observation/Compréhension/Interprétation</strong> centrées sur amour de Dieu et foi; articulation avec Jean 3:1-15.</p>`));
  sections.push(makeSection(4, "Titre du chapitre",
    [
      `<p>${ref} — <strong>Orientation</strong>: lire à la lumière de l’amour de Dieu et du don du Fils pour tous.</p>`,
      `<p>Appuis: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%2019%3A8-10&version=LSG" target="_blank" rel="noopener">Psaumes 19:8-10</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20119%3A105&version=LSG" target="_blank" rel="noopener">Psaumes 119:105</a></span>.</p>`
    ].join('\n')
  ));
  sections.push(makeSection(5, "Contexte historique",
    `<p>Ministère de Jésus en Judée; interlocuteur: Nicodème (chef des Juifs). Place dans l’économie du salut: révélation du cœur du Père.</p>`
  ));
  sections.push(makeSection(6, "Structure littéraire",
    `<p>Cadre narratif (dialogue), logion central (v.16), contrastes vie/jugement, croire/ne pas croire, lumière/ténèbres (v.19-21).</p>`
  ));
  sections.push(makeSection(7, "Genre littéraire",
    `<p>Récit théologique: parole autoritative de Jésus au sein d’un dialogue catéchétique.</p>`
  ));
  sections.push(makeSection(8, "Auteur et généalogie",
    `<p>Tradition johannique; destinataires confrontés aux questions de foi et d’identité messianique.</p>`
  ));
  sections.push(makeSection(9, "Verset-clé doctrinal",
    `<p>Pivot: “Dieu a tant aimé… afin que quiconque croit… ait la vie éternelle” — organise amour → don → foi → vie.</p>`
  ));
  sections.push(makeSection(10, "Analyse exégétique",
    `<p>Reprises lexicales: aimer (agapē), donner (didōmi), croire (pisteuō), périr/vie (apollymi/zoē aiōnios). Contrastes et finalités.</p>`
  ));
  sections.push(makeSection(11, "Analyse lexicale",
    `<p><em>Agapē</em>: amour gratuit et souverain; <em>pisteuō</em>: confiance active; <em>aiōnios</em>: qualité de vie liée à Dieu.</p>`
  ));
  sections.push(makeSection(12, "Références croisées",
    `<p>1 Jn 4:9-10; Rm 5:8; Ép 2:4-9; Nb 21 (serpent d’airain) en arrière-plan de Jn 3:14-15.</p>`
  ));
  sections.push(makeSection(13, "Fondements théologiques",
    `<p>Dieu, source et initiative du salut; Christ, don du Père; réponse: foi qui accueille et transforme.</p>`
  ));
  sections.push(makeSection(14, "Thème doctrinal",
    `<p>Universalité de l’offre du salut et nécessité de la foi personnelle; gratuité et grâce.</p>`
  ));
  sections.push(makeSection(15, "Fruits spirituels",
    `<p>Assurance, joie, humilité, charité active, témoignage.</p>`
  ));
  sections.push(makeSection(16, "Types bibliques",
    `<p>Exaltation du Fils (Jn 3:14) ↔ serpent d’airain (Nb 21): regard de foi qui sauve.</p>`
  ));
  sections.push(makeSection(17, "Appui doctrinal",
    `<p>Jean 17:17; 2 Tm 3:16-17; Ps 19:8-10 — autorité et efficacité de la Parole.</p>`
  ));
  sections.push(makeSection(18, "Comparaison entre versets",
    `<p>Comparer Jn 3:16 avec Jn 3:14-15 et 3:17-21 (amour/jugement, lumière/ténèbres).</p>`
  ));
  sections.push(makeSection(19, "Comparaison avec Actes 2",
    `<p>Parole annoncée, Esprit donné, communauté formée: dynamique du salut vécue et partagée.</p>`
  ));
  sections.push(makeSection(20, "Verset à mémoriser",
    `<p>Formuler une phrase-mémo et prière-réponse centrées sur amour, foi, vie.</p>`
  ));
  sections.push(makeSection(21, "Enseignement pour l’Église",
    `<p>Évangélisation, catéchèse baptismale, hospitalité pour “quiconque croit”.</p>`
  ));
  sections.push(makeSection(22, "Enseignement pour la famille",
    `<p>Transmission: prière en famille, pardon, service; apprendre le verset aux enfants.</p>`
  ));
  sections.push(makeSection(23, "Enseignement pour enfants",
    `<p>Raconter l’histoire de Nicodème; geste: main sur le cœur “Dieu aime”, mains ouvertes “il donne Jésus”.</p>`
  ));
  sections.push(makeSection(24, "Application missionnaire",
    `<p>Témoignage simple: “voici ce que l’amour de Dieu a changé pour moi”.</p>`
  ));
  sections.push(makeSection(25, "Application pastorale",
    `<p>Accompagnement des personnes en quête: écouter, clarifier l’Évangile, prier ensemble.</p>`
  ));
  sections.push(makeSection(26, "Application personnelle",
    `<p>Deux pas concrets cette semaine: (1) prier pour une personne, (2) poser un acte de charité.</p>`
  ));
  sections.push(makeSection(27, "Versets à retenir",
    `<p>Jn 3:16; Rm 5:8; Ép 2:8-9; 1 Jn 4:9-10.</p>`
  ));
  sections.push(makeSection(28, "Prière de fin",
    `<p>Que la Parole reçue en ${ref} devienne en nous foi, prière et obéissance. Amen.</p>`
  ));

  return {
    reference: ref,
    version,
    sections
  };
}

// ---- Fallback generic content (for any other passage) ----
function buildGeneric({book, chapter, verse, version, directives}) {
  const ref = `${book} ${chapter ?? ""}${nonEmptyString(verse) ? ":"+verse : ""}`.trim();
  const sections = [];
  sections.push(makeSection(1, "Prière d’ouverture", buildPrayer({reference: ref, directives, defaultFocus: "Parole/foi"})));
  for (let i = 2; i <= 28; i++) {
    sections.push(makeSection(i, [
      "Canon et testament","Questions du chapitre précédent","Titre du chapitre","Contexte historique",
      "Structure littéraire","Genre littéraire","Auteur et généalogie","Verset-clé doctrinal",
      "Analyse exégétique","Analyse lexicale","Références croisées","Fondements théologiques",
      "Thème doctrinal","Fruits spirituels","Types bibliques","Appui doctrinal",
      "Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser","Enseignement pour l’Église",
      "Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
      "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
    ][i-2] || `Section ${i}`,
    `<p>Indications pour ${ref} — contenu générique (à enrichir selon le passage).</p>`));
  }
  // Ensure 28 sections
  return { reference: ref, version, sections: sections.slice(0, 28) };
}

// ---------------- handler core ----------------
function buildResponse(payload) {
  const norm = normalizePayload(payload || {});
  if (norm.probe) {
    return { ok: true, source: "probe", warn: "" };
  }

  // Validate
  if (!nonEmptyString(norm.book) || (!norm.chapter && norm.chapter !== 0)) {
    return {
      ok: false,
      source: "canonical",
      warn: "Invalid request: 'book' and 'chapter' are required.",
      data: null
    };
  }

  // Choose builder
  let data;
  const bookKey = norm.book.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  if ((bookKey === "genese" || bookKey === "genese") && norm.chapter === 1) {
    data = buildGenesis1({ version: norm.version, directives: norm.directives });
  } else if (bookKey === "jean" && norm.chapter === 3 && norm.verse === "16") {
    data = buildJohn316({ version: norm.version, directives: norm.directives });
  } else {
    data = buildGeneric({ book: norm.book, chapter: norm.chapter, verse: norm.verse, version: norm.version, directives: norm.directives });
  }

  return {
    ok: true,
    source: "canonical",
    warn: "",
    data
  };
}

// ---------------- exported handler (Next.js pages / Vercel) ----------------
module.exports = async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      return send(res, 405, { ok: false, source: "canonical", warn: "Method Not Allowed. Use POST." });
    }
    const body = await readJsonBody(req);
    if (body && body.__parse_error) {
      return send(res, 200, { ok: false, source: "canonical", warn: "JSON parse error: " + body.__parse_error, raw: body.__raw?.slice(0, 2000) ?? "" });
    }
    const result = buildResponse(body || {});
    return send(res, 200, result);
  } catch (err) {
    // Never crash with 500 for expected cases; return structured error instead
    const message = err?.message || String(err);
    return send(res, 200, { ok: false, source: "canonical", warn: "Unhandled error: " + message });
  }
};

// api/generate-study.js
// Pages Router (pas App Router). Génère 28 rubriques.
// La rubrique 2 produit 2000–2500 caractères, style narratif + doctrinal,
// adaptés dynamiquement au livre + chapitre. Liens : ton front les rend cliquables.
//
// ENV à définir sur Vercel :
//   API_BIBLE_KEY   = votre clé api.bible
//   DARBY_BIBLE_ID  = l’ID de la Bible Darby utilisée chez api.bible (FR Darby)
//
// -> Exemple d’appel : /api/generate-study?book=Genèse&chapter=2

export default async function handler(req, res) {
  try {
    const { book, chapter } = req.query || {};
    if (!book || !chapter) {
      return res.status(400).json({ error: 'Paramètres requis: book, chapter' });
    }

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.DARBY_BIBLE_ID || '';

    const refLabel = `${book} ${chapter}`;

    // 1) Passage depuis api.bible (Darby) — repli gracieux si indisponible
    let passageText = '';
    if (apiKey && bibleId) {
      try {
        const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/passages?reference=${encodeURIComponent(refLabel)}&content-type=text`;
        const r = await fetch(url, { headers: { 'api-key': apiKey } });
        if (r.ok) {
          const j = await r.json();
          passageText = extractTextFromApiBible(j);
        }
        if (!passageText) {
          const url2 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(refLabel)}&limit=1`;
          const r2 = await fetch(url2, { headers: { 'api-key': apiKey } });
          if (r2.ok) {
            const j2 = await r2.json();
            passageText = extractTextFromSearch(j2);
          }
        }
      } catch (_e) {
        // on laisse passer : repli ci-dessous
      }
    }
    if (!passageText) {
      passageText = `(${refLabel}) — passage non chargé depuis api.bible ; génération doctrinale assurée sans le texte intégral.`;
    }

    // 2) Analyse légère (mots fréquents, thèmes)
    const analysis = lightAnalyze(passageText, { book, chapter });

    // 3) Génération des 28 rubriques
    const sections = [];

    // 1. Prière d’ouverture (≈ 1000–1300) — à la 1re personne
    sections.push({ n: 1, content: buildOpeningPrayer({ book, chapter }) });

    // 2. Contexte & résumé doctrinal narratif (2000–2500)
    sections.push({
      n: 2,
      content: buildRubrique2({ book, chapter, analysis, passageText })
    });

    // 3. Questions du chapitre précédent (répond/relance)
    sections.push({ n: 3, content: buildPrevChapterQs({ book, chapter }) });

    // 4–27 : bases doctrinales sobres (cohérentes, non verbeuses)
    const other = [
      buildCanon, buildTestament, buildPromesses, buildPecheEtGrace, buildChristologie,
      buildEspritSaint, buildAlliance, buildEglise, buildDisciples, buildEthique,
      buildPriere, buildMission, buildEsperance, buildExhortation, buildApplicationPerso,
      buildApplicationCollective, buildLiturgie, buildMeditation, buildMemoVerset,
      buildTypologie, buildTheologieSystematique, buildHistoireDuSalut, buildThemesSecondaires,
      buildDoutesObjections, buildSynthese, buildPlanDeLecture
    ];
    let n = 4;
    for (const fn of other) {
      sections.push({ n, content: fn({ book, chapter, analysis, passageText }) });
      n++;
    }

    // 28. Prière de clôture (≈ 1000–1300) — à la 1re personne
    sections.push({ n: 28, content: buildClosingPrayer({ book, chapter }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ====================== Utilitaires api.bible ====================== */

function extractTextFromApiBible(payload) {
  try {
    const d = payload && payload.data;
    if (!d) return '';
    if (typeof d.content === 'string') return stripTags(d.content);
    if (Array.isArray(d.passages) && d.passages.length) {
      const html = d.passages.map(p => p.content || '').join('\n');
      return stripTags(html);
    }
  } catch (_) {}
  return '';
}

function extractTextFromSearch(payload) {
  try {
    const d = payload && payload.data;
    if (!d) return '';
    if (Array.isArray(d.verses) && d.verses.length) {
      return d.verses.map(v => v.text || '').join(' ');
    }
    if (Array.isArray(d.passages) && d.passages.length) {
      return d.passages.map(p => p.content || p.reference || '').join(' ');
    }
  } catch (_) {}
  return '';
}

function stripTags(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ====================== Analyse légère ====================== */

function lightAnalyze(text, { book, chapter }) {
  const raw = (text || '').slice(0, 12000);
  const words = raw.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const freq = new Map();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);
  const top = [...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 12).map(x=>x[0]);

  const themes = [];
  if (/(créa|create|lumi|ténè|commencement|commença)/i.test(raw)) themes.push('création');
  if (/(alliance|covenant|promesse)/i.test(raw)) themes.push('alliance');
  if (/(péché|peche|chute|faute|iniqui|mal)/i.test(raw)) themes.push('péché');
  if (/(grâce|grace|miséricorde)/i.test(raw)) themes.push('grâce');
  if (/(loi|torah|commandement)/i.test(raw)) themes.push('loi');
  if (/(roi|royaume|règne|regne)/i.test(raw)) themes.push('royaume');

  return { book, chapter, topWords: top, themes };
}

/* ====================== Génération des rubriques ====================== */

function buildOpeningPrayer({ book, chapter }) {
  const ref = `${book} ${chapter}`;
  return (
    `**Prière d’ouverture**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Seigneur, je m’approche de ta Parole en ${ref}. Donne-moi un cœur attentif, ` +
    `purifie mes intentions et rends-moi souple à ta volonté. Si tu y révèles ta sainteté, ` +
    `que je la révère; si tu y offres ta miséricorde, que je l’accueille sans détour; ` +
    `si tu y dévoiles mon péché, que je le confesse et reçoive ta grâce. Fais de ce chapitre ` +
    `une vraie rencontre: que la mémoire de ton Alliance éclaire mon intelligence, que ` +
    `l’espérance affermisse ma volonté, et que l’obéissance soit le fruit concret de cette lecture. ` +
    `Au nom de Jésus-Christ, amen.`
  );
}

function buildRubrique2({ book, chapter, analysis, passageText }) {
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0,6).join(', ');
  const t = [];

  t.push(`**Contexte et fil narratif de ${ref}**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(
    `Pour comprendre ${ref}, il faut l’inscrire dans l’architecture de ${book}: ` +
    `chaque chapitre n’est pas un bloc isolé, mais un palier d’une montée où Dieu se fait connaître ` +
    `par ses œuvres et ses paroles. Le chapitre ${chapter} poursuit ce mouvement: il reprend des lignes déjà ` +
    `esquissées, en ouvre de nouvelles et prépare le terrain des développements suivants. Le texte avance ` +
    `par unités cohérentes (scènes, discours, généalogies ou oracles selon le genre) qui convergent vers un ` +
    `**thème directeur**. Ici, plusieurs motifs saillants affleurent (${motifs}), et orientent la lecture vers ` +
    `la fidélité de Dieu, la condition humaine et l’appel à la réponse.`
  );
  t.push('');
  t.push(
    `Sur le plan canonique, ${ref} résonne avec d’autres passages: le cadre théologique s’éclaire par la ` +
    `création et la providence (Psaumes 19; Psaumes 104), par la pédagogie de la Loi (Proverbes 1:7; Deutéronome 6), ` +
    `et par l’espérance messianique qui court jusqu’à l’accomplissement en Christ (Luc 24:27; Jean 5:39). ` +
    `Ce réseau d’échos ne force pas le texte: il lui donne relief et profondeur, et apprend au lecteur à ` +
    `recevoir la Bible comme un tout.`
  );
  t.push('');
  t.push(
    `Le chapitre met en jeu une dynamique en trois temps. **D’abord l’initiative de Dieu**: source et mesure ` +
    `de tout bien, elle précède nos démarches et fonde l’alliance. **Puis la réponse humaine**: obéissance, ` +
    `peur, hésitation ou confiance; l’Écriture ne flattera pas l’homme, elle l’éduque. **Enfin la pédagogie de Dieu**: ` +
    `corrections, promesses, relèvements, afin que le peuple apprenne à marcher dans la vérité. Ainsi, ${ref} ` +
    `n’impose pas une morale désincarnée: il raconte la manière dont Dieu façonne réellement des hommes et des femmes ` +
    `dans l’histoire.`
  );
  t.push('');
  t.push(
    `Doctrinalement, ${ref} articule la connaissance de Dieu et la vie droite. Ce que Dieu révèle de lui-même ` +
    `engage l’existence: sa sainteté interdit l’autojustification; sa miséricorde interdit le désespoir; ` +
    `sa sagesse démasque la folie du cœur; sa patience appelle la conversion durable. Le chapitre oriente ` +
    `donc l’Église vers une foi qui pense, une espérance qui supporte, et une charité qui agit. Sous la ` +
    `lumière du Christ, promesse, type ou accomplissement, ${ref} trouve sa place dans l’histoire du salut ` +
    `et prépare déjà les lignes qui convergeront vers la croix et la résurrection.`
  );
  t.push('');
  t.push(
    `Si le passage insiste sur la fragilité humaine, ce n’est pas pour la sacraliser mais pour ` +
    `exalter la suffisance de la grâce. S’il insiste sur l’obéissance, ce n’est jamais comme ` +
    `performance qui gagne Dieu, mais comme fruit de sa fidélité première. C’est pourquoi ${ref} ` +
    `m’enseigne à lire devant Dieu: non pour juger la Parole, mais pour recevoir d’elle le juste jugement ` +
    `qui libère. La mémoire de ses œuvres fonde l’obéissance; la mémoire de nos égarements ` +
    `appelle la vigilance; la mémoire de ses promesses entretient la persévérance.`
  );
  t.push('');
  t.push(
    `Enfin, ${ref} me place dans une trajectoire: apprendre à nommer le mal afin d’y renoncer, ` +
    `apprendre à reconnaître la bonté de Dieu afin de la célébrer, apprendre à discerner le pas à faire ` +
    `aujourd’hui. La vérité reçue devient prière; la prière engendre l’obéissance; et l’obéissance ` +
    `devient témoignage.`
  );

  // Expansion douce pour 2000–2500 caractères
  let out = t.join('\n');
  out = inflateToRange(out, 2000, 2500, { book, chapter });
  // petit rappel de contexte (passageText non affiché intégralement)
  return out;
}

function buildPrevChapterQs({ book, chapter }) {
  const ch = parseInt(chapter, 10);
  if (Number.isFinite(ch) && ch > 1) {
    const prev = `${book} ${ch - 1}`;
    return (
      `**Questions du chapitre précédent**  \n` +
      `*Référence :* ${prev}\n\n` +
      `— Quel fil narratif ${prev} tend-il vers **${book} ${chapter}** ?  \n` +
      `— Quels personnages/lieux reviennent et que révèlent-ils de Dieu ?  \n` +
      `— Quelles tensions ouvertes y trouvent un début de réponse ?  \n` +
      `— Quelle attente la fin de ${prev} suscite-t-elle pour la suite ?`
    );
  }
  return (
    `**Questions du chapitre précédent**  \n` +
    `*Référence :* ${book} ${chapter}\n\n` +
    `Ce chapitre ouvre une section. On s’attend donc à voir se poser les grands axes: ` +
    `révélation de Dieu, vocation de l’homme, promesse et éthique de l’alliance.`
  );
}

/* ==== Bases doctrinales sobres (rubriques 4–27 ; extensibles à la demande) ==== */
function basic({book,chapter}, title, body){
  return `${title}  \n*Référence :* ${book} ${chapter}\n\n${body}`;
}
function buildCanon(ctx){return basic(ctx,'**Canonicité et cohérence**','Le chapitre s’insère sans rupture dans l’unique histoire du salut.');}
function buildTestament(ctx){return basic(ctx,'**Ancien/Nouveau Testament**','Les résonances intertestamentaires donnent l’éclairage juste.');}
function buildPromesses(ctx){return basic(ctx,'**Promesses**','Dieu prend l’initiative et soutient l’espérance.');}
function buildPecheEtGrace(ctx){return basic(ctx,'**Péché et grâce**','Le diagnostic est vrai; la grâce est suffisante.');}
function buildChristologie(ctx){return basic(ctx,'**Christologie**','Le Christ est la clé herméneutique des Écritures.');}
function buildEspritSaint(ctx){return basic(ctx,'**Esprit Saint**','Il éclaire, convainc, sanctifie et envoie.');}
function buildAlliance(ctx){return basic(ctx,'**Alliance**','Cadre éthique de la réponse à Dieu.');}
function buildEglise(ctx){return basic(ctx,'**Église**','Peuple modelé par Parole et sacrements.');}
function buildDisciples(ctx){return basic(ctx,'**Discipulat**','Appel, obéissance, persévérance sous la grâce.');}
function buildEthique(ctx){return basic(ctx,'**Éthique**','La vérité fonde la vie juste, pas l’inverse.');}
function buildPriere(ctx){return basic(ctx,'**Prière**','La parole reçue devient supplication et louange.');}
function buildMission(ctx){return basic(ctx,'**Mission**','Dieu rassemble et envoie vers les nations.');}
function buildEsperance(ctx){return basic(ctx,'**Espérance**','Le jugement sert la vie; la fin nourrit la fidélité.');}
function buildExhortation(ctx){return basic(ctx,'**Exhortation**','Recevoir la Parole, c’est marcher selon elle.');}
function buildApplicationPerso(ctx){return basic(ctx,'**Application personnelle**','Des actes précis répondent à la vérité entendue.');}
function buildApplicationCollective(ctx){return basic(ctx,'**Application communautaire**','La communion se traduit en service et sainteté.');}
function buildLiturgie(ctx){return basic(ctx,'**Liturgie**','Le culte ordonne l’amour de Dieu et du prochain.');}
function buildMeditation(ctx){return basic(ctx,'**Méditation**','Garder, ruminer, pratiquer.');}
function buildMemoVerset({book,chapter}){return `**Verset-clé**  \n*Référence :* ${book} ${chapter}; v.1  \nÀ mémoriser et vivre.`;}
function buildTypologie(ctx){return basic(ctx,'**Typologie**','Figures et accomplissements convergent en Christ.');}
function buildTheologieSystematique(ctx){return basic(ctx,'**Théologie systématique**','Locus: Dieu, Christ, Esprit, Église, Salut.');}
function buildHistoireDuSalut(ctx){return basic(ctx,'**Histoire du salut**','Une seule histoire: promesse → accomplissement.');}
function buildThemesSecondaires(ctx){return basic(ctx,'**Thèmes secondaires**','Repérer les motifs récurrents et nuances.');}
function buildDoutesObjections(ctx){return basic(ctx,'**Doutes/objections**','Répondre avec patience, selon l’Écriture.');}
function buildSynthese(ctx){return basic(ctx,'**Synthèse**','Résumer le propos et son effet spirituel.');}
function buildPlanDeLecture(ctx){return basic(ctx,'**Plan de lecture**','Continuer: lire, prier, pratiquer, témoigner.');}

function buildClosingPrayer({ book, chapter }) {
  const ref = `${book} ${chapter}`;
  return (
    `**Prière de clôture**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Père, je te rends grâce pour la lumière reçue en ${ref}. ` +
    `Grave cette vérité dans mon cœur, affermis ma volonté dans l’obéissance, ` +
    `et fais de ma vie une louange humble et fidèle. Au nom de Jésus-Christ, amen.`
  );
}

/* ====== Aide : étendre à la plage demandée (2000–2500 pour la rub. 2) ====== */
function inflateToRange(text, min, max, ctx) {
  let t = String(text || '').trim();
  if (t.length >= min && t.length <= max) return t;

  const add = [];
  add.push(` Cette lecture de ${ctx.book} ${ctx.chapter} s’inscrit dans l’ensemble du canon (Psaumes 119; 2 Timothée 3:14-17; Hébreux 4:12), afin que l’intelligence devienne obéissance.`);
  add.push(` Elle suppose une vie de prière et de communion (Actes 2:42; Éphésiens 4:11-16), où la vérité reçue se traduit en fidélité durable.`);
  add.push(` Enfin, elle invite à reconnaître la providence de Dieu qui conduit vers la maturité (Romains 8:28-30; 1 Pierre 1:3-9).`);

  let i = 0;
  while (t.length < min && i < add.length) t += add[i++];

  if (t.length > max) {
    const cut = t.slice(0, max);
    const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = cut.slice(0, last > 0 ? last + 1 : max).trim();
  }
  return t;
}

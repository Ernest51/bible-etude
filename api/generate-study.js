// api/generate-study.js
// Étude 28 points + Rubrique 0 en tête (versets du chapitre + explications dynamiques via api.bible)
//
// Entrée: ?book=Genèse&chapter=1[&version=LSG|DARBY|NEG|SEM][&long=1]
// Requiert en env: API_BIBLE_KEY, DARBY_BIBLE_ID (et éventuellement LSG_BIBLE_ID, NEG_BIBLE_ID, SEM_BIBLE_ID)
// NB: La “Rubrique 0” est renvoyée en PREMIER dans le JSON (n:0). Les autres rubriques suivent 1→28.

export default async function handler(req, res) {
  try {
    const { book, chapter } = req.query || {};
    if (!book || !chapter) {
      return res.status(400).json({ error: 'Paramètres requis: book, chapter' });
    }

    const apiKey = process.env.API_BIBLE_KEY || '';
    const bibleId =
      (req.query?.bibleId && String(req.query.bibleId)) ||
      pickBibleIdFromVersion(req.query?.version) ||
      process.env.DARBY_BIBLE_ID || '';
    const refLabel = `${book} ${chapter}`;

    // ========= 1) Récupération du passage (texte brut) pour analyse légère =========
    let passageText = '';
    if (apiKey && bibleId) {
      try {
        const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/passages?reference=${encodeURIComponent(refLabel)}&content-type=text`;
        const r = await fetch(url, { headers: { 'api-key': apiKey } });
        if (r.ok) passageText = extractTextFromApiBible(await r.json());

        if (!passageText) {
          const url2 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(refLabel)}&limit=200`;
          const r2 = await fetch(url2, { headers: { 'api-key': apiKey } });
          if (r2.ok) passageText = extractTextFromSearch(await r2.json());
        }
      } catch (_) {}
    }
    if (!passageText) {
      passageText = `(${refLabel}) — passage non récupéré ; analyse doctrinale sans texte intégral.`;
    }

    const analysis = lightAnalyze(passageText, { book, chapter });

    // ========= 2) Construire les sections =========
    const sections = [];

    // 0. Panorama des versets
    const rubrique0 = await buildRubrique0_VersesOverview({ book, chapter, apiKey, bibleId, analysis });
    sections.push({ n: 0, content: rubrique0 });

    // 1. Prière d’ouverture (~1000–1300)
    sections.push({ n: 1, content: buildOpeningPrayer({ book, chapter }) });

    // 2. Contexte & fil narratif (2000–2500)
    sections.push({ n: 2, content: buildRubrique2({ book, chapter, analysis, passageText }) });

    // 3. Q/R du chapitre précédent
    sections.push({ n: 3, content: buildPrevChapterQnA({ book, chapter }) });

    // 4. Canonicité (longue)
    sections.push({ n: 4, content: buildRubrique4_Canonicite({ book, chapter, analysis }) });

    // 5. AT/NT (longue)
    sections.push({ n: 5, content: buildRubrique5_Testament({ book, chapter, analysis }) });

    // 6–27 : par défaut SOBRES ; activer versions longues si ?long=1|true|yes
    const useLong = /^1|true|yes$/i.test(String(req?.query?.long || '').trim());

    const others = useLong
      ? [
          buildPromessesLong, buildPecheEtGraceLong, buildChristologieLong,
          buildEspritSaintLong, buildAllianceLong, buildEgliseLong, buildDisciplesLong, buildEthiqueLong,
          buildPriereLong, buildMissionLong, buildEsperanceLong, buildExhortationLong, buildApplicationPersoLong,
          buildApplicationCollectiveLong, buildLiturgieLong, buildMeditationLong, buildMemoVersetLong,
          buildTypologieLong, buildTheologieSystematiqueLong, buildHistoireDuSalutLong, buildThemesSecondairesLong,
          buildDoutesObjectionsLong, buildSyntheseLong, buildPlanDeLectureLong
        ]
      : [
          buildPromesses, buildPecheEtGrace, buildChristologie,
          buildEspritSaint, buildAlliance, buildEglise, buildDisciples, buildEthique,
          buildPriere, buildMission, buildEsperance, buildExhortation, buildApplicationPerso,
          buildApplicationCollective, buildLiturgie, buildMeditation, buildMemoVerset,
          buildTypologie, buildTheologieSystematique, buildHistoireDuSalut, buildThemesSecondaires,
          buildDoutesObjections, buildSynthese, buildPlanDeLecture
        ];
    let idx = 6;
    for (const fn of others) {
      sections.push({ n: idx, content: fn({ book, chapter, analysis, passageText }) });
      idx++;
    }

    // 28. Prière de clôture (~1000–1300)
    sections.push({ n: 28, content: buildClosingPrayer({ book, chapter }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ====================== Utilitaires api.bible ====================== */

function pickBibleIdFromVersion(v) {
  const version = String(v || '').toUpperCase();
  const map = {
    'DARBY': process.env.DARBY_BIBLE_ID,
    'LSG': process.env.LSG_BIBLE_ID,
    'NEG': process.env.NEG_BIBLE_ID,
    'SEM': process.env.SEM_BIBLE_ID
  };
  return map[version] || '';
}

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

/* ====================== Rubrique 0 — Panorama des versets ====================== */
async function buildRubrique0_VersesOverview({ book, chapter, apiKey, bibleId, analysis }) {
  const ref = `${book} ${chapter}`;
  let verses = [];

  if (apiKey && bibleId) {
    try {
      const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(ref)}&limit=400`;
      const r = await fetch(url, { headers: { 'api-key': apiKey } });
      if (r.ok) {
        const j = await r.json();
        const raw = Array.isArray(j?.data?.verses) ? j.data.verses : [];
        const prefix = new RegExp(`^${escapeReg(book)}\\s+${escapeReg(String(chapter))}\\s*:\\s*(\\d+)`, 'i');
        verses = raw
          .map(v => ({ ref: v.reference || '', text: normalizeWhitespace(v.text || '') }))
          .filter(v => prefix.test(v.ref))
          .map(v => {
            const m = prefix.exec(v.ref);
            const num = m ? parseInt(m[1], 10) : null;
            return { verse: num, ref: v.ref, text: v.text };
          })
          .filter(v => Number.isFinite(v.verse))
          .sort((a,b)=>a.verse-b.verse);
      }
    } catch (_) {}
  }

  const head =
    `**Rubrique 0 — Panorama des versets du chapitre**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Cette section dresse la **liste des versets** du chapitre, chacun suivi d’une **explication claire** pour orienter la lecture, ` +
    `la prière et la mise en pratique. L’enjeu n’est pas l’exhaustivité technique, mais une **compréhension fidèle** et narrative, ` +
    `digne d’un travail théologique solide.`;

  if (!verses.length) {
    return head + `\n\n— *Les versets n’ont pas pu être chargés.*\n\n` +
      `**Conseil de lecture :** repère l’ouverture (thème posé), le déploiement (développement doctrinal et appels) et la clôture ` +
      `(résolution ou tension maintenue). Identifie ce que le texte **révèle de Dieu** (sa sainteté, sa grâce, sa fidélité) et ` +
      `ce qu’il **appelle** chez l’homme (écoute, repentance, foi, obéissance).`;
  }

  const len = verses.length;
  const explain = (i) => {
    const pos = i + 1;
    const t = analysis.themes || [];
    const lead = pos === 1
      ? `Ouverture: le cadre se pose et le mouvement s’annonce. `
      : (pos === len
        ? `Clôture: la portée théologique s’affirme et appelle la pratique. `
        : (pos <= Math.ceil(len/3)
          ? `Mise en route: la thématique s’installe et ordonne la lecture. `
          : (pos <= Math.ceil((2*len)/3)
            ? `Déploiement: les enjeux se précisent et le discernement s’affine. `
            : `Transition vers la conclusion: les motifs convergent et éclairent l’appel. `)));

    const motif = t.includes('grâce') ? `La **grâce** traverse le texte: initiative divine et relèvement. `
                : t.includes('loi') ? `La **loi** révèle la vérité et règle la réponse. `
                : t.includes('alliance') ? `L’**Alliance** structure l’espérance et la fidélité. `
                : t.includes('péché') ? `Le **péché** est nommé sans détour pour conduire à la vie. `
                : t.includes('création') ? `La **création** et la providence élargissent la perspective. `
                : t.includes('royaume') ? `Le **Royaume** affleure: autorité de Dieu et appel. `
                : `Le fil doctrinal demeure: Dieu parle, l’homme répond, la vérité libère. `;

    return `${lead}${motif}Tiens ensemble **vérité** et **miséricorde**, pour que la foi devienne **obéissance paisible**.`;
  };

  const lines = verses.map((v, i) => {
    const shown = truncateForLine(v.text, 240);
    return `- **v.${v.verse}** — ${shown}\n  → ${explain(i)}`;
  });

  return head + `\n\n` + lines.join('\n');
}

/* ====================== Rubriques existantes (1–5, 28) ====================== */

function buildOpeningPrayer({ book, chapter }) {
  const ref = `${book} ${chapter}`;
  return (
    `**Prière d’ouverture**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Seigneur, je m’approche de ta Parole avec un cœur qui veut apprendre. Dans ce chapitre, ` +
    `tu parles pour créer, corriger et consoler. Donne-moi de recevoir la vérité sans la tordre, ` +
    `de discerner ce qui vient de toi et d’y répondre avec simplicité. Si tu exposes ta sainteté, ` +
    `que je révère ton Nom; si tu révèles mes égarements, que je confesse et me détourne; si tu ouvres ` +
    `un chemin d’espérance, que je l’embrasse avec foi. Que l’Alliance oriente mon esprit, que l’Évangile ` +
    `règle mes affections, et que l’obéissance devienne ma joie. Je veux une rencontre vraie: ` +
    `fais de cette page un lieu d’écoute, et de mon cœur un terrain docile. Au nom de Jésus-Christ, amen.`
  );
}

function buildRubrique2({ book, chapter, analysis }) {
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0, 6).join(', ');
  const t = [];

  t.push(`**Contexte et fil narratif**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(
    `Ce chapitre ne se comprend qu’à l’intérieur d’une architecture plus vaste. L’auteur n’empile pas des scènes, ` +
    `il conduit un itinéraire: ce qui précède pose des repères, ce qui suit reprend et approfondit. La section ` +
    `présente rassemble des motifs ( ${motifs} ) et les agence pour faire ressortir une ligne maîtresse. Le lecteur ` +
    `est guidé d’un repère doctrinal à l’autre: Dieu prend l’initiative, l’être humain répond, et la pédagogie ` +
    `divine façonne un peuple.`
  );
  t.push('');
  t.push(
    `Sur le plan littéraire, la progression se fait par unités cohérentes — récit, discours, oracle ou généalogie — ` +
    `qui convergent vers un **thème directeur**. Les répétitions ne sont pas des redites: elles jouent le rôle d’un ` +
    `marteau doux qui imprime la vérité. Les contrastes forcent le discernement (lumière/ténèbres, fidélité/infidélité, ` +
    `sagesse/folie) et mettent au jour l’appel de Dieu.`
  );
  t.push('');
  t.push(
    `Canoniquement, la page s’éclaire par résonance: création et providence (Psaumes 19; 104), pédagogie de la Loi ` +
    `(Deutéronome 6; Proverbes 1:7), promesse et accomplissement convergeant en Christ (Luc 24:27; Jean 5:39). ` +
    `Ces échos ne tordent pas le texte: ils lui donnent profondeur en le situant dans l’unique histoire du salut.`
  );
  t.push('');
  t.push(
    `Doctrinalement, la dynamique est tripartite. **D’abord l’initiative de Dieu**: sujet véritable, il crée, appelle, ` +
    `juge et sauve; la grâce devance tout mérite. **Ensuite la réponse humaine**: fidélité hésitante, confiance ou ` +
    `résistance; l’Écriture éduque plutôt qu’elle ne flatte. **Enfin la patience du Seigneur**: corrections, promesses, ` +
    `relèvements; la vérité s’inscrit dans la durée et sanctifie la vie ordinaire. Ainsi la narration devient doctrine, ` +
    `et la doctrine devient chemin.`
  );
  t.push('');
  t.push(
    `À la lumière du Christ, la section prend sa portée entière: promesse en germe, figure typologique ou annonce directe, ` +
    `elle oriente vers la croix et la résurrection, où la justice et la miséricorde se rencontrent. Ce passage enseigne ` +
    `moins la performance que la conversion: nommer le mal pour s’en détourner, célébrer la bonté de Dieu pour y demeurer, ` +
    `poser aujourd’hui l’acte qui convient à la vérité reçue.`
  );
  t.push('');
  t.push(
    `En somme, cette page est un atelier de formation spirituelle. La vérité reçue devient prière; la prière enfante l’obéissance; ` +
    `l’obéissance devient témoignage. Le chapitre s’inscrit ainsi dans une trajectoire où l’on apprend à marcher humblement avec Dieu, ` +
    `porté par sa Parole qui éclaire, corrige et console.`
  );

  return inflateToRange(t.join('\n'), 2000, 2500, { book, chapter });
}

function buildPrevChapterQnA({ book, chapter }) {
  const ch = parseInt(chapter, 10);
  const generic = {
    fil: `Le chapitre précédent a posé un cadre théologique (origine, alliance, loi ou promesse) qui ouvre logiquement sur l’approfondissement présent: ce qui était énoncé devient enjeu vécu.`,
    pers: `Les acteurs déjà introduits reviennent avec des fonctions clarifiées (responsabilité, épreuve, mission). Le décor n’est pas neutre: il sert la pédagogie divine.`,
    dieu: `Sa sainteté interdit l’autojustification; sa miséricorde interdit le désespoir; sa fidélité rend l’obéissance possible.`,
    tensions: `Limites humaines, attente d’une promesse, conflit latent: la suite reprend ces fils pour dresser un diagnostic vrai et proposer un chemin de vie.`,
    attente: `Une mise au clair doctrinale ou un déplacement narratif que la section présente commence à honorer en orientant le lecteur vers la fidélité concrète.`
  };

  if (Number.isFinite(ch) && ch > 1) {
    const prev = `${book} ${ch - 1}`;
    return (
      `**Questions du chapitre précédent**  \n` +
      `*Référence :* ${prev}\n\n` +
      `1. **Quel fil narratif conduit vers la suite ?**  \n→ ${generic.fil}\n\n` +
      `2. **Quels personnages ou lieux réapparaissent et que gagnent-ils en précision ?**  \n→ ${generic.pers}\n\n` +
      `3. **Qu’a révélé ${prev} sur Dieu et comment cela règle la lecture actuelle ?**  \n→ ${generic.dieu}\n\n` +
      `4. **Quelles tensions restaient ouvertes et commencent à se résoudre ?**  \n→ ${generic.tensions}\n\n` +
      `5. **Quelle attente la clôture de ${prev} suscitait-elle ?**  \n→ ${generic.attente}`
    );
  }

  const ref = `${book} ${chapter}`;
  return (
    `**Questions d’introduction**  \n` +
    `*Référence :* ${ref}\n\n` +
    `1. **Quel horizon théologique s’ouvre dès l’entrée ?**  \n→ Souveraineté de Dieu et finalité salvifique de l’histoire.\n\n` +
    `2. **Comment l’homme est-il situé d’emblée ?**  \n→ Créature appelée à vivre de la Parole, recevoir l’Alliance et exercer une responsabilité réglée par Dieu.\n\n` +
    `3. **Quels thèmes structurants émergent ?**  \n→ Création/providence, promesse/jugement, sagesse/folie, appel/obéissance.`
  );
}

/* ===== Rubrique 4 : longue (Canonicité) ===== */
function buildRubrique4_Canonicite({ book, chapter, analysis }){
  const ref=`${book} ${chapter}`; const motifs=(analysis.topWords||[]).slice(0,5).join(', ');
  const p=[];
  p.push(`**Canonicité et cohérence**`);
  p.push(`*Référence :* ${ref}`);
  p.push('');
  p.push(`Ce chapitre prend sa pleine mesure lorsqu’on le replace dans l’économie du canon, où promesse et accomplissement se répondent. La Bible n’est pas une mosaïque de slogans; elle déroule l’histoire unique du salut, de l’initiative créatrice jusqu’à l’accomplissement en Christ, puis l’envoi de l’Église dans l’Esprit. Ici, les motifs (${motifs}) relèvent d’une pédagogie: Dieu reprend, approfondit, et place les mêmes vérités dans des contextes variés pour former un peuple intelligent et obéissant.`);
  p.push('');
  p.push(`Lire canoniquement, c’est se laisser guider par les résonances proches (au sein du livre) et lointaines (Psaumes 119; Proverbes 1:7; la prédication prophétique; l’éclairage du Nouveau Testament en Luc 24:27 et Jean 5:39). Ces correspondances manifestent l’unité d’un dessein où Dieu demeure fidèle, et où la diversité des genres — récit, loi, sagesse, prophétie, évangile, épître — sert une même finalité: la communion du pécheur réconcilié avec Dieu.`);
  p.push('');
  p.push(`La cohérence se perçoit à trois niveaux: **théologique** (Dieu sujet véritable; l’homme n’est pas centre), **narratif** (ce qui a été posé est ici approfondi, et la clôture prépare la suite), **ecclésial** (le peuple est façonné: doctrine, culte et vie ordinaire s’accordent). Cette cohérence n’étouffe pas la diversité; elle l’harmonise, comme une polyphonie au service de la grâce souveraine.`);
  p.push('');
  p.push(`Concrètement, replacer ${ref} dans l’unité biblique, c’est mieux entendre les appels: si le passage nomme le péché, c’est pour mieux dévoiler la suffisance de la grâce; s’il insiste sur l’obéissance, c’est comme fruit d’une fidélité première; s’il parle de jugement, c’est en vue de la vie. La vérité reçue engendre prière, l’obéissance devient témoignage, et la communauté progresse dans la paix ferme de l’Évangile.`);
  return inflateToRange(p.join('\n'),2000,2500,{book,chapter});
}

/* ===== Rubrique 5 : longue (Ancien/Nouveau Testament) ===== */
function buildRubrique5_Testament({ book, chapter, analysis }){
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0, 5).join(', ');
  const t = [];
  t.push(`**Ancien/Nouveau Testament : continuité, accomplissement, lumière réciproque**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(
    `Pour lire ce chapitre avec justesse, il faut honorer la manière dont l’Ancien et le Nouveau Testament s’éclairent sans se confondre. ` +
    `La révélation progresse selon la logique de l’Alliance: Dieu parle, promet, juge et console, jusqu’à l’accomplissement en Jésus-Christ. ` +
    `L’Ancien prépare, annonce et typologise; le Nouveau dévoile, accomplit et interprète. La continuité n’est pas uniformité; la nouveauté n’est pas opposition.`
  );
  t.push('');
  t.push(
    `Dans l’Ancien Testament, les réalités du salut sont données comme promesses, figures et ordonnances: création et providence (Psaumes 19; 104), ` +
    `Loi formatrice (Deutéronome 6; Proverbes 1:7), sacrifices qui disent le sérieux du péché. Le Nouveau reprend ces fils non pour les abolir, ` +
    `mais pour en manifester le sens plein: le Christ est la clé herméneutique (Luc 24:27; Jean 5:39).`
  );
  t.push('');
  t.push(
    `Trois axes structurent ce rapport: **promesse/accomplissement** (2 Corinthiens 1:20), **loi/évangile** (Romains 3–8; Galates), ` +
    `**Esprit/Église** (Joël 3 → Actes 2). Dans ce cadre, ${ref} assume et prolonge l’Ancien en orientant vers l’Évangile. Les motifs (${motifs}) ` +
    `nourrissent une pédagogie où la répétition grave la vérité et la variation en déploie les implications.`
  );
  t.push('');
  t.push(
    `Cette lecture protège de deux excès: **le biblicisme plat** (verset isolé hors contexte) et **l’opposition stérile** (Nouveau contre Ancien). ` +
    `La nouveauté chrétienne révèle la portée ultime de ce qui précède dans la personne du Fils. L’intelligence spirituelle consiste à laisser ` +
    `l’Ancien préparer la foi et le Nouveau l’établir, afin que la vie devienne obéissance joyeuse.`
  );
  t.push('');
  t.push(
    `Concrètement, replacer ${ref} dans cette lumière conjointe, c’est discerner la m

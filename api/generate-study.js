// api/generate-study.js
// Étude 28 points + Rubrique 0 en tête (versets du chapitre + explications dynamiques via api.bible)
//
// Entrée: ?book=Genèse&chapter=1[|1:1|1:1-9][&version=LSG|DARBY|NEG|SEM][&long=1|0]
// Requiert: API_BIBLE_KEY, DARBY_BIBLE_ID (optionnellement LSG_BIBLE_ID, NEG_BIBLE_ID, SEM_BIBLE_ID)
// NB: La “Rubrique 0” arrive en premier (n:0). Les rubriques 6→27 sont exactement 22 items. 28 = prière de clôture.

export default async function handler(req, res) {
  try {
    const { book, chapter: chapterParam } = req.query || {};
    if (!book || !chapterParam) {
      return res.status(400).json({ error: 'Paramètres requis: book, chapter' });
    }

    // Normalise "1", "1:1", "1:1-9", "1–2"
    const { chapterNum, chapterRef } = normalizeChapter(String(chapterParam));

    const apiKey = process.env.API_BIBLE_KEY || '';
    const bibleId =
      (req.query?.bibleId && String(req.query.bibleId)) ||
      pickBibleIdFromVersion(req.query?.version) ||
      process.env.DARBY_BIBLE_ID || '';

    const refForApi     = `${book} ${chapterRef}`;
    const refForChapter = `${book} ${chapterNum}`;

    // ========= 1) Passage pour analyse légère =========
    let passageText = '';
    if (apiKey && bibleId) {
      try {
        const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/passages?reference=${encodeURIComponent(refForApi)}&content-type=text`;
        const r = await fetch(url, { headers: { 'api-key': apiKey } });
        if (r.ok) passageText = extractTextFromApiBible(await r.json());
        if (!passageText) {
          const url2 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(refForApi)}&limit=200`;
          const r2 = await fetch(url2, { headers: { 'api-key': apiKey } });
          if (r2.ok) passageText = extractTextFromSearch(await r2.json());
        }
      } catch (e) { console.error('[api.bible fetch] error', e); }
    }
    if (!passageText) {
      passageText = `(${refForApi}) — passage non récupéré ; analyse doctrinale sans texte intégral.`;
    }

    const analysis = lightAnalyze(passageText, { book, chapter: chapterNum });

    // ========= 2) Sections =========
    const sections = [];

    // 0. Panorama des versets (niveau chapitre)
    const rubrique0 = await buildRubrique0_VersesOverview({
      book, chapterForFilter: chapterNum, apiKey, bibleId, analysis
    });
    sections.push({ n: 0, content: rubrique0 });

    // 1–5 — identiques
    sections.push({ n: 1, content: buildOpeningPrayer({ book, chapter: chapterNum }) });
    sections.push({ n: 2, content: buildRubrique2({ book, chapter: chapterNum, analysis, passageText }) });
    sections.push({ n: 3, content: buildPrevChapterQnA({ book, chapter: chapterNum }) });
    sections.push({ n: 4, content: buildRubrique4_Canonicite({ book, chapter: chapterNum, analysis }) });
    sections.push({ n: 5, content: buildRubrique5_Testament({ book, chapter: chapterNum, analysis }) });

    // 6–27 : EXACTEMENT 22 items (mode long par défaut = &long=1)
    const useLong = (() => {
      const q = String(req?.query?.long ?? '').trim();
      return q === '' ? true : /^1|true|yes$/i.test(q) && !/^(0|false|no)$/i.test(q);
    })();

    const othersLong = [
      buildPromessesLong,            // 6
      buildPecheEtGraceLong,         // 7
      buildChristologieLong,         // 8
      buildEspritSaintLong,          // 9
      buildAllianceLong,             // 10
      buildEgliseLong,               // 11
      buildDisciplesLong,            // 12
      buildEthiqueLong,              // 13
      buildPriereLong,               // 14
      buildMissionLong,              // 15
      buildEsperanceLong,            // 16
      buildExhortationLong,          // 17
      buildApplicationPersoLong,     // 18
      buildApplicationCollectiveLong, // 19
      buildLiturgieLong,             // 20
      buildMeditationLong,           // 21  (intègre l’ex-“Verset-clé”)
      buildTypologieLong,            // 22
      buildTheologieSystematiqueLong,// 23
      buildHistoireDuSalutLong,      // 24
      buildDoutesObjectionsLong,     // 25  (intègre “Thèmes secondaires”)
      buildSyntheseLong,             // 26
      buildPlanDeLectureLong         // 27
    ];

    const othersShort = [
      buildPromesses, buildPecheEtGrace, buildChristologie, buildEspritSaint, buildAlliance, buildEglise,
      buildDisciples, buildEthique, buildPriere, buildMission, buildEsperance, buildExhortation,
      buildApplicationPerso, buildApplicationCollective, buildLiturgie, buildMeditation,
      buildTypologie, buildTheologieSystematique, buildHistoireDuSalut,
      buildDoutesObjections, buildSynthese, buildPlanDeLecture
    ];

    const others = useLong ? othersLong : othersShort;

    // filet de sécurité — évite toute dérive d’indexation
    if (others.length !== 22) {
      console.error('[config] others.length != 22 →', others.length);
      return res.status(500).json({ error: 'Configuration des rubriques 6–27 invalide (attendu: 22).' });
    }

    for (let i = 0; i < others.length; i++) {
      const n = 6 + i; // 6..27
      const fn = others[i];
      sections.push({ n, content: fn({ book, chapter: chapterNum, analysis, passageText }) });
    }

    // 28. Prière de clôture
    sections.push({ n: 28, content: buildClosingPrayer({ book, chapter: chapterNum }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ====================== Utilitaires ====================== */

function normalizeChapter(raw) {
  const s = String(raw || '').trim();
  const m = s.match(/^(\d+)/);
  const chapterNum = m ? m[1] : s;
  const chapterRef = /[:\-–]/.test(s) ? s : chapterNum;
  return { chapterNum, chapterRef };
}

function pickBibleIdFromVersion(v) {
  const version = String(v || '').toUpperCase();
  const map = {
    'DARBY': process.env.DARBY_BIBLE_ID,
    'LSG':   process.env.LSG_BIBLE_ID,
    'NEG':   process.env.NEG_BIBLE_ID,
    'SEM':   process.env.SEM_BIBLE_ID
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

/* ====================== Rubrique 0 — Panorama (par CHAPITRE) ====================== */
async function buildRubrique0_VersesOverview({ book, chapterForFilter, apiKey, bibleId, analysis }) {
  const ref = `${book} ${chapterForFilter}`;
  let verses = [];
  if (apiKey && bibleId) {
    try {
      const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(ref)}&limit=400`;
      const r = await fetch(url, { headers: { 'api-key': apiKey } });
      if (r.ok) {
        const j = await r.json();
        const raw = Array.isArray(j?.data?.verses) ? j.data.verses : [];
        const prefix = new RegExp(`^${escapeReg(book)}\\s+${escapeReg(String(chapterForFilter))}\\s*:\\s*(\\d+)`, 'i');
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
    } catch (e) { console.error('[search verses] error', e); }
  }

  const head =
    `**Rubrique 0 — Panorama des versets du chapitre**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Cette section dresse la **liste des versets** avec une **explication brève** pour orienter lecture, prière et pratique.`;

  if (!verses.length) {
    return head + `\n\n— *Les versets n’ont pas pu être chargés.*\n\n` +
      `**Conseil de lecture :** repère ouverture, déploiement, clôture; ce que le texte **révèle de Dieu** et **appelle** chez l’homme.`;
  }

  const len = verses.length;
  const explain = (i) => {
    const pos = i + 1, t = analysis.themes || [];
    const lead = pos === 1 ? `Ouverture: le cadre se pose. `
      : pos === len ? `Clôture: l’appel se précise. `
      : pos <= Math.ceil(len/3) ? `Mise en route: la thématique s’installe. `
      : pos <= Math.ceil((2*len)/3) ? `Déploiement: les enjeux se précisent. `
      : `Transition: les motifs convergent. `;
    const motif = t.includes('grâce') ? `La **grâce** traverse le texte. `
      : t.includes('loi') ? `La **loi** règle la réponse. `
      : t.includes('alliance') ? `L’**Alliance** structure l’espérance. `
      : t.includes('péché') ? `Le **péché** est nommé pour la vie. `
      : t.includes('création') ? `La **création** élargit la perspective. `
      : t.includes('royaume') ? `Le **Royaume** affleure. `
      : `Dieu parle, l’homme répond. `;
    return `${lead}${motif}Vérité & miséricorde tenues ensemble.`;
  };

  const lines = verses.map((v, i) => {
    const shown = truncateForLine(v.text, 240);
    return `- **v.${v.verse}** — ${shown}\n  → ${explain(i)}`;
  });

  return head + `\n\n` + lines.join('\n');
}

/* ====================== Rubriques 1–5, 28 (inchangées) ====================== */

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
  t.push(`*Référence :* ${ref}\n`);
  t.push(`Ce chapitre s’inscrit dans une architecture plus vaste. Les motifs ( ${motifs} ) sont agencés pour mettre en relief une ligne maîtresse: Dieu prend l’initiative, l’être humain répond, et la pédagogie divine façonne un peuple.`);
  t.push(`Les unités — récit, discours, oracle ou généalogie — convergent vers un **thème directeur**. Répétitions, contrastes et échos canoniques (Psaumes 19; 104; Dt 6; Pr 1:7; Lc 24:27; Jn 5:39) creusent la profondeur sans tordre le texte.`);
  t.push(`Doctrinalement: **initiative de Dieu**, **réponse humaine**, **patience du Seigneur**. La narration devient doctrine, la doctrine devient chemin.`);
  t.push(`À la lumière du Christ, la page oriente vers la croix et la résurrection; elle enseigne moins la performance que la conversion: nommer le mal, s’en détourner, célébrer la bonté de Dieu et poser aujourd’hui l’acte proportionné.`);
  t.push(`En somme, atelier de formation spirituelle: vérité reçue → prière → obéissance → témoignage.`);
  return inflateToRange(t.join('\n\n'), 2000, 2500, { book, chapter });
}

function buildPrevChapterQnA({ book, chapter }) {
  const ch = parseInt(chapter, 10);
  const generic = {
    fil: `Le chapitre précédent posait un cadre théologique (origine, alliance, loi ou promesse) ouvrant sur l’approfondissement actuel.`,
    pers: `Acteurs et lieux reviennent avec fonctions clarifiées (responsabilité, épreuve, mission).`,
    dieu: `Sainteté qui interdit l’autojustification, miséricorde qui interdit le désespoir, fidélité qui rend l’obéissance possible.`,
    tensions: `Limites humaines, attente d’une promesse, conflit latent: la suite reprend ces fils vers un chemin de vie.`,
    attente: `Une mise au clair doctrinale que la section présente commence à honorer.`
  };
  if (Number.isFinite(ch) && ch > 1) {
    const prev = `${book} ${ch - 1}`;
    return (
      `**Questions du chapitre précédent**  \n` +
      `*Référence :* ${prev}\n\n` +
      `1. **Quel fil narratif conduit vers la suite ?**  \n→ ${generic.fil}\n\n` +
      `2. **Quels personnages/lieux réapparaissent ?**  \n→ ${generic.pers}\n\n` +
      `3. **Qu’a révélé ${prev} sur Dieu ?**  \n→ ${generic.dieu}\n\n` +
      `4. **Quelles tensions commencent à se résoudre ?**  \n→ ${generic.tensions}\n\n` +
      `5. **Quelle attente la clôture suscitait-elle ?**  \n→ ${generic.attente}`
    );
  }
  const ref = `${book} ${chapter}`;
  return (
    `**Questions d’introduction**  \n` +
    `*Référence :* ${ref}\n\n` +
    `1. **Quel horizon s’ouvre ?**  \n→ Souveraineté de Dieu et finalité salvifique.\n\n` +
    `2. **Comment l’homme est-il situé ?**  \n→ Créature appelée à vivre de la Parole et de l’Alliance.\n\n` +
    `3. **Quels thèmes structurants ?**  \n→ Création/providence, promesse/jugement, sagesse/folie, appel/obéissance.`
  );
}

function buildRubrique4_Canonicite({ book, chapter, analysis }){
  const ref=`${book} ${chapter}`; const motifs=(analysis.topWords||[]).slice(0,5).join(', ');
  const p=[];
  p.push(`**Canonicité et cohérence**`);
  p.push(`*Référence :* ${ref}\n`);
  p.push(`Ce chapitre prend sa pleine mesure dans l’économie du canon, où promesse et accomplissement se répondent. La Bible déroule l’histoire unique du salut, de la création à l’envoi de l’Église. Les motifs (${motifs}) relèvent d’une pédagogie divine: mêmes vérités dans des contextes variés, pour former un peuple intelligent et obéissant.`);
  p.push(`Les résonances proches/lointaines (Ps 119; Pr 1:7; prédication prophétique; Lc 24:27; Jn 5:39) manifestent l’unité d’un dessein fidèle. La diversité des genres sert une finalité: la communion du pécheur réconcilié avec Dieu.`);
  p.push(`Cohérence à trois niveaux: **théologique** (Dieu sujet véritable), **narratif** (progrès du propos), **ecclésial** (doctrine, culte, vie). Concrètement, replacer ${ref} dans l’unité biblique affine les appels: vérité qui sauve, obéissance fruit de la fidélité première, jugement en vue de la vie.`);
  return inflateToRange(p.join('\n\n'),2000,2500,{book,chapter});
}

function buildRubrique5_Testament({ book, chapter, analysis }){
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0, 5).join(', ');
  const t = [];
  t.push(`**Ancien/Nouveau Testament : continuité, accomplissement, lumière réciproque**`);
  t.push(`*Référence :* ${ref}\n`);
  t.push(`L’Ancien prépare/annonce/typologise; le Nouveau dévoile/accomplit/interprète. La révélation progresse selon l’Alliance. La continuité n’est pas uniformité; la nouveauté n’est pas opposition.`);
  t.push(`Promesse/accomplissement (2 Co 1:20), loi/évangile (Rm 3–8; Ga), Esprit/Église (Jl 3 → Ac 2). ${ref} assume et prolonge l’Ancien. Motifs (${motifs}) : pédagogie par répétition et variation.`);
  t.push(`Deux excès à éviter: **verset isolé** et **opposition stérile** AT/NT. La même voix appelle au repentir et à la confiance. La vérité reçue devient prière, obéissance, témoignage.`);
  return inflateToRange(t.join('\n\n'), 2000, 2500, { book, chapter });
}

/* ==== MODE COURT (6–27) : 22 items ==== */
function basic({book,chapter}, title, body){
  return `${title}  \n*Référence :* ${book} ${chapter}\n\n${body}`;
}
function buildPromesses(ctx){return basic(ctx,'**Promesses**','Dieu prend l’initiative, soutient l’espérance et appelle à la fidélité.');}
function buildPecheEtGrace(ctx){return basic(ctx,'**Péché et grâce**','Diagnostic vrai; grâce première et suffisante.');}
function buildChristologie(ctx){return basic(ctx,'**Christologie**','Le Christ éclaire toute l’Écriture (Lc 24:27; Jn 5:39).');}
function buildEspritSaint(ctx){return basic(ctx,'**Esprit Saint**','Il illumine, convainc, sanctifie et envoie.');}
function buildAlliance(ctx){return basic(ctx,'**Alliance**','Don, vocation, responsabilité dans l’Alliance.');}
function buildEglise(ctx){return basic(ctx,'**Église**','Peuple façonné par Parole & sacrements.');}
function buildDisciples(ctx){return basic(ctx,'**Discipulat**','Appel, apprentissage, persévérance.');}
function buildEthique(ctx){return basic(ctx,'**Éthique**','La morale découle de l’Évangile.');}
function buildPriere(ctx){return basic(ctx,'**Prière**','Supplication, action de grâce, intercession.');}
function buildMission(ctx){return basic(ctx,'**Mission**','Témoigner et servir avec humilité.');}
function buildEsperance(ctx){return basic(ctx,'**Espérance**','La fin nourrit la fidélité présente.');}
function buildExhortation(ctx){return basic(ctx,'**Exhortation**','Marcher selon la lumière reçue.');}
function buildApplicationPerso(ctx){return basic(ctx,'**Application personnelle**','Actes précis: renoncer, choisir, servir.');}
function buildApplicationCollective(ctx){return basic(ctx,'**Application communautaire**','Unité, sainteté, service mutuel.');}
function buildLiturgie(ctx){return basic(ctx,'**Liturgie**','Le culte façonne la semaine.');}
function buildMeditation(ctx){return basic(ctx,'**Méditation**','Garder, ruminer, pratiquer (inclut verset-clé).');}
function buildTypologie(ctx){return basic(ctx,'**Typologie**','Figures et accomplissements en Christ.');}
function buildTheologieSystematique(ctx){return basic(ctx,'**Théologie systématique**','Loci: Dieu, Christ, Esprit, Église, Salut.');}
function buildHistoireDuSalut(ctx){return basic(ctx,'**Histoire du salut**','De la promesse à l’accomplissement.');}
function buildDoutesObjections(ctx){return basic(ctx,'**Doutes/objections**','Répondre avec patience et Écriture (inclut thèmes secondaires).');}
function buildSynthese(ctx){return basic(ctx,'**Synthèse**','Fil doctrinal et pas d’obéissance.');}
function buildPlanDeLecture(ctx){return basic(ctx,'**Plan de lecture**','Lire, prier, pratiquer, témoigner.');}

/* === Prière de clôture (28) === */
function buildClosingPrayer({ book, chapter }) {
  const ref = `${book} ${chapter}`;
  return (
    `**Prière de clôture**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Père, je te rends grâce pour la lumière consentie. Ce chapitre a repris mes pas, ` +
    `corrigé mes illusions et établi mon cœur dans l’espérance. Grave en moi ce que tu as enseigné; ` +
    `fais mûrir ce que tu as semé. Donne-moi d’aimer la vérité plus que mon confort, de chercher la paix ` +
    `sans renoncer à la justice, et d’obéir sans dureté. Que l’Esprit Saint convertisse mes habitudes, ` +
    `règle mes paroles et dilate ma charité. Je veux marcher humblement avec toi, dans la joie simple ` +
    `de celui qui a été rejoint. Au nom de Jésus-Christ, amen.`
  );
}

/* ====== Aides ====== */
function inflateToRange(text, min, max, ctx) {
  let t = String(text || '').trim();
  if (t.length >= min && t.length <= max) return t;

  const add = [];
  add.push(
    ` Cette lecture s’inscrit dans le canon (Ps 119; Hé 4:12; 2 Tm 3:14-17): ` +
    `la Parole reçue fonde l’obéissance et nourrit l’espérance.`
  );
  add.push(
    ` Elle suppose prière et communion (Ac 2:42; Ép 4:11-16), ` +
    `afin que l’intelligence devienne fidélité durable.`
  );
  add.push(
    ` Enfin, ${ctx.book} ${ctx.chapter} invite à discerner la providence par laquelle Dieu conduit son peuple ` +
    `vers la maturité (Rm 8:28-30; 1 P 1:3-9).`
  );

  let i = 0;
  while (t.length < min && i < add.length) t += add[i++];

  if (t.length > max) {
    const cut = t.slice(0, max);
    const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = cut.slice(0, last > 0 ? last + 1 : max).trim();
  }
  return t;
}

function escapeReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function normalizeWhitespace(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function truncateForLine(s, max){
  const t=normalizeWhitespace(s);
  if(t.length<=max) return t;
  const cut=t.slice(0,max);
  const sp=cut.lastIndexOf(' ');
  return (sp>60?cut.slice(0,sp):cut).trim()+'…';
}
function normBook(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
}

/* ===== Helper doctrinal long (2000–2500) ===== */
function buildLongDoctrineSection(ctx, { title, thesis, axes, canons, praxis, scelle }) {
  const { book, chapter, analysis } = ctx;
  const ref = `${book} ${chapter}`;
  const mots = (analysis?.topWords || []).slice(0, 6).join(', ');
  const themes = analysis?.themes || [];
  const accent =
    themes.includes('grâce') ? `La **grâce** demeure l’horizon: initiative divine et relèvement durable. `
  : themes.includes('loi') ? `La **Loi** joue son rôle pédagogique: dévoiler la vérité et régler la réponse fidèle. `
  : themes.includes('alliance') ? `L’**Alliance** structure l’interprétation: promesse, signe, fidélité. `
  : themes.includes('péché') ? `Le **péché** est nommé pour conduire à la vie, non au découragement. `
  : themes.includes('création') ? `La **création** et la providence élargissent la perspective. `
  : themes.includes('royaume') ? `Le **Royaume** affleure: règne de Dieu et appel. `
  : `Dieu parle, l’homme répond, la vérité libère. `;

  const p = [];
  p.push(`${title}  \n*Référence :* ${ref}\n`);
  p.push(`${thesis} ${book} ${chapter} agence des motifs (${mots}) pour former le discernement. ${accent}`);

  if (axes?.length) {
    p.push('\n**Axes de lecture**');
    axes.forEach((ax, i) => p.push(`${i + 1}. ${ax}`));
  }
  if (canons?.length) {
    p.push('\n**Résonances canoniques** — La Bible éclaire la Bible (Lc 24:27; Jn 5:39).');
    canons.forEach(c => p.push(`- ${c}`));
  }
  if (praxis?.length) {
    p.push('\n**Praxis / Mise en œuvre** — La doctrine règle la vie ordinaire:');
    praxis.forEach(x => p.push(`- ${x}`));
  }
  p.push('\n' + (scelle || `**Prière** — Inscris cette vérité dans nos cœurs pour une obéissance paisible. Amen.`));

  return inflateToRange(p.join('\n'), 2000, 2500, ctx);
}

/* ==== Versions LONGUES (6–27) ==== */

// 6 — Promesses (spécifique Genèse 1 = EXACTEMENT le texte fourni)
function buildPromessesLong(ctx){
  const { book, chapter } = ctx;
  if (normBook(book) === 'genese' && String(chapter) === '1') {
    return (
`Promesses  
*Référence :* Genèse 1

Les promesses divines ne sont pas des slogans pieux, mais des actes de parole par lesquels Dieu s’engage publiquement et efficacement, dans le cadre de l’Alliance, à produire un avenir qu’il réalise lui-même. Déjà en Genèse 1, la promesse est en germe au cœur de l’efficacité créatrice: «Dieu dit… et il en fut ainsi». La Parole qui fait être est aussi la Parole qui fait espérer. Le Dieu qui sépare, nomme et ordonne ne laisse pas le monde à l’indétermination; il inscrit la création dans une téléologie: qu’elle reflète sa bonté et qu’elle devienne habitation de l’humain appelé à l’image. Ainsi, la première pédagogie de la promesse consiste à stabiliser la réalité par une parole fiable; la confiance peut naître, non d’un optimisme naturel, mais d’une fidélité première.

La promesse biblique comporte quatre traits. (1) Initiative souveraine: elle vient d’en haut, précède toute œuvre humaine et ne se fonde ni sur le mérite ni sur la vraisemblance des circonstances. (2) Contenu déterminé: Dieu ne promet pas vaguement le “bien-être”, il annonce des biens précis (vie, présence, fécondité, repos, bénédiction) qui s’enracinent dans son dessein. (3) Caractère performatif: parce que Dieu est vrai, sa parole fait ce qu’elle dit; le délai apparent n’infirme pas la certitude, il éduque la patience et purifie l’attente. (4) Orientation christologique: toute promesse converge vers le Oui définitif en Jésus-Christ; la création ordonnée prépare l’économie du salut où la grâce restaure et mène à l’achèvement.

Pastoralement, la promesse délivre de deux dérives. D’un côté, l’auto-assurance religieuse qui prétend fabriquer l’avenir par la technique spirituelle; de l’autre, le fatalisme qui se résigne à l’informe. La promesse enseigne la foi obéissante: recevoir aujourd’hui la parole fiable, poser l’acte proportionné (garder, cultiver, bénir, sanctifier), et laisser Dieu tenir ce qu’il a dit selon son temps. Elle apprend aussi la lecture canonique: on n’isole pas des fragments; on discerne la trame — création, bénédiction, sabbat — comme prémices d’une Alliance qui conduit d’Adam à Abraham, d’Israël au Christ, puis à l’Église dans l’Esprit. Ainsi, Genèse 1 n’est pas seulement un prologue cosmique: c’est le laboratoire de l’espérance où l’on voit, à l’état pur, que ce que Dieu ordonne, il l’accomplit, et que ce qu’il bénit, il le porte jusqu’à sa plénitude.`
    ).trim();
  }
  return buildLongDoctrineSection(ctx,{
    title:'**Promesses**',
    thesis:`Les promesses sont des **actes de parole** par lesquels Dieu garantit un avenir qu’il réalise lui-même, dans le cadre de l’Alliance.`,
    axes:[
      `**Promesse & serment** (Hé 6:13–20)`,
      `**Temps de Dieu** (2 P 3:9)`,
      `**Christ accomplissement** (2 Co 1:20)`,
      `**Foi obéissante** — espérance qui sanctifie`
    ],
    canons:[`Gen 12; 15`,`Ps 89`,`Luc 1–2`,`Rom 4`],
    praxis:[`Résister au court-termisme`,`Lire les promesses comme appels à vivre saintement`,`Consoler sans relâcher l’exigence`]
  });
}

function buildPecheEtGraceLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Péché et grâce**',
  thesis:`Le **péché** est révolte objective et corruption intérieure; la **grâce** est initiative souveraine qui pardonne, renouvelle et agrège à l’Alliance.`,
  axes:[`**Vérité du péché** (Rm 3)`,`**Priorité de la grâce** (Ép 2:1–10)`,`**Conversion** — repentance & foi`,`**Sanctification** (Tt 2:11–14)`],
  canons:[`Gen 3`,`Ps 51`,`Rm 5–8`],
  praxis:[`Confession régulière`,`Refuser autojustification & désespoir`,`Accueillir la grâce transformatrice`]
});}
function buildChristologieLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Christologie**',
  thesis:`Le Christ, vrai Dieu et vrai homme, est **clé herméneutique** et centre de l’économie du salut.`,
  axes:[`**Personne** — une personne, deux natures`,`**Œuvre** — incarnation, croix, résurrection, ascension`,`**Royaume** — déjà/pas encore`,`**Union au Christ** (Rm 6)`],
  canons:[`És 53`,`Ps 2; 110`,`Col 1:15–20`,`Hébreux`],
  praxis:[`Adoration centrée sur le Christ`,`Vivre de l’union au Christ`,`Éthique enracinée dans l’identité`]
});}
function buildEspritSaintLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Esprit Saint**',
  thesis:`L’Esprit est Dieu: il illumine, convertit, sanctifie, édifie l’Église et envoie en mission.`,
  axes:[`**Illumination** (Jn 16)`,`**Nouvelle naissance** (Jn 3)`,`**Édification** (1 Co 12–14)`,`**Mission** (Ac 1:8)`],
  canons:[`Jl 3 → Ac 2`,`Rm 8`],
  praxis:[`Demander sa conduite`,`Exercer les dons avec charité et ordre`,`Relier piété et mission`]
});}
function buildAllianceLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Alliance**',
  thesis:`Dieu se donne par promesse et commandement et forme un peuple; tout converge en la **Nouvelle Alliance**.`,
  axes:[`**Variations** — Noé, Abraham, Sinaï, David, Nouvelle`,`**Signes** — circoncision/baptême; Pâque/Cène`,`**Fidélité de Dieu** & responsabilité du peuple`,`**Christ médiateur**; Esprit scellé`],
  canons:[`Gen 12; 15; 17`,`Ex 19–24`,`Jr 31:31–34`,`Lc 22:20; Hé 8–10`],
  praxis:[`Écoute, signes, obéissance`,`Mémorial des œuvres de Dieu`,`Recevoir la discipline paternelle`]
});}
function buildEgliseLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Église**',
  thesis:`Peuple convoqué par la Parole, rassemblé par l’Esprit autour du Christ; une, sainte, catholique, apostolique.`,
  axes:[`**Parole & sacrements**`,`**Gouvernance servante**; discipline`,`**Unité dans la diversité** des dons`,`**Sainteté hospitalière**`],
  canons:[`Ac 2:42–47`,`Ép 4`,`1 P 2`],
  praxis:[`Ancrer Parole & prière`,`Charité ordonnée`,`Servir la cité sans se dissoudre`]
});}
function buildDisciplesLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Discipulat**',
  thesis:`Être disciple: apprendre du Christ pour lui ressembler; la grâce rend l’apprentissage possible.`,
  axes:[`**Appel & réponse** (Mc 1)`,`**Formation** — Parole, épreuves, communauté`,`**Obéissance concrète**`,`**Persévérance** — croix quotidienne`],
  canons:[`Mt 5–7`,`Jn 13–17`,`Hé 12`],
  praxis:[`Rythme: Écriture, prière, accompagnement`,`Pas obéissants précis`,`Recevoir pour donner`]
});}
function buildEthiqueLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Éthique**',
  thesis:`L’éthique découle de l’Évangile: vérité & miséricorde, justice & paix.`,
  axes:[`**Fondement** — Dieu saint, image, loi accomplie en l’amour`,`**Vertus** — foi, espérance, charité`,`**Discernement** — conscience éclairée`,`**Communauté** — correction fraternelle`],
  canons:[`Ex 20; Dt 6`,`Rm 12–15`,`Jacques`],
  praxis:[`Examiner ses pratiques`,`Habitudes vertueuses`,`Justice sans perdre la miséricorde`]
});}
function buildPriereLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Prière**',
  thesis:`Réponse confiante à la Parole; structurée par le Notre Père; nourrie par l’Esprit.`,
  axes:[`**Adoration & action de grâce**`,`**Confession & intercession**`,`**Demande filiale** (Lc 11)`,`**Rythme communautaire**`],
  canons:[`Psaumes`,`Mt 6`,`Rm 8:26–27`],
  praxis:[`Rythme simple et durable`,`Sujets précis & mémorial des exaucements`,`Prier la Parole lue`]
});}
function buildMissionLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Mission**',
  thesis:`Le Père envoie le Fils; l’Esprit envoie l’Église: témoigner, servir, faire des disciples.`,
  axes:[`**Évangélisation** fidèle et humble`,`**Justice & miséricorde** — signes du Royaume`,`**Implantation & formation**`,`**Souffrance & joie**`],
  canons:[`Mt 28:18–20`,`Actes`,`1 Th`],
  praxis:[`Témoigner dans son réseau`,`Relier parole et service`,`Soutenir par prière et dons`]
});}
function buildEsperanceLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Espérance**',
  thesis:`Fondée sur la **résurrection** et la nouvelle création; elle transforme la persévérance.`,
  axes:[`**Résurrection** (1 Co 15)`,`**Jugement** — justice pour les victimes`,`**Nouvelle création** (Ap 21–22)`,`**Vigilance** — enfants du jour`],
  canons:[`Rm 8`,`1 P 1:3–9`,`Apocalypse`],
  praxis:[`Lire les épreuves à la lumière de la fin`,`Signes de vie nouvelle dès maintenant`,`Consoler avec compétence`]
});}
function buildExhortationLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Exhortation**',
  thesis:`Appel paternel fondé sur l’Évangile, orientant la marche concrète du peuple.`,
  axes:[`**Rappeler l’Évangile**`,`**Nommer** le bien et le mal`,`**Encourager** la persévérance`,`**Accompagner** avec douceur`],
  canons:[`Hé 3:13; 10:24–25`,`Ép 4–6`],
  praxis:[`Exhorter sans écraser`,`Relier appel public et soins personnels`,`Mesurer des progrès concrets`]
});}
function buildApplicationPersoLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Application personnelle**',
  thesis:`La vraie application naît de la doctrine reçue: intelligence → conscience → volonté.`,
  axes:[`**Examiner** ses habitudes`,`**Décider** un pas clair`,`**Redevabilité** fraternelle`,`**Célébrer** la grâce à l’œuvre`],
  canons:[`Jac 1:22–25`,`Ps 139:23–24`],
  praxis:[`Résolution concrète liée au chapitre`,`Revue & action de grâce`,`Prière + action`]
});}
function buildApplicationCollectiveLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Application communautaire**',
  thesis:`Dieu façonne un peuple: doctrine, liturgie, diaconie, mission, fraternité.`,
  axes:[`**Unité doctrinale essentielle**`,`**Liturgie formative**`,`**Diaconie** concrète`,`**Mission locale**`],
  canons:[`Ac 2:42–47`,`Ép 4`],
  praxis:[`Auditer à la lumière du chapitre`,`Planifier: former, prier, servir`,`Mesurer: paix, justice, joie`]
});}
function buildLiturgieLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Liturgie**',
  thesis:`Le culte façonne l’amour: pédagogie de l’Évangile; Parole & sacrements ordonnent la semaine.`,
  axes:[`**Appel/Confession/Annonce**`,`**Lecture & prédication**`,`**Sacrements**`,`**Envoi**`],
  canons:[`És 6`,`Lc 24`,`Ac 2`],
  praxis:[`Préparer le cœur`,`Chanter vrai`,`Relier dimanche et semaine`]
});}
function buildMeditationLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Méditation**',
  thesis:`Ruminer la Parole jusqu’à façonner affections et choix (inclut verset-clé).`,
  axes:[`**Lenteur**`,`**Mémoire** — sélectionner un verset clé`,`**Affection**`,`**Action**`],
  canons:[`Ps 1`,`Jos 1:8`,`Ps 119:11`],
  praxis:[`Verset clé matin/soir`,`Note “lumière / action / prière”`,`Partager un fruit de méditation`]
});}
function buildTypologieLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Typologie**',
  thesis:`Reconnaître les **figures** par lesquelles Dieu prépare l’intelligence du Christ, sans violence du sens.`,
  axes:[`**Repérer** motifs: roi, prophète, temple, exode`,`**Vérifier** contexte/canon`,`**Orienter** vers le Christ`,`**Distinguer** typologie/allégorie`],
  canons:[`Mt — accomplissements`,`Hé — temple/sacrifices`],
  praxis:[`Lire les figures pour adorer le Christ`,`Sobriété exégétique`,`Éviter sur-lectures symbolistes`]
});}
function buildTheologieSystematiqueLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Théologie systématique**',
  thesis:`Ordonner les **loci** (Dieu, Christ, Esprit, Écriture, Église, Salut, Fins) pour une confession cohérente.`,
  axes:[`**Sola Scriptura**`,`**Analogie de la foi**`,`**Hiérarchie des vérités**`,`**Finalité pastorale**`],
  canons:[`2 Tm 3:14–17`,`Hé 4:12`],
  praxis:[`Relier lecture suivie et synthèse`,`Repérer centre/périphérie`,`Confesser avec l’Église`]
});}
function buildHistoireDuSalutLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Histoire du salut**',
  thesis:`Une seule économie: création, chute, promesse, élection, loi, prophètes, Christ, Église, Parousie.`,
  axes:[`**Promesse/Accomplissement**`,`**Crise/Relèvement**`,`**Déjà/Pas encore**`,`**Peuple/Toutes nations**`],
  canons:[`Gen → Apoc`,`Lc 24`],
  praxis:[`Lire chaque chapitre comme station du salut`,`Mémorial des œuvres de Dieu`,`Espérance située`]
});}
function buildDoutesObjectionsLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Doutes/objections**',
  thesis:`Réponses patientes: précision exégétique, clarté doctrinale, accompagnement pastoral (inclut thèmes secondaires).`,
  axes:[`**Écouter** la vraie question`,`**Clarifier** genre/contexte/canon`,`**Relier** à l’Évangile`,`**Accompagner** — temps & prière`],
  canons:[`1 P 3:15`,`Jude 22–23`],
  praxis:[`Espace de questions franc`,`Ressources fiables progressives`,`Chemin de maturité dans l’Église`]
});}
function buildSyntheseLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Synthèse**',
  thesis:`Recueillir le fil doctrinal, ordonner les résonances (y c. thèmes secondaires), désigner le pas d’obéissance pour aujourd’hui.`,
  axes:[`**Vérité sur Dieu**`,`**Diagnostic sur l’homme**`,`**Chemin en Christ**`,`**Fruit** — prière/obéissance/témoignage`],
  canons:[`Ps 119`,`Rm 12`],
  praxis:[`Formuler une phrase-synthèse`,`Choisir un pas concret`,`Partager la grâce reçue`]
});}
function buildPlanDeLectureLong(ctx){return buildLongDoctrineSection(ctx,{
  title:'**Plan de lecture**',
  thesis:`La Parole forme par **durée**: discipline simple, joyeuse, communautaire.`,
  axes:[`**Rythme** — AT/NT/Psaumes`,`**Profondeur** — Observation/Interprétation/Application`,`**Communauté** — partage/redevabilité/intercession`,`**Souplesse** — adapter sans culpabiliser`],
  canons:[`Jos 1:8`,`Ac 17:11`],
  praxis:[`Plan 4–6 semaines lié au livre`,`Journal “lumière / action / prière”`,`RDV fraternel bi-hebdo`]
});}

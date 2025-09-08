// api/generate-study.js
// Étude 28 points + Rubrique 0 en tête (API api.bible)
// - Entrée: ?book=Genèse&chapter=1[|1:1|1:1-9][&version=LSG|DARBY|NEG|SEM][&long=1|0]
// - Requiert: API_BIBLE_KEY, DARBY_BIBLE_ID (optionnels: LSG_BIBLE_ID, NEG_BIBLE_ID, SEM_BIBLE_ID)
// - Front intact: renvoie { sections:[{n,content}, ...] } avec Rubrique 0 en premier

export default async function handler(req, res) {
  try {
    const { book, chapter: chapterParam } = req.query || {};
    if (!book || !chapterParam) {
      return res.status(400).json({ error: 'Paramètres requis: book, chapter' });
    }

    const { chapterNum, chapterRef } = normalizeChapter(String(chapterParam));
    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = (req.query?.bibleId && String(req.query.bibleId))
      || pickBibleIdFromVersion(req.query?.version)
      || process.env.DARBY_BIBLE_ID || '';

    const refForApi     = `${book} ${chapterRef}`;
    const refForChapter = `${book} ${chapterNum}`;

    // 1) Passage (texte brut) pour une analyse légère
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
      } catch (e) { console.error('[api.bible/passages] error', e); }
    }
    if (!passageText) passageText = `(${refForApi}) — passage non récupéré ; analyse doctrinale sans texte intégral.`;

    const analysis = lightAnalyze(passageText, { book, chapter: chapterNum });

    // 1bis) Tous les versets du chapitre (une seule fois)
    const chapterVerses = await fetchChapterVerses({ book, chapter: chapterNum, apiKey, bibleId });

    // 2) Sections
    const sections = [];

    // 0 — Panorama (utilise chapterVerses si dispo)
    const rubrique0 = await buildRubrique0_VersesOverview({
      book, chapterForFilter: chapterNum, apiKey, bibleId, analysis, chapterVerses
    });
    sections.push({ n: 0, content: rubrique0 });

    // 1–5 — inchangées
    sections.push({ n: 1, content: buildOpeningPrayer({ book, chapter: chapterNum }) });
    sections.push({ n: 2, content: buildRubrique2({ book, chapter: chapterNum, analysis, passageText }) });
    sections.push({ n: 3, content: buildPrevChapterQnA({ book, chapter: chapterNum }) });
    sections.push({ n: 4, content: buildRubrique4_Canonicite({ book, chapter: chapterNum, analysis }) });
    sections.push({ n: 5, content: buildRubrique5_Testament({ book, chapter: chapterNum, analysis }) });

    // 6–27 — mode long par défaut (= comme si &long=1)
    const useLong = (() => {
      const q = String(req?.query?.long ?? '').trim();
      return q === '' ? true : /^1|true|yes$/i.test(q) && !/^(0|false|no)$/i.test(q);
    })();

    // ====== CONFIG SÉMANTIQUE PAR RUBRIQUE (regex sans accents) ======
    const rxCfg = {
      6:  ['promess','bened','serment','fecond','multipl','croi','puissan'],
      7:  ['pech','faute','iniquit','transgress','grac','misericord','pardon'],
      8:  ['oint','messie','roi','berger','liberat','sauver'],
      9:  ['esprit','souffl','craign','sage-femme','sages-femmes','sage femme'],
      10: ['alliance','serment','signe','statut','fecond','multipl','peuple','israel'],
      11: ['peuple','assemble','congreg','fils d israel','enfants d israel','tribu'],
      12: ['suivre','obe','ecout','march','garder','ordon','selon l ordre','selon le commandement'],
      13: ['just','droit','loi','command','equite','verit','statut','ordonn'],
      14: ['prier','invoqu','crier','louer','benir','souvenir'],
      15: ['nation','peuple','annonc','envoy','temoi','etendard','camp'],
      16: ['esper','attendr','avenir','repos','bened'],
      17: ['gardez','ne ','craign','ecout','servez','souven'],
      18: ['coeu','voie','march','garder','agir','crain'],
      19: ['freres','peuple','assemble','loi','statut','ordonnance','tribu'],
      20: ['sabbat','culte','sanctifi','offr','fete','repos','tabernacle','levit'],
      21: ['medit','penser','souvenir','consider','garder dans le coeur'],
      22: ['image','ombre','figure','modele','prototype','prefiguration'],
      23: ['dieu','parole','loi','justice','grac','royaume'],
      24: ['commencement','genealog','promess','exode','alliance','souven','recense'],
      25: ['pourquoi','comment','question','contester','douter'],
      26: ['voici','ainsi','c est pourquoi','afin que','conclusion'],
      27: ['jour','matin','soir','parole','loi','psaume','lecture']
    };

    // ====== BUILDERS LONGS (différenciés par rubrique) ======
    const buildLong = {
      6:  (ctx)=> buildPromessesLong(ctx),
      7:  (ctx)=> buildFromKeywords(ctx, 7,  { title:'**Péché et grâce**',            rx: rxCfg[7]  }),
      8:  (ctx)=> buildFromKeywords(ctx, 8,  { title:'**Christologie**',              rx: rxCfg[8]  }),
      9:  (ctx)=> buildFromKeywords(ctx, 9,  { title:'**Esprit Saint**',              rx: rxCfg[9],  preferLocal:true }),
      10: (ctx)=> buildFromKeywords(ctx, 10, { title:'**Alliance**',                  rx: rxCfg[10], preferLocal:true }),
      11: (ctx)=> buildFromKeywords(ctx, 11, { title:'**Église**',                    rx: rxCfg[11] }),
      12: (ctx)=> buildFromKeywords(ctx, 12, { title:'**Discipulat**',                rx: rxCfg[12] }),
      13: (ctx)=> buildFromKeywords(ctx, 13, { title:'**Éthique**',                   rx: rxCfg[13] }),
      14: (ctx)=> buildFromKeywords(ctx, 14, { title:'**Prière**',                    rx: rxCfg[14] }),
      15: (ctx)=> buildFromKeywords(ctx, 15, { title:'**Mission**',                   rx: rxCfg[15] }),
      16: (ctx)=> buildFromKeywords(ctx, 16, { title:'**Espérance**',                 rx: rxCfg[16] }),
      17: (ctx)=> buildFromKeywords(ctx, 17, { title:'**Exhortation**',               rx: rxCfg[17] }),
      18: (ctx)=> buildFromKeywords(ctx, 18, { title:'**Application personnelle**',   rx: rxCfg[18] }),
      19: (ctx)=> buildFromKeywords(ctx, 19, { title:'**Application communautaire**', rx: rxCfg[19] }),
      20: (ctx)=> buildFromKeywords(ctx, 20, { title:'**Liturgie**',                  rx: rxCfg[20] }),
      21: (ctx)=> buildFromKeywords(ctx, 21, { title:'**Méditation**',                rx: rxCfg[21], includeMemoryVerse:true }),
      22: (ctx)=> buildFromKeywords(ctx, 22, { title:'**Typologie**',                 rx: rxCfg[22] }),
      23: (ctx)=> buildFromKeywords(ctx, 23, { title:'**Théologie systématique**',    rx: rxCfg[23] }),
      24: (ctx)=> buildFromKeywords(ctx, 24, { title:'**Histoire du salut**',         rx: rxCfg[24] }),
      25: (ctx)=> buildFromKeywords(ctx, 25, { title:'**Doutes/objections**',         rx: rxCfg[25] }),
      26: (ctx)=> buildFromKeywords(ctx, 26, { title:'**Synthèse**',                  rx: rxCfg[26], foldSecondaryThemes:true }),
      27: (ctx)=> buildFromKeywords(ctx, 27, { title:'**Plan de lecture**',           rx: rxCfg[27] })
    };

    // ====== BUILDERS COURTS ======
    const buildShort = {
      6:  buildPromesses, 7:  buildPecheEtGrace, 8:  buildChristologie, 9:  buildEspritSaint,
      10: buildAlliance,  11: buildEglise,       12: buildDisciples,    13: buildEthique,
      14: buildPriere,    15: buildMission,      16: buildEsperance,    17: buildExhortation,
      18: buildApplicationPerso, 19: buildApplicationCollective, 20: buildLiturgie,
      21: buildMeditation, 22: buildTypologie, 23: buildTheologieSystematique,
      24: buildHistoireDuSalut, 25: buildDoutesObjections, 26: buildSynthese, 27: buildPlanDeLecture
    };

    // Partage pour anti-doublon inter-rubriques
    const shared = { usedVerses: new Set() };

    for (let n = 6; n <= 27; n++) {
      const ctx = { book, chapter: chapterNum, analysis, passageText, apiKey, bibleId, refForChapter, chapterVerses, shared, rubricId:n };
      try {
        const content = useLong ? await buildLong[n](ctx) : buildShort[n](ctx);
        sections.push({ n, content });
      } catch (e) {
        console.error(`[rubrique ${n}]`, e);
        sections.push({ n, content: basic(ctx, `**Rubrique ${n}**`, '— contenu non disponible (erreur interne).') });
      }
    }

    // 28 — prière de clôture
    sections.push({ n: 28, content: buildClosingPrayer({ book, chapter: chapterNum }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ====================== Utilitaires api.bible & parsing ====================== */

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
  return String(html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/* ---- Charge tous les versets du chapitre une fois ---- */
async function fetchChapterVerses({ book, chapter, apiKey, bibleId }) {
  const out = [];
  if (!apiKey || !bibleId) return out;
  try {
    const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(`${book} ${chapter}`)}&limit=400`;
    const r = await fetch(url, { headers: { 'api-key': apiKey } });
    if (!r.ok) return out;
    const j = await r.json();
    const raw = Array.isArray(j?.data?.verses) ? j.data.verses : [];
    const prefix = new RegExp(`^${escapeReg(book)}\\s+${escapeReg(String(chapter))}\\s*:\\s*(\\d+)`, 'i');
    for (const v of raw) {
      const ref = v.reference || '';
      const m = prefix.exec(ref);
      if (!m) continue;
      const num = parseInt(m[1], 10);
      if (!Number.isFinite(num)) continue;
      out.push({ verse: num, ref, text: normalizeWhitespace(v.text || '') });
    }
    out.sort((a,b)=>a.verse-b.verse);
  } catch (e) { console.error('[fetchChapterVerses] error', e); }
  return out;
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

/* ====================== Rubrique 0 — Panorama ====================== */
async function buildRubrique0_VersesOverview({ book, chapterForFilter, apiKey, bibleId, analysis, chapterVerses }) {
  const ref = `${book} ${chapterForFilter}`;
  let verses = Array.isArray(chapterVerses) && chapterVerses.length ? chapterVerses : [];

  if (!verses.length && apiKey && bibleId) {
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
`**Rubrique 0 — Panorama des versets du chapitre**  
*Référence :* ${ref}

Cette section dresse la **liste des versets** avec une **explication brève** pour orienter lecture, prière et pratique.`;

  if (!verses.length) {
    return head + `

— *Les versets n’ont pas pu être chargés.*

**Conseil de lecture :** repère ouverture, déploiement, clôture; ce que le texte **révèle de Dieu** et **appelle** chez l’homme.`;
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
`**Prière d’ouverture**  
*Référence :* ${ref}

Seigneur, je m’approche de ta Parole avec un cœur qui veut apprendre. Dans ce chapitre, tu parles pour créer, corriger et consoler. Donne-moi de recevoir la vérité sans la tordre, de discerner ce qui vient de toi et d’y répondre avec simplicité. Si tu exposes ta sainteté, que je révère ton Nom; si tu révèles mes égarements, que je confesse et me détourne; si tu ouvres un chemin d’espérance, que je l’embrasse avec foi. Que l’Alliance oriente mon esprit, que l’Évangile règle mes affections, et que l’obéissance devienne ma joie. Je veux une rencontre vraie: fais de cette page un lieu d’écoute, et de mon cœur un terrain docile. Au nom de Jésus-Christ, amen.`
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
`**Questions du chapitre précédent**  
*Référence :* ${prev}

1. **Quel fil narratif conduit vers la suite ?**  
→ ${generic.fil}

2. **Quels personnages/lieux réapparaissent ?**  
→ ${generic.pers}

3. **Qu’a révélé ${prev} sur Dieu ?**  
→ ${generic.dieu}

4. **Quelles tensions commencent à se résoudre ?**  
→ ${generic.tensions}

5. **Quelle attente la clôture suscitait-elle ?**  
→ ${generic.attente}`
    );
  }
  const ref = `${book} ${chapter}`;
  return (
`**Questions d’introduction**  
*Référence :* ${ref}

1. **Quel horizon s’ouvre ?**  
→ Souveraineté de Dieu et finalité salvifique.

2. **Comment l’homme est-il situé ?**  
→ Créature appelée à vivre de la Parole et de l’Alliance.

3. **Quels thèmes structurants ?**  
→ Création/providence, promesse/jugement, sagesse/folie, appel/obéissance.`
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

/* ====================== MODE COURT (6–27) ====================== */
function basic({book,chapter}, title, body){
  return `${title}  \n*Référence :* ${book} ${chapter}\n\n${body}`;
}
function buildPromesses(ctx){return basic(ctx,'**Promesses**','Dieu prend l’initiative, soutient l’espérance et appelle à la fidélité.');}
function buildPecheEtGrace(ctx){return basic(ctx,'**Péché et grâce**','Diagnostic vrai; grâce première et suffisante.');}
function buildChristologie(ctx){return basic(ctx,'**Christologie**','Le Christ éclaire toute l’Écriture (Lc 24:27; Jn 5:39).');}
function buildEspritSaint(ctx){return basic(ctx,'**Esprit Saint**','Il illumine, convainc, sanctifie et envoie.');}
function buildAlliance(ctx){return basic(ctx,'**Alliance**','Cadre de la fidélité de Dieu et de la réponse du peuple.');}
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
function buildDoutesObjections(ctx){return basic(ctx,'**Doutes/objections**','Répondre avec patience et Écriture.');}
function buildSynthese(ctx){return basic(ctx,'**Synthèse**','Fil doctrinal et pas d’obéissance.');}
function buildPlanDeLecture(ctx){return basic(ctx,'**Plan de lecture**','Lire, prier, pratiquer, témoigner.');}

/* ====================== Aides style/longueur/texte ====================== */

function inflateToRange(text, min, max, ctx) {
  let t = String(text || '').trim();
  if (t.length >= min && t.length <= max) return t;
  const add = [];
  add.push(` Cette lecture s’inscrit dans le canon (Ps 119; Hé 4:12; 2 Tm 3:14-17): la Parole reçue fonde l’obéissance et nourrit l’espérance.`);
  add.push(` Elle suppose prière et communion (Ac 2:42; Ép 4:11-16), afin que l’intelligence devienne fidélité durable.`);
  add.push(` Enfin, ${ctx.book} ${ctx.chapter} invite à discerner la providence par laquelle Dieu conduit son peuple vers la maturité (Rm 8:28-30; 1 P 1:3-9).`);
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
function stripAccents(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''); }
function truncateForLine(s, max){
  const t=normalizeWhitespace(s);
  if(t.length<=max) return t;
  const cut=t.slice(0,max);
  const sp=cut.lastIndexOf(' ');
  return (sp>60?cut.slice(0,sp):cut).trim()+'…';
}
function normBook(s){ return stripAccents(String(s||'')).toLowerCase().trim(); }

/* ====================== Générateur long générique avec anti-doublon ====================== */

async function buildFromKeywords(ctx, rubricId, cfg, opts={}) {
  const { book, chapter, analysis, chapterVerses, shared } = ctx;
  const ref = `${book} ${chapter}`;
  const title = cfg?.title || '**Rubrique**';

  // 1) Hits locaux (regex sans accents sur versets)
  let hits = [];
  if (Array.isArray(chapterVerses) && chapterVerses.length && Array.isArray(cfg?.rx)) {
    const pats = cfg.rx.map(p => new RegExp(p, 'i'));
    for (const v of chapterVerses) {
      const txt = stripAccents(v.text).toLowerCase();
      if (pats.some(rx => rx.test(txt))) hits.push(v);
    }
  }
  // 2) Si rien → squelette (départ/milieu/fin) pour rester ancré au chapitre
  if (!hits.length) hits = await fallbackScaffold({ book, chapter, apiKey: ctx.apiKey, bibleId: ctx.bibleId });

  // 3) Anti-doublon inter-rubriques: on écarte versets déjà utilisés
  hits = preferUnique(hits, shared?.usedVerses);

  // 4) Overrides spécifiques (ex.: Nombres 1 pour Discipulat / Éthique)
  const overr = trySpecificOverrides({ rubricId, book, chapter, hits, verses: chapterVerses });
  if (overr && overr.hits && overr.hits.length) hits = overr.hits;

  // 5) Composition différenciée par rubrique (évite clones textuels)
  const body = composeRubricBody({ rubricId, title, ref, hits, analysis, book, chapter });

  // 6) Marque versets utilisés (anti-doublon pour rubriques suivantes)
  if (shared && shared.usedVerses) {
    for (const h of hits) shared.usedVerses.add(h.verse);
  }

  return inflateToRange(body, 2000, 2500, ctx);
}

/* ---- Diversification/anti-doublon ---- */
function preferUnique(hits, usedSet){
  if (!usedSet || !usedSet.size) return hits;
  const uniq = hits.filter(h => !usedSet.has(h.verse));
  if (uniq.length >= Math.min(3, hits.length)) return uniq;
  // si trop peu, on garde une minorité déjà vue mais on priorise du nouveau
  const mix = uniq.concat(hits.filter(h => usedSet.has(h.verse)).slice(0,2));
  return mix.length ? mix : hits;
}

/* ---- Overrides ciblés : Nombres 1 ---- */
function trySpecificOverrides({ rubricId, book, chapter, hits, verses }) {
  const isNb1 = normBook(book)==='nombres' && String(chapter)==='1';
  if (!isNb1 || !Array.isArray(verses) || !verses.length) return null;

  // Utilitaires pour choper certains versets clés
  const byNum = n => verses.find(v => v.verse === n);
  const findRx = (rx) => verses.filter(v => rx.test(stripAccents(v.text).toLowerCase()));

  if (rubricId === 12) { // Discipulat — ordre reçu → obéissance → persévérance
    const v1  = byNum(1) || findRx(/dieu parla a moise|l eternel parla/i)[0];
    const v3  = byNum(3);
    const v17 = byNum(17);
    const v18 = byNum(18);
    const v19 = byNum(19);
    const v54 = byNum(54);
    const arr = [v1,v3,v17,v18,v19,v54].filter(Boolean);
    if (arr.length) return { hits: arr };
  }

  if (rubricId === 13) { // Éthique — normes, responsabilités, équité institutionnelle
    const v2  = byNum(2);
    const v4  = byNum(4);
    const v16 = byNum(16);
    const v17 = byNum(17);
    const v18 = byNum(18);
    const v52 = byNum(52);
    const v53 = byNum(53);
    const v54 = byNum(54);
    const arr = [v2,v4,v16,v17,v18,v52,v53,v54].filter(Boolean);
    if (arr.length) return { hits: arr };
  }

  return null;
}

/* ---- Rédaction spécifique par rubrique ---- */
function composeRubricBody({ rubricId, title, ref, hits, analysis, book, chapter }) {
  const rep = makeRepere(hits);
  const accent = accentFromThemes(analysis);

  // Templates distinctifs (clé = rubriqueId)
  const templates = {
    12: // Discipulat
`${title}  
*Référence :* ${ref}

Le **discipulat** se lit ici comme un itinéraire en trois temps: **appel reçu**, **obéissance concrète**, **persévérance ordonnée**. ${accent}
**Repères textuels** — ${rep}

**1) Appel reçu.** Dieu parle et confie une tâche identifiable (v.${pick(hits,[1,2])}): le recensement structuré des familles. L’autorité vient d’en haut; l’action commence par l’écoute.

**2) Obéissance concrète.** Moïse et Aaron mettent en œuvre l’ordre reçu (v.${pick(hits,[17,18,19])}): convocation, inscription nominale, responsabilité partagée. L’obéissance est méthodique, non impulsive.

**3) Persévérance ordonnée.** La clôture confirme la fidélité “selon l’ordre de l’Éternel” (v.${pick(hits,[54])}). Le discipulat n’est pas un élan passager: c’est une constance qui honore la Parole dans la durée.

**Portée doctrinale.** La grâce précède l’obéissance; l’obéissance n’achète rien, elle **manifeste** la confiance. Le disciple se forme par des actes réglés, au service d’un peuple ordonné.

**Pratique.** Identifier l’instruction de Dieu aujourd’hui, la traduire en étapes claires, confier la marche à la communauté et rendre grâce pour les progrès visibles (même modestes).`,

    13: // Éthique
`${title}  
*Référence :* ${ref}

L’**éthique** biblique n’est pas un moralisme abstrait: elle ordonne la vie commune selon une **finalité** (sainteté, service) et des **normes** explicites. ${accent}
**Repères textuels** — ${rep}

**1) Normes fondatrices.** L’ordre est **commandé** (v.${pick(hits,[2,4])}): critères, âges, chefs, responsabilité “par maison paternelle”. La norme protège les faibles en rendant des comptes.

**2) Responsabilités distribuées.** Des chefs “appelés de l’assemblée” (v.${pick(hits,[16,17,18])}) coopèrent; l’éthique est **institutionnelle** autant qu’individuelle.

**3) Finalité communautaire.** Le dispositif vise la paix de l’ensemble (v.${pick(hits,[52,53,54])}): campement ordonné, proximité du sanctuaire, service lévitique. La “droiture” ne se réduit pas à l’intention; elle prend corps dans des rythmes.

**Portée doctrinale.** Vérité et miséricorde se rejoignent: la norme éclaire, la grâce relève. L’équité découle de la fidélité de Dieu et se vérifie dans la régularité des pratiques.

**Pratique.** Établir des règles claires, expliquer leur finalité, confier des rôles, et mesurer la justice non à l’émotion, mais à la protection réelle du prochain.`
  };

  // Template générique (varié) selon familles de rubriques
  const family = (id)=>{
    if ([6,10,24].includes(id)) return 'histoire';
    if ([7,13,17].includes(id)) return 'normatif';
    if ([8,22,23].includes(id)) return 'dogmatique';
    if ([9,14,21].includes(id)) return 'spirituel';
    if ([11,18,19,27].includes(id)) return 'ecclesial';
    if ([15,16,25,26].includes(id)) return 'missionnel';
    return 'mixte';
  };

  if (templates[rubricId]) return templates[rubricId];

  // Générique varié par "famille" pour éviter les clones textuels
  const base = {
    histoire:
`${title}  
*Référence :* ${ref}

La page articule **mémoire** et **promesse**, inscrivant l’événement dans l’histoire du salut. ${accent}
**Repères textuels** — ${rep}

- **Origine/ordre**: l’initiative de Dieu règle la scène.  
- **Déploiement**: les acteurs répondent dans un cadre précis.  
- **Finalité**: ce mouvement sert la fidélité de Dieu envers son peuple.

Concrètement, il s’agit de lire les signes de la providence, de recevoir la Parole comme boussole, et d’avancer selon l’espérance annoncée.`,

    normatif:
`${title}  
*Référence :* ${ref}

La dimension **normative** apparaît non comme une contrainte arbitraire, mais comme l’ordonnancement d’une vie juste. ${accent}
**Repères textuels** — ${rep}

- **Clarification** des critères et des responsabilités.  
- **Protection** du faible par la structure et la redevabilité.  
- **Finalité** de paix, de sainteté et de service.

Pratiquement: écouter, formuler, appliquer sans dureté ni mollesse, afin que la vérité reçue devienne justice vécue.`,

    dogmatique:
`${title}  
*Référence :* ${ref}

La doctrine se profile dans la narration: elle **confesse** qui est Dieu et **éclaire** l’économie du salut. ${accent}
**Repères textuels** — ${rep}

- **Dieu sujet** du texte, l’homme répond.  
- **Unité canonique**: promesse et accomplissement convergent.  
- **Clé christologique**: la page prépare/éclaire l’œuvre du Fils.

Mise en pratique: garder ensemble vérité et miséricorde; confesser pour marcher.`,

    spirituel:
`${title}  
*Référence :* ${ref}

La vie spirituelle naît de la Parole: **prière**, **illumination**, **obéissance**. ${accent}
**Repères textuels** — ${rep}

- La Parole suscite la crainte filiale et la louange.  
- L’Esprit éclaire et fortifie dans l’épreuve.  
- La prière inscrit la vérité dans les gestes.

Chemin concret: écouter, répondre, persévérer dans une prière réglée.`,

    ecclesial:
`${title}  
*Référence :* ${ref}

La communauté est façonnée par la **Parole** et des **rythmes** partagés. ${accent}
**Repères textuels** — ${rep}

- Appels communs et charges distribuées.  
- Rythmes (rassemblement, service, repos) qui forment.  
- Témoignage vers l’extérieur par la paix intérieure.

En pratique: rôles clairs, service mutuel, unité dans l’écoute.`,

    missionnel:
`${title}  
*Référence :* ${ref}

La page oriente vers la **mission**: fidélité à Dieu, **bénédiction** pour d’autres. ${accent}
**Repères textuels** — ${rep}

- Source: initiative divine.  
- Message: vérité qui libère.  
- Milieu: monde réel, avec ses contraintes.

Pas concrets: dire vrai avec douceur, servir humblement, persévérer.`
  };

  return base[family(rubricId)];
}

/* ---- Aides de composition ---- */
function makeRepere(hits){
  if (!hits || !hits.length) return `Aucun mot-clé strict n’apparaît; lecture par **analogie canonique** en respectant le contexte.`;
  const parts = hits.slice(0,6).map(h => `**${h.ref}**`);
  return parts.join(', ');
}
function pick(hits, prefNums=[]){
  // retourne la première occurrence dont le numéro est dans prefNums ; sinon premier verset
  const set = new Set(prefNums.map(n=>Number(n)));
  const found = hits.find(h => set.has(h.verse));
  return found ? found.verse : (hits[0]?.verse || '?');
}

/* ====================== 6 — Promesses (texte fourni pour Gen 1) ====================== */
async function buildPromessesLong(ctx){
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
  // Sinon: génération différenciée
  return buildFromKeywords(ctx, 6, { title:'**Promesses**', rx:['promess','bened','serment','fecond','multipl','croi','puissan'] });
}

/* ====================== 28 — Prière de clôture ====================== */
function buildClosingPrayer({ book, chapter }) {
  const ref = `${book} ${chapter}`;
  return (
`**Prière de clôture**  
*Référence :* ${ref}

Père, je te rends grâce pour la lumière consentie. Ce chapitre a repris mes pas, corrigé mes illusions et établi mon cœur dans l’espérance. Grave en moi ce que tu as enseigné; fais mûrir ce que tu as semé. Donne-moi d’aimer la vérité plus que mon confort, de chercher la paix sans renoncer à la justice, et d’obéir sans dureté. Que l’Esprit Saint convertisse mes habitudes, règle mes paroles et dilate ma charité. Je veux marcher humblement avec toi, dans la joie simple de celui qui a été rejoint. Au nom de Jésus-Christ, amen.`
  );
}

/* ====================== Fallbacks & utilitaires supplémentaires ====================== */

async function fallbackScaffold({ book, chapter, apiKey, bibleId }) {
  const verses = await fetchChapterVerses({ book, chapter, apiKey, bibleId });
  if (!verses.length) return [];
  const res = [verses[0]];
  const mid = verses[Math.floor(verses.length/2)];
  if (mid && mid.verse !== res[0]?.verse) res.push(mid);
  const last = verses[verses.length-1];
  if (last && last.verse !== res[0]?.verse && last.verse !== mid?.verse) res.push(last);
  return res;
}

function mergeHits(a, b){
  const map = new Map(a.map(x=>[x.verse,x]));
  for (const h of (b||[])) if (!map.has(h.verse)) map.set(h.verse,h);
  return [...map.values()].sort((x,y)=>x.verse-y.verse);
}

function accentFromThemes(analysis){
  const t=analysis?.themes||[];
  return t.includes('grâce') ? `La **grâce** demeure l’horizon; elle précède et relève.`
       : t.includes('loi') ? `La **Loi** joue son rôle pédagogique; elle dévoile et règle.`
       : t.includes('alliance') ? `L’**Alliance** ordonne l’intelligence du passage.`
       : t.includes('péché') ? `Le **péché** est nommé pour conduire à la vie.`
       : t.includes('création') ? `La **création** et la providence élargissent la perspective.`
       : t.includes('royaume') ? `Le **Royaume** affleure: autorité et appel.`
       : `Dieu parle, l’homme répond; la vérité libère.`;
}

/* ====================== Normalisation ====================== */
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

// api/generate-study.js
// Ajout du paramètre ?length=500|1500|2500 pour cadrer la longueur des rubriques.

export default async function handler(req, res) {
  try {
    const { book, chapter, length } = req.query || {};
    if (!book || !chapter) return res.status(400).json({ error: 'Paramètres requis: book, chapter' });

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.DARBY_BIBLE_ID || '';
    const refLabel = `${book} ${chapter}`;

    // Longueur cible (défaut 1500)
    const L = parseInt(length, 10);
    const TARGET = [500,1500,2500].includes(L) ? L : 1500;

    // Passage (pour analyse légère)
    let passageText = '';
    if (apiKey && bibleId) {
      try {
        const u1 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/passages?reference=${encodeURIComponent(refLabel)}&content-type=text`;
        const r1 = await fetch(u1, { headers: { 'api-key': apiKey } });
        if (r1.ok) passageText = extractTextFromApiBible(await r1.json());
        if (!passageText) {
          const u2 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(refLabel)}&limit=1`;
          const r2 = await fetch(u2, { headers: { 'api-key': apiKey } });
          if (r2.ok) passageText = extractTextFromSearch(await r2.json());
        }
      } catch {}
    }
    if (!passageText) passageText = `(${refLabel}) — passage non récupéré chez api.bible ; génération doctrinale assurée.`;

    const analysis = lightAnalyze(passageText, { book, chapter });

    // Rubrique 0 (versets + explications)
    const rubrique0 = await buildRubrique0({ book, chapter, apiKey, bibleId, analysis });

    // Construction des sections
    const sections = [];
    sections.push({ n: 0, content: rubrique0 });

    // 1. Prière d’ouverture
    sections.push({ n: 1, content: fitLength(buildOpeningPrayer({ book, chapter }), TARGET) });

    // 2. Contexte & fil narratif
    sections.push({ n: 2, content: fitLength(buildRubrique2({ book, chapter, analysis, passageText }), TARGET) });

    // 3. Q/R chapitre précédent
    sections.push({ n: 3, content: fitLength(buildPrevChapterQnA({ book, chapter }), TARGET) });

    // 4–5 longues
    sections.push({ n: 4, content: fitLength(buildRubrique4_Canonicite({ book, chapter, analysis }), TARGET) });
    sections.push({ n: 5, content: fitLength(buildRubrique5_Testament({ book, chapter, analysis }), TARGET) });

    // 6–27 sobres → étirables selon TARGET
    const others = [
      buildPromesses, buildPecheEtGrace, buildChristologie, buildEspritSaint, buildAlliance, buildEglise,
      buildDisciples, buildEthique, buildPriere, buildMission, buildEsperance, buildExhortation,
      buildApplicationPerso, buildApplicationCollective, buildLiturgie, buildMeditation, buildMemoVerset,
      buildTypologie, buildTheologieSystematique, buildHistoireDuSalut, buildThemesSecondaires,
      buildDoutesObjections, buildSynthese, buildPlanDeLecture
    ];
    let n = 6;
    for (const fn of others) {
      const raw = fn({ book, chapter, analysis, passageText });
      sections.push({ n, content: fitLength(raw, TARGET) });
      n++;
    }

    // 28. Prière de clôture
    sections.push({ n: 28, content: fitLength(buildClosingPrayer({ book, chapter }), TARGET) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ===== Rubrique 0 ===== */
async function buildRubrique0({ book, chapter, apiKey, bibleId, analysis }) {
  const ref = `${book} ${chapter}`;
  let verses = [];
  if (apiKey && bibleId) {
    try {
      const u = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(ref)}&limit=400`;
      const r = await fetch(u, { headers: { 'api-key': apiKey } });
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
    } catch {}
  }

  const head =
    `**Rubrique 0 — Panorama des versets du chapitre**  \n` +
    `*Référence :* ${ref}\n\n` +
    `Chaque verset du chapitre est listé avec un extrait et une **explication claire**, afin de suivre la progression narrative et doctrinale. ` +
    `Le propos demeure fidèle à la saine doctrine, avec un ton narratif et explicatif.`;

  if (!verses.length) {
    return head + `\n\n— *Versets indisponibles pour le moment.*  \n` +
      `**Conseil de lecture :** repère l’ouverture, le déploiement et la clôture; identifie ce que Dieu révèle de lui-même et la réponse attendue.`;
  }

  const len = verses.length;
  const explain = (i) => {
    const pos = i + 1, t = analysis.themes || [];
    const lead = pos===1 ? `Ouverture: le cadre se pose.` :
                pos===len ? `Clôture: la portée s’affirme.` :
                pos<=Math.ceil(len/3) ? `Mise en route: la thématique s’installe.` :
                pos<=Math.ceil((2*len)/3) ? `Déploiement: les enjeux se précisent.` :
                `Transition: les motifs convergent.`;
    const motif = t.includes('grâce') ? `La **grâce** traverse le texte.` :
                 t.includes('loi') ? `La **loi** règle la réponse.` :
                 t.includes('alliance') ? `L’**Alliance** structure l’espérance.` :
                 t.includes('péché') ? `Le **péché** est nommé pour conduire à la vie.` :
                 t.includes('création') ? `La **création** élargit la perspective.` :
                 t.includes('royaume') ? `Le **Royaume** affleure.` :
                 `Dieu parle; l’homme répond; la vérité libère.`;
    return `${lead} ${motif}`;
  };

  const lines = verses.map((v,i)=>{
    const shown = truncateForLine(v.text, 240);
    return `- **v.${v.verse}** — ${shown}\n  → ${explain(i)}`;
  });

  return head + `\n\n` + lines.join('\n');
}

/* ===== Autres rubriques (identiques à avant), puis fitting ===== */
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

function buildRubrique2({ book, chapter, analysis, passageText }) {
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0, 6).join(', ');
  const t = [];
  t.push(`**Contexte et fil narratif**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(
    `Ce chapitre ne se comprend qu’à l’intérieur d’une architecture plus vaste. L’auteur n’empile pas des scènes, ` +
    `il conduit un itinéraire: ce qui précède pose des repères, ce qui suit reprend et approfondit. La section présente ` +
    `rassemble des motifs ( ${motifs} ) et les agence pour faire ressortir une ligne maîtresse. Le lecteur est guidé d’un ` +
    `repère doctrinal à l’autre: Dieu prend l’initiative, l’être humain répond, et la pédagogie divine façonne un peuple.`
  );
  t.push('');
  t.push(
    `Sur le plan littéraire, la progression se fait par unités cohérentes — récit, discours, oracle ou généalogie — qui convergent ` +
    `vers un **thème directeur**. Les répétitions ne sont pas des redites: elles jouent le rôle d’un marteau doux qui imprime la vérité. ` +
    `Les contrastes forcent le discernement (lumière/ténèbres, fidélité/infidélité, sagesse/folie) et mettent au jour l’appel de Dieu.`
  );
  t.push('');
  t.push(
    `Canoniquement, la page s’éclaire par résonance: création et providence (Psaumes 19; 104), pédagogie de la Loi (Deutéronome 6; Proverbes 1:7), ` +
    `promesse et accomplissement en Christ (Luc 24:27; Jean 5:39). Ces échos ne tordent pas le texte: ils lui donnent profondeur en le situant ` +
    `dans l’unique histoire du salut.`
  );
  t.push('');
  t.push(
    `Doctrinalement, la dynamique est tripartite: **initiative de Dieu** (grâce première), **réponse humaine** (foi, obéissance, repentance), ` +
    `**patience divine** (corrections, consolations, relèvements). Ainsi la narration devient doctrine, et la doctrine devient chemin.`
  );
  t.push('');
  t.push(
    `À la lumière du Christ, la section prend sa portée entière: promesse en germe, figure typologique ou annonce directe, elle oriente vers la croix ` +
    `et la résurrection, où la justice et la miséricorde se rencontrent. Le passage enseigne moins la performance que la conversion: nommer le mal, ` +
    `s’en détourner, demeurer dans la bonté de Dieu.`
  );
  t.push('');
  t.push(
    `En somme, cette page est un atelier de formation spirituelle. La vérité reçue devient prière; la prière enfante l’obéissance; ` +
    `l’obéissance devient témoignage.`
  );
  return t.join('\n');
}

function buildPrevChapterQnA({ book, chapter }) {
  const ch = parseInt(chapter, 10);
  const generic = {
    fil: `Le chapitre précédent a posé un cadre théologique (origine, alliance, loi ou promesse) qui ouvre logiquement sur l’approfondissement présent: ce qui était énoncé devient enjeu vécu.`,
    pers: `Les acteurs déjà introduits reviennent avec des fonctions clarifiées (responsabilité, épreuve, mission). Le décor n’est pas neutre: il sert la pédagogie divine.`,
    dieu: `Sa sainteté interdit l’autojustification; sa miséricorde interdit le désespoir; sa fidélité rend l’obéissance possible.`,
    tensions: `Limites humaines, attente d’une promesse, conflit latent: la suite reprend ces fils pour dresser un diagnostic vrai et proposer un chemin de vie.`,
    attente: `Une mise au clair doctrinale ou un déplacement narratif orientant vers la fidélité concrète.`
  };
  if (Number.isFinite(ch) && ch > 1) {
    const prev = `${book} ${ch - 1}`;
    return (
      `**Questions du chapitre précédent**  \n` +
      `Questions et réponses sur le chapitre précédent  \n` +
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
    `2. **Comment l’homme est-il situé d’emblée ?**  \n→ Créature appelée à vivre de la Parole, à recevoir l’Alliance et à exercer une responsabilité réglée par Dieu.\n\n` +
    `3. **Quels thèmes structurants émergent ?**  \n→ Création/providence, promesse/jugement, sagesse/folie, appel/obéissance.`
  );
}

/* ===== Longues ===== */
function buildRubrique4_Canonicite({ book, chapter, analysis }){
  const ref=`${book} ${chapter}`; const motifs=(analysis.topWords||[]).slice(0,5).join(', ');
  const p=[];
  p.push(`**Canonicité et cohérence**`);
  p.push(`*Référence :* ${ref}`);
  p.push('');
  p.push(`Ce chapitre prend sa pleine mesure replacé dans l’économie du canon, où promesse et accomplissement se répondent. La Bible déroule l’histoire unique du salut; ici, les motifs (${motifs}) relèvent d’une pédagogie qui reprend et approfondit pour former un peuple intelligent et obéissant.`);
  p.push('');
  p.push(`Les résonances proches et lointaines éclairent le texte (Psaumes 119; Proverbes 1:7; Luc 24:27; Jean 5:39). Elles manifestent l’unité d’un dessein où Dieu demeure fidèle, et où la diversité des genres sert une même finalité: la communion du pécheur réconcilié avec Dieu.`);
  p.push('');
  p.push(`La cohérence se lit à trois niveaux: **théologique** (Dieu sujet véritable), **narratif** (ce qui a été posé est approfondi; la clôture prépare la suite), **ecclésial** (le peuple se laisse façonner: doctrine, culte, vie).`);
  p.push('');
  p.push(`Concrètement, replacer ${ref} dans l’unité biblique, c’est mieux entendre les appels: nommer le péché, recevoir la grâce, marcher dans l’obéissance. La vérité reçue devient prière, la prière nourrit l’obéissance, l’obéissance se fait témoignage. `);
  return p.join('\n');
}

function buildRubrique5_Testament({ book, chapter, analysis }){
  const ref = `${book} ${chapter}`;
  const motifs = (analysis.topWords || []).slice(0, 5).join(', ');
  const t = [];
  t.push(`**Ancien/Nouveau Testament : continuité, accomplissement, lumière réciproque**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(`L’Ancien prépare, annonce et typologise; le Nouveau dévoile, accomplit et interprète. La continuité n’est pas uniformité, la nouveauté n’est pas opposition: le même Dieu conduit son dessein. Les motifs (${motifs}) participent d’une pédagogie où la répétition grave la vérité et la variation en déploie les implications.`);
  t.push('');
  t.push(`Axes: **promesse/accomplissement** (2 Co 1:20), **loi/évangile** (Rom 3–8; Ga), **Esprit/Église** (Joël 3 → Ac 2). Cette lecture protège du biblicisme plat (verset isolé) et de l’opposition stérile (Nouveau contre Ancien).`);
  t.push('');
  t.push(`Concrètement, replacer ${ref} dans cette lumière, c’est discerner l’appel au repentir et à la confiance, l’instruction de la prière et l’ordonnance de la charité. La vérité reçue devient prière, obéissance, témoignage.`);
  return t.join('\n');
}

/* ===== Rubriques simples 6–27 ===== */
function basic({book,chapter}, title, body){
  return `${title}  \n*Référence :* ${book} ${chapter}\n\n${body}`;
}
function buildPromesses(ctx){return basic(ctx,'**Promesses**','Dieu prend l’initiative, soutient l’espérance et appelle à la fidélité. La promesse n’abolit pas l’épreuve; elle donne la direction et la force d’avancer.');}
function buildPecheEtGrace(ctx){return basic(ctx,'**Péché et grâce**','Le diagnostic vrai du péché conduit à la grâce suffisante. La miséricorde ne nie pas la vérité; elle la mène à son terme dans la restauration.');}
function buildChristologie(ctx){return basic(ctx,'**Christologie**','Le Christ éclaire les Écritures (Luc 24:27; Jean 5:39): promesse accomplie, vérité incarnée, chemin de la vie.');}
function buildEspritSaint(ctx){return basic(ctx,'**Esprit Saint**','Il illumine l’intelligence, convainc de péché, sanctifie la vie, et donne la puissance du témoignage.');}
function buildAlliance(ctx){return basic(ctx,'**Alliance**','Don et appel: Dieu engage sa fidélité; l’homme répond par la foi obéissante.');}
function buildEglise(ctx){return basic(ctx,'**Église**','Peuple rassemblé par la Parole et les sacrements, envoyé pour servir dans la vérité et la charité.');}
function buildDisciples(ctx){return basic(ctx,'**Discipulat**','Apprendre du Maître, porter sa croix, persévérer humblement; la grâce soutient l’obéissance.');}
function buildEthique(ctx){return basic(ctx,'**Éthique**','La vie ordonnée découle de l’Évangile: justice, vérité, miséricorde, fidélité.');}
function buildPriere(ctx){return basic(ctx,'**Prière**','La Parole reçue devient supplication, confession, action de grâce et intercession.');}
function buildMission(ctx){return basic(ctx,'**Mission**','Dieu envoie: témoigner humblement et fermement, en paroles et en actes.');}
function buildEsperance(ctx){return basic(ctx,'**Espérance**','Le jugement sert la vie; la fin nourrit la fidélité présente et la consolation.');}
function buildExhortation(ctx){return basic(ctx,'**Exhortation**','Avancer dans la lumière, sans dureté ni mollesse, en gardant le cœur.');}
function buildApplicationPerso(ctx){return basic(ctx,'**Application personnelle**','Traduire la vérité en pas concrets: renoncer, choisir, servir, persévérer.');}
function buildApplicationCollective(ctx){return basic(ctx,'**Application communautaire**','Unité, sainteté, service mutuel; charité ordonnée pour la paix commune.');}
function buildLiturgie(ctx){return basic(ctx,'**Liturgie**','Le culte inscrit la vérité dans le temps; il façonne l’amour de Dieu et du prochain.');}
function buildMeditation(ctx){return basic(ctx,'**Méditation**','Garder et ruminer la Parole pour qu’elle devienne obéissance joyeuse.');}
function buildMemoVerset({book,chapter}){return `**Verset-clé**  \n*Référence :* ${book} ${chapter}; v.1  \nÀ mémoriser et vivre, comme lumière sur le chemin.`;}
function buildTypologie(ctx){return basic(ctx,'**Typologie**','Figures et accomplissements convergent en Christ, clé d’intelligence, sans violence du sens.');}
function buildTheologieSystematique(ctx){return basic(ctx,'**Théologie systématique**','Dieu, Christ, Esprit, Église, Salut: articulation fidèle et nourrissante.');}
function buildHistoireDuSalut(ctx){return basic(ctx,'**Histoire du salut**','De la promesse à l’accomplissement: un seul dessein, une même fidélité.');}
function buildThemesSecondaires(ctx){return basic(ctx,'**Thèmes secondaires**','Repérer motifs récurrents et nuances, au service du thème directeur.');}
function buildDoutesObjections(ctx){return basic(ctx,'**Doutes/objections**','Répondre avec patience et Écriture; la vérité libère, la charité garde.');}
function buildSynthese(ctx){return basic(ctx,'**Synthèse**','Résumer le propos et discerner le pas juste à accomplir aujourd’hui.');}
function buildPlanDeLecture(ctx){return basic(ctx,'**Plan de lecture**','Continuer: lire, prier, pratiquer, témoigner; inscrire la Parole dans la durée.');}

/* ===== Helpers longueur ===== */
function fitLength(text, target){
  const t = String(text||'').trim();
  if (t.length === 0) return t;

  // marges tolérées (~±12% pour rester naturel)
  const min = Math.floor(target*0.88), max = Math.ceil(target*1.12);
  if (t.length >= min && t.length <= max) return t;

  if (t.length < min){
    // on enrichit avec addenda doctrinaux courts jusqu’à atteindre min
    let out = t;
    const addenda = [
      ` Cette lecture s’inscrit dans l’ensemble du canon: la Parole éclaire, corrige, console et dirige la vie.`,
      ` Elle suppose la prière, l’écoute ecclésiale et la mise en pratique, afin que la vérité reçue devienne fidélité durable.`,
      ` On y discerne l’initiative de Dieu, la réponse de l’homme et la patience de l’Alliance, jusqu’à l’accomplissement en Christ.`
    ];
    let i=0;
    while (out.length < min && i < addenda.length) { out += addenda[i++]; }
    return out;
  }

  // si trop long, on coupe proprement à la fin de la phrase
  const cut = t.slice(0, max);
  const last = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return cut.slice(0, last>0 ? last+1 : max).trim();
}

/* ===== Utilitaires API/texte ===== */
function extractTextFromApiBible(payload) {
  try {
    const d = payload && payload.data;
    if (!d) return '';
    if (typeof d.content === 'string') return stripTags(d.content);
    if (Array.isArray(d.passages) && d.passages.length) {
      const html = d.passages.map(p => p.content || '').join('\n');
      return stripTags(html);
    }
  } catch {}
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
  } catch {}
  return '';
}
function stripTags(html) { return String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }

function lightAnalyze(text,{book,chapter}){
  const raw=(text||'').slice(0,12000);
  const words=raw.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const freq=new Map(); for(const w of words) freq.set(w,(freq.get(w)||0)+1);
  const top=[...freq.entries()].sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x[0]);
  const themes=[]; if(/(créa|create|lumi|ténè|commencement|commença)/i.test(raw)) themes.push('création');
  if(/(alliance|covenant|promesse)/i.test(raw)) themes.push('alliance');
  if(/(péché|peche|chute|faute|iniqui|mal)/i.test(raw)) themes.push('péché');
  if(/(grâce|grace|miséricorde)/i.test(raw)) themes.push('grâce');
  if(/(loi|torah|commandement)/i.test(raw)) themes.push('loi');
  if(/(roi|royaume|règne|regne)/i.test(raw)) themes.push('royaume');
  return { book, chapter, topWords:top, themes };
}

function truncateForLine(s, max){
  const t = normalizeWhitespace(s);
  if (t.length<=max) return t;
  const cut = t.slice(0,max);
  const sp = cut.lastIndexOf(' ');
  return (sp>60 ? cut.slice(0,sp) : cut).trim()+'…';
}
function normalizeWhitespace(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function escapeReg(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

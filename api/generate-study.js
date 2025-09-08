// api/generate-study.js
// Étude 28 points + Rubrique 0 en tête (versets du chapitre + explications dynamiques via api.bible)
//
// Entrée: ?book=Genèse&chapter=1[|1:1|1:1-9][&version=LSG|DARBY|NEG|SEM][&long=1|0]
// Requiert: API_BIBLE_KEY, DARBY_BIBLE_ID (optionnellement LSG_BIBLE_ID, NEG_BIBLE_ID, SEM_BIBLE_ID)

export default async function handler(req, res) {
  try {
    const { book, chapter: chapterParam } = req.query || {};
    if (!book || !chapterParam) {
      return res.status(400).json({ error: 'Paramètres requis: book, chapter' });
    }

    const { chapterNum, chapterRef } = normalizeChapter(String(chapterParam));
    const apiKey = process.env.API_BIBLE_KEY || '';
    const bibleId =
      (req.query?.bibleId && String(req.query.bibleId)) ||
      pickBibleIdFromVersion(req.query?.version) ||
      process.env.DARBY_BIBLE_ID || '';

    const refForApi     = `${book} ${chapterRef}`;
    const refForChapter = `${book} ${chapterNum}`;

    // ========= 1) Passage (texte brut) + Versets du chapitre =========
    let passageText = '';
    if (apiKey && bibleId) {
      try {
        const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/passages?reference=${encodeURIComponent(refForApi)}&content-type=text`;
        const r = await fetch(url, { headers: { 'api-key': apiKey } });
        if (r.ok) passageText = extractTextFromApiBible(await r.json());
      } catch (e) { console.error('[passages] error', e); }
    }
    if (!passageText && apiKey && bibleId) {
      try {
        const url2 = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(refForApi)}&limit=200`;
        const r2 = await fetch(url2, { headers: { 'api-key': apiKey } });
        if (r2.ok) passageText = extractTextFromSearch(await r2.json());
      } catch (e) { console.error('[search fallback] error', e); }
    }
    if (!passageText) {
      passageText = `(${refForApi}) — passage non récupéré ; analyse doctrinale sans texte intégral.`;
    }

    // Versets complets du chapitre (une seule requête), réutilisés partout
    const chapterVerses = apiKey && bibleId
      ? await getChapterVerses({ apiKey, bibleId, book, chapterForFilter: chapterNum })
      : [];

    const analysis = lightAnalyze(passageText, { book, chapter: chapterNum });

    // ========= 2) Sections =========
    const sections = [];

    // 0. Panorama (versets du chapitre)
    const rubrique0 = await buildRubrique0_VersesOverview({
      book, chapterForFilter: chapterNum, chapterVerses, analysis
    });
    sections.push({ n: 0, content: rubrique0 });

    // 1–5 — inchangées (dont 2,4,5 longues)
    sections.push({ n: 1, content: buildOpeningPrayer({ book, chapter: chapterNum }) });
    sections.push({ n: 2, content: buildRubrique2({ book, chapter: chapterNum, analysis, passageText }) });
    sections.push({ n: 3, content: buildPrevChapterQnA({ book, chapter: chapterNum }) });
    sections.push({ n: 4, content: buildRubrique4_Canonicite({ book, chapter: chapterNum, analysis }) });
    sections.push({ n: 5, content: buildRubrique5_Testament({ book, chapter: chapterNum, analysis }) });

    // 6–27 — mode long activé par défaut (&long=1)
    const useLong = (() => {
      const q = String(req?.query?.long ?? '').trim();
      return q === '' ? true : /^1|true|yes$/i.test(q) && !/^(0|false|no)$/i.test(q);
    })();

    // Définition stricte de l’ordre et des filtres thématiques (aucun doublon)
    const longDefs = [
      { title:'Promesses',              key:'promesses', terms:['promet','promesse','bén', 'bened','serment','espoir','espérance'] },
      { title:'Péché et grâce',        key:'pecheGrace', terms:['péché','peche','faute','iniqui','transgress','grâce','grace','miséricorde'] },
      { title:'Christologie',           key:'christologie', terms:['christ','messie','fils','seigneur','parole','sagesse'] },
      { title:'Esprit Saint',           key:'esprit', terms:['esprit','souffle','ruach','pneuma','oint','onction'] },
      { title:'Alliance',               key:'alliance', terms:['alliance','covenant','signe','serment','bén','bened'] },
      { title:'Église',                 key:'eglise', terms:['assemblée','peuple','convoqué','saints','communauté'] },
      { title:'Discipulat',             key:'discipulat', terms:['obéir','obéissance','suivre','discip','marche','chemin'] },
      { title:'Éthique',                key:'ethique', terms:['loi','command','justice','droiture','sagesse','folie'] },
      { title:'Prière',                 key:'priere', terms:['prie','invoque','bénit','lou','psaume','crie'] },
      { title:'Mission',                key:'mission', terms:['nations','témoign','annonce','envoy','lumière','bénédiction'] },
      { title:'Espérance',              key:'esperance', terms:['espérance','espere','attend','fin','accompl','repos'] },
      { title:'Exhortation',            key:'exhortation', terms:['exhorte','avertit','appele','écoute','entends'] },
      { title:'Application personnelle',key:'appPerso', terms:['coeur','voie','marche','main','langue','pensée','prudence'] },
      { title:'Application communautaire',key:'appCommu', terms:['frère','prochain','peuple','justice','partage','paix'] },
      { title:'Liturgie',               key:'liturgie', terms:['bénit','sanctifie','sabbat','offrande','culte','repos'] },
      { title:'Méditation',             key:'meditation', terms:['médit','pense','répète','jour','nuit','souviens','loi'] },
      { title:'Typologie',              key:'typologie', terms:['figure','ombre','type','image','royaume','temple','roi','prêtre','prophète'] },
      { title:'Théologie systématique', key:'systematique', terms:['dieu','parole','vérité','saint','justice','royaume'] },
      { title:'Histoire du salut',      key:'hds', terms:['promesse','alliance','bénéd','jugement','grâce','rédemp'] },
      { title:'Doutes/objections',      key:'doutes', terms:['pourquoi','comment','doute','objection','scandale','silence'] },
      { title:'Synthèse',               key:'synthese', terms:['ainsi','voici','donc','enfin'] },
      { title:'Plan de lecture',        key:'plan', terms:['jour','semaine','mois','lire','entendre','pratiquer'] },
    ];

    if (!useLong) {
      // Mode court = tes placeholders sobres existants
      const shortFns = getShortFns();
      for (let i = 0; i < shortFns.length; i++) {
        sections.push({ n: 6 + i, content: shortFns[i]({ book, chapter: chapterNum, analysis, passageText }) });
      }
    } else {
      // Mode long = génération académique 2000–2500, spécifique au chapitre
      for (let i = 0; i < longDefs.length; i++) {
        const n = 6 + i;
        const def = longDefs[i];
        const content = await buildRubriqueLong({
          n, def, ctx: { book, chapter: chapterNum, analysis, passageText, chapterVerses }
        });
        sections.push({ n, content });
      }
    }

    // 28. Prière de clôture
    sections.push({ n: 28, content: buildClosingPrayer({ book, chapter: chapterNum }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ====================== Accès chapitres/versets ====================== */

// Récupère tous les versets "Book Chapter:verse" via /search, une seule fois
async function getChapterVerses({ apiKey, bibleId, book, chapterForFilter }) {
  try {
    const ref = `${book} ${chapterForFilter}`;
    const url = `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/search?query=${encodeURIComponent(ref)}&limit=500`;
    const r = await fetch(url, { headers: { 'api-key': apiKey } });
    if (!r.ok) return [];
    const j = await r.json();
    const raw = Array.isArray(j?.data?.verses) ? j.data.verses : [];
    const prefix = new RegExp(`^${escapeReg(book)}\\s+${escapeReg(String(chapterForFilter))}\\s*:\\s*(\\d+)`, 'i');
    return raw
      .map(v => ({ ref: v.reference || '', text: normalizeWhitespace(v.text || '') }))
      .filter(v => prefix.test(v.ref))
      .map(v => {
        const m = prefix.exec(v.ref);
        const num = m ? parseInt(m[1], 10) : null;
        return { verse: num, ref: v.ref, text: v.text };
      })
      .filter(v => Number.isFinite(v.verse))
      .sort((a,b)=>a.verse-b.verse);
  } catch (e) {
    console.error('[getChapterVerses] error', e);
    return [];
  }
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
async function buildRubrique0_VersesOverview({ book, chapterForFilter, chapterVerses, analysis }) {
  const ref = `${book} ${chapterForFilter}`;
  const verses = Array.isArray(chapterVerses) ? chapterVerses : [];

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

/* ====================== Rubriques 6–27 — Génération LONGUE ====================== */

async function buildRubriqueLong({ n, def, ctx }) {
  const { book, chapter, analysis, passageText, chapterVerses } = ctx;

  // Cas spécial: Rubrique 6 + Genèse 1 => texte fourni par toi (non modifié)
  if (n === 6 && normBook(book) === 'genese' && String(chapter) === '1') {
    return (
`Promesses  
*Référence :* Genèse 1

Les promesses divines ne sont pas des slogans pieux, mais des actes de parole par lesquels Dieu s’engage publiquement et efficacement, dans le cadre de l’Alliance, à produire un avenir qu’il réalise lui-même. Déjà en Genèse 1, la promesse est en germe au cœur de l’efficacité créatrice: «Dieu dit… et il en fut ainsi». La Parole qui fait être est aussi la Parole qui fait espérer. Le Dieu qui sépare, nomme et ordonne ne laisse pas le monde à l’indétermination; il inscrit la création dans une téléologie: qu’elle reflète sa bonté et qu’elle devienne habitation de l’humain appelé à l’image. Ainsi, la première pédagogie de la promesse consiste à stabiliser la réalité par une parole fiable; la confiance peut naître, non d’un optimisme naturel, mais d’une fidélité première.

La promesse biblique comporte quatre traits. (1) Initiative souveraine: elle vient d’en haut, précède toute œuvre humaine et ne se fonde ni sur le mérite ni sur la vraisemblance des circonstances. (2) Contenu déterminé: Dieu ne promet pas vaguement le “bien-être”, il annonce des biens précis (vie, présence, fécondité, repos, bénédiction) qui s’enracinent dans son dessein. (3) Caractère performatif: parce que Dieu est vrai, sa parole fait ce qu’elle dit; le délai apparent n’infirme pas la certitude, il éduque la patience et purifie l’attente. (4) Orientation christologique: toute promesse converge vers le Oui définitif en Jésus-Christ; la création ordonnée prépare l’économie du salut où la grâce restaure et mène à l’achèvement.

Pastoralement, la promesse délivre de deux dérives. D’un côté, l’auto-assurance religieuse qui prétend fabriquer l’avenir par la technique spirituelle; de l’autre, le fatalisme qui se résigne à l’informe. La promesse enseigne la foi obéissante: recevoir aujourd’hui la parole fiable, poser l’acte proportionné (garder, cultiver, bénir, sanctifier), et laisser Dieu tenir ce qu’il a dit selon son temps. Elle apprend aussi la lecture canonique: on n’isole pas des fragments; on discerne la trame — création, bénédiction, sabbat — comme prémices d’une Alliance qui conduit d’Adam à Abraham, d’Israël au Christ, puis à l’Église dans l’Esprit. Ainsi, Genèse 1 n’est pas seulement un prologue cosmique: c’est le laboratoire de l’espérance où l’on voit, à l’état pur, que ce que Dieu ordonne, il l’accomplit, et que ce qu’il bénit, il le porte jusqu’à sa plénitude.`
    ).trim();
  }

  // Sélection de 2–4 versets thématiquement pertinents du chapitre
  const anchors = pickAnchors(chapterVerses, def.terms, 4);
  const ref = `${book} ${chapter}`;
  const motifs = (analysis?.topWords || []).slice(0, 6).join(', ');
  const themes = analysis?.themes || [];
  const accent =
    themes.includes('grâce') ? `La **grâce** demeure l’horizon: initiative divine et relèvement. `
  : themes.includes('loi') ? `La **loi** révèle et règle la réponse fidèle. `
  : themes.includes('alliance') ? `L’**Alliance** donne structure: promesse, signe, fidélité. `
  : themes.includes('péché') ? `Le **péché** est nommé sans détour pour conduire à la vie. `
  : themes.includes('création') ? `La **création** élargit la perspective et situe l’éthique. `
  : themes.includes('royaume') ? `Le **Royaume** affleure: règne de Dieu et appel. `
  : `Dieu parle, l’homme répond; la vérité libère. `;

  const { axes, canons, praxis, scelle } = rubricScaffolds(def.key, { book, chapter });

  const p = [];
  p.push(`${def.title}  \n*Référence :* ${ref}\n`);
  p.push(`Thèse — ${rubricThesis(def.key)} ${accent}Dans ${ref}, les motifs (${motifs}) orientent l’intelligence doctrinale et la pratique.`);

  if (anchors.length) {
    p.push('\n**Ancrages du chapitre**');
    anchors.forEach(a => p.push(`- **${formatRef(a)}** — ${truncateForLine(a.text, 220)}`));
  } else {
    p.push('\n**Ancrages du chapitre**\n- (Aucun verset ciblé trouvé ; lecture doctrinale fondée sur l’ensemble du passage.)');
  }

  if (axes?.length) {
    p.push('\n**Axes de lecture**');
    axes.forEach((ax,i)=>p.push(`${i+1}. ${ax}`));
  }
  if (canons?.length) {
    p.push('\n**Résonances canoniques** — La Bible éclaire la Bible (Luc 24:27; Jean 5:39).');
    canons.forEach(c=>p.push(`- ${c}`));
  }
  if (praxis?.length) {
    p.push('\n**Praxis / Mise en œuvre**');
    praxis.forEach(x=>p.push(`- ${x}`));
  }
  p.push('\n' + (scelle || `**Prière** — Inscris cette vérité dans nos cœurs pour une obéissance paisible. Amen.`));

  return inflateToRange(p.join('\n'), 2000, 2500, { book, chapter });
}

/* ====== Scaffolds par rubrique (logique distincte, pas de doublons) ====== */

function rubricThesis(key){
  switch(key){
    case 'promesses': return `Les promesses sont des **actes de parole** par lesquels Dieu engage un avenir qu’il réalise lui-même.`;
    case 'pecheGrace': return `Le **péché** dévoile la rupture; la **grâce** devance et restaure.`;
    case 'christologie': return `Le Christ est **clé herméneutique** et centre de l’économie du salut.`;
    case 'esprit': return `L’**Esprit** illumine, convertit, sanctifie et envoie.`;
    case 'alliance': return `L’**Alliance** organise la révélation: promesse, signe, fidélité et responsabilité.`;
    case 'eglise': return `L’**Église** est le peuple convoqué par la Parole, envoyé dans le monde.`;
    case 'discipulat': return `Le **discipulat** forme à la ressemblance du Christ par la grâce.`;
    case 'ethique': return `L’**éthique** découle de l’Évangile: vérité & miséricorde, justice & paix.`;
    case 'priere': return `La **prière** répond à la Parole et règle la vie.`;
    case 'mission': return `La **mission** prolonge l’envoi du Fils et de l’Esprit vers les nations.`;
    case 'esperance': return `L’**espérance** s’enracine dans la résurrection et la nouvelle création.`;
    case 'exhortation': return `L’**exhortation** applique l’Évangile à la marche concrète.`;
    case 'appPerso': return `L’application **personnelle** fait passer la vérité reçue en décisions.`;
    case 'appCommu': return `L’application **communautaire** façonne une vie d’Église ordonnée.`;
    case 'liturgie': return `La **liturgie** éduque l’amour: Parole & sacrements, semaine et monde.`;
    case 'meditation': return `La **méditation** grave la Parole: mémoire, affection, action.`;
    case 'typologie': return `La **typologie** reconnaît les figures préparant l’intelligence du Christ.`;
    case 'systematique': return `La théologie **systématique** ordonne les loci pour une confession cohérente.`;
    case 'hds': return `L’**histoire du salut** déroule une unique économie: promesse → accomplissement.`;
    case 'doutes': return `Les **doutes/objections** reçoivent une réponse patiente, scripturaire, pastorale.`;
    case 'synthese': return `La **synthèse** recueille le fil doctrinal et désigne le pas d’obéissance.`;
    case 'plan': return `Un **plan de lecture** durable forme la maturité.`;
    default: return `Doctrine et pratique se répondent.`;
  }
}

function rubricScaffolds(key, {book,chapter}){
  switch(key){
    case 'promesses':
      return {
        axes:[`Initiative souveraine`,`Contenu déterminé`,`Performativité de la Parole`,`Orientation christologique`],
        canons:[`Gen 12; 15`,`Ps 89`,`2 Co 1:20`,`Hé 6:13–20`],
        praxis:[`Résister au court-termisme`,`Attendre en obéissant`,`Tenir mémoire des exaucements`]
      };
    case 'pecheGrace':
      return {
        axes:[`Vérité du péché`,`Priorité de la grâce`,`Conversion (repentir & foi)`,`Sanctification`],
        canons:[`Gen 3`,`Ps 51`,`Rm 5–8`,`Ép 2:1–10`],
        praxis:[`Confession régulière`,`Refuser autojustification & désespoir`,`Vivre de la grâce transformatrice`]
      };
    case 'christologie':
      return {
        axes:[`Personne du Christ`,`Œuvre: croix & résurrection`,`Royaume: déjà/pas encore`,`Union au Christ`],
        canons:[`Col 1:15–20`,`Hébreux`,`Ps 2; 110`,`És 53`],
        praxis:[`Adoration centrée sur le Christ`,`Marcher selon l’identité reçue`]
      };
    case 'esprit':
      return {
        axes:[`Illumination`,`Nouvelle naissance`,`Dons & édification`,`Mission`],
        canons:[`Jl 3 → Ac 2`,`Rm 8`,`Jn 3; 16`],
        praxis:[`Demander sa conduite`,`Exercer les dons avec charité et ordre`]
      };
    case 'alliance':
      return {
        axes:[`Variations (Noé, Abraham, Sinaï, David, Nouvelle)`,`Signes (circoncision/baptême; Pâque/Cène)`,`Fidélité & responsabilité`,`Christ médiateur`],
        canons:[`Gen 12; 15; 17`,`Ex 19–24`,`Jr 31:31–34`,`Hé 8–10`],
        praxis:[`Écouter, se souvenir, obéir`,`Recevoir discipline paternelle`]
      };
    case 'eglise':
      return {
        axes:[`Parole & sacrements`,`Gouvernance servante`,`Unité dans la diversité`,`Sainteté hospitalière`],
        canons:[`Ac 2:42–47`,`Ép 4`,`1 P 2`],
        praxis:[`Charité ordonnée`,`Servir la cité sans se dissoudre`]
      };
    case 'discipulat':
      return {
        axes:[`Appel & réponse`,`Formation (Parole, épreuves, communauté)`,`Obéissance concrète`,`Persévérance`],
        canons:[`Mt 5–7`,`Jn 13–17`,`Hé 12`],
        praxis:[`Rythme : Écriture/prière/accompagnement`,`Pas obéissants précis`]
      };
    case 'ethique':
      return {
        axes:[`Fondement (Dieu saint, image)`,`Loi accomplie en l’amour`,`Vertus: foi, espérance, charité`,`Discernement & conscience`],
        canons:[`Ex 20; Dt 6`,`Rm 12–15`,`Jacques`],
        praxis:[`Examiner ses pratiques`,`Allier justice et miséricorde`]
      };
    case 'priere':
      return {
        axes:[`Adoration & action de grâce`,`Confession & intercession`,`Demande filiale`,`Rythme communautaire`],
        canons:[`Psaumes`,`Mt 6 — Notre Père`,`Rm 8:26–27`],
        praxis:[`Rythme simple et durable`,`Prier la Parole lue`]
      };
    case 'mission':
      return {
        axes:[`Évangélisation humble & fidèle`,`Justice & miséricorde: signes du Royaume`,`Formation & implantation`,`Souffrance & joie`],
        canons:[`Mt 28:18–20`,`Actes`,`1 Th`],
        praxis:[`Témoigner dans son réseau`,`Relier parole et service`]
      };
    case 'esperance':
      return {
        axes:[`Résurrection`,`Jugement juste`,`Nouvelle création`,`Vigilance`],
        canons:[`1 Co 15`,`Rm 8`,`1 P 1:3–9`,`Ap 21–22`],
        praxis:[`Lire les épreuves à la lumière de la fin`,`Consoler avec compétence`]
      };
    case 'exhortation':
      return {
        axes:[`Rappeler l’Évangile`,`Nommer le bien et le mal`,`Encourager la persévérance`,`Accompagner avec douceur`],
        canons:[`Hé 3:13; 10:24–25`,`Ép 4–6`],
        praxis:[`Exhorter sans écraser`,`Relier appel public et soin personnel`]
      };
    case 'appPerso':
      return {
        axes:[`Examiner ses habitudes`,`Décider un pas clair`,`Redevabilité fraternelle`,`Célébrer la grâce`],
        canons:[`Jac 1:22–25`,`Ps 139:23–24`],
        praxis:[`Résolution concrète liée au chapitre`,`Journal “lumière/action/prière”`]
      };
    case 'appCommu':
      return {
        axes:[`Doctrine, liturgie, diaconie, mission`,`Unité & sainteté`,`Ordre & paix`],
        canons:[`Ac 2:42–47`,`Ép 4`],
        praxis:[`Audit communautaire lié au chapitre`,`Planifier former/prier/servir`]
      };
    case 'liturgie':
      return {
        axes:[`Appel/Confession/Annonce`,`Lecture & prédication`,`Sacrements`,`Envoi`],
        canons:[`És 6`,`Lc 24`,`Ac 2`],
        praxis:[`Préparer le cœur`,`Relier dimanche & semaine`]
      };
    case 'meditation':
      return {
        axes:[`Lenteur`,`Mémoire (verset-clé)`,`Affection`,`Action`],
        canons:[`Ps 1`,`Jos 1:8`,`Ps 119:11`],
        praxis:[`Choisir un verset-clé du chapitre`,`Le prier matin/soir`,`Partager un fruit de méditation`]
      };
    case 'typologie':
      return {
        axes:[`Repérer motifs: roi/temple/exode`,`Vérifier contexte/canon`,`Orienter vers le Christ`,`Distinguer typologie/allégorie`],
        canons:[`Matthieu — accomplissements`,`Hébreux — temple/sacrifices`],
        praxis:[`Sobriété exégétique`,`Adorer le Christ révélé`]
      };
    case 'systematique':
      return {
        axes:[`Sola Scriptura`,`Analogie de la foi`,`Hiérarchie des vérités`,`Finalité pastorale`],
        canons:[`2 Tm 3:14–17`,`Hé 4:12`],
        praxis:[`Relier lecture suivie et synthèse`,`Repérer centre/périphérie`]
      };
    case 'hds':
      return {
        axes:[`Promesse/Accomplissement`,`Crise/Relèvement`,`Déjà/Pas encore`,`Peuple/Toutes nations`],
        canons:[`Gen → Apoc`,`Lc 24`],
        praxis:[`Lire le chapitre comme station du salut`,`Tenir mémorial des œuvres de Dieu`]
      };
    case 'doutes':
      return {
        axes:[`Écouter la vraie question`,`Clarifier genre/contexte/canon`,`Relier à l’Évangile`,`Accompagner (temps & prière)`],
        canons:[`1 P 3:15`,`Jude 22–23`],
        praxis:[`Espace de questions franc`,`Ressources fiables progressives`]
      };
    case 'synthese':
      return {
        axes:[`Vérité sur Dieu`,`Diagnostic sur l’homme`,`Chemin en Christ`,`Fruit: prière/obéissance/témoignage`],
        canons:[`Ps 119`,`Rm 12`],
        praxis:[`Formuler une phrase-synthèse`,`Choisir un pas concret`]
      };
    case 'plan':
      return {
        axes:[`Rythme AT/NT/Psaumes`,`Observation/Interprétation/Application`,`Partage & intercession`,`Souplesse sans culpabiliser`],
        canons:[`Jos 1:8`,`Ac 17:11`],
        praxis:[`Plan 4–6 semaines lié au livre`,`RDV fraternel bi-hebdo`]
      };
    default: return { axes:[], canons:[], praxis:[] };
  }
}

/* ====== Sélection des versets d’ancrage par thème ====== */

function pickAnchors(chapterVerses, terms, maxN) {
  if (!Array.isArray(chapterVerses) || !chapterVerses.length) return [];
  const t = (terms || []).map(s => normalizeForMatch(s)).filter(Boolean);
  const seen = new Set();
  const matches = [];
  for (const v of chapterVerses) {
    const hay = normalizeForMatch(v.text);
    if (t.some(term => hay.includes(term))) {
      const key = v.verse;
      if (!seen.has(key)) { seen.add(key); matches.push(v); }
    }
    if (matches.length >= maxN) break;
  }
  // si rien trouvé, on prend v.1, v. (milieu), v. (fin) pour ancrer la rubrique
  if (!matches.length) {
    const len = chapterVerses.length;
    if (len >= 1) matches.push(chapterVerses[0]);
    if (len >= 3) matches.push(chapterVerses[Math.floor(len/2)]);
    if (len >= 2) matches.push(chapterVerses[len-1]);
  }
  return matches.slice(0, maxN);
}

function formatRef(v){ return `v.${v.verse}`; }
function normalizeForMatch(s){
  return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim();
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
  t.push(`L’Ancien prépare/annonce/typologise; le Nouveau dévoile/accomplit/interprète. La révélation progresse selon l’Alliance. La continuité n’est pas uniformité; la

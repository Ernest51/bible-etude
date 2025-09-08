// api/generate-study.js
export default async function handler(req, res) {
  try {
    const { book, chapter } = req.query || {};
    if (!book || !chapter) return res.status(400).json({ error: 'Paramètres requis: book, chapter' });

    const apiKey  = process.env.API_BIBLE_KEY || '';
    const bibleId = process.env.DARBY_BIBLE_ID || '';
    const refLabel = `${book} ${chapter}`;

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

    const sections = [];
    sections.push({ n:1, content: buildOpeningPrayer({ book, chapter }) });
    sections.push({ n:2, content: buildRubrique2({ book, chapter, analysis, passageText }) });
    sections.push({ n:3, content: buildPrevChapterQnA({ book, chapter }) });

    // === Rubrique 4 : version longue (2000–2500) ===
    sections.push({ n:4, content: buildRubrique4_Canonicite({ book, chapter, analysis }) });

    // 5–27 : pour l’instant versions sobres (inchangées)
    const others = [
      buildTestament, buildPromesses, buildPecheEtGrace, buildChristologie,
      buildEspritSaint, buildAlliance, buildEglise, buildDisciples, buildEthique,
      buildPriere, buildMission, buildEsperance, buildExhortation, buildApplicationPerso,
      buildApplicationCollective, buildLiturgie, buildMeditation, buildMemoVerset,
      buildTypologie, buildTheologieSystematique, buildHistoireDuSalut, buildThemesSecondaires,
      buildDoutesObjections, buildSynthese, buildPlanDeLecture
    ];
    let n = 5; for(const fn of others){ sections.push({ n, content: fn({ book, chapter, analysis, passageText }) }); n++; }

    sections.push({ n:28, content: buildClosingPrayer({ book, chapter }) });

    return res.status(200).json({ sections });
  } catch (e) {
    console.error('[generate-study] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* === Utils api.bible === */
function extractTextFromApiBible(payload){ try{ const d=payload?.data; if(!d) return ''; if(typeof d.content==='string') return stripTags(d.content); if(Array.isArray(d.passages)&&d.passages.length){ return stripTags(d.passages.map(p=>p.content||'').join(' ')); } }catch{} return ''; }
function extractTextFromSearch(payload){ try{ const d=payload?.data; if(!d) return ''; if(Array.isArray(d.verses)&&d.verses.length){ return d.verses.map(v=>v.text||'').join(' '); } if(Array.isArray(d.passages)&&d.passages.length){ return d.passages.map(p=>p.content||p.reference||'').join(' '); } }catch{} return ''; }
function stripTags(html){ return String(html||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }

/* === Analyse légère === */
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

/* === Rubriques 1–3 (inchangées, ton narratif) === */
function buildOpeningPrayer({ book, chapter }){ const ref=`${book} ${chapter}`;
  return `**Prière d’ouverture**  \n*Référence :* ${ref}\n\nSeigneur, je m’approche de ta Parole avec un cœur qui veut apprendre. Dans ce chapitre, tu parles pour créer, corriger et consoler. Donne-moi de recevoir la vérité sans la tordre, de discerner ce qui vient de toi et d’y répondre avec simplicité. Si tu exposes ta sainteté, que je révère ton Nom; si tu révèles mes égarements, que je confesse et me détourne; si tu ouvres un chemin d’espérance, que je l’embrasse avec foi. Que l’Alliance oriente mon esprit, que l’Évangile règle mes affections, et que l’obéissance devienne ma joie. Je te demande non une lecture brillante, mais une rencontre vraie: fais de cette page un lieu d’écoute, et de mon cœur un terrain docile. Au nom de Jésus-Christ, amen.`; }

function buildRubrique2({ book, chapter, analysis }){ const ref=`${book} ${chapter}`; const motifs=(analysis.topWords||[]).slice(0,6).join(', ');
  const t=[];
  t.push(`**Contexte et fil narratif**`);
  t.push(`*Référence :* ${ref}`);
  t.push('');
  t.push(`Ce chapitre ne se comprend qu’à l’intérieur d’une architecture plus vaste. L’auteur n’empile pas des scènes, il conduit un itinéraire: ce qui précède pose des repères, ce qui suit reprend et approfondit. La section présente rassemble des motifs ( ${motifs} ) et les agence pour faire ressortir une ligne maîtresse. Le lecteur est ainsi guidé d’un repère doctrinal à l’autre: Dieu prend l’initiative, l’être humain répond, et la pédagogie divine façonne progressivement un peuple.`);
  t.push('');
  t.push(`Sur le plan littéraire, la progression se fait par unités cohérentes — récit, discours, oracle ou généalogie selon le genre — qui convergent vers un **thème directeur**. Les répétitions ne sont pas des redites: elles jouent le rôle d’un marteau doux qui imprime la vérité. Les contrastes forcent le discernement (lumière/ténèbres, fidélité/infidélité, sagesse/folie) et mettent au jour l’appel de Dieu.`);
  t.push('');
  t.push(`Canoniquement, la page s’éclaire par résonance: création et providence (Psaumes 19; Psaumes 104), pédagogie de la Loi (Deutéronome 6; Proverbes 1:7), promesse et accomplissement qui convergent en Christ (Luc 24:27; Jean 5:39). Ces échos ne tordent pas le texte: ils lui donnent profondeur en le situant dans l’unique histoire du salut.`);
  t.push('');
  t.push(`Doctrinalement, la dynamique est tripartite. **D’abord l’initiative de Dieu**: sujet véritable, il crée, appelle, juge et sauve; la grâce devance tout mérite. **Ensuite la réponse humaine**: fidélité hésitante, confiance ou résistance; l’Écriture éduque plutôt qu’elle ne flatte. **Enfin la patience du Seigneur**: corrections, promesses, relèvements ; la vérité s’inscrit dans la durée et sanctifie la vie ordinaire. Ainsi la narration devient doctrine, et la doctrine devient chemin.`);
  t.push('');
  t.push(`À la lumière du Christ, la section prend sa portée entière: promesse en germe, figure typologique ou annonce directe, elle oriente vers la croix et la résurrection, où la justice et la miséricorde se rencontrent. Ce passage enseigne moins la performance que la conversion: apprendre à nommer le mal pour s’en détourner, à célébrer la bonté de Dieu pour y demeurer, à poser aujourd’hui l’acte qui convient à la vérité reçue.`);
  t.push('');
  t.push(`Si l’accent porte sur la fragilité humaine, ce n’est pas pour l’ériger en fatalité, mais pour exalter la suffisance de la grâce. S’il met en avant l’obéissance, ce n’est jamais la monnaie d’échange d’un salut à gagner, mais le fruit naturel d’une fidélité première. De là naît une lecture « devant Dieu »: je ne juge pas l’Écriture, j’accueille son jugement qui libère. La mémoire de ses œuvres fonde l’obéissance; la mémoire de mes égarements appelle la vigilance; la mémoire de ses promesses entretient la persévérance.`);
  t.push('');
  t.push(`En somme, cette page est un atelier de formation spirituelle. La vérité reçue devient prière; la prière enfante l’obéissance; l’obéissance devient témoignage. Le chapitre s’inscrit ainsi dans une trajectoire où l’on apprend à marcher humblement avec Dieu, porté par sa Parole qui éclaire, corrige et console.`);
  return inflateToRange(t.join('\n'),2000,2500,{book,chapter});
}

function buildPrevChapterQnA({ book, chapter }){ const ch=parseInt(chapter,10);
  const generic={ fil:`Le chapitre précédent a posé un cadre théologique (origine, alliance, loi ou promesse) qui ouvre logiquement sur l’approfondissement présent: ce qui était énoncé devient enjeu vécu.`, pers:`Les acteurs déjà introduits reviennent avec des fonctions clarifiées (responsabilité, épreuve, mission). Le décor n’est pas neutre: il sert la pédagogie divine.`, dieu:`Sa sainteté interdit l’autojustification; sa miséricorde interdit le désespoir; sa fidélité rend l’obéissance possible. Ce triptyque oriente l’interprétation de la section actuelle.`, tensions:`Limites humaines, attente d’une promesse, conflit latent: la suite reprend ces fils pour dresser un diagnostic vrai et proposer un chemin de vie.`, attente:`Une mise au clair doctrinale ou un déplacement narratif que la section présente commence à honorer en orientant le lecteur vers la fidélité concrète.` };
  if(Number.isFinite(ch)&&ch>1){ const prev=`${book} ${ch-1}`;
    return `**Questions du chapitre précédent**  \nQuestions et réponses sur le chapitre précédent  \n*Référence :* ${prev}\n\n1. **Quel fil narratif conduit vers la suite ?**  \n→ ${generic.fil}\n\n2. **Quels personnages ou lieux réapparaissent et que gagnent-ils en précision ?**  \n→ ${generic.pers}\n\n3. **Qu’a révélé ${prev} sur Dieu et comment cela règle la lecture actuelle ?**  \n→ ${generic.dieu}\n\n4. **Quelles tensions restaient ouvertes et commencent à se résoudre ?**  \n→ ${generic.tensions}\n\n5. **Quelle attente la clôture de ${prev} suscitait-elle ?**  \n→ ${generic.attente}`; }
  const ref=`${book} ${chapter}`;
  return `**Questions d’introduction**  \n*Référence :* ${ref}\n\n1. **Quel horizon théologique s’ouvre dès l’entrée ?**  \n→ Le texte installe la souveraineté de Dieu et la finalité salvifique de l’histoire; on lira la suite dans cette perspective.\n\n2. **Comment l’homme est-il situé d’emblée ?**  \n→ Créature appelée à vivre de la Parole, à recevoir l’Alliance et à exercer une responsabilité réglée par Dieu.\n\n3. **Quels thèmes structurants émergent ?**  \n→ Création/providence, promesse/jugement, sagesse/folie, appel/obéissance; autant d’axes qui guideront la lecture.`; }

/* === Rubrique 4 (LONGUE) === */
function buildRubrique4_Canonicite({ book, chapter, analysis }){
  const ref=`${book} ${chapter}`; const motifs=(analysis.topWords||[]).slice(0,5).join(', ');
  const p=[];
  p.push(`**Canonicité et cohérence**`);
  p.push(`*Référence :* ${ref}`);
  p.push('');
  p.push(`Ce chapitre prend sa pleine mesure lorsqu’on le replace dans l’économie du canon, où promesse et accomplissement ne s’opposent pas mais se répondent. La Bible n’est pas une mosaïque d’assertions sans lien; elle déroule l’histoire unique du salut, depuis l’initiative créatrice de Dieu jusqu’à l’accomplissement en Christ, puis l’envoi de l’Église dans l’Esprit. Dans ce cadre, le passage présent n’est ni une parenthèse ni une redite: il est une pierre portante dont la place explique la forme et la charge. On y entend des motifs récurrents (${motifs}) qui ne relèvent pas d’un hasard lexical, mais d’une pédagogie: Dieu enseigne en reprenant, en approfondissant, en replaçant les mêmes vérités dans des contextes variés pour former un peuple intelligent et obéissant.`);
  p.push('');
  p.push(`Lire canoniquement, c’est accepter d’être conduit par les résonances. Certaines sont proches: échos au sein du même livre, rappels d’un épisode antérieur, promesses reprises. D’autres sont lointaines: Psaumes 119 invite à aimer la Loi parce qu’elle libère; Proverbes 1:7 établit la crainte du Seigneur comme principe de la sagesse; les prophètes, d’Ésaïe à Malachie, rattachent l’éthique à l’Alliance; le Nouveau Testament éclaire l’ensemble en Christ (Luc 24:27; Jean 5:39). Ces correspondances ne sont pas des artifices: elles traduisent l’unité d’un dessein où Dieu demeure fidèle à lui-même, et où la diversité des genres – récit, loi, sagesse, prophétie, évangile, épître – sert une même finalité, la communion du pécheur réconcilié avec son Dieu.`);
  p.push('');
  p.push(`Dans ce chapitre, la cohérence se perçoit à trois niveaux. **D’abord l’axe théologique**: Dieu reste le sujet véritable, et l’homme, sans être écrasé, n’occupe jamais la place centrale. Cette disposition interdit l’orgueil religieux; elle fonde la paix. **Ensuite l’axe narratif**: ce qui a été posé auparavant trouve ici un approfondissement, et la clôture prépare discrètement la suite; c’est la logique de l’Alliance qui avance par engagements réitérés, jugements salutaires et consolations. **Enfin l’axe ecclésial**: la communauté qui reçoit ce texte est appelée à se laisser façonner; doctrine, culte et vie ordinaire sont ajustés ensemble, non par contrainte extérieure, mais par la vérité reconnue comme bonne.`);
  p.push('');
  p.push(`Cette vision canonique protège des lectures morcelées. D’un côté, elle refuse le biblicisme qui découpe des versets comme des slogans: un verset s’entend dans sa phrase, la phrase dans sa section, la section dans l’architecture du livre, le livre dans le canon. De l’autre, elle refuse l’individualisme qui ferait de l’expérience subjective la norme de l’interprétation. Le texte exerce au contraire un jugement bienfaisant: il corrige nos projections, ordonne nos affections, et nous apprend à penser avec l’Église, sur la longue durée. Ainsi la cohérence n’étouffe pas la diversité; elle l’harmonise, comme une polyphonie où chaque voix, entendue à sa place, magnifie le thème commun de la grâce souveraine.`);
  p.push('');
  p.push(`Concrètement, replacer ${ref} dans cette unité, c’est entendre à nouveaux frais ses appels: si le passage met au jour le péché, c’est pour mieux dévoiler la suffisance de la grâce; s’il insiste sur l’obéissance, c’est comme fruit d’une fidélité première; s’il parle de jugement, c’est au service de la vie. Une telle lecture devient performative: la vérité reçue engendre la prière, la prière nourrit l’obéissance, l’obéissance se fait témoignage paisible et ferme. **Cohérence canonique** ne signifie pas abstraction; elle désigne l’art de Dieu de conduire, de rappeler, de relancer, jusqu’à faire mûrir un peuple qui marche humblement avec lui.`);
  return inflateToRange(p.join('\n'),2000,2500,{book,chapter});
}

/* === Autres rubriques sobres (5–27) — on les allongera après validation === */
function basic({book,chapter}, title, body){ return `${title}  \n*Référence :* ${book} ${chapter}\n\n${body}`; }
function buildTestament(ctx){return basic(ctx,'**Ancien/Nouveau Testament**','Les résonances intertestamentaires donnent l’éclairage juste sans tordre le sens littéral.');}
function buildPromesses(ctx){return basic(ctx,'**Promesses**','Dieu prend l’initiative, soutient l’espérance et appelle à la fidélité.');}
function buildPecheEtGrace(ctx){return basic(ctx,'**Péché et grâce**','Le diagnostic est vrai; la grâce est première et suffisante.');}
function buildChristologie(ctx){return basic(ctx,'**Christologie**','Le Christ éclaire l’ensemble des Écritures (Luc 24:27; Jean 5:39).');}
function buildEspritSaint(ctx){return basic(ctx,'**Esprit Saint**','Il illumine, convainc, sanctifie et envoie.');}
function buildAlliance(ctx){return basic(ctx,'**Alliance**','La relation à Dieu est réglée par sa Parole: don, vocation, responsabilité.');}
function buildEglise(ctx){return basic(ctx,'**Église**','Peuple modelé par Parole et sacrements, pour la louange et le service.');}
function buildDisciples(ctx){return basic(ctx,'**Discipulat**','Appel, apprentissage, persévérance; la grâce soutient l’obéissance.');}
function buildEthique(ctx){return basic(ctx,'**Éthique**','La vérité fonde la vie juste, et non l’inverse; la morale découle de l’Évangile.');}
function buildPriere(ctx){return basic(ctx,'**Prière**','La Parole reçue devient supplication, action de grâce et intercession.');}
function buildMission(ctx){return basic(ctx,'**Mission**','Dieu rassemble et envoie vers les nations, dans l’humilité et la vérité.');}
function buildEsperance(ctx){return basic(ctx,'**Espérance**','Le jugement sert la vie; la fin nourrit la fidélité présente.');}
function buildExhortation(ctx){return basic(ctx,'**Exhortation**','Marcher selon la lumière reçue, sans dureté ni mollesse.');}
function buildApplicationPerso(ctx){return basic(ctx,'**Application personnelle**','La vérité devient actes précis: renoncer, choisir, servir.');}
function buildApplicationCollective(ctx){return basic(ctx,'**Application communautaire**','Unité, sainteté, service mutuel: la charité ordonnée.');}
function buildLiturgie(ctx){return basic(ctx,'**Liturgie**','Le culte oriente l’amour de Dieu et du prochain et façonne la semaine.');}
function buildMeditation(ctx){return basic(ctx,'**Méditation**','Garder, ruminer, pratiquer: mémoire et obéissance se répondent.');}
function buildMemoVerset({book,chapter}){return `**Verset-clé**  \n*Référence :* ${book} ${chapter}; v.1  \nÀ mémoriser et vivre.`;}
function buildTypologie(ctx){return basic(ctx,'**Typologie**','Figures et accomplissements convergent en Christ, sans violence du sens.');}
function buildTheologieSystematique(ctx){return basic(ctx,'**Théologie systématique**','Locus principaux: Dieu, Christ, Esprit, Église, Salut.');}
function buildHistoireDuSalut(ctx){return basic(ctx,'**Histoire du salut**','Une seule histoire: de la promesse à l’accomplissement.');}
function buildThemesSecondaires(ctx){return basic(ctx,'**Thèmes secondaires**','Noter motifs récurrents et nuances textuelles.');}
function buildDoutesObjections(ctx){return basic(ctx,'**Doutes/objections**','Répondre avec patience et Écriture, non par slogans.');}
function buildSynthese(ctx){return basic(ctx,'**Synthèse**','Résumer le propos et son effet spirituel; discerner le pas à faire.');}
function buildPlanDeLecture(ctx){return basic(ctx,'**Plan de lecture**','Continuer: lire, prier, pratiquer, témoigner; inscrire la Parole dans la durée.');}

/* === Prière de clôture === */
function buildClosingPrayer({ book, chapter }){ const ref=`${book} ${chapter}`;
  return `**Prière de clôture**  \n*Référence :* ${ref}\n\nPère, je te rends grâce pour la lumière consentie. Ce chapitre a repris mes pas, corrigé mes illusions et établi mon cœur dans l’espérance. Grave en moi ce que tu as enseigné; fais mûrir ce que tu as semé. Donne-moi d’aimer la vérité plus que mon confort, de chercher la paix sans renoncer à la justice, et d’obéir sans dureté. Que l’Esprit Saint convertisse mes habitudes, règle mes paroles et dilate ma charité. Je veux marcher humblement avec toi, dans la joie simple de celui qui a été rejoint. Au nom de Jésus-Christ, amen.`; }

/* === Aide longueur === */
function inflateToRange(text,min,max,ctx){ let t=String(text||'').trim(); if(t.length>=min&&t.length<=max) return t;
  const add=[]; add.push(` Cette lecture s’inscrit dans l’ensemble du canon (Psaumes 119; Hébreux 4:12; 2 Timothée 3:14-17): la Parole qui éclaire fonde l’obéissance et nourrit l’espérance.`);
  add.push(` Elle suppose une vie de prière et de communion (Actes 2:42; Éphésiens 4:11-16), afin que l’intelligence devienne fidélité durable.`);
  add.push(` Enfin, ${ctx.book} ${ctx.chapter} invite à discerner la providence par laquelle Dieu conduit son peuple vers la maturité (Romains 8:28-30; 1 Pierre 1:3-9).`);
  let i=0; while(t.length<min && i<add.length) t+=add[i++]; if(t.length>max){ const cut=t.slice(0,max); const last=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? ')); t=cut.slice(0,last>0?last+1:max).trim(); } return t; }

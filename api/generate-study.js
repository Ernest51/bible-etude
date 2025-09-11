// /api/generate-study.js — conforme runbook (toujours 200, GET hint / POST 28 rubriques)
function send200(ctx, data) {
  if (ctx.res) { ctx.res.status(200).setHeader('Content-Type','application/json; charset=utf-8'); ctx.res.setHeader('Cache-Control','no-store'); ctx.res.json(data); return; }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control':'no-store' } });
}
async function readBody(ctx) {
  // Support Node (Vercel) + stream fallback
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((resolve,reject)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',resolve); req.on('error',reject); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

/* ---------- YouVersion ---------- */
const YV_BOOK = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75' };
function linkRef(book, chapter, verseOrRange, version='LSG') {
  const code = YV_BOOK[book] || 'GEN';
  const ver  = (version || 'LSG').toUpperCase();
  const verId= YV_VERSION_ID[ver] || '93';
  const url  = `https://www.bible.com/fr/bible/${verId}/${code}.${chapter}.${ver}`;
  const label= verseOrRange ? `${book} ${chapter}:${verseOrRange}` : `${book} ${chapter}`;
  return `[${label}](${url})`;
}

/* ---------- Helpers contenu ---------- */
function expandUnique(base, pool, targetLen) {
  const used = new Set(); let out = base.trim();
  for (const sRaw of pool) {
    const s = sRaw.trim(); if (!s || used.has(s)) continue;
    out += (out.endsWith('\n') ? '' : '\n') + s + (/[.!?]$/.test(s) ? '' : '.');
    used.add(s);
    if (out.length >= targetLen) break;
  }
  if (out.length < targetLen) {
    let i = 1;
    for (const s of pool) {
      if (used.has(s)) continue;
      out += `\n- ${s}`;
      if (++i > 999 || out.length >= targetLen) break;
    }
  }
  return out;
}

function qaBlockSpecific_Gen1(book, chap) {
  return `### Questions du chapitre précédent

*Référence :* ${book} ${chap}

**Q1.** Qu’enseigne ${book} ${chap} sur Dieu comme Créateur ?  
**R.** Il est l’initiateur absolu : il parle et tout vient à l’existence, révélant sa souveraineté et sa bonté.

**Q2.** Pourquoi la formule « Dieu vit que cela était bon » est-elle répétée ?  
**R.** Pour affirmer que la création est voulue bonne par Dieu ; le mal ne vient pas de la matière mais d’une rupture ultérieure (cf. Gen 3).

**Q3.** Quelle dignité l’homme reçoit-il en ${book} ${chap}:26–27 ?  
**R.** Il porte l’**image de Dieu** : vocation à représenter Dieu, cultiver et garder la création, dans une responsabilité éthique.

**Q4.** En quoi ${book} ${chap} se distingue-t-il des mythes environnants ?  
**R.** Un seul Dieu, transcendant, créant par sa **Parole** sans rival ; pas de combat divin : l’ordre procède de la volonté bienveillante de Dieu.

**Q5.** Application : comment prier à partir de ${book} ${chap} ?  
**R.** Louer le Créateur, recevoir le monde comme don, et décider d’un geste concret de gardiennage (écologie, justice, compassion).`;
}

function qaBlockGeneric(book, chap) {
  const ref = `${book} ${chap}`;
  return `### Questions du chapitre précédent

*Référence :* ${ref}

**Q1.** Quel attribut de Dieu ressort de ${ref} ?  
**R.** Sa fidélité et sa souveraineté : il conduit l’histoire selon ses promesses.

**Q2.** Quel est le fil littéraire de ${ref} (progression, mots-clés) ?  
**R.** Une progression structurée avec des reprises stratégiques ; relever les verbes directeurs et les connecteurs.

**Q3.** Quelles tensions ou questions le chapitre laisse-t-il ouvertes ?  
**R.** Celles qui préparent le chapitre suivant (motifs récurrents, attente d’accomplissement, enjeux d’obéissance).

**Q4.** Quels échos canoniques éclairent ${ref} ?  
**R.** Passages parallèles dans la Loi/Prophètes/Sagesse et reprise christologique dans l’Évangile/Épîtres.

**Q5.** Application : quelle décision concrète aujourd’hui ?  
**R.** Une prière précise et un pas d’obéissance mesurable (relation, justice, service, espérance).`;
}

/* ---------- Génération de contenu par passage ---------- */
function studyForGenesis1(version, perLen) {
  const b='Genèse', c=1;
  const jn1   = linkRef('Jean',1,'1–3',version);
  const ps33  = linkRef('Psaumes',33,'6',version);
  const he11  = linkRef('Hébreux',11,'3',version);
  const col1  = linkRef('Colossiens',1,'16–17',version);

  const sections = [];
  const add = (id, title, base, pool=[]) => sections.push({ id, title, description: '', content: expandUnique(base, pool, perLen) });

  // 1
  add(1,'Prière d’ouverture',
`### Prière d’ouverture

*Référence :* ${b} ${c}

Père, nous venons écouter ta Parole. Comme au commencement, que ta lumière disperse nos ténèbres et que ton Esprit plane sur nos pensées. Donne-nous une lecture humble et obéissante, pour que ta gloire nous conduise à l’adoration et au service.`,
[
  'Nous nous déposons devant toi pour recevoir ce que tu dis',
  'Éloigne de nous les lectures arbitraires et donne l’intelligence spirituelle',
  'Que la foi naisse et grandisse à l’écoute de ta Parole vivante',
  'Conduis-nous de la compréhension à l’obéissance'
]);

  // 2
  add(2,'Canon et testament',
`### Canon et testament

*Référence :* ${b} ${c}

${b} ${c} ouvre l’Écriture et révèle le même Dieu créateur que le Nouveau Testament (${jn1}; ${he11}). La révélation progresse sans se contredire : tout est créé par la Parole (${ps33}) et subsiste en Christ (${col1}).`,
[
  'Le canon donne l’horizon d’interprétation et évite l’isolement des textes',
  'Le Christ est la clé qui récapitule la création et la rédemption',
  'L’autorité de l’Écriture vient de Dieu qui s’y fait connaître'
]);

  // 3 (Q/R spécifique demandée)
  sections.push({
    id: 3,
    title: 'Questions du chapitre précédent',
    description: 'Points concrets pour relire et intégrer la lecture.',
    content: qaBlockSpecific_Gen1(b, c)
  });

  // 4..28 (gabarit doctrinal stable)
  const doctrinalTitles = {
    4:'Titre du chapitre',5:'Contexte historique',6:'Structure littéraire',
    7:'Genre littéraire',8:'Auteur et généalogie',9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',
    12:'Références croisées',13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison entre versets',19:'Parallèle avec Actes 2',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement pour enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',27:'Versets à retenir',28:'Prière de fin'
  };
  const poolCommon = [
    'La Bible s’explique par la Bible et garde l’unité de la foi',
    'Le Christ accomplit la promesse et oriente l’interprétation',
    'La Parole édifie l’Église et forme la vie quotidienne',
    'La doctrine naît du texte reçu, non de la spéculation',
    'La prière accompagne l’étude et ouvre à l’obéissance'
  ];
  const baseFor = (t)=>`### ${t}\n\n*Référence :* ${b} ${c}\n\nLecture de ${linkRef(b,c,'', 'LSG')} avec accent ${t.toLowerCase()}.`;

  for (let i=4;i<=28;i++) {
    sections.push({ id:i, title:doctrinalTitles[i] || `Rubrique ${i}`, description:'', content: expandUnique(baseFor(doctrinalTitles[i] || `Rubrique ${i}`), poolCommon, perLen) });
  }

  // descriptions colonne gauche
  const desc = {
    1:'Invocation du Saint-Esprit pour éclairer l’étude.',
    2:'Place dans le canon (AT/NT) et continuité biblique.',
    3:'Points concrets et réponses pour relire la lecture.',
    4:'Formulation doctrinale synthétique.',
    5:'Cadre historique et culturel.',
    6:'Découpage et progression.',
    7:'Incidences herméneutiques.',
    8:'Auteur et inspiration.',
    9:'Pivot théologique du chapitre.',
    10:'Grammaire, syntaxe, contexte.',
    11:'Termes clés et portée.',
    12:'Passages parallèles.',
    13:'Attributs de Dieu, création…',
    14:'Rattachement systématique.',
    15:'Vertus produites par la doctrine.',
    16:'Typologie et symboles.',
    17:'Textes d’appui concordants.',
    18:'Harmonisation interne.',
    19:'Continuité dans l’Église.',
    20:'Formulation à mémoriser.',
    21:'Gouvernance, culte, mission.',
    22:'Transmission et consolation.',
    23:'Pédagogie adaptée.',
    24:'Annonce et contextualisation.',
    25:'Conseil et consolation.',
    26:'Repentance, foi, obéissance.',
    27:'Sélection utile à retenir.',
    28:'Action de grâces et bénédiction.'
  };
  for (const s of sections) s.description = desc[s.id] || s.description || '';

  return sections.sort((a,b)=>a.id-b.id);
}

function genericStudy(book, chap, version, perLen) {
  const titles = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',
    9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',
    13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',
    27:'Versets à retenir',28:'Prière de fin'
  };
  const poolCommon = [
    'La Bible s’explique par la Bible et garde l’unité de la foi',
    'Le Christ accomplit la promesse et oriente l’interprétation',
    'La Parole édifie l’Église et forme la vie quotidienne',
    'La doctrine naît du texte reçu, non de la spéculation',
    'La prière accompagne l’étude et ouvre à l’obéissance'
  ];
  const linkChap = linkRef(book, chap, '', version);
  const sections = [];

  // 1–2 standard
  const base1 = `### ${titles[1]}\n\n*Référence :* ${book} ${chap}\n\nPère, éclaire notre lecture : que ta Parole forme notre intelligence et notre obéissance.`;
  const base2 = `### ${titles[2]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} dans l’unité de l’AT et du NT : continuité de la révélation, accomplie en Christ.`;
  sections.push({ id:1, title:titles[1], description:'', content: expandUnique(base1, poolCommon, perLen) });
  sections.push({ id:2, title:titles[2], description:'', content: expandUnique(base2, poolCommon, perLen) });

  // 3 = Q/R générique (demandé)
  sections.push({
    id:3,
    title: titles[3],
    description: 'Questions concrètes et réponses brèves pour intégrer la lecture.',
    content: qaBlockGeneric(book, chap)
  });

  // 4–28 gabarit
  for (let i=4;i<=28;i++) {
    const base = `### ${titles[i]}\n\n*Référence :* ${book} ${chap}\n\nLecture de ${linkChap} avec accent ${titles[i].toLowerCase()}.`;
    sections.push({ id:i, title:titles[i], description:'', content: expandUnique(base, poolCommon, perLen) });
  }

  return sections;
}

/* ---------- Build + handler ---------- */
function buildStudy(passage, length, version='LSG') {
  const allowed = [500,1500,2500];
  const perLen = allowed.includes(Number(length)) ? Number(length) : 1500;
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(passage||'').trim());
  const book = m ? m[1].trim() : 'Genèse';
  const chap = m ? parseInt(m[2],10) : 1;
  const sections = (book === 'Genèse' && chap === 1)
    ? studyForGenesis1(version, perLen)
    : genericStudy(book, chap, version, perLen);
  return { study: { sections } };
}

async function core(ctx) {
  const method = ctx.req?.method || 'GET';
  if (method === 'GET') {
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST JSON { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques.'
    });
  }
  if (method === 'POST') {
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim();
    const length  = Number(body?.options?.length);
    const version = String((body?.options?.translation || 'LSG')).toUpperCase();
    const safePassage = passage || 'Genèse 1';
    try { return send200(ctx, buildStudy(safePassage, length, version)); }
    catch (e) { return send200(ctx, { ok:false, emergency:true, error:String(e), study:{ sections:[] } }); }
  }
  // autres méthodes → hint GET-like (200)
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res) {
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

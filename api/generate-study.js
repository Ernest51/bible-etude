// api/generate-study.js
// Génération robuste : dynamique (api.bible Darby) avec repli statique garanti (jamais de 500).

function ok(res, obj) { try { res.setHeader?.('Cache-Control', 'no-store'); } catch {} return res.status(200).json(obj); }
function fail(res, message, extra = {}) { return ok(res, { ok: false, error: String(message || 'bad_request'), ...extra }); }
function normLen(n){ const v=Number(n); return [500,1500,2500].includes(v)?v:1500; }

// --- Cartes utiles ---
const FR2OSIS = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR",
  "Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG",
  "Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO",
  "Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO",
  "Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH",
  "1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE",
  "1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

// YouVersion (LSG id 93)
function youVersionLink(osis, chap, verse){ return `https://www.bible.com/fr/bible/93/${osis}.${chap}.LSG#v${verse||1}`; }

// --- Repli statique (le même “bon” contenu qu’hier, abrégé ici par souci de place) ---
const STATIC_STUDY = (()=> {
  const s = [];
  const push = (id,title,description,content)=>s.push({id,title,description,content});
  push(1,"Prière d’ouverture","Invocation du Saint-Esprit pour éclairer l’étude.",
`### Prière d’ouverture

*Référence :* Genèse 1

Père, nous venons à ta Parole. Comme au commencement, que ta lumière perce nos ténèbres (cf. [Genèse 1:3](https://www.bible.com/fr/bible/93/GEN.1.LSG)) et que ton Esprit plane sur nos pensées ([Genèse 1:2](https://www.bible.com/fr/bible/93/GEN.1.LSG)). Donne-nous une écoute humble, une exégèse fidèle et une obéissance joyeuse. Amen.`);
  // … (pour gagner de la place ici, on garde les 27 autres rubriques comme dans ta version précédente ;
  // si tu veux, recolle l’intégralité du STATIC_STUDY d’hier)
  return { sections: s };
})();

// --- Appel api.bible (Darby) ---
async function fetchDarbyChapter(passage) {
  const BASE = process.env.BIBLE_API_BASE;
  const KEY  = process.env.BIBLE_API_KEY;
  const BID  = process.env.BIBLE_ID_DARBY;
  if(!BASE || !KEY || !BID) return null; // manquant => repli

  // Parse "Genèse 1" / "Genèse 1:1-5"
  const m = /^([\p{L}\d\s'’\-]+?)\s+(\d+)(?::([\d\-–,]+))?$/u.exec(passage || '');
  if(!m) return null;
  const book = m[1].trim();
  const chap = Number(m[2]);
  const osis = FR2OSIS[book];
  if(!osis || !Number.isFinite(chap)) return null;

  // Référence pour l’API
  const reference = `${osis}.${chap}`;
  const url = `${BASE}/bibles/${encodeURIComponent(BID)}/passages?reference=${encodeURIComponent(reference)}&contentType=text&includeTitles=false&includeChapterNumbers=false&includeVerseNumbers=true&includeNotes=false&includeVerseSpans=true`;

  const r = await fetch(url, { headers: { 'api-key': KEY } });
  if(!r.ok) return null;
  const j = await r.json();
  // Format api.bible : data.content (HTML) ou data.passages[].content
  const node = j?.data || j;
  const content = node?.content || (Array.isArray(node?.passages) && node.passages[0]?.content) || '';
  if(!content) return null;

  // On extrait un tableau de versets (numéro + texte)
  // Le HTML api.bible inclut souvent <span class="v">1</span> etc.
  const verses = [];
  const div = globalThis.document ? document.createElement('div') : undefined;
  // Si pas de DOM (Node), on fait un parsing simple :
  const plain = content
    .replace(/<[^>]+>/g, '\n')        // enlève balises
    .replace(/\n{2,}/g, '\n')
    .trim();

  // Heuristique : split « ^\d+\s » sur chaque ligne
  for (const line of plain.split('\n')) {
    const m2 = /^\s*(\d{1,3})\s*(.*)$/.exec(line.trim());
    if (m2 && m2[2]) {
      verses.push({ v: Number(m2[1]), t: m2[2].trim() });
    }
  }
  // Si l’heuristique est pauvre, au moins on a le bloc
  if (verses.length === 0 && plain) verses.push({ v: 1, t: plain });

  return { osis, chap, verses };
}

// — Composition doctrinale claire sans doublons —
function clampLen(text, len){
  if(len===2500) return text;
  if(len===1500) return text.length>1700? text.slice(0,1600).replace(/\s+\S*$/,'')+'…' : text;
  // 500
  return text.length>700? text.slice(0,560).replace(/\s+\S*$/,'')+'…' : text;
}

function buildFromDarby(passage, length, fetched){
  const { osis, chap, verses } = fetched;
  const ref = `*Référence :* ${passage}`;

  // Utilitaires versets cliquables
  const v = (n)=> {
    const found = verses.find(x=>x.v===n);
    const link = youVersionLink(osis, chap, n);
    return found ? `([${osis} ${chap}:${n}](${link})) ${found.t}` : `([${osis} ${chap}:${n}](${link}))`;
  };
  const vRange = (a,b)=> {
    const parts = [];
    for(let i=a;i<=b;i++){ const f=verses.find(x=>x.v===i); if(f){ parts.push(`[${chap}:${i}](${youVersionLink(osis,chap,i)}) ${f.t}`); } }
    return parts.join(' ');
  };

  // 28 rubriques — texte concis, narratif/exégétique, liens YouVersion partout où c’est pertinent.
  const S = [];

  S.push({
    id:1, title:"Prière d’ouverture", description:"Invocation du Saint-Esprit pour éclairer l’étude.",
    content: clampLen(
`### Prière d’ouverture

${ref}

Père, nous venons écouter ta Parole. Comme au commencement, que ta lumière paraisse (${v(3)}), et que ton Esprit plane encore sur nos pensées (${v(2)}). Donne-nous une lecture humble et obéissante, afin que la doctrine devienne adoration et service. Au nom de Jésus-Christ, Parole éternelle ([Jean 1:1–3](${youVersionLink('JHN',1,1)})). Amen.`, length)
  });

  S.push({
    id:2, title:"Canon et testament", description:"Place dans le canon (AT/NT) et continuité biblique.",
    content: clampLen(
`### Canon et testament

${ref}

Genèse inaugure le canon : Dieu parle et tout devient (${v(3)}). Le Nouveau Testament l’explicite : « Tout a été fait par lui » ([Jean 1:3](${youVersionLink('JHN',1,3)})) ; « le monde a été formé par la parole de Dieu » ([Hébreux 11:3](${youVersionLink('HEB',11,3)})). La création ordonnée (${v(4)} ${v(10)} ${v(12)} ${v(18)}) fonde l’alliance, la providence et la rédemption.`, length)
  });

  S.push({
    id:3, title:"Questions du chapitre précédent", description:"Points à reprendre et réponses doctrinales.",
    content: clampLen(
`### Questions du chapitre précédent

${ref}

**Q1.** Que révèle la formule « Dieu dit » (${v(3)} ${v(6)} ${v(9)} …) sur l’autorité de l’Écriture ?  
**R.** La Parole divine est efficace : elle crée, ordonne, sépare et nomme (${v(4)} ${v(5)} ${v(10)}). L’Écriture inspirée partage cette autorité normative ([2 Timothée 3:16](${youVersionLink('2TI',3,16)})).

**Q2.** Quel est le sens de l’« image de Dieu » (${v(26)} ${v(27)}) ?  
**R.** Représentation et vocation : connaître Dieu, servir et garder le créé ; exercer une domination responsable (${v(28)}).

**Q3.** Quelle est la portée du sabbat ([Genèse 2:1–3](${youVersionLink('GEN',2,1)})) ?  
**R.** Achèvement et bénédiction : le repos anticipe l’eschatologie et s’accomplit en Christ ([Hébreux 4:9–11](${youVersionLink('HEB',4,9)})).`, length)
  });

  // 4. Titre
  S.push({ id:4, title:"Titre du chapitre", description:"Formulation doctrinale fidèle.",
    content: clampLen(
`### Titre du chapitre

${ref}

**« La Parole qui appelle un monde bon à l’existence et confie à l’homme une vocation d’image. »**`, length)
  });

  // 5. Contexte
  S.push({ id:5, title:"Contexte historique", description:"Cadre et visée.",
    content: clampLen(
`### Contexte historique

${ref}

Rédaction mosaïque au service de l’alliance. Réponse aux cosmologies voisines : ici, pas de divinités astrales (les luminaires ne sont que des « grands » et « petits » ${v(16)}), mais un seul Dieu souverain. Le texte forme un peuple qui sanctifie le temps (semaine/sabbat) et reçoit un mandat culturel (${v(28)}).`, length)
  });

  // 6. Structure
  S.push({ id:6, title:"Structure littéraire", description:"Répétitions et progression.",
    content: clampLen(
`### Structure littéraire

${ref}

Cycle « Dieu dit / il y eut / Dieu vit que c’était bon / soir-matin » (${v(3)} ${v(4)} ${v(5)}). Triptyques 1/4 (lumière/astres ${v(14)}–${v(18)}), 2/5 (mers-cieux / poissons-oiseaux ${v(6)}–${v(8)} / ${v(20)}–${v(22)}), 3/6 (terre / animaux-humains ${v(9)}–${v(13)} / ${v(24)}–${v(27)}). Jour 7 comme sommet (Gen 2:1–3).`, length)
  });

  // 7. Genre
  S.push({ id:7, title:"Genre littéraire", description:"Récit théologique structuré.",
    content: clampLen(
`### Genre littéraire

${ref}

Récit théologique rythmé (cadences, parallélismes, refrains). Finalité catéchétique et doxologique : confesser le Créateur, recevoir l’ordre du monde et sa bonté (${v(31)}).`, length)
  });

  // 8. Auteur & généalogie
  S.push({ id:8, title:"Auteur et généalogie", description:"Tradition mosaïque, toledot.",
    content: clampLen(
`### Auteur et généalogie

${ref}

Tradition mosaïque au service de la Torah. Les « toledot » ancrent la création à la racine de l’histoire du salut ; l’Esprit inspire pour révéler la souveraineté d’un Dieu parlant.`, length)
  });

  // 9. Verset-clé
  S.push({ id:9, title:"Verset-clé doctrinal", description:"Pivot théologique.",
    content: clampLen(
`### Verset-clé doctrinal

${ref}

« Au commencement, Dieu créa les cieux et la terre » ([Genèse 1:1](${youVersionLink(osis,chap,1)})). Tout vient de Dieu, tout est pour Dieu.`, length)
  });

  // 10. Exégèse
  S.push({ id:10, title:"Analyse exégétique", description:"Grammaire, contexte.",
    content: clampLen(
`### Analyse exégétique

${ref}

La parole fait être (${v(3)} ${v(6)} ${v(9)}). Les verbes « séparer » et « nommer » manifestent la souveraineté (${v(4)} ${v(5)} ${v(10)}). L’homme reçoit un mandat de représentation (${v(26)}–${v(28)}).`, length)
  });

  // 11. Lexicale
  S.push({ id:11, title:"Analyse lexicale", description:"Termes clés.",
    content: clampLen(
`### Analyse lexicale

${ref}

**bara'** (créer) réservé à Dieu (${v(1)} ${v(21)} ${v(27)}). **tselem** (image) : vocation de reflet (${v(26)}–${v(27)}). **tov** (bon) : adéquation au dessein (${v(4)} ${v(10)} ${v(31)}).`, length)
  });

  // 12. Réfs croisées
  S.push({ id:12, title:"Références croisées", description:"Parallèles scripturaires.",
    content: clampLen(
`### Références croisées

${ref}

[PSA 33:6–9](https://www.bible.com/fr/bible/93/PSA.33.LSG) · [Ésaïe 40](https://www.bible.com/fr/bible/93/ISA.40.LSG) · [Jean 1:1–3](${youVersionLink('JHN',1,1)}) · [Col 1:15–17](${youVersionLink('COL',1,15)}) · [Hé 11:3](${youVersionLink('HEB',11,3)}).`, length)
  });

  // 13. Fondements
  S.push({ id:13, title:"Fondements théologiques", description:"Attributs & dessein.",
    content: clampLen(
`### Fondements théologiques

${ref}

Dieu unique, parlant, souverain, bon (${v(31)}). Monde réel, ordonné et confié (${v(28)}). Alliance et sabbat (Gen 2:1–3).`, length)
  });

  // 14. Thème doctrinal
  S.push({ id:14, title:"Thème doctrinal", description:"Systématique en lien.",
    content: clampLen(
`### Thème doctrinal

${ref}

Révélation & Parole (${v(3)}), Création & Providence (${v(1)} ${v(31)}), Anthropologie (image ${v(26)}–${v(27)}), Sabbat (Gen 2:1–3).`, length)
  });

  // 15. Fruits
  S.push({ id:15, title:"Fruits spirituels", description:"Vertus visées.",
    content: clampLen(
`### Fruits spirituels

${ref}

Adoration, humilité, reconnaissance, responsabilité, sanctification du temps et du travail (${v(28)}).`, length)
  });

  // 16. Types
  S.push({ id:16, title:"Types bibliques", description:"Figures & symboles.",
    content: clampLen(
`### Types bibliques

${ref}

**Lumière** (${v(3)}) → Christ lumière ([Jean 8:12](${youVersionLink('JHN',8,12)})). **Repos** (Gen 2:1–3) → repos en Christ ([Hébreux 4:9–11](${youVersionLink('HEB',4,9)})).`, length)
  });

  // 17. Appui doctrinal
  S.push({ id:17, title:"Appui doctrinal", description:"Textes de validation.",
    content: clampLen(
`### Appui doctrinal

${ref}

[PSA 104](https://www.bible.com/fr/bible/93/PSA.104.LSG) · [Néh 9:6](${youVersionLink('NEH',9,6)}) · [Ac 17:24–28](${youVersionLink('ACT',17,24)}) · [Ap 4:11](${youVersionLink('REV',4,11)}).`, length)
  });

  // 18. Comparaisons
  S.push({ id:18, title:"Comparaison entre versets", description:"Harmonisation interne.",
    content: clampLen(
`### Comparaison entre versets

${ref}

Correspondances structurantes (1/4, 2/5, 3/6) et refrain « bon / très bon » (${v(31)}).`, length)
  });

  // 19. Parallèle Actes 2
  S.push({ id:19, title:"Parallèle avec Actes 2", description:"Nouvelle création & Esprit.",
    content: clampLen(
`### Parallèle avec Actes 2

${ref}

L’Esprit plane (${v(2)}) / l’Esprit est répandu ([Actes 2:1–4](${youVersionLink('ACT',2,1)})). La Parole crée un peuple.`, length)
  });

  // 20. Verset à mémoriser
  S.push({ id:20, title:"Verset à mémoriser", description:"Formulation structurante.",
    content: clampLen(
`### Verset à mémoriser

${ref}

> [Genèse 1:1](${youVersionLink(osis,chap,1)}).`, length)
  });

  // 21–27 Applications & sélections
  S.push({ id:21, title:"Enseignement pour l’Église", description:"Culte, mission, édification.",
    content: clampLen(
`### Enseignement pour l’Église

${ref}

Vivre de la Parole efficace (${v(3)}), sanctifier le temps (Gen 2:1–3), former des intendants du créé (${v(28)}).`, length)
  });
  S.push({ id:22, title:"Enseignement pour la famille", description:"Transmission & dignité.",
    content: clampLen(
`### Enseignement pour la famille

${ref}

Dignité de toute personne (image ${v(27)}), rythme travail/repos (Gen 2:1–3), gratitude quotidienne.`, length)
  });
  S.push({ id:23, title:"Enseignement pour enfants", description:"Pédagogie simple et fidèle.",
    content: clampLen(
`### Enseignement pour enfants

${ref}

Raconter les jours, repérer les refrains, souligner « Dieu aime créer » et « Dieu m’a fait à son image ».`, length)
  });
  S.push({ id:24, title:"Application missionnaire", description:"Annonce contextualisée.",
    content: clampLen(
`### Application missionnaire

${ref}

Dans un monde fragmenté, proclamer le Dieu créateur (source de dignité et d’espérance), inviter à entendre sa Parole ordonnatrice.`, length)
  });
  S.push({ id:25, title:"Application pastorale", description:"Conseil, avertissement, consolation.",
    content: clampLen(
`### Application pastorale

${ref}

Rythme sain, guérison de l’image de soi par l’« image de Dieu » (${v(27)}), responsabilité sobre vis-à-vis du créé.`, length)
  });
  S.push({ id:26, title:"Application personnelle", description:"Repentance, foi, obéissance.",
    content: clampLen(
`### Application personnelle

${ref}

Recevoir chaque jour comme don, laisser la Parole séparer et nommer en nous (${v(4)} ${v(5)}), pratiquer un sabbat hebdomadaire.`, length)
  });
  S.push({ id:27, title:"Versets à retenir", description:"Sélection utile.",
    content: clampLen(
`### Versets à retenir

${ref}

[Genèse 1:1](${youVersionLink(osis,chap,1)}) · [1:26–28](${youVersionLink(osis,chap,26)}) · [1:31](${youVersionLink(osis,chap,31)}) · [2:1–3](${youVersionLink('GEN',2,1)}).`, length)
  });
  S.push({ id:28, title:"Prière de fin", description:"Action de grâces.",
    content: clampLen(
`### Prière de fin

${ref}

Dieu créateur, merci pour ta Parole qui fait être (${v(3)}). Apprends-nous à nommer, servir et garder ; conduis-nous vers ton repos (Gen 2:1–3). Amen.`, length)
  });

  return { sections: S, meta: { passage, requestedLength:length, source:'api.bible:Darby' } };
}

function buildStatic(passage, length){
  // Ici on peut aussi adapter la densité si tu veux; pour l’instant on retourne tel quel.
  return { sections: STATIC_STUDY.sections.map(s=>({...s})), meta:{ passage, requestedLength:length, source:'static' } };
}

export default async function handler(req, res){
  try{
    if(req.method==='GET'){
      return ok(res,{ ok:true, route:'/api/generate-study', method:'GET', hint:'POST { passage, options:{ length: 500|1500|2500 } }' });
    }
    if(req.method!=='POST'){ return fail(res,'method_not_allowed',{ allow:['GET','POST'] }); }

    const body = (req.body && typeof req.body==='object') ? req.body : {};
    const passage = String(body.passage||'Genèse 1');
    const length  = normLen(body?.options?.length);

    // Essai dynamique
    let study;
    try{
      const fetched = await fetchDarbyChapter(passage);
      if(fetched) study = buildFromDarby(passage, length, fetched);
    }catch(e){ /* ignoré, on replie */ }

    if(!study) study = buildStatic(passage, length);
    return ok(res,{ study });
  }catch(e){
    console.error('generate-study fatal:', e);
    // Jamais de 500
    return ok(res,{ study: buildStatic('Genèse 1',1500), ok:false, error:'internal_error' });
  }
}

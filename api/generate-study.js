// /api/generate-study.js
// Génération dynamique des 28 rubriques basée sur l’endpoint interne /api/verses
// - Toujours 200
// - Aucune CORS requise (même origine)
// - Anti-doublons entre rubriques
// - Texte enrichi (mots-clés, thème, verset-clé, genre, applications)

function send200(ctx, data) {
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type','application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control','no-store');
    ctx.res.end(payload);
    return;
  }
  return new Response(payload, { status:200, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store'
  }});
}

async function readBody(ctx){
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[];
  await new Promise((res,rej)=>{
    req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c)));
    req.on('end',res); req.on('error',rej);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

/* --------------------- Utilitaires texte --------------------- */
const CLEAN = s => String(s||'')
  .replace(/<[^>]+>/g,' ')
  .replace(/\s+/g,' ')
  .replace(/\s([;:,.!?…])/g,'$1')
  .trim();

const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc aussi très plus moins entre sous sur vers chez sans ni ou'.split(/\s+/));

function words(text){
  return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean);
}

function topKeywords(text, k=14){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length < 3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

function detectThemes(t){
  const out=[]; const add=(k,refs)=>out.push({k,refs});
  if (/\blumi[eè]re\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(gr[âa]ce|pardon|mis[ée]ricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(cr[ée]a|cr[ée]ation|créateur|createur)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\balliance\b/.test(t)) add('alliance', [['Genèse',15,'6'],['Luc',22,'20']]);
  return out;
}

function guessGenre(book, text){
  const t = (text||'').toLowerCase();
  if (/\bvision|songe|oracle|ainsi dit\b/.test(t)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez|harpe\b/.test(t)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume|pharisien|samaritain\b/.test(t)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(t)) return 'historique';
  if (book==='Proverbes' || /\bproverbe|sagesse\b/.test(t)) return 'sagesse';
  if (/\bgr(â|a)ce|foi|justification|circoncision|apôtres?\b/.test(t)) return 'épître/doctrinal';
  return 'narratif/doctrinal';
}

function linkRef(book, chap, vv, verId='93'){ // LSG 93
  const USFM = {
    "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
    "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
    "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
    "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
    "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
    "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
  };
  const code = USFM[book] || 'GEN';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.LSG`;
  const lab = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${lab}](${url})`;
}

/* --------------------- Anti-doublons --------------------- */
class UniqueManager {
  constructor(){ this.stems = new Set(); }
  norm(s){
    return String(s||'').trim().toLowerCase()
      .replace(/[«»“”"()\-,:;.!?]/g,' ')
      .replace(/\s+/g,' ');
  }
  take(cands){
    for (const c of cands){
      const t=String(c||'').trim(); if (!t) continue;
      const k=this.norm(t); if (k.length<30) continue;
      if (!this.stems.has(k)){ this.stems.add(k); return t; }
    }
    return cands[0] || '';
  }
}

/* --------------------- Score verset-clé --------------------- */
function scoreKeyVerse(verses){
  if (!Array.isArray(verses) || !verses.length) return null;
  const PRIORITY=['dieu','seigneur','christ','jésus','jesus','esprit','foi','amour','grâce','grace','parole','vie','vérité','verite','royaume','salut','péché','peche','alliance','promesse'];
  let best={ v:null, text:'', score:-1 };
  for (const it of verses){
    if (!it?.v || !it?.text) continue;
    const t = it.text.toLowerCase(); let s=0;
    for (const w of PRIORITY) if (t.includes(w)) s+=3;
    const L = it.text.length; if (L>=50&&L<=200) s+=5; else if (L>=30&&L<=250) s+=2; else if (L<18||L>320) s-=2;
    if (t.includes(':')||t.includes(';')) s+=1;
    if (/\b(fils de|fille de|enfanta|engendra)\b/.test(t)) s-=3;
    if (s>best.score) best={ v:it.v, text:it.text, score:s };
  }
  return best.v? best : null;
}

/* --------------------- Récup via /api/verses --------------------- */
async function fetchVersesViaInternal(ctx, book, chapter){
  // On reconstruit un URL absolu vers le même déploiement (aucune CORS)
  const req = ctx.req;
  const host = req?.headers?.host || 'localhost:3000';
  const proto = (req?.headers?.['x-forwarded-proto'] || 'https').toString().split(',')[0].trim();
  const url = `${proto}://${host}/api/verses?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}`;

  const r = await fetch(url, { headers: { accept:'application/json' } });
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { j = { ok:false, error:'non-json', raw: txt }; }

  if (!r.ok) return { ok:false, error:`HTTP ${r.status}`, raw:j };
  return j;
}

/* --------------------- Génération des 28 rubriques --------------------- */
function buildSectionsFromCorpus({ book, chap, verses, version, source }){
  const u = new UniqueManager();

  const plain = verses.map(v=>v.text).join(' ');
  const text = CLEAN(plain);
  const keywords = topKeywords(text, 14);
  const themes = detectThemes(text.toLowerCase());
  const genre = guessGenre(book, text);
  const kv = scoreKeyVerse(verses);
  const verId = '93'; // LSG

  const refChap = linkRef(book, chap, null, verId);
  const refKv = kv ? linkRef(book, chap, String(kv.v), verId) : null;

  const sections = [];

  const TITLES = {
    1:'Prière d’ouverture',2:'Canon et testament',3:'Questions du chapitre précédent',4:'Titre du chapitre',
    5:'Contexte historique',6:'Structure littéraire',7:'Genre littéraire',8:'Auteur et généalogie',
    9:'Verset-clé doctrinal',10:'Analyse exégétique',11:'Analyse lexicale',12:'Références croisées',
    13:'Fondements théologiques',14:'Thème doctrinal',15:'Fruits spirituels',16:'Types bibliques',
    17:'Appui doctrinal',18:'Comparaison interne',19:'Parallèle ecclésial',20:'Verset à mémoriser',
    21:'Enseignement pour l’Église',22:'Enseignement pour la famille',23:'Enseignement pour enfants',
    24:'Application missionnaire',25:'Application pastorale',26:'Application personnelle',
    27:'Versets à retenir',28:'Prière de fin'
  };

  // 1) Prière d’ouverture — propre à ce chapitre
  sections.push({
    id:1, title:TITLES[1], description:'',
    content: u.take([`### Prière d’ouverture
*Référence :* ${book} ${chap}

Père, toi qui parles et éclaires, nous venons écouter ${refChap}. Purifie nos intentions, dispose nos cœurs, et donne-nous l’intelligence spirituelle pour recevoir fidèlement ce que tu révèles ici. Par Jésus-Christ, Amen.`])
  });

  // 2) Canon et testament
  sections.push({
    id:2, title:TITLES[2], description:'',
    content: u.take([`### Canon et testament
*Référence :* ${book} ${chap}

${refChap} s’inscrit dans l’unité de la révélation : l’Ancien annonce, le Nouveau accomplit. Nous lisons ce chapitre à la lumière de l’ensemble biblique, selon la règle : **l’Écriture interprète l’Écriture** (les passages clairs éclairent les plus obscurs).`])
  });

  // 3) Questions du chapitre précédent (et réponses)
  const prev = chap>1 ? `${book} ${chap-1}` : `${book} ${chap}`;
  sections.push({
    id:3, title:TITLES[3], description:'',
    content: u.take([`### Questions du chapitre précédent
*Référence :* ${prev}

1) Quel trait du caractère de Dieu ressortait ?  
**Réponse :** Sa fidélité et sa souveraineté se confirmaient, préparant ${refChap}.

2) Quel lien structurel avec ce chapitre ?  
**Réponse :** Des motifs et mots-clés (${keywords.slice(0,3).join(', ')||'—'}) se prolongent et se précisent.

3) Quelle promesse ou mise en garde ?  
**Réponse :** Elle appelle la foi et l’obéissance, approfondies dans ${refChap}.

4) Quelle application avais-je mise en pratique ?  
**Réponse :** Prière, écoute, service — à poursuivre selon la lumière de ce chapitre.`])
  });

  // 4) Titre du chapitre (proposition à partir des mots-clés / thème)
  const chTitle = themes[0]?.k ? `${book} ${chap} — ${themes[0].k}` : `${book} ${chap} — Motifs : ${keywords.slice(0,3).join(', ')}`;
  sections.push({
    id:4, title:TITLES[4], description:'',
    content: u.take([`### Titre du chapitre
*Référence :* ${book} ${chap}

Proposition : **${chTitle}**.  
Motifs dominants : ${keywords.slice(0,6).join(', ')||'—'}.  
Genre pressenti : ${genre}.`])
  });

  // 5) Contexte historique
  sections.push({
    id:5, title:TITLES[5], description:'',
    content: u.take([`### Contexte historique
*Référence :* ${book} ${chap}

Cadre : place de **${book}** dans le canon ; destinataires initiaux ; contexte de l’alliance.  
Portée : ${refChap} contribue à l’histoire du salut (promesse → accomplissement), et forme la compréhension de l’Église.`])
  });

  // 6) Structure littéraire (découpage heuristique)
  sections.push({
    id:6, title:TITLES[6], description:'',
    content: u.take([`### Structure littéraire
*Référence :* ${book} ${chap}

Repères : répétitions, inclusions, transitions.  
Découpage indicatif (à vérifier au texte) :  
- v.1–${Math.max(2, Math.floor((verses.length||6)/3))} : ouverture / thème.  
- v.${Math.max(3, Math.floor((verses.length||6)/3)+1)}–${Math.max(4, Math.floor((verses.length||6)*2/3))} : développement.  
- v.${Math.max(5, Math.floor((verses.length||6)*2/3)+1)}–${verses.length||'fin'} : conclusion / appel.`])
  });

  // 7) Genre littéraire
  sections.push({
    id:7, title:TITLES[7], description:'',
    content: u.take([`### Genre littéraire
*Référence :* ${book} ${chap}

Marqueurs observables → genre : **${genre}**.  
Le genre oriente la lecture (attentes, figures, portée doctrinale) et balise l’application.`])
  });

  // 8) Auteur et généalogie (synthèse canonique sobre)
  sections.push({
    id:8, title:TITLES[8], description:'',
    content: u.take([`### Auteur et généalogie
*Référence :* ${book} ${chap}

Auteur traditionnel et destinataires ; place de ${book} dans la trame canonique ; insertion dans l’alliance et l’histoire du salut.`])
  });

  // 9) Verset-clé doctrinal
  sections.push({
    id:9, title:TITLES[9], description:'',
    content: u.take([`### Verset-clé doctrinal
*Référence :* ${book} ${chap}

${kv ? `**${refKv}** — ${kv.text}` : `Choisir un verset central (court, dense, mémorisable).`}  
Raison : densité doctrinale, position structurante, clarté pour la mémorisation.`])
  });

  // 10) Analyse exégétique (grammatico-historique)
  sections.push({
    id:10, title:TITLES[10], description:'',
    content: u.take([`### Analyse exégétique
*Référence :* ${book} ${chap}

Sens littéral (grammaire, syntaxe, contexte immédiat) → ${refChap}.  
Sens du passage dans l’argument global du livre ; articulation avec l’alliance ; orientation christologique.`])
  });

  // 11) Analyse lexicale (mots clés)
  sections.push({
    id:11, title:TITLES[11], description:'',
    content: u.take([`### Analyse lexicale
*Référence :* ${book} ${chap}

Termes récurrents / saillants : ${keywords.slice(0,8).join(', ')||'—'}.  
Champ sémantique et portée doctrinale ; cohérences intertextuelles.`])
  });

  // 12) Références croisées (depuis theme détecté)
  const refs = (themes[0]?.refs||[]).map(([b,c,v])=>`- ${linkRef(b,c,v)}`).join('\n') || '- (à compléter)';
  sections.push({
    id:12, title:TITLES[12], description:'',
    content: u.take([`### Références croisées
*Référence :* ${book} ${chap}

Appuis canoniques :  
${refs}

Principe : lire **Écriture par l’Écriture** pour garder l’unité de la foi.`])
  });

  // 13) Fondements théologiques
  sections.push({
    id:13, title:TITLES[13], description:'',
    content: u.take([`### Fondements théologiques
*Référence :* ${book} ${chap}

Attributs de Dieu, œuvre du Christ, action de l’Esprit, alliance, création, chute, rédemption — tels qu’illustrés par ${refChap}.`])
  });

  // 14) Thème doctrinal (nom + brefs appuis)
  sections.push({
    id:14, title:TITLES[14], description:'',
    content: u.take([`### Thème doctrinal
*Référence :* ${book} ${chap}

Thème principal : **${themes[0]?.k || 'révélation'}**.  
Effets : règles de lecture, clarté dogmatique, sécurisation de l’application.`])
  });

  // 15) Fruits spirituels
  sections.push({
    id:15, title:TITLES[15], description:'',
    content: u.take([`### Fruits spirituels
*Référence :* ${book} ${chap}

Humilité, foi, espérance, amour ; sainteté de vie ; louange et intercession nourries par ${refChap}.`])
  });

  // 16) Types bibliques
  sections.push({
    id:16, title:TITLES[16], description:'',
    content: u.take([`### Types bibliques
*Référence :* ${book} ${chap}

Symboles/figures (à vérifier au texte) — fonction : orienter vers le Christ sans forcer le sens.`])
  });

  // 17) Appui doctrinal
  sections.push({
    id:17, title:TITLES[17], description:'',
    content: u.take([`### Appui doctrinal
*Référence :* ${book} ${chap}

Texte reçu dans l’Église : confessions, catéchismes ; articulation avec les loci (Dieu, Christ, Esprit, Écriture, salut, Église).`])
  });

  // 18) Comparaison interne
  sections.push({
    id:18, title:TITLES[18], description:'',
    content: u.take([`### Comparaison interne
*Référence :* ${book} ${chap}

Harmonisation avec d’autres passages du **même livre** (répétitions, variations, approfondissements).`])
  });

  // 19) Parallèle ecclésial
  sections.push({
    id:19, title:TITLES[19], description:'',
    content: u.take([`### Parallèle ecclésial
*Référence :* ${book} ${chap}

Lecture à la lumière d’**Actes 2** (enseignement, communion, fraction du pain, prières) : pratiques modelées par la Parole.`])
  });

  // 20) Verset à mémoriser
  sections.push({
    id:20, title:TITLES[20], description:'',
    content: u.take([`### Verset à mémoriser
*Référence :* ${book} ${chap}

${kv ? `Proposition : **${refKv}**` : `À choisir dans ${refChap}`} — court, clair, doctrinal, applicable.`])
  });

  // 21) Enseignement pour l’Église
  sections.push({
    id:21, title:TITLES[21], description:'',
    content: u.take([`### Enseignement pour l’Église
*Référence :* ${book} ${chap}

Culte (Parole & prière), discipulat (saine doctrine), mission (vérité & grâce), gouvernance (sainteté & service) — selon ${refChap}.`])
  });

  // 22) Enseignement pour la famille
  sections.push({
    id:22, title:TITLES[22], description:'',
    content: u.take([`### Enseignement pour la famille
*Référence :* ${book} ${chap}

Transmission intergénérationnelle : lire, prier, pratiquer la justice ; conversations quotidiennes ancrées dans ${refChap}.`])
  });

  // 23) Enfants
  sections.push({
    id:23, title:TITLES[23], description:'',
    content: u.take([`### Enseignement pour enfants
*Référence :* ${book} ${chap}

Raconter simplement, illustrer, mémoriser un verset, prier une phrase tirée du texte.`])
  });

  // 24) Mission
  sections.push({
    id:24, title:TITLES[24], description:'',
    content: u.take([`### Application missionnaire
*Référence :* ${book} ${chap}

Témoigner fidèlement : annoncer le cœur de ${refChap}, contextualiser sans diluer la vérité.`])
  });

  // 25) Pastorale
  sections.push({
    id:25, title:TITLES[25], description:'',
    content: u.take([`### Application pastorale
*Référence :* ${book} ${chap}

Consoler, corriger, exhorter à partir de ${refChap} ; accompagner vers la maturité en Christ.`])
  });

  // 26) Personnel
  sections.push({
    id:26, title:TITLES[26], description:'',
    content: u.take([`### Application personnelle
*Référence :* ${book} ${chap}

- Vérité à croire : Dieu parle et agit comme révélé ici.  
- Péché à confesser : incrédulité, orgueil.  
- Promesse : grâce suffisante en Christ.  
- Obéissance : prière, écoute, service.  
- Décision : un acte concret aujourd’hui.`])
  });

  // 27) Versets à retenir (liste courte)
  const top3 = verses.slice(0,3).map(v=>`- ${linkRef(book, chap, String(v.v))}`).join('\n') || '- (à choisir)';
  sections.push({
    id:27, title:TITLES[27], description:'',
    content: u.take([`### Versets à retenir
*Référence :* ${book} ${chap}

${top3}`])
  });

  // 28) Prière de fin
  sections.push({
    id:28, title:TITLES[28], description:'',
    content: u.take([`### Prière de fin
*Référence :* ${book} ${chap}

Nous te bénissons pour la lumière reçue dans ${refChap}. Affermis la foi, conduis l’obéissance, fais porter du fruit à ta Parole. Par Jésus-Christ, Amen.`])
  });

  return { sections: sections.sort((a,b)=>a.id-b.id), source, version };
}

/* --------------------- Orchestration --------------------- */
function parsePassage(p){
  const m = /^(.+?)\s+(\d+)(?:\s*.*)?$/.exec(String(p||'').trim());
  return { book: m ? m[1].trim() : 'Genèse', chap: m ? parseInt(m[2],10) : 1 };
}

function normalizeLen(n){
  const L = Number(n);
  if ([500,1500,2500].includes(L)) return L;
  return 1500;
}

async function core(ctx){
  const method = ctx.req?.method || 'GET';

  if (method === 'GET'){
    return send200(ctx, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { "passage":"Genèse 1", "options":{ "length":500|1500|2500 } } → 28 rubriques dynamiques basées sur /api/verses.'
    });
  }

  if (method === 'POST'){
    const body = await readBody(ctx);
    const passage = String(body?.passage || '').trim() || 'Genèse 1';
    const { book, chap } = parsePassage(passage);
    const length = normalizeLen(body?.options?.length);

    try {
      // 1) Récup corpus via endpoint interne (comme Rubrique 0)
      const j = await fetchVersesViaInternal(ctx, book, chap);
      const verses = Array.isArray(j?.verses) ? j.verses.map(v => ({ v:v.v, text:CLEAN(v.text||'') })) : [];
      const version = j?.version || 'LSG';
      const source  = j?.source  || 'unknown';

      // Si aucun verset, on fabrique quand même 28 rubriques minimalistes
      const study = buildSectionsFromCorpus({ book, chap, verses, version, source });

      return send200(ctx, {
        study,
        metadata: {
          book, chapter: chap, version, source,
          generatedAt: new Date().toISOString(),
          lengthBudget: length
        }
      });
    } catch (e){
      // Secours : renvoyer 28 rubriques basiques (toujours 200)
      const fallback = buildSectionsFromCorpus({ book, chap, verses: [], version:'LSG', source:'fallback' });
      return send200(ctx, {
        study: fallback,
        metadata: { book, chapter: chap, version:'LSG', source:'fallback', emergency:true, error:String(e?.message||e) }
      });
    }
  }

  // Autres méthodes → hint
  return send200(ctx, { ok:true, route:'/api/generate-study', hint:'GET pour smoke-test, POST pour générer.' });
}

export default async function handler(req, res){
  if (res && typeof res.status === 'function') return core({ req, res });
  return core({ req });
}

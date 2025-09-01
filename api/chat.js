// /api/chat.js — Génération 28 rubriques (OpenAI + garde-fous + canon Genèse 1)
// Réponse JSON: { ok, source: "openai"|"fallback"|"canonical", data:{ reference, version, sections:[{id,title,content}] }, warn? }

const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_VERSION = "LSG"; // Louis Segond 1910 par défaut

const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
  "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
];
const N = TITLES.length;

// ---------------- Canonique pour Genèse 1 (ton texte exactement) ----------------
const CANON = {
  "Genèse|1": [
    // 1
    "Seigneur Tout-Puissant, Créateur du ciel et de la terre, éclaire ma lecture. Ouvre mon cœur pour que je voie ta grandeur et que je reçoive la vérité de ta Parole avec humilité et obéissance. Amen.",
    // 2
    "La Genèse, traditionnellement attribuée à Moïse, a été donnée à Israël comme fondement de son identité et de sa foi. Genèse 1 se situe dans le Proche-Orient ancien, où de nombreux récits païens d’origine du monde circulaient. Ici, la différence est claire : un seul Dieu, souverain et personnel, crée par sa Parole.",
    // 3
    "Le chapitre 1 est un prologue grandiose : il présente Dieu comme le Créateur absolu. Le texte est structuré par répétitions (“Dieu dit… il y eut un soir, il y eut un matin”), soulignant l’ordre et l’intentionnalité de la création.",
    // 4
    "Jour 1 : Lumière et ténèbres (vv. 1–5)\n\nJour 2 : Firmament, séparation des eaux (vv. 6–8)\n\nJour 3 : Terre et végétation (vv. 9–13)\n\nJour 4 : Astres (vv. 14–19)\n\nJour 5 : Poissons et oiseaux (vv. 20–23)\n\nJour 6 : Animaux terrestres et l’homme (vv. 24–31)\n\nJour 7 : Repos de Dieu (cf. Genèse 2:1-3)",
    // 5
    "Bara’ (“créer”) : réservé à l’action divine, marque une création radicale.\n\nTohu-bohu (v.2) : désigne un état de chaos avant l’organisation divine.\n\nImage de Dieu (tselem Elohim) : exprime la dignité et la vocation unique de l’homme.",
    // 6
    "Dieu : Créateur souverain.\n\nL’homme et la femme : porteurs de l’image divine, mandatés pour gérer la terre.",
    // 7
    "Dieu crée l’univers en six jours, en ordonnant le chaos. Chaque œuvre est déclarée “bonne”. L’homme et la femme sont créés à son image et reçoivent mandat sur la création.",
    // 8
    "La création est l’œuvre d’un Dieu unique, sage et bon, qui établit l’ordre et confère dignité à l’humanité.",
    // 9
    "Genèse 1:27\n\n« Dieu créa l’homme à son image, il le créa à l’image de Dieu, il créa l’homme et la femme. »",
    // 10
    "Genèse 1:1\n\n« Au commencement, Dieu créa les cieux et la terre. »",
    // 11
    "Jean 1:1-3 — Le Verbe comme Créateur.\n\nColossiens 1:16 — Tout a été créé par et pour Christ.\n\nHébreux 11:3 — Le monde formé par la Parole de Dieu.",
    // 12
    "Toute la révélation biblique part de ce fondement : Dieu est Créateur. Apocalypse 21-22 boucle le récit avec une nouvelle création.",
    // 13
    "Il est la Parole créatrice (Jean 1), le médiateur de la création et de la rédemption.",
    // 14
    "Quelle est ma valeur si je suis créé à l’image de Dieu ?\n\nComment puis-je refléter cette image dans mon quotidien ?",
    // 15
    "Personnel : vivre avec gratitude et dignité.\n\nFamilial : transmettre aux enfants que Dieu est le Créateur.\n\nÉglise : affirmer la dignité humaine dans un monde relativiste.\n\nMissionnaire : annoncer que le monde a un sens et un Auteur.\n\nPastoral : accompagner ceux qui doutent de leur valeur.\n\nEnfants : enseigner la beauté de la création comme don de Dieu.",
    // 16
    "Comme un artiste qui signe sa toile, Dieu a mis son empreinte en créant l’homme à son image.",
    // 17
    "« La science contredit la Bible. »\n\n« L’évolution rend inutile l’idée de Créateur. »",
    // 18
    "La Bible n’est pas un manuel scientifique mais une révélation théologique. La science décrit le “comment”, la Parole révèle le “pourquoi”.",
    // 19
    "Dieu bénit l’homme et lui confie la création (Genèse 1:28).",
    // 20
    "« Soyez féconds, multipliez, remplissez la terre, et l’assujettissez. » (Genèse 1:28).",
    // 21
    "Développer une écologie biblique : prendre soin de la création en signe d’obéissance à Dieu.",
    // 22
    "🎵 « Seigneur, tu es digne » (hymne de louange à Dieu Créateur, inspiré d’Apocalypse 4:11).",
    // 23
    "Père Créateur, merci pour la vie et la dignité que tu m’as données. Aide-moi à refléter ton image, à honorer ta création et à reconnaître ton autorité sur tout. Amen.",
    // 24
    "Tout commence par Dieu.",
    // 25
    "Lire Jean 1 pour relier la création au Christ, la Parole.",
    // 26
    "Le texte ne donne pas de détails scientifiques. Il révèle l’ordre divin et le but de l’existence.",
    // 27
    "Genèse 1 fonde notre vision du monde : Dieu est Créateur, l’homme est son image, et la création est bonne. Ces vérités orientent notre foi, notre mission et notre espérance.",
    // 28
    "—" // laissé vide volontairement si tu veux compléter (mais on garde 28 items)
  ]
};

// Le texte fourni a 28 items logiques mais ne mappe pas 1:1 avec nos 28 titres standards.
// On reconstruit une correspondance propre ci-dessous :
function canonicalGenesis1Sections() {
  const S = new Array(28).fill("");
  // Mapping vers TITLES (1..28)
  S[0]  = CANON["Genèse|1"][0]; // Prière d’ouverture
  S[1]  = CANON["Genèse|1"][1]; // Canon et testament (contextualisé)
  S[2]  = "Préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
  S[3]  = "Genèse 1 — Dieu crée par sa Parole : titre doctrinal synthétique.";
  S[4]  = CANON["Genèse|1"][1]; // Contexte historique (déjà mentionné)
  S[5]  = CANON["Genèse|1"][3]; // Structure des jours 1..7
  S[6]  = "Narratif théologique solennel (prologue de la Genèse).";
  S[7]  = "Tradition : Moïse ; rattachement aux patriarches ; transmission à Israël.";
  S[8]  = CANON["Genèse|1"][8]; // Verset-clé doctrinal (1:27)
  S[9]  = "bara’ (créer) réservé à Dieu ; refrain « Dieu dit… il y eut un soir, il y eut un matin » ; ordonnancement progressif.";
  S[10] = CANON["Genèse|1"][4]; // Lexicale : bara’, tohu-bohu, tselem Elohim
  S[11] = CANON["Genèse|1"][10]; // Références croisées
  S[12] = "Dieu unique, souverain et bon ; dignité humaine ; mandat culturel ; repos/sabbat.";
  S[13] = CANON["Genèse|1"][7];  // Thème doctrinal central
  S[14] = "Gratitude, adoration, responsabilité, espérance.";
  S[15] = "Typologies : repos/sabbat ; ordre/chaos ; Parole/lumière.";
  S[16] = "Psaume 8 ; Psaume 104 ; Apocalypse 4:11 ; Hébreux 11:3.";
  S[17] = "Comparer 1:1 ; 1:27 ; 1:31 ; 2:1-3 (ouverture, image, bonté, repos).";
  S[18] = "Avec Actes 2 : Parole, communauté, Esprit — nouvelle création inaugurée.";
  S[19] = "Genèse 1:1 ou 1:27 — courte citation (LSG).";
  S[20] = "Affirmations pour l’Église : Créateur, dignité, sabbat, mission.";
  S[21] = "Famille : transmettre que Dieu est Créateur ; éducation à la gérance.";
  S[22] = "Enfants : Dieu a tout fait ; nous sommes précieux ; prenons soin de la terre.";
  S[23] = "Mission : annoncer que le monde a un Auteur et un sens ; relier au Christ.";
  S[24] = "Pastoral : accompagner ceux qui doutent de leur valeur ; écologie biblique.";
  S[25] = "Examen personnel : où je méprise la création ou l’image de Dieu ? Décisions concrètes.";
  S[26] = "Genèse 1:1 ; 1:27 ; 1:28 ; Psaume 8 ; Jean 1:3.";
  S[27] = "Père Créateur, merci pour la vie et la dignité… Amen.";
  return S;
}

// ---------------- Utils HTTP ----------------
function setNoStore(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function ok(res, payload) { setNoStore(res); res.statusCode = 200; res.end(JSON.stringify(payload)); }
function fail(res, status, message){ setNoStore(res); res.statusCode = status||500; res.end(JSON.stringify({ ok:false, error:String(message||"Internal error") })); }

// ---------------- Helpers ----------------
function parseQ(q){ if(!q) return {book:"",chapter:NaN}; const m=String(q).match(/^(.+?)\s+(\d+)\s*$/); return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN}; }
function toSections(reference, version, blocks){
  return {
    reference, version,
    sections: blocks.map((content,i)=>({ id:i+1, title:TITLES[i], content:String(content||"").trim() }))
  };
}

// ---------------- Fallback générique ----------------
function fallbackBlocks(book,chapter,version){
  const ref = `${book} ${chapter}`;
  return [
    `Père céleste, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`,
    `Le livre de ${book} appartient au canon biblique (Ancien/Nouveau Testament).`,
    `Préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`,
    `${ref} — Titre doctrinal synthétique.`,
    `Contexte : auteur traditionnel, époque, destinataires, enjeux.`,
    `Structure interne du chapitre (pérécopes, refrains, progression).`,
    `Genre littéraire et incidences herméneutiques.`,
    `Auteur & rattachements (tradition) / généalogie.`,
    `Verset-clé: ${ref}:1 — courte citation (${version}).`,
    `Analyse exégétique : observations (verbes, connecteurs, parallèles).`,
    `Analyse lexicale : mots clés (hébreu/grec), portée doctrinale.`,
    `Références croisées : 3–5 passages parallèles ou éclairants.`,
    `Fondements : attributs divins, création/chute/rédemption, alliance.`,
    `Thème doctrinal principal (formulé clairement).`,
    `Fruits : louange, repentance, obéissance, charité, espérance.`,
    `Types bibliques et figures christologiques.`,
    `Appui doctrinal : autres passages qui confirment.`,
    `Comparaison interne : versets en tension ou en écho.`,
    `Comparaison avec Actes 2 : Parole, Esprit, communauté.`,
    `Verset à mémoriser: ${ref}:1 — courte citation (${version}).`,
    `Implications pour l’Église locale.`,
    `Implications pour la famille.`,
    `Version enfants : récit simple + 2 questions.`,
    `Application missionnaire : annonce, justice, miséricorde.`,
    `Application pastorale : accompagnement, exhortation.`,
    `Application personnelle : examen et décisions concrètes.`,
    `Versets à retenir : 3–5 références du chapitre.`,
    `Prière finale : merci pour ${ref}, aide-nous à pratiquer ta Parole.`
  ];
}

// ---------------- Qualité minimale (heuristiques) ----------------
function isGoodForGenesis1(book,chapter,sections){
  if(book!=="Genèse" || Number(chapter)!==1) return true; // on ne teste finement que Genèse 1
  const byId = Object.fromEntries(sections.map(s=>[s.id, s.content || ""]));
  const need = [
    [5, /Proche[- ]?Orient/i],                 // contexte historique
    [6, /Jour\s*1|Jour\s*2|Jour\s*3|Jour\s*4|Jour\s*5|Jour\s*6|Jour\s*7/i], // structure 7 jours
    [10, /bara|tohu|tselem|image de Dieu/i],    // exégèse
    [11, /lexic|mot/i],                         // lexicale
    [12, /Jean\s*1|Colossiens\s*1|H[ée]breux\s*11/i], // refs croisées
    [20, /Gen[èe]se\s*1:\d+/i]                  // verset à mémoriser
  ];
  let pass = 0;
  for(const [id, re] of need){
    if(re.test(byId[id]||"")) pass++;
  }
  return pass >= 4; // seuil
}

// ---------------- OpenAI ----------------
async function askOpenAI({ book, chapter, version, apiKey }){
  const SYSTEM = `
Tu es un assistant pastoral francophone. Réponds STRICTEMENT en JSON avec 28 chaînes "s1".."s28".
- 3–6 phrases par rubrique, concises et doctrinales (pas un simple collage de versets).
- Respecte l'ordre exact des 28 rubriques ci-dessous.
- Pour s9 (Verset-clé doctrinal) et s20 (Verset à mémoriser), inclure "Référence + courte citation" (${version}).
Rubriques:
${TITLES.map((t,i)=>`- s${i+1} = "${t}"`).join("\n")}
`.trim();

  const USER = `Livre="${book}", Chapitre="${chapter}", Version="${version}".`;

  const payload = {
    model: MODEL,
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type:"json_object" },
    messages: [
      { role:"system", content: SYSTEM },
      { role:"user", content: USER }
    ]
  };

  const r = await fetch(OPENAI_URL, {
    method:"POST",
    headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });
  const raw = await r.text();
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0,300)}`);

  let outer; try{ outer = JSON.parse(raw); }catch{ throw new Error("OpenAI: JSON global invalide"); }
  const content = outer?.choices?.[0]?.message?.content || "";
  let obj; try{ obj = JSON.parse(content); }catch{ throw new Error("OpenAI: contenu non-JSON strict"); }

  const blocks = [];
  for(let i=1;i<=N;i++){
    const v = obj[`s${i}`];
    if(typeof v !== "string") throw new Error(`OpenAI: champ manquant s${i}`);
    blocks.push(v);
  }
  return blocks;
}

// ---------------- Handler ----------------
export default async function handler(req,res){
  try{
    // CORS minimal + no-store
    res.setHeader("Access-Control-Allow-Origin","*");
    if(req.method==="OPTIONS"){
      res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers","Content-Type");
      return res.status(204).end();
    }
    setNoStore(res);

    // body JSON si POST
    let body={};
    if(req.method==="POST"){
      body = await new Promise(resolve=>{
        let b=""; req.on("data",c=>b+=c);
        req.on("end",()=>{ try{ resolve(JSON.parse(b||"{}")); }catch{ resolve({}); } });
      });
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp  = Object.fromEntries(url.searchParams.entries());
    const probe = qp.probe === "1" || body.probe === true;

    // paramètres
    let book    = (body.book || qp.book || "").trim();
    let chapter = Number(body.chapter || qp.chapter);
    let version = (body.version || qp.version || DEFAULT_VERSION).trim() || DEFAULT_VERSION;

    const q = body.q || qp.q;
    if((!book || !chapter) && q){ const p=parseQ(q); book=book||p.book; chapter=chapter||p.chapter; }
    if(!book) book="Genèse";
    if(!Number.isFinite(chapter) || chapter<=0) chapter=1;

    const reference = `${book} ${chapter}`;

    // probe => retourne fallback générique (ou canon si Genèse 1) en JSON
    if(probe){
      if(CANON[`${book}|${chapter}`]){
        const blocks = canonicalGenesis1Sections();
        return ok(res, { ok:true, source:"canonical", data: toSections(reference, version, blocks) });
      }
      return ok(res, { ok:true, source:"fallback", data: toSections(reference, version, fallbackBlocks(book,chapter,version)) });
    }

    const apiKey = (process.env.OPENAI_API_KEY||"").trim();
    let blocks=null, source="fallback", warn="";

    if(apiKey){
      try{
        const out = await askOpenAI({ book, chapter, version, apiKey });
        blocks = out;
        source = "openai";
      }catch(e){
        warn = `OpenAI: ${String(e?.message||e)}`;
      }
    } else {
      warn = "OPENAI_API_KEY manquant";
    }

    // Si livre=Genèse chap=1 et que la qualité n'est pas au niveau → canon garanti
    if(CANON[`${book}|${chapter}`]){
      if(!blocks){
        const canon = canonicalGenesis1Sections();
        return ok(res, { ok:true, source:"canonical", warn, data: toSections(reference, version, canon) });
      } else {
        const sections = toSections(reference, version, blocks).sections;
        if(!isGoodForGenesis1(book,chapter,sections)){
          const canon = canonicalGenesis1Sections();
          return ok(res, { ok:true, source:"canonical", warn:"AI content adjusted to canonical", data: toSections(reference, version, canon) });
        }
      }
    }

    // Autres chapitres → si pas d'AI, fallback générique
    if(!blocks) {
      const fb = fallbackBlocks(book,chapter,version);
      return ok(res, { ok:true, source:"fallback", warn, data: toSections(reference, version, fb) });
    }

    // AI OK
    return ok(res, { ok:true, source, warn, data: toSections(reference, version, blocks) });

  }catch(e){
    return fail(res, 500, e?.message || e);
  }
}

// api/chat.js — Réponse riche (28 rubriques), rubrique 3 structurée (5 Q/R), liens BibleGateway cliquables
// - POST { book, chapter, version? }  => JSON { ok, data:{ reference, version, sections:[{id,title,content}...] } }
// - GET ?q="Genèse 1" supporté (secours)
// - Si OpenAI échoue ou répond trop pauvre => fallback "canonique enrichi" (avec liens <a>)

const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
  "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
];

function parseQ(q){
  if(!q) return {book:"",chapter:NaN};
  const m=String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN};
}

function bgUrlFromRef(ref, version="LSG"){
  // ref: "Genèse 1:27" ou "Exode 1"
  const url = new URL("https://www.biblegateway.com/passage/");
  url.searchParams.set("search", ref);
  url.searchParams.set("version", version);
  return url.toString();
}

function autoLinkBibleRefs(html, version="LSG"){
  // Convertit "Genèse 1:27" ou "Exode 1" en <a href="...">...</a>
  const BOOKS = [
    "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"
  ];
  const bookAlt = BOOKS.map(b => b.replace(/\s+/g,"\\s+")).join("|");
  // Match "Livre 1:2-3" ou "Livre 1"
  const re = new RegExp(`\\b(${bookAlt})\\s+(\\d+)(?::(\\d+(?:-\\d+)?))?\\b`,"g");
  return String(html||"").replace(re, (m,book,chap,vers)=>{
    const ref = vers ? `${book} ${chap}:${vers}` : `${book} ${chap}`;
    const href = bgUrlFromRef(ref, version);
    return `<a href="${href}" target="_blank" rel="noopener">${ref}</a>`;
  });
}

function openingPrayer(book, chap){
  return [
    `<p><strong>Prière d’ouverture</strong></p>`,
    `<p>Père éternel, nous venons à toi pour méditer <strong>${book} ${chap}</strong>. Par ton Esprit, ouvre notre intelligence, purifie nos intentions et conduis-nous dans l’obéissance à ta Parole. Que cette lecture façonne notre foi, notre espérance et notre amour. Au nom de Jésus-Christ, amen.</p>`
  ].join("\n");
}

function canonicalRubric3(book, chap){
  // Réponses structurées aux 5 questions (style théologien), génériques mais denses ; bonus inclus.
  // NB : les références seront auto-liées ensuite.
  return [
    `<p><strong>Révision sur ${book} ${chap} — 5 questions</strong></p>`,
    `<p><strong>1) Observation.</strong> Relever les faits majeurs du chapitre (dynamique narrative, acteurs principaux, progression) et les refrains/termes récurrents (mots de bénédiction/jugement, formules répétées). Noter les contrastes (lumière/ténèbres, promesse/opposition, foi/peur) et les points d’inflexion littéraires qui structurent le texte.</p>`,
    `<p><strong>2) Compréhension.</strong> Que dit le passage de Dieu (attributs, dessein, fidélité à l’alliance) et de l’homme (vocation, responsabilité, limites) ? Montrer comment l’initiative de Dieu prévaut sur l’inconstance humaine, et comment l’appel reçu (adorer, servir, garder) s’exerce au cœur des tensions historiques.</p>`,
    `<p><strong>3) Interprétation.</strong> Proposer un verset-clef et justifier son rôle organisateur (thème central, écho des promesses, orientation éthique). Expliquer comment ce verset relie l’ouverture et la conclusion du passage et prépare la suite du livre (promesse, jugement, délivrance, présence).</p>`,
    `<p><strong>4) Connexions bibliques.</strong> Identifier des parallèles/échos dans l’Ancien et le Nouveau Testament (promesses patriarcales, motifs d’exode, sagesse, accomplissement en Christ). Montrer la continuité de la révélation et l’unité du dessein de Dieu.</p>`,
    `<p><strong>5) Application.</strong> Décliner une mise en pratique concrète cette semaine : <em>personnelle</em> (discipline, prière, repentance), <em>familiale</em> (transmission, service), <em>ecclésiale</em> (adoration, diaconie, mission). Préciser un engagement mesurable (quoi, quand, avec qui) et une prière correspondante.</p>`,
    `<p><strong>Bonus — Verset à mémoriser & prière.</strong> Choisir un verset du chapitre à apprendre par cœur et formuler une courte prière de réponse (louange, demande, consécration) qui applique la vérité méditée.</p>`
  ].join("\n");
}

function canonicalEnrichedJSON(book, chap, version="LSG"){
  // Gabarit enrichi (sans IA) — solide & cohérent ; S3 structuré ; liens cliquables
  const s = [];
  s[1]  = openingPrayer(book, chap);
  s[2]  = `<p>${book} appartient au canon biblique (${book==="Matthieu"||book==="Marc"||book==="Luc"||book==="Jean"||book==="Actes"||book==="Romains" ? "Nouveau" : "Ancien"} Testament). Le chapitre ${chap} s’inscrit dans la grande narration du salut : Dieu agit, appelle et forme un peuple.</p>`;
  s[3]  = canonicalRubric3(book, chap);
  s[4]  = `<p><strong>${book} ${chap} — Titre doctrinal synthétique</strong> : Dieu parle et accomplit ; l’homme reçoit vocation et espérance au cœur de l’histoire.</p>`;
  s[5]  = `<p>Contexte : rédaction située dans la tradition d’Israël ; environnement religieux du Proche-Orient ancien ; but catéchétique et mémoriel. Le chapitre ${chap} confronte les récits païens en affirmant la souveraineté du Dieu unique.</p>`;
  s[6]  = `<p>Structure littéraire : séquences clairement balisées (ouverture, développements, sommet, résolution). Repérer les refrains, inclusions et parallélismes qui organisent le chapitre.</p>`;
  s[7]  = `<p>Genre : narration théologique (prose solennelle), avec procédés rhétoriques (répétitions, symétries), au service d’une confession de foi.</p>`;
  s[8]  = `<p>Auteur (tradition), destinataires, place dans l’histoire du salut ; articulation avec les patriarches et les promesses.</p>`;
  s[9]  = `<p><strong>Verset-clé doctrinal.</strong> À sélectionner dans ${book} ${chap} (ex. <em>${book} ${chap}:1</em> ou <em>${book} ${chap}:${chap===1?27:1}</em>) et à mémoriser.</p>`;
  s[10] = `<p>Exégèse : termes structurants, mouvements du texte, rythme ; observer “Dieu dit / il fut ainsi / Dieu vit que c’était bon” le cas échéant, ou l’enchaînement promesse/menace/jugement.</p>`;
  s[11] = `<p>Lexique : mots sources (hébreu/grec) quand pertinent ; nuances sémantiques qui éclairent doctrine et pratique.</p>`;
  s[12] = `<p>Références croisées : <em>Jean 1:1-3</em>, <em>Colossiens 1:16</em>, <em>Hébreux 11:3</em> pour la création et la Parole ; autres passages à relier selon le chapitre.</p>`;
  s[13] = `<p>Dogmatique : Dieu unique et souverain ; dignité humaine ; providence ; sabbat ; alliance (selon le texte étudié).</p>`;
  s[14] = `<p>Thème doctrinal central du chapitre, formulé en une thèse claire et mémorisable.</p>`;
  s[15] = `<p>Fruits : gratitude, adoration, justice, espérance, gérance de la création, courage dans l’épreuve.</p>`;
  s[16] = `<p>Typologie : motifs (repos, exode, temple, roi, berger, serviteur) qui préfigurent le Christ.</p>`;
  s[17] = `<p>Appuis : Psaumes, prophètes, évangiles et épîtres qui confirment l’enseignement du chapitre.</p>`;
  s[18] = `<p>Comparer les versets pivots du chapitre (ouverture, sommet, conclusion) et montrer la progression théologique.</p>`;
  s[19] = `<p>Lien avec <em>Actes 2</em> : création nouvelle, don de l’Esprit, communauté ordonnée par la Parole.</p>`;
  s[20] = `<p><strong>Verset à mémoriser</strong> : choisir un verset bref et central du chapitre (<em>${book} ${chap}:1</em> par ex.).</p>`;
  s[21] = `<p>Église : confesser Dieu Créateur/Rédempteur, protéger la dignité humaine, vivre le rythme travail/repos, proclamer l’Évangile.</p>`;
  s[22] = `<p>Famille : transmettre la bonté de Dieu, la prière, la lecture, la gérance.</p>`;
  s[23] = `<p>Enfants : dire simplement que Dieu a tout fait, qu’il aime et confie la terre à notre soin.</p>`;
  s[24] = `<p>Mission : annoncer que le monde a un Auteur et un but en Christ ; appeler à la réconciliation.</p>`;
  s[25] = `<p>Pastoral : accompagner ceux qui doutent de leur valeur ; veiller aux démunis ; former les consciences.</p>`;
  s[26] = `<p>Personnel : examen — où je méprise la Parole ou l’image de Dieu ? Résolutions concrètes et mesurables.</p>`;
  s[27] = `<p>Versets à retenir : <em>${book} ${chap}:1</em>, <em>${book} ${chap}:${chap===1?27:2}</em>, et passages parallèles majeurs.</p>`;
  s[28] = `<p><strong>Prière de fin</strong> — Merci, Père, pour ta Parole vivante. Affermis notre foi, éclaire notre marche et fais de nous des témoins fidèles. Amen.</p>`;

  // auto-link des refs
  for(let i=1;i<=28;i++){ s[i]=autoLinkBibleRefs(s[i], version); }

  return {
    ok:true,
    source:"canonical",
    warn:"AI content adjusted to canonical",
    data:{
      reference:`${book} ${chap}`,
      version,
      sections: TITLES.map((t,idx)=>({ id:idx+1, title:t, content:s[idx+1] }))
    }
  };
}

async function askOpenAI_JSON({book,chapter,version="LSG",apiKey}){
  const SYSTEM = `
Tu réponds en JSON strict (clés "s1"..."s28"). Style pastoral, doctrinal, précis.
- Pas d'astérisques Markdown : utilise <strong>, <em>, <p>, <ul>, <ol>, <li>, <blockquote>.
- Enrichis chaque rubrique (contenu substantiel).
- La rubrique s1 est une prière d'ouverture contextualisée au livre/chapitre.
- La rubrique s3 DOIT répondre aux 5 questions suivantes, chacune en 2–4 phrases, numérotées 1) à 5), puis "Bonus" :
  1) Observation (faits/réfrains) 
  2) Compréhension (Dieu/homme)
  3) Interprétation (verset-clef + rôle)
  4) Connexions bibliques (AT/NT)
  5) Application (personnelle/famille/église)
  Bonus: Verset à mémoriser + courte prière.
- s9, s12, s20, s27 doivent contenir des références explicites (ex. "Genèse 1:27").
- Évite le copier-coller long du texte biblique. Cite brièvement si nécessaire.
`.trim();

  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Produis un JSON strict { "s1": "...", ..., "s28": "..." }.
`.trim();

  const payload = {
    model:"gpt-4o-mini",
    temperature:0.35,
    max_tokens:2200,
    response_format:{ type:"json_object" },
    messages:[ {role:"system",content:SYSTEM}, {role:"user",content:USER} ]
  };

  const ctrl = new AbortController();
  const to = setTimeout(()=>ctrl.abort(), 18000);

  try{
    const r = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body:JSON.stringify(payload),
      signal:ctrl.signal
    });
    const txt = await r.text();
    if(!r.ok) throw new Error(`OpenAI ${r.status}: ${txt.slice(0,200)}`);
    let data; try{ data = JSON.parse(txt); }catch{ throw new Error("Réponse OpenAI illisible"); }
    const raw = data?.choices?.[0]?.message?.content || "";
    let obj; try{ obj = JSON.parse(raw); }catch{ throw new Error("Contenu non-JSON renvoyé"); }

    // Normalisation + auto-link + garde-fous rubrique 1 / 3
    const out = {};
    for(let i=1;i<=28;i++){
      let v = String(obj[`s${i}`]||"").trim();
      if(i===1 && !v) v = openingPrayer(book,chapter);
      if(i===3){
        const hasFive = /(^|\n)\s*1\)/.test(v) && /(^|\n)\s*5\)/.test(v);
        if(!hasFive || v.length<400) v = canonicalRubric3(book,chapter);
      }
      out[`s${i}`] = autoLinkBibleRefs(v, version);
    }
    return {
      ok:true,
      source:"openai",
      warn:"",
      data:{
        reference:`${book} ${chapter}`,
        version,
        sections: TITLES.map((t,idx)=>({ id:idx+1, title:t, content: out[`s${idx+1}`] }))
      }
    };
  } finally { clearTimeout(to); }
}

export default async function handler(req,res){
  try{
    // lecture corps / query
    let body={};
    if(req.method==="POST"){
      body = await new Promise(resolve=>{
        let b=""; req.on("data",c=>b+=c); req.on("end",()=>{ try{ resolve(JSON.parse(b||"{}")); }catch{ resolve({}); } });
      });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp  = Object.fromEntries(url.searchParams.entries());
    let { book, chapter, version } = { 
      book: body.book || qp.book, 
      chapter: Number(body.chapter || qp.chapter),
      version: body.version || qp.version || "LSG"
    };
    if((!book||!chapter) && (body.q||qp.q)){ const p=parseQ(body.q||qp.q); book=book||p.book; chapter=chapter||p.chapter; }
    book = book || "Genèse"; chapter = chapter || 1;

    const apiKey = process.env.OPENAI_API_KEY;

    // Si pas de clé => fallback enrichi canonique
    if(!apiKey){
      const payload = canonicalEnrichedJSON(book, chapter, version);
      res.setHeader("Content-Type","application/json; charset=utf-8");
      return res.status(200).json(payload);
    }

    // Essai IA, sinon fallback enrichi canonique
    try{
      const payload = await askOpenAI_JSON({book,chapter,version,apiKey});
      res.setHeader("Content-Type","application/json; charset=utf-8");
      return res.status(200).json(payload);
    }catch(e){
      const fb = canonicalEnrichedJSON(book, chapter, version);
      res.setHeader("Content-Type","application/json; charset=utf-8");
      res.setHeader("X-OpenAI-Error", String(e?.message||e));
      return res.status(200).json(fb);
    }
  }catch(e){
    const fb = canonicalEnrichedJSON("Genèse",1,"LSG");
    res.setHeader("Content-Type","application/json; charset=utf-8");
    res.setHeader("X-Last-Error", String(e?.message||e));
    return res.status(200).json(fb);
  }
}

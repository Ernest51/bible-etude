// api/chat.js — Génération 28 rubriques (JSON-mode OpenAI) avec fallback solide

const TITLES = [
  "1. Prière d’ouverture","2. Canon et testament","3. Questions du chapitre précédent","4. Titre du chapitre",
  "5. Contexte historique","6. Structure littéraire","7. Genre littéraire","8. Auteur et généalogie",
  "9. Verset-clé doctrinal","10. Analyse exégétique","11. Analyse lexicale","12. Références croisées",
  "13. Fondements théologiques","14. Thème doctrinal","15. Fruits spirituels","16. Types bibliques",
  "17. Appui doctrinal","18. Comparaison entre versets","19. Comparaison avec Actes 2","20. Verset à mémoriser",
  "21. Enseignement pour l’Église","22. Enseignement pour la famille","23. Enseignement pour enfants","24. Application missionnaire",
  "25. Application pastorale","26. Application personnelle","27. Versets à retenir","28. Prière de fin"
];

const TEMPLATE = `# {{BOOK}} {{CHAP}}

1. Prière d’ouverture

{{S1}}

2. Canon et testament

{{S2}}

3. Questions du chapitre précédent

{{S3}}

4. Titre du chapitre

{{S4}}

5. Contexte historique

{{S5}}

6. Structure littéraire

{{S6}}

7. Genre littéraire

{{S7}}

8. Auteur et généalogie

{{S8}}

9. Verset-clé doctrinal

{{S9}}

10. Analyse exégétique

{{S10}}

11. Analyse lexicale

{{S11}}

12. Références croisées

{{S12}}

13. Fondements théologiques

{{S13}}

14. Thème doctrinal

{{S14}}

15. Fruits spirituels

{{S15}}

16. Types bibliques

{{S16}}

17. Appui doctrinal

{{S17}}

18. Comparaison entre versets

{{S18}}

19. Comparaison avec Actes 2

{{S19}}

20. Verset à mémoriser

{{S20}}

21. Enseignement pour l’Église

{{S21}}

22. Enseignement pour la famille

{{S22}}

23. Enseignement pour enfants

{{S23}}

24. Application missionnaire

{{S24}}

25. Application pastorale

{{S25}}

26. Application personnelle

{{S26}}

27. Versets à retenir

{{S27}}

28. Prière de fin

{{S28}}`.trim();

function parseQ(q){
  if(!q) return {book:"",chapter:NaN};
  const m=String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m ? {book:m[1].trim(), chapter:Number(m[2])} : {book:String(q).trim(), chapter:NaN};
}

function youVersionLink(book,chapter){
  const map={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const code=map[book];
  return code?`https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`:"";
}

function mergeIntoTemplate(book, chapter, obj){
  let t = TEMPLATE.replace("{{BOOK}}",book).replace("{{CHAP}}",String(chapter));
  for(let i=1;i<=28;i++){
    t = t.replace(`{{S${i}}}`, String(obj[`S${i}`]||"").trim() || "—");
  }
  return t;
}

function fallbackMarkdown(book,chapter){
  const isOT = ![
    "Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"
  ].includes(book);
  const link=youVersionLink(book,chapter)||"—";
  const obj={
    S1:`Père céleste, nous venons devant toi pour lire ${book} ${chapter}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`,
    S2:`Le livre de ${book} appartient à l’${isOT?"Ancien":"Nouveau"} Testament.`,
    S3:`Préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`,
    S4:`${book} ${chapter} — Titre doctrinal synthétique.`,
    S5:`Contexte ANE : récits concurrents, mais ${book} affirme un Dieu unique, bon et transcendant.`,
    S6:`Jour 1 : Lumière/ténèbres • Jour 2 : Étendue • Jour 3 : Terre/végétation • Jour 4 : Astres • Jour 5 : Poissons/oiseaux • Jour 6 : Animaux/homme • Jour 7 : Repos (2:1-3).`,
    S7:`Narratif théologique solennel, structuré par le refrain « Dieu dit… il y eut un soir, il y eut un matin ».`,
    S8:`Auteur (tradition) : Moïse ; lien aux patriarches & à l’alliance.`,
    S9:`Genèse ${chapter}:27 — « Dieu créa l’homme à son image… » (LSG).`,
    S10:`bara’ (créer) réservé à Dieu ; tohu-bohu (v.2) : chaos ; tselem Elohim (image) : dignité & vocation.`,
    S11:`tôv (bon), raqia (étendue), dominer/soumettre : gérance responsable.`,
    S12:`Passages : Jean 1:1-3 ; Col 1:16 ; Hé 11:3. YouVersion : ${link}`,
    S13:`Dieu unique et bon ; ordre et but de la création ; dignité humaine ; mandat culturel ; sabbat.`,
    S14:`Dieu ordonne le chaos et confère vocation à l’humanité.`,
    S15:`Gratitude, adoration, responsabilité, espérance.`,
    S16:`Typologie du repos/sabbat ; ordre de la création.`,
    S17:`Appui : Ps 8 ; Ps 104 ; Ap 4:11.`,
    S18:`Comparer 1:1 ; 1:31 ; 2:1-3 : ouverture, refrain « bon », repos.`,
    S19:`Lien avec Actes 2 : Parole créatrice, Lumière, communauté ordonnée par l’Esprit (nouvelle création).`,
    S20:`Genèse 1:1 — « Au commencement, Dieu créa les cieux et la terre. »`,
    S21:`Affirmer Dieu Créateur ; protéger la dignité humaine ; rythmer travail/repos.`,
    S22:`Transmettre la bonté de la création ; éduquer à la gérance.`,
    S23:`Enfants : Dieu a tout fait avec amour ; nous sommes précieux ; prenons soin de la terre.`,
    S24:`Annoncer que le monde a un Auteur et un sens ; relier avec Christ.`,
    S25:`Accompagner ceux qui doutent de leur valeur ; prêcher une écologie biblique.`,
    S26:`Examen : où je méprise la création ou l’image de Dieu ? Décisions concrètes.`,
    S27:`Genèse 1:1 ; 1:27 ; 1:28 ; Ps 8:4-6 ; Jn 1:3.`,
    S28:`Père créateur, merci pour la vie et la dignité. Aide-nous à refléter ton image, honorer ta création et marcher dans ta volonté. Amen.`
  };
  return mergeIntoTemplate(book,chapter,obj);
}

async function askOpenAI_JSON({book,chapter,apiKey,version="LSG"}){
  const schema = {
    type:"object",
    properties:Object.fromEntries(Array.from({length:28},(_,i)=>[`s${i+1}`,{type:"string"}])),
    required:Array.from({length:28},(_,i)=>`s${i+1}`),
    additionalProperties:false
  };

  const SYSTEM = `
Réponds en JSON strict (sans texte autour) avec 28 clés "s1"..."s28".
Chaque clé = 3 à 6 phrases en français, ton pastoral, citations en ${version}.
Correspondance exacte:
s1="1. Prière d’ouverture", s2="2. Canon et testament", ..., s28="28. Prière de fin".
Pour "6. Structure littéraire", donne une structure claire du passage (ex. Genèse 1: "Jour 1…7").
Pour "9" et "20", mets "Référence + citation" (${version}).`.trim();

  const link = youVersionLink(book,chapter) || "—";
  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Si utile, inclure "YouVersion : ${link}" dans s9/s12/s20/s27.
Retourne UNIQUEMENT un JSON valide correspondant au schéma demandé.`.trim();

  const payload = {
    model:"gpt-4o-mini",
    temperature:0.35,
    max_tokens:1600,
    response_format:{ type:"json_object" },
    messages:[ {role:"system", content:SYSTEM}, {role:"user", content:USER} ]
  };

  const controller=new AbortController();
  const to=setTimeout(()=>controller.abort(),20000);

  try{
    const r=await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const text=await r.text();
    if(!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0,200)}`);
    let data; try{ data=JSON.parse(text); }catch{ throw new Error("Réponse OpenAI invalide"); }
    const raw = data?.choices?.[0]?.message?.content || "";
    let obj; try{ obj=JSON.parse(raw); }catch{ throw new Error("Contenu non-JSON renvoyé"); }
    for(let i=1;i<=28;i++){ if(typeof obj[`s${i}`] !== "string") throw new Error(`Champ manquant s${i}`); }
    const mapped = Object.fromEntries(Array.from({length:28},(_,i)=>[`S${i+1}`,obj[`s${i+1}`]]));
    return mapped;
  } finally { clearTimeout(to); }
}

export default async function handler(req,res){
  // CORS minimal (facultatif pour même origine, inoffensif sinon)
  res.setHeader("Access-Control-Allow-Origin","*");
  res.setHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers","Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();

  try{
    // lecture entrée
    let body={};
    if(req.method==="POST"){
      body=await new Promise((resolve)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch{resolve({})}});});
    }
    const url=new URL(req.url,`http://${req.headers.host}`);
    const qp=Object.fromEntries(url.searchParams.entries());
    const probe=qp.probe==="1"||body.probe===true;

    let book=body.book||qp.book, chapter=Number(body.chapter||qp.chapter), version=body.version||qp.version||"LSG";
    const q=body.q||qp.q;
    if((!book||!chapter)&&q){ const p=parseQ(q); book=book||p.book; chapter=chapter||p.chapter; }
    const b=book||"Genèse", c=chapter||1;

    const apiKey=process.env.OPENAI_API_KEY;

    if(probe){ // force fallback pour tests
      const md=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }

    if(!apiKey){
      // pas de clé -> fallback
      const md=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
      res.setHeader("X-OpenAI-Error","missing OPENAI_API_KEY");
      return res.status(200).send(md);
    }

    // Appel IA
    let sections;
    try{
      sections = await askOpenAI_JSON({book:b,chapter:c,apiKey,version});
    }catch(e){
      const fb=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error",String(e?.message||e));
      return res.status(200).send(fb);
    }

    const md = mergeIntoTemplate(b,c,sections);
    res.setHeader("Content-Type","text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
    return res.status(200).send(md);

  }catch(e){
    try{
      const url=new URL(req.url,`http://${req.headers.host}`);
      const p=parseQ(url.searchParams.get("q")||"");
      const md=fallbackMarkdown(p.book||"Genèse",p.chapter||1);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("X-Last-Error",String(e?.message||e));
      return res.status(200).send(md);
    }catch{
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      return res.status(200).send(fallbackMarkdown("Genèse",1));
    }
  }
}

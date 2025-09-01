// api/chat.js — version corrigée
// - 28 rubriques garanties
// - JSON robuste, debug headers, max_tokens augmenté

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

${TITLES.map((t,i)=>`${t}\n\n{{S${i+1}}}`).join("\n\n")}`.trim();

function parseQ(q){ if(!q) return {book:"",chapter:NaN}; const m=String(q).match(/^(.+?)\s+(\d+)\s*$/); return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN}; }

function youVersionLink(book,chapter){
  const map={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const code=map[book]; return code?`https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`:"";
}

function mergeIntoTemplate(book, chapter, obj){
  let t = TEMPLATE.replace("{{BOOK}}",book).replace("{{CHAP}}",String(chapter));
  for(let i=1;i<=28;i++){
    const key=`S${i}`;
    t = t.replace(`{{S${i}}}`, String(obj[key]||"").trim() || "—");
  }
  return t;
}

// Fallback simplifié
function fallbackMarkdown(book,chapter){
  const link=youVersionLink(book,chapter)||"—";
  const obj={};
  for(let i=1;i<=28;i++){ obj[`S${i}`] = `Contenu générique pour ${TITLES[i-1]} (${book} ${chapter}).`; }
  obj.S9 = `Genèse ${chapter}:27 — « Dieu créa l’homme à son image… » (LSG).`;
  obj.S20 = `Genèse 1:1 — « Au commencement, Dieu créa les cieux et la terre. »`;
  obj.S12 += ` (YouVersion : ${link})`;
  return mergeIntoTemplate(book,chapter,obj);
}

async function askOpenAI_JSON({book,chapter,apiKey,version="LSG"}){
  const SYSTEM = `
Tu DOIS répondre en **JSON strict** (aucun texte hors JSON), avec **28** clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, style pastoral, version ${version} pour citations.
Respecte exactement la correspondance :
s1=>"1. Prière d’ouverture", ..., s28=>"28. Prière de fin".`.trim();

  const link = youVersionLink(book,chapter) || "—";
  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Si utile, inclure "YouVersion : ${link}" dans s9/s12/s20/s27.
Renvoie **uniquement** un JSON valide.`.trim();

  const payload = {
    model:"gpt-4o-mini",
    temperature:0.35,
    max_tokens:4000,
    response_format:{ type:"json_object" },
    messages:[
      {role:"system", content:SYSTEM},
      {role:"user", content:USER}
    ]
  };

  const controller=new AbortController();
  const to=setTimeout(()=>controller.abort(),18000);

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

    // 🔒 Extraction JSON robuste
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Pas de JSON trouvé");
    let obj;
    try { obj=JSON.parse(match[0]); }
    catch { throw new Error("JSON invalide"); }

    // Validation
    for(let i=1;i<=28;i++){ if(typeof obj[`s${i}`] !== "string") throw new Error(`Champ manquant s${i}`); }
    const mapped = Object.fromEntries(Array.from({length:28},(_,i)=>[`S${i+1}`,obj[`s${i+1}`]]));
    return {mapped, raw};
  } finally { clearTimeout(to); }
}

export default async function handler(req,res){
  try{
    let body={}; if(req.method==="POST"){ body=await new Promise((resolve)=>{let b="";req.on("data",c=>b+=c);req.on("end",()=>{try{resolve(JSON.parse(b||"{}"))}catch{resolve({})}});});}
    const url=new URL(req.url,`http://${req.headers.host}`), qp=Object.fromEntries(url.searchParams.entries());
    const probe=qp.probe==="1"||body.probe===true;

    let book=body.book||qp.book, chapter=Number(body.chapter||qp.chapter), version=body.version||qp.version||"LSG";
    const q=body.q||qp.q; if((!book||!chapter)&&q){ const p=parseQ(q); book=book||p.book; chapter=chapter||p.chapter; }
    const b=book||"Genèse", c=chapter||1;

    if(probe){
      const md=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }

    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey){
      const md=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      return res.status(200).send(md);
    }

    // IA -> JSON -> Markdown
    let sections, raw;
    try{
      ({mapped:sections, raw} = await askOpenAI_JSON({book:b,chapter:c,apiKey,version}));
    }catch(e){
      const fb=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error",String(e?.message||e));
      return res.status(200).send(fb);
    }

    const md = mergeIntoTemplate(b,c,sections);

    res.setHeader("Content-Type","text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
    res.setHeader("X-OpenAI-Raw", raw.slice(0,200)); // debug
    return res.status(200).send(md);
  }catch(e){
    res.setHeader("Content-Type","text/markdown; charset=utf-8");
    return res.status(200).send(fallbackMarkdown("Genèse",1));
  }
}

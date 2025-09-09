import { NextRequest, NextResponse } from "next/server";

/* ---------- CONFIG ---------- */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const BIBLE_API_KEY = process.env.BIBLE_API_KEY || "";
const DARBY_VERSION_ID = process.env.BIBLE_DARBY_VERSION_ID || ""; // ex: "65eec8e0f5d04f5b-01"

/* ---------- RUBRIQUES ---------- */
const RUBRICS: Record<number, { title: string; desc: string }> = {
  1:{title:"Prière d’ouverture",desc:"Invocation du Saint-Esprit pour éclairer l’étude."},
  2:{title:"Canon et testament",desc:"Appartenance au canon (AT/NT)."},
  3:{title:"Questions du chapitre précédent",desc:"Questions à reprendre de l’étude précédente."},
  4:{title:"Titre du chapitre",desc:"Résumé doctrinal synthétique du chapitre."},
  5:{title:"Contexte historique",desc:"Période, géopolitique, culture, carte."},
  6:{title:"Structure littéraire",desc:"Séquençage narratif et composition."},
  7:{title:"Genre littéraire",desc:"Type de texte : narratif, poétique, prophétique…"},
  8:{title:"Auteur et généalogie",desc:"Auteur et lien aux patriarches (généalogie)."},
  9:{title:"Verset-clé doctrinal",desc:"Verset central du chapitre."},
  10:{title:"Analyse exégétique",desc:"Commentaire exégétique (original si utile)."},
  11:{title:"Analyse lexicale",desc:"Mots-clés et portée doctrinale."},
  12:{title:"Références croisées",desc:"Passages parallèles et complémentaires."},
  13:{title:"Fondements théologiques",desc:"Doctrines majeures qui émergent du chapitre."},
  14:{title:"Thème doctrinal",desc:"Correspondance avec les grands thèmes doctrinaux."},
  15:{title:"Fruits spirituels",desc:"Vertus / attitudes visées."},
  16:{title:"Types bibliques",desc:"Figures typologiques et symboles."},
  17:{title:"Appui doctrinal",desc:"Passages d’appui concordants."},
  18:{title:"Comparaison entre versets",desc:"Comparaison interne des versets."},
  19:{title:"Comparaison avec Actes 2",desc:"Parallèle avec Actes 2."},
  20:{title:"Verset à mémoriser",desc:"Verset à mémoriser."},
  21:{title:"Enseignement pour l’Église",desc:"Implications pour l’Église."},
  22:{title:"Enseignement pour la famille",desc:"Applications familiales."},
  23:{title:"Enseignement pour enfants",desc:"Pédagogie enfants (jeux, récits, symboles)."},
  24:{title:"Application missionnaire",desc:"Applications mission/évangélisation."},
  25:{title:"Application pastorale",desc:"Applications pastorales/enseignement."},
  26:{title:"Application personnelle",desc:"Application personnelle engagée."},
  27:{title:"Versets à retenir",desc:"Versets utiles à retenir."},
  28:{title:"Prière de fin",desc:"Prière de clôture."},
};

const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const hardLimit = (txt:string,max:number)=>{
  if (txt.length<=max) return txt;
  const s = txt.slice(0,max);
  const cut = Math.max(s.lastIndexOf("."),s.lastIndexOf("!"),s.lastIndexOf("?"));
  return (cut>max*0.6? s.slice(0,cut+1) : s+"…");
};

/* ---------- BIBLE DARBY (optionnel) ---------- */
async function fetchDarby(passage:string):Promise<string|null>{
  if (!BIBLE_API_KEY || !DARBY_VERSION_ID) return null;
  try{
    const url = new URL(`https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(DARBY_VERSION_ID)}/passages`);
    url.searchParams.set("reference", passage);
    url.searchParams.set("content-type", "text");
    url.searchParams.set("include-notes", "false");
    url.searchParams.set("include-titles", "false");
    url.searchParams.set("include-chapter-numbers", "false");
    url.searchParams.set("include-verse-numbers", "true");
    const r = await fetch(url.toString(), { headers:{ "api-key": BIBLE_API_KEY } });
    if(!r.ok) throw new Error(`Bible API ${r.status}`);
    const j = await r.json();
    const c = j?.data?.content || j?.data?.passages?.[0]?.content || "";
    return String(c).trim() || null;
  }catch{ return null; }
}

/* ---------- OpenAI (si dispo) ---------- */
async function genWithOpenAI(passage:string, scripture:string|null, perSec:number){
  const system = `Tu es un théologien évangélique. Étude en 28 rubriques, ton narratif et pastoral, fidèle à la saine doctrine.
- Appuie-toi sur la DARBY (si fournie) sans recoller le texte intégral.
- Zéro doublon entre rubriques; réponds explicitement aux questions.
- Cite les versets sous forme "v.3-5" si utile.
- Longueur par rubrique ~ ${perSec} caractères (±8%).`;

  const user = [
    `Passage: ${passage}`,
    scripture?`Texte DARBY (contexte, ne pas reproduire en bloc):\n${scripture.slice(0,8000)}`:`Texte DARBY indisponible`,
    `Retourne JSON strict: {"sections":[{"id":1..28,"title":"","description":"","content":""},...]}`,
    `Libellés attendus: ${JSON.stringify(RUBRICS)}`
  ].join("\n\n");

  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model:"gpt-4o-mini", temperature:0.6, response_format:{type:"json_object"},
      messages:[ {role:"system",content:system},{role:"user",content:user} ] })
  });
  if(!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || "{}";
  let parsed:any={}; try{ parsed=JSON.parse(raw);}catch{}
  const arr = Array.isArray(parsed?.sections)?parsed.sections:[];
  return Array.from({length:28},(_,i)=>{
    const id=i+1, meta=RUBRICS[id], f=arr.find((x:any)=>Number(x?.id)===id)||{};
    return {
      id,
      title: String(f.title||meta.title),
      description: String(f.description||meta.desc),
      content: hardLimit(String(f.content||""), clamp(perSec,300,5000)),
    };
  });
}

/* ---------- Fallback local ---------- */
function localFallback(passage:string, perSec:number){
  return Array.from({length:28},(_,i)=>{
    const id=i+1, meta=RUBRICS[id];
    const txt = (
      `${meta.title} — ${passage}. ${meta.desc}. `+
      `À la lumière de l’Écriture, le chapitre met en avant la souveraineté de Dieu, `+
      `la progression de la révélation et l’appel à la foi obéissante. `+
      `Application: méditer, prier, obéir, témoigner, servir l’Église et aimer le prochain.`
    );
    return { id, title: meta.title, description: meta.desc, content: hardLimit(txt, clamp(perSec,300,5000)) };
  });
}

/* ---------- Handler ---------- */
export async function POST(req: NextRequest) {
  try{
    const { passage, options } = await req.json();
    const per = clamp(Number(options?.length||1500),300,5000);
    const scripture = await fetchDarby(String(passage||""));

    let sections;
    try{
      sections = OPENAI_API_KEY
        ? await genWithOpenAI(String(passage||""), scripture, per)
        : localFallback(String(passage||""), per);
    }catch(e){
      sections = localFallback(String(passage||""), per);
    }

    return NextResponse.json({ study: { sections } });
  }catch(err:any){
    const sections = localFallback("Genèse 1", 1500);
    return NextResponse.json({ study:{ sections }, error:String(err?.message||err), info:{ emergency:true }},{status:200});
  }
}

export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok:true, route:"/api/generate-study", router:"app", hint:"POST pour générer." });
}

export async function POST(req: NextRequest){
  const { passage = "Genèse 1", options = {} } = await req.json().catch(()=>({}));
  const per = Math.max(300, Math.min(5000, Number(options.length||1500)));
  const RUBRICS = {
    1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",
    5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",
    9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",
    13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",
    17:"Appui doctrinal",18:"Comparaison entre versets",19:"Comparaison avec Actes 2",20:"Verset à mémoriser",
    21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",
    24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",
    27:"Versets à retenir",28:"Prière de fin"
  } as Record<number,string>;

  const fit=(t:string)=>{
    const min=Math.round(per*0.92), max=Math.round(per*1.08);
    let s=t.trim();
    if(s.length>max){ const c=s.slice(0,max); const p=Math.max(c.lastIndexOf("."),c.lastIndexOf("!"),c.lastIndexOf("?")); s=p>max*0.6?c.slice(0,p+1):c+"…"; }
    while(s.length<min){
      s += " L’Esprit éclaire, la Parole façonne, et la foi obéit avec humilité.";
      if (s.length>min) break;
    }
    return s;
  };

  const sections = Array.from({length:28},(_,i)=>{
    const id=i+1, title=RUBRICS[id];
    const body =
`### ${title}

${id===1?`Père, nous venons méditer ${passage}. Ouvre nos yeux, affermis nos cœurs et conduis-nous dans la vérité.`:
id===4?`« ${passage} — Dieu parle et l’homme répond ». Le fil narratif souligne l’initiative divine, la réponse humaine et la fidélité de l’alliance.`:
id===9?`Verset-clé à identifier (par ex. v.1–5) : axe doctrinal qui éclaire la souveraineté de Dieu et la foi qui répond.`:
id===28?`Seigneur, scelle cette méditation de ${passage}. Fortifie notre foi et conduis-nous dans l’obéissance. Amen.`:
`${title} — ${passage}.`}`;
    return { id, title, description: body.split("\n")[2]||"", content: fit(body) };
  });

  return NextResponse.json({ study:{ sections } }, { status:200 });
}

export const runtime = "edge";

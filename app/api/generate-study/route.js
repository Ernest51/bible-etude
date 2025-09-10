import { NextRequest, NextResponse } from "next/server";

/** --- mini générateur sans IA : 28 rubriques, densité respectée --- */
const RUBRICS: Record<number, {t:string; d:string}> = {
  1:{t:"Prière d’ouverture",d:"Invocation du Saint-Esprit pour éclairer l’étude."},
  2:{t:"Canon et testament",d:"Appartenance au canon (AT/NT)."},
  3:{t:"Questions du chapitre précédent",d:"Questions à reprendre de l’étude précédente."},
  4:{t:"Titre du chapitre",d:"Résumé doctrinal synthétique du chapitre."},
  5:{t:"Contexte historique",d:"Période, géopolitique, culture, carte."},
  6:{t:"Structure littéraire",d:"Séquençage narratif et composition."},
  7:{t:"Genre littéraire",d:"Type de texte : narratif, poétique, prophétique…"},
  8:{t:"Auteur et généalogie",d:"Auteur et lien aux patriarches (généalogie)."},
  9:{t:"Verset-clé doctrinal",d:"Verset central du chapitre."},
  10:{t:"Analyse exégétique",d:"Commentaire exégétique (original si utile)."},
  11:{t:"Analyse lexicale",d:"Mots-clés et portée doctrinale."},
  12:{t:"Références croisées",d:"Passages parallèles et complémentaires."},
  13:{t:"Fondements théologiques",d:"Doctrines majeures qui émergent du chapitre."},
  14:{t:"Thème doctrinal",d:"Correspondance avec les grands thèmes doctrinaux."},
  15:{t:"Fruits spirituels",d:"Vertus / attitudes visées."},
  16:{t:"Types bibliques",d:"Figures typologiques et symboles."},
  17:{t:"Appui doctrinal",d:"Passages d’appui concordants."},
  18:{t:"Comparaison entre versets",d:"Comparaison interne des versets."},
  19:{t:"Comparaison avec Actes 2",d:"Parallèle avec Actes 2."},
  20:{t:"Verset à mémoriser",d:"Verset à mémoriser."},
  21:{t:"Enseignement pour l’Église",d:"Implications pour l’Église."},
  22:{t:"Enseignement pour la famille",d:"Applications familiales."},
  23:{t:"Enseignement pour enfants",d:"Pédagogie enfants (jeux, récits, symboles)."},
  24:{t:"Application missionnaire",d:"Applications mission/évangélisation."},
  25:{t:"Application pastorale",d:"Applications pastorales/enseignement."},
  26:{t:"Application personnelle",d:"Application personnelle engagée."},
  27:{t:"Versets à retenir",d:"Versets utiles à retenir."},
  28:{t:"Prière de fin",d:"Prière de clôture."},
};

const clamp = (n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const fit = (txt:string, target:number)=>{
  const min = Math.round(target*0.92), max = Math.round(target*1.08);
  let t = txt.trim();
  if (t.length>max){
    const s=t.slice(0,max); const cut=Math.max(s.lastIndexOf("."),s.lastIndexOf("!"),s.lastIndexOf("?"));
    return cut>max*0.6 ? s.slice(0,cut+1) : s+"…";
  }
  if (t.length<min){
    const add=[
      " Cela nous garde humbles devant Dieu.",
      " L’Esprit éclaire le cœur pour recevoir la vérité.",
      " L’alliance demeure sûre en Christ.",
      " Ainsi la foi s’enracine dans l’obéissance.",
      " L’Église est appelée à vivre cette parole dans l’amour."
    ];
    let i=0; while(t.length<min){ t+=add[i%add.length]; i++; if(i>50)break; }
  }
  return t;
};

export async function POST(req: NextRequest){
  try{
    const { passage, options } = await req.json();
    const psg = String(passage||"Genèse 1");
    const per = clamp(Number(options?.length||1500),300,5000);

    const sections = Array.from({length:28}, (_,k)=>{
      const id=k+1, meta=RUBRICS[id];
      const base =
`### ${meta.t}

${id===1
  ? `Père, éclaire-nous en lisant ${psg}. Donne un cœur docile et une intelligence renouvelée, afin que ta Parole porte du fruit de repentance, de foi et d’amour.`
  : id===4
  ? `« ${psg} — Dieu parle et l’homme répond ». Le fil narratif souligne l’initiative divine, la réponse de l’homme et la fidélité de l’alliance.`
  : id===9
  ? `Verset-clé à repérer (par ex. v.1–5) : il condense l’axe doctrinal du chapitre et éclaire la souveraineté de Dieu et la foi qui répond.`
  : id===28
  ? `Seigneur, scelle en nous cette méditation de ${psg}. Affermis notre foi, dilate notre amour, et conduis-nous dans l’obéissance. Amen.`
  : `${meta.d} ${psg}.`
}`;

      return {
        id,
        title: meta.t,
        description: meta.d,
        content: fit(base, per),
      };
    });

    return NextResponse.json({ study:{ sections } }, { status:200 });
  }catch(e:any){
    const sections = Array.from({length:28},(_,i)=>({ id:i+1, title:RUBRICS[i+1].t, description:RUBRICS[i+1].d, content: fit(`### ${RUBRICS[i+1].t}\n\n${RUBRICS[i+1].d}`, 1200)}));
    return NextResponse.json({ study:{ sections }, info:{ emergency:true }, error:String(e?.message||e) }, { status:200 });
  }
}

export async function GET(){
  // smoke test utile dans le navigateur
  return NextResponse.json({ ok:true, route:"/api/generate-study", router:"app", hint:"POST pour générer." });
}

export const runtime = "edge";

// api/study-28.js
export const config = { runtime: "nodejs" };

/**
 * Génère une étude en 28 rubriques.
 * - mode=dry → contenu factice
 * - mode=full (défaut) → utilise api.bible pour récupérer un passage + injecte dans la structure
 */

import { getPassage } from "./bibleProvider.js";

function send(res, status, payload){
  res.status(status).setHeader("content-type","application/json; charset=utf-8");
  res.end(JSON.stringify(payload,null,2));
}

const FIXED_TITLES=[
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];

export default async function handler(req,res){
  try{
    if(req.method!=="POST"&&req.method!=="GET")
      return send(res,405,{ok:false,error:"Méthode non autorisée"});
    const { searchParams } = new URL(req.url,`http://${req.headers.host}`);
    const dry=searchParams.get("dry")==="1";
    const mode=searchParams.get("mode")||"full";

    let body={}; if(req.method==="POST"){
      const chunks=[]; for await (const c of req) chunks.push(c);
      try{ body=JSON.parse(Buffer.concat(chunks).toString("utf8")||"{}"); }catch{}
    }else{
      body={
        book: searchParams.get("book")||"",
        chapter: searchParams.get("chapter")||"",
        verse: searchParams.get("verse")||"",
        translation: searchParams.get("translation")||"LSG",
        bibleId: searchParams.get("bibleId")||"",
      };
    }
    const { book, chapter, verse, translation, bibleId } = body;
    if(!book||!chapter) return send(res,400,{ok:false,error:"book et chapter requis"});

    const meta={ book, chapter:String(chapter), verse:verse||"", translation, reference:`${book} ${chapter}${verse?":"+verse:""}`, osis:"" };
    let passage=null;
    if(!dry){
      try{
        const ref=`${book}.${chapter}${verse? "."+verse:""}`;
        const got=await getPassage({ bibleId, ref, includeVerseNumbers:true });
        passage=got.contentHtml.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
        meta.reference=got.reference||meta.reference; meta.osis=ref;
      }catch(e){ passage="(Passage non récupéré : "+e.message+")"; }
    }

    const sections=FIXED_TITLES.map((t,i)=>({
      index:i+1,
      title:t,
      content: dry? `Exemple ${t} (${meta.reference}).` : `${t} (${meta.reference}). ${passage?passage.slice(0,120)+"...":""}`,
      verses:[]
    }));

    return send(res,200,{ok:true,data:{meta,sections}});
  }catch(e){
    return send(res,500,{ok:false,error:String(e?.message||e)});
  }
}

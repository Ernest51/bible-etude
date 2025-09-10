// /api/generate-study.js — version robuste et en français

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const nettoyer = s => String(s||'').replace(/\s{2,}/g,' ').trim();
const uniq = txt=>{
  const vus=new Set();
  return String(txt||'').split(/(?<=\.)\s+/).filter(p=>{
    const k=p.trim().toLowerCase();
    if(!k||vus.has(k)) return false;
    vus.add(k);
    return true;
  }).join(' ');
};

// Ajuste le texte pour correspondre à la densité demandée
function ajusterLongueur(txt,cible){
  const min=Math.round(cible*0.9), max=Math.round(cible*1.1);
  let t=nettoyer(uniq(txt));
  if(t.length>max){
    const cut=t.slice(0,max);
    const fin=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '));
    t = fin>max*0.6 ? cut.slice(0,fin+1) : cut;
  }
  if(t.length<min){
    const pads=[
      " Cela souligne la cohérence interne du passage.",
      " Ce texte fonde la doctrine de la création et du salut.",
      " Il éclaire la mission de l’Église et la vocation de l’homme."
    ];
    let i=0;
    while(t.length<min && i<pads.length*5){ t+=pads[i%pads.length]; i++; }
  }
  return nettoyer(uniq(t));
}

// Rubriques
const RUBRIQUES = {
  1:{titre:"Prière d’ouverture", angle:"Invocation de l’Esprit."},
  2:{titre:"Canon et testament", angle:"Place dans le canon."},
  // … jusqu’à 28
  28:{titre:"Prière de fin", angle:"Clôture et bénédiction."}
};

// Exemple de génération simple (à remplacer par un vrai moteur théologique)
function genererSection(id, passage, cible){
  const enTete = `### ${RUBRIQUES[id].titre}\n\n*Référence :* ${passage}\n\n`;
  const contenu = `Développement narratif et doctrinal pour ${passage}. ${RUBRIQUES[id].angle}`;
  return ajusterLongueur(enTete+contenu, cible);
}

function genererToutes(passage, cible){
  return Array.from({length:28},(_,i)=>{
    const id=i+1;
    return {
      id,
      title:RUBRIQUES[id].titre,
      description:RUBRIQUES[id].angle,
      content: genererSection(id, passage, cible)
    };
  });
}

// Aide : lecture du body JSON
async function lireBody(req){
  if(req.body && typeof req.body==='object') return req.body;
  if(typeof req.body==='string'){ try{ return JSON.parse(req.body);}catch{} }
  return new Promise(resolve=>{
    let brut=''; req.on('data',c=>brut+=c);
    req.on('end',()=>{ try{ resolve(brut?JSON.parse(brut):{});}catch{ resolve({}); } });
    req.on('error',()=>resolve({}));
  });
}

// Réponse JSON
function envoyer(res, code, obj){
  res.statusCode=code;
  res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store");
  res.end(JSON.stringify(obj));
}

// Handler principal
module.exports = async (req,res)=>{
  try{
    if(req.method==='GET'){
      return envoyer(res,200,{
        ok:true,
        route:'/api/generate-study',
        method:'GET',
        hint:'POST { passage, options:{ length:500|1500|2500 } }'
      });
    }
    if(req.method!=='POST'){
      return envoyer(res,405,{error:'Méthode non autorisée'});
    }

    const body=await lireBody(req);
    const passage=body?.passage || "Genèse 1";
    const L=Number(body?.options?.length)||1500;
    const cible = L<1000?500:(L<2000?1500:2500);

    const sections=genererToutes(passage,cible);
    return envoyer(res,200,{study:{sections}});
  }catch(e){
    console.error("Erreur generate-study:",e);
    const sections=genererToutes("Genèse 1",1500);
    return envoyer(res,200,{study:{sections},info:{error:String(e)}});
  }
};

// Pour compatibilité ESM
exports.default = module.exports;

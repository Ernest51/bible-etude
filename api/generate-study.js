// api/generate-study.js
const RUBRICS = {
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

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const fit = (txt,target)=>{
  const min=Math.round(target*0.92), max=Math.round(target*1.08);
  let t=String(txt||"").trim();
  if (t.length>max){
    const s=t.slice(0,max);
    const cut=Math.max(s.lastIndexOf("."),s.lastIndexOf("!"),s.lastIndexOf("?"));
    t = cut>max*0.6 ? s.slice(0,cut+1) : s + "…";
  }
  while (t.length<min){
    t += " L’Esprit éclaire, la Parole façonne, et la foi obéit avec humilité.";
    if (t.length>min) break;
  }
  return t;
};

function buildSections(passage, per){
  return Array.from({length:28},(_,i)=>{
    const id=i+1, meta=RUBRICS[id];
    const body =
`### ${meta.title}

${id===1?`Père, nous venons méditer ${passage}. Ouvre nos yeux, affermis nos cœurs et conduis-nous dans la vérité.`:
id===4?`« ${passage} — Dieu parle et l’homme répond ». Le fil narratif souligne l’initiative divine, la réponse humaine et la fidélité de l’alliance.`:
id===9?`Verset-clé à identifier (par ex. v.1–5) : axe doctrinal qui éclaire la souveraineté de Dieu et la foi qui répond.`:
id===28?`Seigneur, scelle cette méditation de ${passage}. Fortifie notre foi et conduis-nous dans l’obéissance. Amen.`:
`${meta.desc} ${passage}.`}`;
    return { id, title: meta.title, description: meta.desc, content: fit(body, per) };
  });
}

function json(res, status, data){
  res.status(status);
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.end(JSON.stringify(data));
}

export default async function handler(req, res){
  if (req.method === 'OPTIONS') return json(res, 204, {});

  if (req.method === 'GET'){
    return json(res, 200, {
      ok:true, route:'/api/generate-study', method:'GET',
      hint:'POST { passage, options:{ length: 500|1500|2500 } }'
    });
  }
  if (req.method !== 'POST'){
    return json(res, 405, { error: 'Method not allowed' });
  }

  try{
    let body = req.body || {};
    if (typeof body === 'string'){
      try { body = JSON.parse(body); } catch { body = {}; }
    }

    const passage = body.passage ? String(body.passage) : 'Genèse 1';
    const per = clamp(Number(body?.options?.length) || 1500, 300, 5000);

    const sections = buildSections(passage, per);
    return json(res, 200, { study: { sections } });

  }catch(e){
    const sections = buildSections('Genèse 1', 1500);
    return json(res, 200, { study: { sections }, info:{ emergency:true, err:String(e?.message||e) } });
  }
}

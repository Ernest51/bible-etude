// /api/generate-study.js — ESM (Node 22), robuste, FR

const clamp = (n,a,b)=>Math.max(a,Math.min(b,n));
const clean = s => String(s||'').replace(/\s{2,}/g,' ').trim();

// supprime les phrases doublonnées (anti-boucles)
function dedupeSentences(txt){
  const seen = new Set();
  return String(txt||'')
    .split(/(?<=\.)\s+/)
    .filter(p=>{
      const k = p.trim().toLowerCase();
      if(!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(' ');
}

// ajuste la longueur autour de la cible (±10%)
function fitLength(txt, target){
  const min = Math.round(target*0.9);
  const max = Math.round(target*1.1);
  let t = clean(dedupeSentences(txt));

  if(t.length > max){
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    t = end > max*0.6 ? cut.slice(0, end+1) : cut;
  }
  if(t.length < min){
    const pads = [
      " Cela confirme l’unité du passage.",
      " La doctrine qui en découle éclaire la foi et la vie de l’Église.",
      " Le propos s’inscrit dans l’ensemble du canon et conduit à l’obéissance."
    ];
    let i = 0;
    while(t.length < min && i < pads.length*6){ t += pads[i % pads.length]; i++; }
  }
  return clean(dedupeSentences(t));
}

const RUBRICS = {
  1:{title:"Prière d’ouverture",desc:"Invocation du Saint-Esprit pour éclairer l’étude."},
  2:{title:"Canon et testament",desc:"Place dans le canon (AT/NT) et continuité biblique."},
  3:{title:"Questions du chapitre précédent",desc:"Points à reprendre et tensions ouvertes."},
  4:{title:"Titre du chapitre",desc:"Formulation doctrinale synthétique et fidèle au texte."},
  5:{title:"Contexte historique",desc:"Cadre temporel, culturel, géographique, destinataires."},
  6:{title:"Structure littéraire",desc:"Découpage, progression et marqueurs rhétoriques."},
  7:{title:"Genre littéraire",desc:"Narratif, poétique, prophétique… incidences herméneutiques."},
  8:{title:"Auteur et généalogie",desc:"Auteur humain, inspiration divine, ancrage généalogique."},
  9:{title:"Verset-clé doctrinal",desc:"Pivot théologique du chapitre."},
  10:{title:"Analyse exégétique",desc:"Explication de texte : grammaire, syntaxe, contexte immédiat."},
  11:{title:"Analyse lexicale",desc:"Termes clés, champs sémantiques, portée doctrinale."},
  12:{title:"Références croisées",desc:"Passages parallèles/complémentaires dans l’Écriture."},
  13:{title:"Fondements théologiques",desc:"Attributs de Dieu, création, alliance, salut…"},
  14:{title:"Thème doctrinal",desc:"Rattachement aux grands thèmes systématiques."},
  15:{title:"Fruits spirituels",desc:"Vertus et attitudes produites par la doctrine."},
  16:{title:"Types bibliques",desc:"Typologie, symboles et figures."},
  17:{title:"Appui doctrinal",desc:"Textes d’appui validant l’interprétation."},
  18:{title:"Comparaison entre versets",desc:"Harmonisation interne du chapitre."},
  19:{title:"Parallèle avec Actes 2",desc:"Continuité de la révélation et de l’Église."},
  20:{title:"Verset à mémoriser",desc:"Formulation brève et structurante pour la mémoire."},
  21:{title:"Enseignement pour l’Église",desc:"Gouvernance, culte, mission, édification."},
  22:{title:"Enseignement pour la famille",desc:"Transmission, sainteté, consolation."},
  23:{title:"Enseignement pour enfants",desc:"Pédagogie, récits, symboles, jeux sérieux."},
  24:{title:"Application missionnaire",desc:"Annonce, contextualisation fidèle, espérance."},
  25:{title:"Application pastorale",desc:"Conseil, avertissement, consolation."},
  26:{title:"Application personnelle",desc:"Repentance, foi, obéissance, prière."},
  27:{title:"Versets à retenir",desc:"Sélection utile pour la méditation et l’évangélisation."},
  28:{title:"Prière de fin",desc:"Action de grâces et demande de bénédiction."}
};

// (Bouchon) fabrique un contenu narratif + doctrinal (remplacer par ton moteur réel si besoin)
function buildContent(id, passage){
  const r = RUBRICS[id];
  const intro = `### ${r.title}\n\n*Référence :* ${passage}\n\n`;
  const body =
`${r.desc} Le propos reste ancré dans la sainte doctrine, en suivant l’axe narratif du chapitre, \
et en mettant en relief l’initiative de Dieu et la réponse de la foi. Les versets pertinents seront \
cliquables côté interface et renverront à YouVersion.`;
  return intro + body;
}

function makeSections(passage, targetLen){
  return Array.from({length:28}, (_,i)=>{
    const id = i+1;
    const raw = buildContent(id, passage);
    return {
      id,
      title: RUBRICS[id].title,
      description: RUBRICS[id].desc,
      content: fitLength(raw, targetLen)
    };
  });
}

// lecture sûre du body (sans dépendre d’un body-parser)
async function readBody(req){
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch {} }
  return new Promise(resolve=>{
    let acc='';
    req.on('data',c=>acc+=c);
    req.on('end',()=>{ try{ resolve(acc?JSON.parse(acc):{});}catch{ resolve({}); } });
    req.on('error',()=>resolve({}));
  });
}

function send(res, code, obj){
  res.statusCode = code;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res){
  try{
    if (req.method === 'GET'){
      return send(res, 200, {
        ok:true,
        route:'/api/generate-study',
        method:'GET',
        hint:'POST { passage, options:{ length: 500|1500|2500 } }'
      });
    }
    if (req.method !== 'POST'){
      return send(res, 405, { error:'Méthode non autorisée' });
    }

    const body = await readBody(req);
    const passage = clean(body?.passage || 'Genèse 1');
    const L = Number(body?.options?.length) || 1500;
    const target = L <= 800 ? 500 : (L < 2000 ? 1500 : 2500);

    const sections = makeSections(passage, target);
    return send(res, 200, { study:{ sections } });
  }catch(err){
    console.error('[generate-study] ERREUR:', err);
    // Filet de sécurité : ne jamais rendre 500 au front → gabarit utile
    const sections = makeSections('Genèse 1', 1500);
    return send(res, 200, { study:{ sections }, info:{ emergency:true, error:String(err?.message||err) } });
  }
}

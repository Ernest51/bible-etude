// /api/chat.js
export const config = { runtime: 'nodejs' };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'; // ou 'gpt-4o-mini'

/* --- Spécifications strictes par point (1..28) --- */
const SPEC = {
  1:  "Prière d’ouverture en JE, liée explicitement au livre et chapitre, humble, théologique et pastorale. Interdit 'nous'.",
  2:  "Canon et testament : situer le livre (AT/NT), place dans le canon, structure globale, visée.",
  3:  "Questions du chapitre précédent : AU MOINS 5 questions AVEC RÉPONSES INTÉGRALES (Q->R) et précises.",
  4:  "Titre du chapitre : résumé doctrinal synthétique (2–3 phrases) fidèle au passage.",
  5:  "Contexte historique : période, géopolitique, culture, inclure une carte visuelle (image Markdown).",
  6:  "Structure littéraire : séquençage narratif point par point (liste), composition interne du chapitre.",
  7:  "Genre littéraire : type et implications herméneutiques.",
  8:  "Auteur et généalogie : auteur, destinataires, arbre généalogique (tableau Markdown si pertinent).",
  9:  "Verset-clé doctrinal : 1 verset central + brève explication (référence explicite).",
  10: "Analyse exégétique : commentaire mot-à-mot, grec/hébreu lorsque pertinent, références précises.",
  11: "Analyse lexicale : mots-clés originaux (translittérations), champs sémantiques, portée doctrinale.",
  12: "Références croisées : passages parallèles/complémentaires (liste).",
  13: "Fondements théologiques : doctrines majeures tirées du chapitre.",
  14: "Thème doctrinal : rattacher aux 22 grands thèmes (salut, sanctification, alliance…).",
  15: "Fruits spirituels : vertus/attitudes suscitées, exhortations concrètes.",
  16: "Types bibliques : symboles/typologie (tableau ou liste) et accomplissement en Christ.",
  17: "Appui doctrinal : passages confirmant l’enseignement (citations + micro-commentaires).",
  18: "Comparaison entre versets du chapitre : tableau comparatif recommandé.",
  19: "Comparaison avec Actes 2 : points de contact/différences, rôle du Saint-Esprit.",
  20: "Verset à mémoriser : un verset + méthode de mémorisation.",
  21: "Enseignement pour l’Église : implications ecclésiales concrètes.",
  22: "Enseignement pour la famille : valeurs/pratiques à transmettre.",
  23: "Enseignement pour enfants : version simplifiée (récit court), idées d’activités/jeux.",
  24: "Application missionnaire : pistes d’évangélisation, ponts culturels.",
  25: "Application pastorale : CONSEILS pour pasteurs/enseignants (plan, prudences, exhortations).",
  26: "Application personnelle : examen de conscience, engagements concrets (liste).",
  27: "Versets à retenir : sélection pour la prédication (liste + utilité).",
  28: "Prière de fin en JE, remerciant pour le livre et chapitre, demandant mise en pratique concrète."
};

const TITRES = [
  'Prière d’ouverture — Invocation du Saint-Esprit pour éclairer mon étude.',
  'Canon et testament — Identifier le livre dans le canon (Ancien/Nouveau Testament).',
  'Questions du chapitre précédent — Minimum 5 questions, avec réponses intégrales pour vérifier la compréhension.',
  'Titre du chapitre — Résumé doctrinal synthétique du passage.',
  'Contexte historique — Période, géopolitique, culture, avec carte visuelle localisée.',
  'Structure littéraire — Séquençage narratif et composition interne du chapitre.',
  'Genre littéraire — Type de texte (narratif, poétique, prophétique, etc.).',
  'Auteur et généalogie — Présentation de l’auteur et lien aux patriarches (avec arbre généalogique).',
  'Verset-clé doctrinal — Verset central du chapitre (cliquable vers BibleGateway).',
  'Analyse exégétique — Commentaire mot-à-mot avec références au grec/hébreu.',
  'Analyse lexicale — Analyse des mots-clés originaux et sens doctrinal.',
  'Références croisées — Passages parallèles ou complémentaires dans la Bible.',
  'Fondements théologiques — Doctrines majeures qui émergent du chapitre.',
  'Thème doctrinal — Lien entre ce chapitre et les 22 grands thèmes de la doctrine biblique.',
  'Fruits spirituels — Vertus et attitudes inspirées par le chapitre.',
  'Types bibliques — Symboles ou figures typologiques présents.',
  'Appui doctrinal — Autres passages bibliques qui confirment l’enseignement.',
  'Comparaison entre versets — Comparer des versets du chapitre pour mise en relief.',
  'Comparaison avec Actes 2 — Parallèle avec le début de l’Église et l’action du Saint-Esprit.',
  'Verset à mémoriser — Verset essentiel à retenir dans ma vie spirituelle.',
  'Enseignement pour l’Église — Implications collectives et ecclésiales.',
  'Enseignement pour la famille — Valeurs à transmettre dans le foyer chrétien.',
  'Enseignement pour enfants — Méthode simplifiée avec récits, images, jeux.',
  'Application missionnaire — Comment ce texte guide l’évangélisation.',
  'Application pastorale — Conseils pour les pasteurs et enseignants.',
  'Application personnelle — Examen de conscience et engagement individuel.',
  'Versets à retenir — Versets incontournables pour la prédication.',
  'Prière de fin — Clôture spirituelle de l’étude avec reconnaissance.'
];

/* ---- utils http ---- */
function bad(res,msg){ res.statusCode=400; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:msg})); }
function ok(res,data){ res.statusCode=200; res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(data)); }
function chunk(a,n){ const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; }

/* ---- validations ---- */
const BOILER = /(voici\s+\d+\s+points|cette étude présente|nous allons|dans cette section)/i;
function norm(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function isJe(s){ return /\b(je|moi|mon|ma|mes)\b/i.test(s); }
function hasRef(s){
  return /\b(Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Rois|2\s*Rois|1\s*Chroniques|2\s*Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1\s*Corinthiens|2\s*Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1\s*Thessaloniciens|2\s*Thessaloniciens|1\s*Timothée|2\s*Timothée|Tite|Philémon|Hébreux|Jacques|1\s*Pierre|2\s*Pierre|1\s*Jean|2\s*Jean|3\s*Jean|Jude|Apocalypse)\s+\d{1,3}([:.]\d{1,3}([-–]\d{1,3})?)?\b/i.test(s);
}
function valid(n,text,{minChars,livre,chapitre}){
  const t = norm(text);
  if (!t || t.length < minChars) return false;
  if (BOILER.test(t)) return false;
  if ((n===1||n===28) && (!isJe(t) || !new RegExp(`\\b${livre}\\b\\s+${chapitre}\\b`,'i').test(t))) return false;
  if (n!==1 && n!==4 && n!==28 && !hasRef(t)) return false;
  return true;
}
function dedupe(out){
  const seen=new Set();
  for (const k of Object.keys(out)){
    const n = norm(out[k]).toLowerCase();
    if (seen.has(n)) out[k] = '(*) Réécrire ce point pour éviter toute redite. Développer un angle distinct, exemples et références nouvelles.';
    seen.add(n);
  }
}

/* ---- OpenAI chat simple ---- */
async function chat({messages}){
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  };
  if (OPENAI_PROJECT) headers['OpenAI-Project'] = OPENAI_PROJECT;

  const body = {
    model: MODEL,
    temperature: 0,
    top_p: 0,
    response_format: { type:'json_object' },
    messages
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {method:'POST', headers, body:JSON.stringify(body)});
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { throw new Error('Réponse OpenAI non JSON : '+txt.slice(0,200)); }
  if (!r.ok) throw new Error(j?.error?.message || ('HTTP '+r.status));
  const content = j?.choices?.[0]?.message?.content || '{}';
  let data; try { data = JSON.parse(content); } catch { throw new Error('Contenu non JSON'); }
  return data;
}

/* ---- messages ---- */
function sys(){
  return {
    role:'system',
    content:
      "Tu es un assistant d’étude biblique rigoureux, pastoral et fidèle à la doctrine chrétienne historique. " +
      "Tu écris en français, sans boilerplate, et tu respectes strictement les consignes."
  };
}

function userBatch({livre,chapitre,version,indices,minChars}){
  const plan = TITRES.map((t,i)=>`${i+1}. ${t}`).join('\n');
  const spec = indices.map(n=>`- ${n}. ${SPEC[n]}`).join('\n');
  const keys = indices.map(String); const keyStr = keys.map(k=>`"${k}"`).join(', ');

  return {
    role:'user',
    content:
`Étude sur **${livre} ${chapitre}** (version ${version||'LSG'}).

Plan (28 points) :
${plan}

Dans CETTE réponse, produis UNIQUEMENT les sections : [${keyStr}]

Exigences GÉNÉRALES (appliquer à CHAQUE section demandée) :
- longueur minimale : ${minChars} caractères utiles
- contenu strictement adapté à ${livre} ${chapitre}
- Markdown : **gras**, listes, tableaux |a|b|, frises "YYYY — ...", images ![alt](https://...) si pertinent
- citer plusieurs références bibliques explicites (ex: Genèse 1:1–3) ; ne mets pas d’URL, juste les références
- proscrire : “Voici X points…”, “nous allons…”, etc.
- points 1 et 28 : prières à la première personne (JE) faisant explicitement référence à ${livre} ${chapitre}

Exigences SPÉCIFIQUES :
${spec}

FORMAT DE SORTIE OBLIGATOIRE : JSON
{ ${keyStr} }
Chaque valeur doit être un long texte en Markdown.`
  };
}

function reviseMsg({livre,chapitre,n,minChars,cause,prev}){
  return {
    role:'user',
    content:
`Réécris UNIQUEMENT la section ${n} pour ${livre} ${chapitre}. Raison : ${cause}.
Contraintes : ≥${minChars} caractères, Markdown riche, références explicites, pas de boilerplate, respecte : ${SPEC[n]}.
Ancienne version (à corriger, ne la réutilise pas telle quelle) :
"""${prev}"""
FORMAT : JSON => { "${n}": "NOUVELLE VERSION" }`
  };
}

/* ---- handler ---- */
export default async function handler(req,res){
  try{
    if (req.method!=='POST') return bad(res,'POST attendu');
    if (!OPENAI_API_KEY) return ok(res,{error:'OPENAI_API_KEY manquant'},500);

    let body={}; try{ body = typeof req.body==='object' ? req.body : JSON.parse(req.body||'{}'); }catch{ return bad(res,'JSON invalide'); }

    const livre = String(body.livre||'').trim();
    const chapitre = parseInt(body.chapitre,10);
    const version = String(body.version||'LSG').trim();
    const minChars = Math.max(1200, parseInt(body.min_chars_per_point,10)||2500);
    const batch = Math.min(4, Math.max(1, parseInt(body.batch_size,10)||2));

    if (!livre || !Number.isFinite(chapitre)) return bad(res,'Paramètres requis : livre (string), chapitre (number)');

    const subset = (Array.isArray(body.subset) && body.subset.length)
      ? body.subset.map(x=>parseInt(x,10)).filter(n=>n>=1 && n<=28)
      : Array.from({length:28},(_,i)=>i+1);

    const groups = chunk(subset, batch);
    const out = {};
    const system = sys();

    for (const g of groups){
      const user = userBatch({livre,chapitre,version,indices:g,minChars});
      let obj = await chat({messages:[system,user]});

      for (const n of g){
        const key = String(n);
        let txt = obj[key] || '';
        if (BOILER.test(txt)) txt = txt.replace(BOILER,'').trim();

        let okFlag = valid(n, txt, {minChars,livre,chapitre});
        let tries = 0;

        while(!okFlag && tries<2){
          tries++;
          const cause = !txt ? 'vide'
                       : (norm(txt).length<minChars ? `longueur < ${minChars}`
                       : (BOILER.test(txt) ? 'boilerplate'
                       : ((n===1||n===28) && !isJe(txt) ? 'prière doit être en JE'
                       : (!hasRef(txt) ? 'références bibliques insuffisantes' : 'incohérence'))));
          const fix = await chat({messages:[system, reviseMsg({livre,chapitre,n,minChars,cause,prev:txt})]});
          txt = fix[key] || txt;
          if (BOILER.test(txt)) txt = txt.replace(BOILER,'').trim();
          okFlag = valid(n, txt, {minChars,livre,chapitre});
        }
        out[key] = txt;
      }
    }
    dedupe(out);
    return ok(res, { meta:{livre,chapitre,version,model:MODEL,minChars,batch}, ...out });
  }catch(e){
    console.error('[api/chat] error', e);
    return ok(res, { error: String(e?.message||e) }, 500);
  }
}

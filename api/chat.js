// /api/chat.js
// Étude 28 points déterministe et contrainte par JSON Schema.
// Variables d'env : OPENAI_API_KEY (obligatoire), OPENAI_PROJECT (optionnel)

export const config = { runtime: 'nodejs' };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'; // mets 'gpt-4.1' s’il est dispo chez toi

// ---- Spécifications STRICTES par point (1..28) ----
const POINT_SPEC = {
  1:  "Prière d’ouverture en JE, liée explicitement au livre et chapitre, humble, théologique et pastorale. Pas de “nous”.",
  2:  "Canon et testament : situer précisément le livre (AT/NT), place dans le canon, structure globale du livre, visée.",
  3:  "Questions du chapitre précédent : AU MOINS 5 questions AVEC RÉPONSES INTÉGRALES et précises (Q->R).",
  4:  "Titre du chapitre : résumé doctrinal synthétique (2–3 phrases fortes) et fidèle au passage.",
  5:  "Contexte historique : période, géopolitique, culture, avec carte visuelle (image Markdown) localisée.",
  6:  "Structure littéraire : séquençage narratif point par point (liste), composition interne du chapitre.",
  7:  "Genre littéraire : identifier et expliquer les implications herméneutiques.",
  8:  "Auteur et généalogie : auteur, destinataires, et arbre généalogique (tableau Markdown si pertinent).",
  9:  "Verset-clé doctrinal : 1 verset central cité + courte explication. Référence explicite (sera linkifiée côté client).",
  10: "Analyse exégétique : commentaire mot-à-mot avec appui grec/hébreu lorsque pertinent, références précises.",
  11: "Analyse lexicale : mots-clés originaux (translittérations), champs sémantiques, portée doctrinale.",
  12: "Références croisées : passages parallèles/complémentaires (liste de références explicites).",
  13: "Fondements théologiques : doctrines majeures tirées du chapitre, brièvement argumentées.",
  14: "Thème doctrinal : rattacher aux 22 grands thèmes (ex : salut, sanctification, alliance…) avec articulation claire.",
  15: "Fruits spirituels : vertus et attitudes suscitées, avec exhortations concrètes.",
  16: "Types bibliques : symboles, figures typologiques (tableau ou liste) et accomplissement en Christ.",
  17: "Appui doctrinal : autres passages confirmant l’enseignement (citations + micro-commentaires).",
  18: "Comparaison entre versets du chapitre : mise en relief de nuances (tableau comparatif recommandé).",
  19: "Comparaison avec Actes 2 : points de contact et différences, rôle du Saint-Esprit.",
  20: "Verset à mémoriser : un verset choisi + méthode de mémorisation (acrostiche, répétition espacée…).",
  21: "Enseignement pour l’Église : implications ecclésiales concrètes (discipline, culte, diaconat…).",
  22: "Enseignement pour la famille : valeurs et pratiques à transmettre dans le foyer chrétien.",
  23: "Enseignement pour enfants : version simplifiée (récit court), idées d’activités/jeux/visuels.",
  24: "Application missionnaire : pistes d’évangélisation, ponts culturels, prudence & clarté.",
  25: "Application pastorale : CONSEILS pour pasteurs et enseignants (plan de prédication, prudences, exhortations).",
  26: "Application personnelle : examen de conscience, engagements concrets (liste).",
  27: "Versets à retenir : sélection pour la prédication (liste + brève utilité de chacun).",
  28: "Prière de fin en JE, remerciant pour le livre et chapitre étudiés, demandant mise en pratique concrète."
};

// ---- Liste des 28 titres (juste informatif pour le prompt) ----
const TITLES_28 = [
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

// ---- Utilitaires HTTP ----
function badRequest(res, msg) {
  res.statusCode = 400;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.end(JSON.stringify({ error: msg || 'Bad request' }));
}
function json(res, data, status=200) {
  res.statusCode = status;
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.end(JSON.stringify(data));
}
function chunk(arr, size){ const out=[]; for(let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }

// ---- Normalisations / validations ----
const BOILER_RX = /(voici\s+\d+\s+points|cette étude présente|nous allons|dans cette section)/i;

function normalize(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function isJe(s){ return /\b(je|moi|mon|ma|mes)\b/i.test(s); }
function hasVerses(s){ return /\b(Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Rois|2\s*Rois|1\s*Chroniques|2\s*Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1\s*Corinthiens|2\s*Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1\s*Thessaloniciens|2\s*Thessaloniciens|1\s*Timothée|2\s*Timothée|Tite|Philémon|Hébreux|Jacques|1\s*Pierre|2\s*Pierre|1\s*Jean|2\s*Jean|3\s*Jean|Jude|Apocalypse)\s+\d{1,3}([:.]\d{1,3}([-–]\d{1,3})?)?\b/i.test(s); }

function validatePoint(n, text, {minChars, livre, chapitre}){
  if (!text || normalize(text).length < minChars) return false;
  if (BOILER_RX.test(text)) return false;
  if (n===1 || n===28) { // prières en "je"
    if (!isJe(text) || !new RegExp(`\\b${livre}\\b\\s+${chapitre}\\b`, 'i').test(text)) return false;
  }
  // encourager les références dans la plupart des points
  if (n!==1 && n!==4 && n!==28 && !hasVerses(text)) return false;
  return true;
}

function dedupeAcross(out){
  const seen = new Set();
  for(const key of Object.keys(out)){
    const norm = normalize(out[key]).toLowerCase();
    if (seen.has(norm)) {
      out[key] = '(*) Réécrire ce point pour éviter la redite avec un autre point. Développer un angle réellement distinct.';
    }
    seen.add(norm);
  }
  return out;
}

// ---- OpenAI low-level ----
async function openAIChatJSON({messages, schema, seed}) {
  const headers = {
    'Content-Type':'application/json',
    'Authorization':`Bearer ${OPENAI_API_KEY}`
  };
  if (OPENAI_PROJECT) headers['OpenAI-Project'] = OPENAI_PROJECT;

  // On tente le json_schema strict (minLength), sinon on retombe sur json_object.
  const body = {
    model: MODEL,
    temperature: 0,
    top_p: 0,
    max_tokens: 4000, // par lot
    seed: typeof seed === 'number' ? seed : 42,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'etude_points',
        schema,
        strict: true
      }
    },
    messages
  };

  let resp = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST', headers, body:JSON.stringify(body)});
  let txt = await resp.text();
  let json;
  try { json = JSON.parse(txt); } catch { throw new Error(`OpenAI non-JSON: ${txt.slice(0,200)}…`); }
  if (!resp.ok) throw new Error(json?.error?.message || `HTTP ${resp.status}`);

  let content = json?.choices?.[0]?.message?.content || '{}';
  try { return JSON.parse(content); }
  catch {
    // fallback json_object
    const fallbackBody = {
      model: MODEL,
      temperature: 0,
      top_p: 0,
      max_tokens: 4000,
      seed: typeof seed === 'number' ? seed : 42,
      response_format: { type: 'json_object' },
      messages
    };
    resp = await fetch('https://api.openai.com/v1/chat/completions',{method:'POST', headers, body:JSON.stringify(fallbackBody)});
    txt = await resp.text();
    try {
      const j2 = JSON.parse(txt);
      const c2 = j2?.choices?.[0]?.message?.content || '{}';
      return JSON.parse(c2);
    } catch {
      throw new Error('Échec format JSON.');
    }
  }
}

// ---- Prompting ----
function systemMsg(){
  return {
    role:'system',
    content:
      "Tu es un assistant d’étude biblique rigoureux, pastoral et fidèle à la doctrine chrétienne historique. " +
      "Tu écris en français riche, précis, structuré, SANS PHRASÉ BOILERPLATE, et tu respectes strictement les consignes."
  };
}

function userMsgBatch({livre, chapitre, version, indices, minChars}){
  const plan = TITLES_28.map((t,i)=>`${i+1}. ${t}`).join('\n');
  const specList = indices.map(n=>`- ${n}. ${POINT_SPEC[n]}`).join('\n');

  const keys = indices.map(String);
  const keyStr = keys.map(k=>`"${k}"`).join(', ');

  const content =
`Étude sur **${livre} ${chapitre}** (version ${version || 'LSG'}).

Canevas complet (28 points) :
${plan}

Dans CETTE réponse, ne produis que les sections : [${keyStr}]
Règles OBLIGATOIRES pour CHAQUE section demandée :
- longueur : AU MINIMUM ${minChars} caractères utiles (pas de remplissage vide)
- contenu strictement adapté à ${livre} ${chapitre}
- utiliser Markdown : **gras**, listes, tableaux |a|b|, frises "YYYY — ..." et images ![alt](https://...) si pertinent
- citer plusieurs références bibliques explicites (ex: Genèse 1:1–3), SANS faire de lien ; elles seront linkifiées côté client
- proscrire les formules “Voici X points…”, “nous allons…”, etc.
- 1 (prière d’ouverture) et 28 (prière de fin) : obligatoirement à la première personne (JE), contextualisées à ${livre} ${chapitre}

Exigences spécifiques :
${specList}

SORTIE JSON STRICTE uniquement, sous la forme :
{ ${keyStr} }
Chaque valeur est un long texte Markdown, sans autre champ.
`;

  return { role:'user', content };
}

function revisionMsg({livre, chapitre, n, minChars, cause, previous}){
  return {
    role:'user',
    content:
`Réécris UNIQUEMENT la section **${n}** pour ${livre} ${chapitre} en respectant les contraintes. Raison : ${cause}.
Exigences minimales : ${minChars} caractères, Markdown riche, références bibliques explicites, pas de boilerplate, et respecte : ${POINT_SPEC[n]}.
Ancienne tentative (à corriger, ne la répète pas telle quelle) :
"""${previous}"""
Réponds en JSON : { "${n}": "NOUVELLE VERSION" }`
  };
}

// ---- Handler principal ----
export default async function handler(req, res){
  try{
    if (req.method !== 'POST') return badRequest(res, 'POST attendu');

    if (!OPENAI_API_KEY) return json(res, { error:'OPENAI_API_KEY manquant' }, 500);

    let body={};
    try{ body = typeof req.body==='object' ? req.body : JSON.parse(req.body||'{}'); }catch{ return badRequest(res,'JSON invalide'); }

    const livre = String(body.livre || '').trim();
    const chapitre = parseInt(body.chapitre,10);
    const version = String(body.version || 'LSG').trim();
    const minChars = Math.max(1200, parseInt(body.min_chars_per_point,10) || 2500);
    const batchSize = Math.min(4, Math.max(1, parseInt(body.batch_size,10) || 2)); // 2 par défaut pour la densité
    const seed = (typeof body.seed === 'number') ? body.seed : 42;

    if (!livre || !Number.isFinite(chapitre)) return badRequest(res,'Paramètres requis : livre (string), chapitre (number)');

    const subset = (Array.isArray(body.subset) && body.subset.length)
      ? body.subset.map(x=>parseInt(x,10)).filter(n=>n>=1 && n<=28)
      : Array.from({length:28},(_,i)=>i+1);

    const groups = chunk(subset, batchSize);
    const out = {};
    const sys = systemMsg();

    // Construit un schema JSON strict pour CHAQUE lot
    function makeSchema(keys){
      const props = {};
      for(const k of keys){
        props[String(k)] = { type:'string', minLength: minChars };
      }
      return {
        type: 'object',
        additionalProperties: false,
        required: keys.map(k=>String(k)),
        properties: props
      };
    }

    for (const grp of groups){
      // 1) première passe
      const schema = makeSchema(grp);
      const user = userMsgBatch({livre, chapitre, version, indices: grp, minChars});
      let obj = await openAIChatJSON({messages:[sys, user], schema, seed});

      // 2) validation + retentes ciblées
      for (const n of grp){
        const key = String(n);
        let text = obj[key] || '';
        // nettoyage boilerplate simple
        if (BOILER_RX.test(text)) text = text.replace(BOILER_RX, '').trim();
        let ok = validatePoint(n, text, {minChars, livre, chapitre});
        let tries = 0;

        while(!ok && tries < 2){
          tries++;
          const cause = !text ? 'contenu vide'
                      : (normalize(text).length < minChars ? `longueur < ${minChars}` 
                      : (BOILER_RX.test(text) ? 'boilerplate détecté'
                      : ((n===1||n===28) && !isJe(text) ? 'la prière doit être en JE'
                      : (!hasVerses(text) ? 'références bibliques insuffisantes' : 'incohérence'))));
          const rev = revisionMsg({livre, chapitre, n, minChars, cause, previous:text});
          const schemaOne = { type:'object', additionalProperties:false, required:[key], properties:{ [key]:{type:'string', minLength:minChars} } };
          const fix = await openAIChatJSON({messages:[sys, rev], schema: schemaOne, seed});
          text = fix[key] || text;
          if (BOILER_RX.test(text)) text = text.replace(BOILER_RX, '').trim();
          ok = validatePoint(n, text, {minChars, livre, chapitre});
        }
        out[key] = text;
      }
    }

    dedupeAcross(out);

    return json(res, {
      meta: { livre, chapitre, version, model: MODEL, minChars, batchSize, seed },
      ...out
    });

  }catch(err){
    console.error('[api/chat] ERR', err);
    return json(res, { error: String(err?.message || err) }, 500);
  }
}

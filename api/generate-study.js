// /api/generate-study.js
// Fonction robuste : marche en Serverless Node (req,res) OU en Edge (Request).
// Valide l'entrée, normalise { passage, options:{ length } }, et renvoie toujours un JSON clair.
// En GET : renvoie un hint. En POST : construit 28 sections (exemple) ou passe à ton générateur réel.

// --- utilitaires d’envoi (compat Node & Edge)
function sendJSON(ctx, status, data) {
  if (ctx.res) { ctx.res.status(status).json(data); return; }
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
function sendError(ctx, status, message, info={}) {
  return sendJSON(ctx, status, { ok:false, error:message, ...info });
}

// --- lecture du body selon l’environnement
async function readBody(ctx) {
  // Edge (Request)
  if (ctx.req && typeof ctx.req.json === 'function') {
    return await ctx.req.json();
  }
  // Node (req,res) — Vercel parse parfois automatiquement, sinon on lit le flux
  const req = ctx.req;
  if (req && typeof req.body === 'object' && req.body) return req.body;

  // lecture brute + parse
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const raw = Buffer.concat(chunks).toString('utf8') || '';
  if (!raw.trim()) return {};
  try { return JSON.parse(raw); }
  catch { return {}; }
}

// --- génération "exemple" (à remplacer par ton vrai moteur si besoin)
function buildStudy(passage, length) {
  // sécurise length sur 500|1500|2500
  const allowed = [500,1500,2500];
  const len = allowed.includes(Number(length)) ? Number(length) : 1500;

  const titles = {
    1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",
    5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",
    9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",
    13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",
    17:"Appui doctrinal",18:"Comparaison entre versets",19:"Parallèle avec Actes 2",20:"Verset à mémoriser",
    21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",
    24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",
    27:"Versets à retenir",28:"Prière de fin"
  };
  const descs = {
    1:"Invocation du Saint-Esprit pour éclairer l’étude.",2:"Place dans le canon et continuité biblique.",
    3:"Points à reprendre et tensions ouvertes.",4:"Formulation doctrinale synthétique.",
    5:"Cadre temporel et culturel.",6:"Découpage et progression.",7:"Incidences herméneutiques.",
    8:"Auteur humain et inspiration divine.",9:"Pivot théologique du chapitre.",10:"Grammaire/syntaxe/contexte.",
    11:"Termes clés et portée doctrinale.",12:"Passages parallèles.",13:"Attributs de Dieu, création, alliance…",
    14:"Rattachement aux thèmes systématiques.",15:"Vertus et attitudes produites.",
    16:"Typologie et symboles.",17:"Textes d’appui concordants.",18:"Harmonisation interne.",
    19:"Continuité dans l’Église.",20:"Brève formulation à retenir.",21:"Gouvernance, culte, mission.",
    22:"Transmission et consolation.",23:"Pédagogie et récits.",24:"Annonce et contextualisation.",
    25:"Conseil, avertissement, consolation.",26:"Repentance, foi, obéissance, prière.",
    27:"Sélection utile à mémoriser.",28:"Action de grâces et bénédiction."
  };

  const sections = [];
  for (let i=1;i<=28;i++) {
    const base = `### ${titles[i]}\n\n*Référence :* ${passage}\n\n`;
    // texte factice qui varie selon length (pour que tu VOIES la différence 500/1500/2500)
    const unit = "Explication doctrinale narrative, fidèle au texte, orientée exégèse et théologie biblique. ";
    const repeat = len===500 ? 4 : len===1500 ? 12 : 20; // ~densité
    const content = base + (unit.repeat(repeat)).trim();
    sections.push({
      id: i,
      title: titles[i],
      description: descs[i],
      content
    });
  }
  return { study:{ sections }, requestedLength: len };
}

// --- cœur de route (compat Node & Edge)
async function core(ctx) {
  const method = ctx.req?.method || 'GET';

  if (method === 'GET') {
    return sendJSON(ctx, 200, {
      ok: true,
      route: '/api/generate-study',
      method: 'GET',
      hint: 'POST { passage, options:{ length: 500|1500|2500 } }'
    });
  }

  if (method !== 'POST') {
    return sendError(ctx, 405, 'Méthode non autorisée', { allow: ['GET','POST'] });
  }

  // lecture & validation
  const body = await readBody(ctx);
  const passage = (body?.passage || '').toString().trim();
  const length = Number(body?.options?.length);

  if (!passage) {
    return sendError(ctx, 400, 'Champ "passage" manquant (ex: "Genèse 1").');
  }

  const allowed = [500,1500,2500];
  const len = allowed.includes(length) ? length : 1500;

  try {
    // ⤵️ ICI tu peux brancher TON générateur réel (OpenAI / api.bible / etc.)
    // const study = await generateWithYourModel(passage, len)
    const result = buildStudy(passage, len);
    return sendJSON(ctx, 200, { ok:true, ...result });
  } catch (e) {
    // on remonte une erreur propre (pas de 500 opaque côté front)
    return sendError(ctx, 200, 'GENERATION_FAILED', { message: String(e&&e.message||e) });
  }
}

// --- exports (Edge ou Node)
export default async function handler(req, res) {
  // si Vercel Node -> (req,res) ; si Edge -> req est un Request (pas res)
  if (res && typeof res.status === 'function') {
    return core({ req, res });
  }
  // Edge / Web API
  return await core({ req });
}

// /api/chat.js
// Vercel Serverless Function – génère une étude biblique complète en 28 points, par lots
// Variables d'env à définir sur Vercel : OPENAI_API_KEY (obligatoire), OPENAI_PROJECT (optionnel)

export const config = {
  runtime: 'nodejs', // compatible Node on Vercel
};

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'; // tu peux mettre 'gpt-4.1' si dispo
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || '';

if (!OPENAI_API_KEY) {
  console.warn('[api/chat] OPENAI_API_KEY manquant (définis-le dans Vercel).');
}

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

// ——— util ———
function badRequest(res, message) {
  res.statusCode = 400;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message || 'Bad request' }));
}
function json(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}
function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ——— prompt builder ———
function buildSystemMessage() {
  return {
    role: 'system',
    content:
      "Tu es un assistant d’étude biblique rigoureux, pastoral et fidèle à la doctrine chrétienne historique. " +
      "Tu écris en français clair, structuré, riche et précis, pour un lecteur francophone. " +
      "Tu ne fais aucun plagiat et tu produis un texte original et utile."
  };
}

function buildUserMessage({ livre, chapitre, version, indices, minChars }) {
  const list = TITLES_28.map((t, i) => `${i + 1}. ${t}`).join('\n');

  const keys = indices.map(String).join('","');
  const schemaKeys = indices.map(n => `"${n}"`).join(', ');

  // On redonne TOUT le plan, mais on restreint la production au sous-ensemble demandé.
  // On exige JSON strict avec ces clés numériques sous forme de chaînes "1".."28".
  // Prières en "je", références bibliques explicites (seront linkifiées côté front).
  const content = `
Génère une étude biblique détaillée sur **${livre} ${chapitre}** (version ${version || 'LSG'}) en suivant STRICTEMENT le canevas ci-dessous.

Canevas complet (28 points) :
${list}

⚠️ Dans CETTE réponse, NE PRODUIS QUE les sections dont les indices sont : ["${keys}"].
Chaque section doit :
- Respecter le titre correspondant du canevas.
- Faire **au minimum ${minChars} caractères** (vise plus si pertinent).
- Être spécifique à **${livre} ${chapitre}** (pas de généralités vagues).
- Utiliser du **Markdown** : **gras**, listes, tableaux (\`|a|b|\`), images (\`![alt](https://...)\`), frises \`YYYY — ...\` si utile.
- Citer **plusieurs versets** sous forme “Livre X:Y–Z” (ils seront cliquables côté client).
- Ne pas dupliquer le même paragraphe d’un point à l’autre (éviter les redites).
- Pour **1. Prière d’ouverture** et **28. Prière de fin** : écrire à la **première personne** (“je”), contextualisées à ${livre} ${chapitre}.
- Interdiction des phrases génériques du type “Voici X points…” ou “cette étude présente…”.
- Aucune introduction/conclusion globale en dehors des sections demandées.

**SORTIE REQUISE** : un **JSON strict** (pas de texte hors JSON), objet dont les seules clés sont les indices demandés (en chaînes) :
{ ${schemaKeys} }
ex. { "3": "…", "4": "…" }

Rappels importants :
- Si tu ajoutes des tableaux, garde un contenu doctrinal solide et exact.
- Si tu ajoutes des images (Markdown), elles doivent être pertinentes (cartes, schémas typologiques, etc.).
- Sers-toi d’un ton pastoral et précis, sans polémique gratuite.

Travaille maintenant uniquement sur : ["${keys}"].
`;

  return { role: 'user', content };
}

async function callOpenAIJson(messages) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${OPENAI_API_KEY}`
  };
  if (OPENAI_PROJECT) headers['OpenAI-Project'] = OPENAI_PROJECT;

  const body = {
    model: MODEL,
    temperature: 0.7,
    response_format: { type: 'json_object' },
    messages
  };

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });

  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Réponse OpenAI non JSON: ${text.slice(0, 300)}…`);
  }

  if (!resp.ok) {
    const msg = data?.error?.message || `HTTP ${resp.status}`;
    throw new Error(`OpenAI: ${msg}`);
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Le contenu OpenAI ne respecte pas le JSON strict.');
  }
}

// ——— handler ———
export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return badRequest(res, 'POST attendu.');

    if (!OPENAI_API_KEY) {
      return json(res, { error: 'OPENAI_API_KEY manquant côté serveur.' }, 500);
    }

    let body = {};
    try {
      body = req.body && typeof req.body === 'object' ? req.body : JSON.parse(req.body || '{}');
    } catch {
      return badRequest(res, 'JSON invalide.');
    }

    const livre = String(body.livre || '').trim();
    const chapitre = parseInt(body.chapitre, 10);
    const version = String(body.version || 'LSG').trim();
    const minChars = Math.max(1200, parseInt(body.min_chars_per_point, 10) || 2500); // garde un minimum réaliste
    const batchSize = Math.min(6, Math.max(2, parseInt(body.batch_size, 10) || 4)); // 4 par défaut
    let subset = Array.isArray(body.subset) ? body.subset.map(x => parseInt(x, 10)).filter(Boolean) : null;

    if (!livre || !Number.isFinite(chapitre)) {
      return badRequest(res, 'Paramètres requis : livre (string), chapitre (number).');
    }

    // Liste des indices à produire
    const all = Array.from({ length: 28 }, (_, i) => i + 1);
    const indices = subset && subset.length ? subset : all;

    // Orchestration par lots
    const sys = buildSystemMessage();
    const out = {};
    const groups = chunkArray(indices, batchSize);

    for (const grp of groups) {
      const user = buildUserMessage({ livre, chapitre, version, indices: grp, minChars });
      const obj = await callOpenAIJson([sys, user]);

      // On fusionne uniquement les clés attendues
      for (const n of grp) {
        const key = String(n);
        if (typeof obj[key] === 'string' && obj[key].trim()) {
          out[key] = obj[key].trim();
        } else {
          // Fallback minimal si le modèle n’a pas fourni la clé (ça arrive rarement)
          out[key] = `(*) Contenu insuffisant retourné par le modèle pour le point ${n}. Merci de relancer la génération de ce point.`;
        }
      }
    }

    // Sécurités/filtres simples (antiboilerplate, prière en je)
    const BOILER_RX = /(voici\s+\d+\s+points|cette étude présente|nous allons|dans cette section)/i;
    for (const n of Object.keys(out)) {
      let t = out[n] || '';
      if (BOILER_RX.test(t)) {
        t = t.replace(BOILER_RX, '').trim();
      }
      // S'assure que 1 et 28 restent bien en "je"
      if (n === '1' && !/(\bje\b|\bmoi\b)/i.test(t)) {
        t = `Père céleste, alors que je lis ${livre} ${chapitre}, dispose mon cœur à ta Parole. ${t}`;
      }
      if (n === '28' && !/(\bje\b|\bmoi\b)/i.test(t)) {
        t = `Seigneur, je te rends grâce pour ${livre} ${chapitre}. ${t}`;
      }
      out[n] = t;
    }

    // Retour objet complet + méta
    return json(res, {
      meta: { livre, chapitre, version, minChars, batchSize, model: MODEL },
      ...out
    });
  } catch (err) {
    console.error('[api/chat] error:', err);
    return json(res, { error: String(err?.message || err) }, 500);
  }
}

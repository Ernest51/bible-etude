// /api/chat.js — Vercel Serverless Function (Node runtime)
// - Renvoie des clés "1".."28" (compatibles avec src/app.js).
// - Marche même sans OPENAI_API_KEY (fallback local).
// - GET ?ping=1 -> { pong: true } pour test rapide.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Intitulés (utiles pour le fallback ou la consigne)
const POINTS = [
  "Prière d’ouverture — Invocation du Saint-Esprit pour éclairer mon étude.",
  "Canon et testament — Identifier le livre dans le canon.",
  "Questions du chapitre précédent — Minimum 5 questions et réponses intégrales.",
  "Titre du chapitre — Résumé doctrinal.",
  "Contexte historique — Carte, frise.",
  "Structure littéraire.",
  "Genre littéraire.",
  "Auteur et généalogie.",
  "Verset-clé doctrinal.",
  "Analyse exégétique.",
  "Analyse lexicale.",
  "Références croisées.",
  "Fondements théologiques.",
  "Thème doctrinal.",
  "Fruits spirituels.",
  "Types bibliques.",
  "Appui doctrinal.",
  "Comparaison entre versets.",
  "Comparaison avec Actes 2.",
  "Verset à mémoriser.",
  "Enseignement pour l’Église.",
  "Enseignement pour la famille.",
  "Enseignement pour enfants.",
  "Application missionnaire.",
  "Application pastorale.",
  "Application personnelle.",
  "Versets à retenir.",
  "Prière de fin."
];

// Log de santé (une seule fois)
if (typeof global !== "undefined" && !global._chat_health) {
  global._chat_health = true;
  console.log("[api/chat] endpoint chargé (runtime=nodejs, model=%s)", MODEL);
}

// —————————————— Utils ——————————————
function safeParseBody(req) {
  if (typeof req.body === "object") return req.body || {};
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return null;
  }
}

function buildLocalPayload(livre, chapitre, n = 28) {
  const out = {};
  for (let i = 1; i <= n; i++) {
    const titre = POINTS[i - 1] || `Point ${i}`;
    out[String(i)] =
      `**${i}. ${titre}**\n\n` +
      `*${livre} ${chapitre}* — Contenu de base. ` +
      `Personnalise ce bloc selon ta trame (exégèse, références, applications).`;
  }
  return out;
}

async function callOpenAI({ livre, chapitre, n }) {
  const prompt = `
Tu es un assistant d’étude biblique rigoureux, pastoral et doctrinal.
Génère ${n} sections numérotées (1..${n}) en **Markdown** pour ${livre} ${chapitre},
selon ces intitulés (une section par point) :
${POINTS.map((p, idx) => `${idx + 1}. ${p}`).join("\n")}

CONTRAINTES :
- Réponds STRICTEMENT en JSON valide (response_format = json_object).
- Les clés doivent être exactement "1", "2", ..., "${n}".
- Les valeurs sont du Markdown structuré (paragraphes, listes si utile).
- Aucune phrase en dehors du JSON.
  `.trim();

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Langue: français. Réponds uniquement en JSON valide." },
        { role: "user", content: prompt }
      ],
    }),
  });

  const text = await r.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error("Réponse OpenAI non JSON: " + text.slice(0, 180));
  }

  if (!r.ok) {
    const msg = json?.error?.message || text;
    throw new Error(`OpenAI ${r.status}: ${msg}`);
  }

  const content = json?.choices?.[0]?.message?.content || "{}";
  let data;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("Le contenu OpenAI n'est pas un JSON valide.");
  }

  // Normalisation "1".."n" + fallback minimal si une clé manque
  const out = {};
  for (let i = 1; i <= n; i++) {
    const key = String(i);
    out[key] = data[key] || data[i] || data["p" + i] || `**${i}. (vide)**`;
  }
  return out;
}

// —————————————— Handler ——————————————
export default async function handler(req, res) {
  try {
    // Test rapide
    if (req.method === "GET" && req.query.ping !== undefined) {
      return res.status(200).json({ pong: true, model: MODEL });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode non autorisée. Utilise POST." });
    }

    const body = safeParseBody(req);
    if (!body) return res.status(400).json({ error: "JSON invalide" });

    const { livre, chapitre, points, version = "LSG" } = body;
    if (!livre || !chapitre) {
      return res.status(400).json({ error: "Paramètres requis : livre, chapitre" });
    }

    // Nombre de points (défaut 28)
    const n = Number(points) > 0 ? Math.min(Number(points), 28) : 28;

    // Si pas de clé → fallback local (l'app fonctionne quand même)
    let payload;
    if (!OPENAI_API_KEY) {
      payload = buildLocalPayload(livre, chapitre, n);
    } else {
      try {
        payload = await callOpenAI({ livre, chapitre, n });
      } catch (e) {
        console.error("[api/chat] OpenAI erreur → fallback local :", e);
        payload = buildLocalPayload(livre, chapitre, n);
      }
    }

    // Réponse finale : UNIQUEMENT les clés "1".."n" (pas de meta parasite)
    return res.status(200).json(payload);
  } catch (e) {
    console.error("[api/chat] erreur", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

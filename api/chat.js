// /api/chat.js
export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

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

function safeParseBody(req) {
  if (typeof req.body === "object") return req.body || {};
  try { return JSON.parse(req.body || "{}"); } catch { return null; }
}

function buildLocalPayload(livre, chapitre, n = 28) {
  const out = {};
  for (let i = 1; i <= n; i++) {
    const titre = POINTS[i - 1] || `Point ${i}`;
    out[String(i)] = `**${i}. ${titre}**\n\n*${livre} ${chapitre}* — Contenu de base. Personnalise ce bloc selon ta trame.`;
  }
  return out;
}

async function callOpenAI({ livre, chapitre, n }) {
  const prompt = `
Tu es un assistant d’étude biblique rigoureux, pastoral et doctrinal.
Génère ${n} sections numérotées (1..${n}) en Markdown pour ${livre} ${chapitre},
une par intitulé :
${POINTS.map((p, i) => `${i + 1}. ${p}`).join("\n")}
CONTRAINTES :
- Réponds STRICTEMENT en JSON valide (json_object).
- Les clés doivent être "1","2",...,"${n}".
- Les valeurs sont du Markdown; pas d'autre texte hors JSON.
`.trim();

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.5,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Langue: français. Tu renvoies UNIQUEMENT du JSON valide." },
        { role: "user", content: prompt }
      ]
    })
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error("Réponse OpenAI non JSON: " + text.slice(0, 160)); }
  if (!r.ok) throw new Error(json?.error?.message || text);

  const content = json?.choices?.[0]?.message?.content || "{}";
  let data;
  try { data = JSON.parse(content); } catch { throw new Error("Contenu OpenAI non JSON."); }

  const out = {};
  for (let i = 1; i <= n; i++) out[String(i)] = data[String(i)] || `**${i}. (vide)**`;
  return out;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET" && req.query.ping !== undefined) {
      return res.status(200).json({ pong: true, model: MODEL });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée. Utilise POST." });

    const body = safeParseBody(req);
    if (!body) return res.status(400).json({ error: "JSON invalide" });

    const { livre, chapitre, points } = body;
    if (!livre || !chapitre) return res.status(400).json({ error: "Paramètres requis : livre, chapitre" });

    const n = Number(points) > 0 ? Math.min(Number(points), 28) : 28;

    let payload;
    if (!OPENAI_API_KEY) {
      payload = buildLocalPayload(livre, chapitre, n);
    } else {
      try { payload = await callOpenAI({ livre, chapitre, n }); }
      catch (e) { console.error("[api/chat] OpenAI erreur → fallback local:", e); payload = buildLocalPayload(livre, chapitre, n); }
    }

    return res.status(200).json(payload);
  } catch (e) {
    console.error("[api/chat] erreur", e);
    return res.status(500).json({ error: String(e?.message || e) });
  }
}

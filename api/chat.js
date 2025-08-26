// api/chat.js
// Génération des 28 rubriques (libellés exacts) via OpenAI Responses API
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Libellés EXACTS (comme ton étude)
const RUBRIQUES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
  "Application missionnaire","Application pastorale","Application personnelle",
  "Versets à retenir","Prière de fin"
];

function bad(res, code, msg) { return res.status(code).json({ ok:false, error: msg }); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return bad(res, 405, 'Method Not Allowed');
  if (!OPENAI_API_KEY) return bad(res, 500, 'OPENAI_API_KEY manquante');

  // Lire le corps
  let raw = '';
  for await (const chunk of req) raw += chunk;
  let body = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { return bad(res, 400, 'Invalid JSON'); }

  const { book, chapter, verse, version, reference, titre } = body || {};
  if (!book || !chapter) return bad(res, 400, 'Paramètres requis: {book, chapter}');

  // Contexte de génération
  const refText = `${book} ${chapter}${verse ? ':'+verse : ''}`;
  const versionText = version || 'PDV';

  // Prompt: on exige un JSON strict pour faciliter l’intégration
  const userPrompt = [
    `Tu es un assistant exégétique et doctrinal francophone.`,
    `Génère une étude biblique en 28 rubriques EXACTEMENT avec ces libellés:`,
    RUBRIQUES.map((t,i)=>`${i+1}. ${t}`).join(' | '),
    `Passage cible: ${refText} (${versionText}).`,
    `Contraintes:`,
    `- Langue: français.`,
    `- Style: pédagogique, fidèle au texte biblique, sans spéculation.` ,
    `- Citer *uniquement* des références bibliques (Livre Chapitre:Verset) quand nécessaire.`,
    `- Sortie STRICTEMENT en JSON (AUCUN texte hors JSON).`,
    `Format attendu: {"sections":[{"title":"<libellé exact>","content":"<contenu>"}, ... 28 items ...]}`,
    `- "title" DOIT correspondre à la liste exacte ci-dessus (même orthographe).`,
    `- "content": 5–12 phrases concises par rubrique (sauf prières: quelques lignes).`,
    `- Adapter le contenu au passage ${refText}.`,
    titre ? `- Titre de l’étude à refléter dans "Titre du chapitre": ${titre}.` : ``
  ].join('\n');

  // Appel OpenAI Responses API (modèle léger et économique ; ajuste si besoin)
  // Réf. API officielle: "Responses" (requête HTTP POST /v1/responses). 
  let openaiResp;
  try {
    const r = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',   // tu peux tester 'gpt-4o-mini' selon ton abonnement
        input: userPrompt,
        temperature: 0.3,
        max_output_tokens: 2200,
        // On demande explicitement du JSON; si ton compte supporte response_format, tu peux décommenter:
        // response_format: { type: "json_object" }
      })
    });
    openaiResp = await r.json();
  } catch (e) {
    return bad(res, 502, 'Erreur réseau OpenAI: '+ String(e));
  }

  // Extraire le texte de sortie (Responses => output_text)
  let text = '';
  try {
    // Selon Responses API, "output_text" regroupe le texte. Fallback si structure différente.
    text = openaiResp.output_text ?? (
      Array.isArray(openaiResp.output) ? openaiResp.output.map(x => x.content?.[0]?.text ?? '').join('\n') : ''
    );
  } catch {}

  if (!text) {
    return bad(res, 502, 'Réponse vide du modèle');
  }

  // Parser le JSON retourné par le modèle
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    // Tentative de récupération: extraire bloc JSON si le modèle a bavardé (rare avec ce prompt)
    const m = text.match(/\{[\s\S]*\}$/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch {}
    }
  }
  if (!parsed || !Array.isArray(parsed.sections)) {
    return bad(res, 502, 'Format inattendu du modèle (sections manquantes)');
  }

  // Sécurité: remapper proprement aux libellés exacts et garantir 28 items
  const byTitle = new Map(parsed.sections.map(s => [String(s.title || '').trim(), String(s.content || '').trim()]));
  const sections = RUBRIQUES.map(title => ({
    title,
    content: byTitle.get(title) || ''
  }));

  return res.status(200).json({
    ok: true,
    reference: refText,
    version: versionText,
    sections
  });
}

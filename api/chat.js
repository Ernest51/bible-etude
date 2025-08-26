// api/chat.js
import OpenAI from "openai";
import { z } from "zod";

/**
 * === Schéma d'entrée attendu ===
 * {
 *   "input": "Marc 5:1-20",   // ou "Marc 5:1" etc.
 *   "templateId": "v28-standard" // optionnel, défaut "v28-standard"
 * }
 *
 * Réponse:
 * { ok: true, data: { reference, templateId, sections: [...] } }
 * ou { ok: false, error: "...", details?: ... }
 */

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const BodySchema = z.object({
  input: z.string().min(1, "input requis (ex: 'Marc 5:1-20')"),
  templateId: z.string().optional().default("v28-standard")
});

// Parser très tolérant pour "Livre Chapitre:Verses"
function parseReference(raw) {
  const str = (raw || "").trim();
  // Exemple capturé : "Marc 5:1-20" / "Marc 5" / "Marc 5:1"
  const m = str.match(/^([\p{L}\p{M}\s\.\-’']+)\s+(\d+)(?::([\d\-–,; ]+))?$/u);
  if (!m) {
    return { book: str, chapter: null, verses: null, raw };
  }
  const [, book, chapter, verses] = m;
  return {
    book: book.trim(),
    chapter: Number(chapter),
    verses: verses ? verses.replace(/\s+/g, "") : null,
    raw: str
  };
}

// Prompt système : génération en 28 points, stricte, en FR.
// On force un JSON strict pour l’affichage fiable côté front.
function buildMessages({ book, chapter, verses, raw, templateId }) {
  const system = `
Tu es un assistant de théologie qui génère des études bibliques **structurées en 28 points** selon un canevas fixe.
Contraintes IMPÉRATIVES :
- Langue : français.
- Aucune digression : colle strictement au passage demandé.
- Pas d’aléatoire : chaque point doit découler du passage, de son contexte et des références croisées.
- Style : pédagogique, clair, numéroté de 1 à 28.
- Sortie **UNIQUEMENT en JSON valide** correspondant au schéma suivant :

{
  "reference": "Livre Chapitre:Verses",
  "templateId": "v28-standard",
  "sections": [
    {
      "id": 1,
      "title": "Titre du point 1",
      "content": "Contenu concis et précis du point 1, fidèle au texte biblique",
      "verses": ["Marc 5:1-5"] // versets principalement mobilisés pour ce point
    },
    ...
    {
      "id": 28,
      "title": "Titre du point 28",
      "content": "Conclusion et application",
      "verses": ["..."]
    }
  ]
}

Rappels de forme :
- 28 sections **exactement**.
- "title" ≤ 90 caractères. "content" ≤ 700 caractères par point.
- Citer des versets précis en "verses" (tableau de chaînes), pas de texte biblique intégral.
- Pas de commentaire en dehors du JSON.
`.trim();

  const user = `
Génère l'étude en 28 points pour : ${raw}
Détails structurés:
- Livre: ${book || "Inconnu"}
- Chapitre: ${chapter ?? "Inconnu"}
- Versets: ${verses ?? "Non spécifié"}
- Modèle: ${templateId}
`.trim();

  return [
    { role: "system", content: system },
    { role: "user", content: user }
  ];
}

// Réponse utilitaire
function json(res, code, payload) {
  res.status(code).setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  try {
    // CORS minimal si besoin (facultatif si même domaine)
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }

    if (req.method !== "POST") {
      return json(res, 405, { ok: false, error: "Méthode non autorisée" });
    }

    if (!process.env.OPENAI_API_KEY) {
      return json(res, 500, { ok: false, error: "OPENAI_API_KEY manquant (variable d'environnement)" });
    }

    let body;
    try {
      body = BodySchema.parse(await readJson(req));
    } catch (e) {
      return json(res, 400, { ok: false, error: "Entrée invalide", details: e?.errors ?? String(e) });
    }

    const ref = parseReference(body.input);
    const messages = buildMessages({ ...ref, templateId: body.templateId });

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,             // moins de variance
      max_tokens: 4000,
      messages
    });

    const text = completion.choices?.[0]?.message?.content?.trim();
    if (!text) {
      return json(res, 502, { ok: false, error: "Réponse vide du modèle" });
    }

    // Tenter de parser le JSON strict (on refuse tout préfixe/suffixe)
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // Si le modèle a ajouté du texte autour, on essaie d'extraire le 1er bloc JSON
      const match = text.match(/\{[\s\S]*\}$/);
      if (match) {
        try {
          data = JSON.parse(match[0]);
        } catch (e2) {
          return json(res, 502, { ok: false, error: "JSON de sortie invalide", details: e2?.message, raw: text });
        }
      } else {
        return json(res, 502, { ok: false, error: "Sortie non JSON", raw: text });
      }
    }

    // Validation minimale du contenu
    if (!data?.sections || !Array.isArray(data.sections) || data.sections.length !== 28) {
      return json(res, 502, { ok: false, error: "Le résultat ne contient pas 28 sections exactes", raw: data });
    }

    // OK
    return json(res, 200, {
      ok: true,
      data: {
        reference: data.reference ?? ref.raw,
        templateId: body.templateId,
        sections: data.sections
      }
    });
  } catch (err) {
    return json(res, 500, { ok: false, error: "Erreur serveur", details: err?.message ?? String(err) });
  }
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  return JSON.parse(raw);
}

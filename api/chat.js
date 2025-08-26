// api/chat.js
import OpenAI from "openai";
import { z } from "zod";

/**
 * Entrées désormais acceptées (au choix) :
 *  A) { "input": "Marc 5:1-20" }
 *  B) { "reference": "Marc 5:1-20" }
 *  C) { "book":"Marc","chapter":5,"verses":"1-20" }
 *  D) body = "Marc 5:1-20" (text/plain)  ← toléré
 *  + optionnel: "templateId"
 */

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const FlexibleSchema = z.union([
  z.object({
    input: z.string().min(1),
    templateId: z.string().optional().default("v28-standard")
  }),
  z.object({
    reference: z.string().min(1),
    templateId: z.string().optional().default("v28-standard")
  }),
  z.object({
    book: z.string().min(1),
    chapter: z.number().int().positive(),
    verses: z.string().optional().nullable(),
    templateId: z.string().optional().default("v28-standard")
  })
]);

// Lecture du body (JSON, ou texte brut toléré)
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");

  // Si vide → objet vide (provoquera une 400 claire)
  if (!raw) return {};

  // D’abord essayer JSON
  try {
    return JSON.parse(raw);
  } catch {
    // Si pas JSON, on traite comme text/plain avec { input: raw }
    return { input: raw.trim() };
  }
}

// Parse "Livre Chapitre:Verses"
function parseReferenceString(raw) {
  const s = (raw || "").trim();
  // Gère accents, apostrophes typographiques
  const m = s.match(/^([\p{L}\p{M}\s\.\-’']+)\s+(\d+)(?::([\d\-–,; ]+))?$

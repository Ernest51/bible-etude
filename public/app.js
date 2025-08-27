// /api/chat.js
// Node 20 compatible
import crypto from "node:crypto";

// OPTIONAL: Vercel KV (Upstash). Sinon, commente ces lignes.
const KV_ENABLED = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
let kv = null;
if (KV_ENABLED) {
  const { Redis } = await import("@upstash/redis");
  kv = new Redis({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });
}

// Mini util
const ok = (data, { etag } = {}) => new Response(JSON.stringify({ ok: true, data }), {
  status: 200,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
    ...(etag ? { ETag: etag } : {})
  }
});
const ko = (status, message) => new Response(JSON.stringify({ ok: false, error: message }), {
  status,
  headers: { "content-type": "application/json; charset=utf-8" }
});

export async function GET(req) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const templateId = url.searchParams.get("templateId") || "v28-standard";
  if (!q) return ko(400, "Missing q");

  return handleChat({ q, templateId, req });
}

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const q = body.q?.trim();
  const templateId = body.templateId || "v28-standard";
  if (!q) return ko(400, "Missing q");
  return handleChat({ q, templateId, req });
}

async function handleChat({ q, templateId, req }) {
  // 1) cache key
  const key = `study:${templateId}:${q}`;
  // 2) check ETag
  const ifNone = req.headers.get("if-none-match");

  // 3) KV cache (serve first)
  if (KV_ENABLED) {
    const cached = await kv.get(key);
    if (cached) {
      const etag = `"${crypto.createHash("sha1").update(cached).digest("hex")}"`;
      if (ifNone && ifNone === etag) return new Response(null, { status: 304 });
      return ok(JSON.parse(cached), { etag });
    }
  }

  // 4) Call OpenAI (ou ton provider). Ici, on force JSON strict.
  // Remplace par ta lib OpenAI; pseudo-code ci-dessous.
  const study = await generateStudyJSON(q); // renvoie {reference, templateId, sections:[{id,title,content,verses:[]} x28]}

  // 5) double sécurité: toujours 28 points
  if (!study?.sections || study.sections.length !== 28) {
    return ko(502, "Provider did not return 28 sections");
  }

  const blob = JSON.stringify(study);
  const etag = `"${crypto.createHash("sha1").update(blob).digest("hex")}"`;

  // KV save + TTL 7 jours
  if (KV_ENABLED) {
    await kv.set(key, blob, { ex: 60 * 60 * 24 * 7 });
  }

  return ok(study, { etag });
}

// ---------- PSEUDO implémentation OpenAI JSON STRICT ----------
async function generateStudyJSON(reference) {
  const system = `
Tu es un générateur d'étude biblique. Réponds UNIQUEMENT en JSON conforme au schéma suivant.
Les 28 rubriques sont FIXES et doivent être remplies.
Pas de texte hors JSON.
  `;
  // Ici, utilise l’API "Responses" d’OpenAI avec response_format: json_schema
  // ou "tools" / "function_call" pour imposer le format.
  // On renvoie un objet:
  // {
  //   reference: "Marc 5:1-20",
  //   templateId: "v28-standard",
  //   sections: [
  //     { id:1, title:"Prière d’ouverture", content:"...", verses:[] },
  //     ...
  //     { id:28, title:"Prière de fin", content:"...", verses:[] }
  //   ]
  // }

  // ----- BOUCHON DÉTERMINISTE (remplace quand tu branches OpenAI) -----
  const TITLES = [
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
    "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
    "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
    "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
    "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
    "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
    "Application missionnaire","Application pastorale","Application personnelle",
    "Versets à retenir","Prière de fin"
  ];
  const sections = TITLES.map((t, i) => ({
    id: i + 1,
    title: t,
    content: i === 0
      ? `Père céleste, nous lisons ${reference}. Ouvre nos cœurs par ton Saint-Esprit. Amen.`
      : i === 27
      ? `Seigneur, merci pour ${reference}. Donne-nous de la mettre en pratique. Amen.`
      : `Contenu ${t} pour ${reference}.`,
    verses: i === 8 ? [reference.replace(/\s+(\d+)$/, "$1:1")] : []
  }));
  return { reference, templateId: "v28-standard", sections };
}

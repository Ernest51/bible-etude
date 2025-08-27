// api/chat.js — IA structurée en 2 passes + cache + correctifs + fallback.
// Node 20+ (Vercel). KV (Upstash) optionnelle. OpenAI optionnel (si absent → fallback déterministe).

import crypto from "node:crypto";

// --- OpenAI SDK optionnelle (si non présente, on reste en fallback déterministe) ---
let OpenAI = null;
try { ({ default: OpenAI } = await import("openai")); } catch { /* pas d'SDK → fallback */ }

// --- KV optionnelle (Upstash / Vercel KV) ---
const KV_ENABLED = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
let kv = null;
if (KV_ENABLED) {
  const { Redis } = await import("@upstash/redis");
  kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

// --------- Réponses HTTP ---------
const send = (res, status, body, etag) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  if (etag) res.setHeader("ETag", etag);
  res.end(JSON.stringify(body));
};
const OK = (res, data, etag) => send(res, 200, { ok: true, data }, etag);
const KO = (res, status, msg)   => send(res, status, { ok: false, error: msg });

// --------- Rubriques & briefs ---------
const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliiques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
  "Application missionnaire","Application pastorale","Application personnelle",
  "Versets à retenir","Prière de fin"
];

const BRIEFS = [
  "Prière courte demandant l’éclairage du Saint-Esprit pour la lecture du passage.",
  "Identifier le testament (Ancien/Nouveau) et la place canonique du livre.",
  "Proposer 5 questions de révision sur le chapitre précédent.",
  "Résumé doctrinal central du chapitre (titre synthétique, 1–2 phrases).",
  "Période, contexte géopolitique, culturel, destinataires.",
  "Plan/structure du chapitre (sections, mouvements).",
  "Genre littéraire et implications herméneutiques.",
  "Auteur, arrière-plan et liens bibliques.",
  "Verset clé avec référence explicite + justification doctrinale.",
  "Analyse brève (mot-à-mot / verset-à-verset) des points saillants.",
  "Mots clés + sens et portée doctrinale.",
  "Passages parallèles/complémentaires et leur lien.",
  "Doctrines majeures mises en évidence.",
  "Thème doctrinal principal et sous-thèmes.",
  "Fruits/vertus visés par le texte (avec appui).",
  "Typologies/symboles et accomplissement.",
  "Passages renforçant l’enseignement.",
  "Comparer 2–3 versets du chapitre.",
  "Parallèle avec Actes 2 (continuité/discontinuité).",
  "1 verset à mémoriser + justification.",
  "Applications pour l’Église locale.",
  "Applications pour la famille.",
  "Applications enfants/adolescents.",
  "Axes missionnaires/évangélisation.",
  "Conseils pastoraux/enseignants.",
  "Application personnelle concrète.",
  "3–5 versets incontournables pour prédication.",
  "Prière de clôture demandant la mise en pratique."
];

// --------- Helpers canon/prières ---------
function isOT(book) {
  const OT = new Set(["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"]);
  return OT.has(book);
}
const prayerOpen = ref => `Père céleste, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans ta vérité. Au nom de Jésus, amen.`;
const prayerClose = ref => `Seigneur, merci pour la lumière reçue dans ${ref}. Donne-nous de mettre ta Parole en pratique à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;

// --------- Fallback déterministe (garantie) ---------
function deterministicStudy(reference, templateId = "v28-standard") {
  const book = String(reference).split(/\s+/)[0] || "Livre";
  const chap = (String(reference).match(/\b(\d+)\b/) || [])[1] || "1";
  return {
    reference,
    templateId,
    sections: TITLES.map((t, i) => ({
      id: i + 1,
      title: t,
      content:
        i === 0  ? prayerOpen(reference) :
        i === 1  ? `Le livre de ${book} appartient à l’${isOT(book) ? "Ancien" : "Nouveau"} Testament.` :
        i === 2  ? "Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir)." :
        i === 8  ? `Verset-clé proposé : ${book} ${chap}:1 — explique brièvement sa centralité doctrinale.` :
        i === 27 ? prayerClose(reference) :
                   `Contenu « ${t} » pour ${reference}.`,
      verses: i === 8 ? [`${book} ${chap}:1`] : []
    }))
  };
}

// --------- Validation & correctifs ---------
function normalizeStudy(study) {
  if (!study || typeof study !== "object") return null;
  if (!Array.isArray(study.sections)) return null;

  const out = { reference: study.reference || "", templateId: study.templateId || "v28-standard", sections: [] };
  const byId = new Map();
  study.sections.forEach(s => {
    const id = Number(s?.id);
    if (id >= 1 && id <= 28 && !byId.has(id)) {
      byId.set(id, {
        id,
        title: TITLES[id-1],
        content: String(s?.content || "").trim(),
        verses: Array.isArray(s?.verses) ? s.verses.slice(0, 10).map(String) : []
      });
    }
  });

  for (let i = 1; i <= 28; i++) {
    if (byId.has(i)) out.sections.push(byId.get(i));
    else out.sections.push({ id: i, title: TITLES[i-1], content: "", verses: [] });
  }
  return out;
}

function patchGuarantees(study) {
  const ref = study.reference || "—";
  study.sections[0].content  = prayerOpen(ref);
  study.sections[27].content = prayerClose(ref);

  if (!study.sections[1].content) {
    const book = String(ref).split(/\s+/)[0] || "Livre";
    study.sections[1].content = `Le livre de ${book} appartient à l’${isOT(book) ? "Ancien" : "Nouveau"} Testament.`;
  }
  if (!study.sections[2].content) {
    study.sections[2].content = "Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
  }
  if (!study.sections[8].content || !/\d+:\d+/.test(study.sections[8].content)) {
    const book = String(ref).split(/\s+/)[0] || "Livre";
    const chap = (String(ref).match(/\b(\d+)\b/) || [])[1] || "1";
    if (!Array.isArray(study.sections[8].verses) || !study.sections[8].verses.length) {
      study.sections[8].verses = [`${book} ${chap}:1`];
    }
    if (!study.sections[8].content) {
      study.sections[8].content = `Verset-clé proposé : ${book} ${chap}:1 — explique brièvement sa centralité doctrinale.`;
    }
  }

  study.sections.forEach(s => { s.content = String(s.content || "").trim(); });
  return study;
}

// --------- Appel OpenAI (passe 1) ---------
async function generateWithOpenAI(reference) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      reference: { type: "string" },
      templateId: { type: "string" },
      sections: {
        type: "array",
        minItems: 28, maxItems: 28,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer", minimum: 1, maximum: 28 },
            title: { type: "string" },
            content: { type: "string" },
            verses: { type: "array", items: { type: "string" } }
          },
          required: ["id","title","content"]
        }
      }
    },
    required: ["reference","sections"]
  };

  const system = `
Tu es un générateur d'étude biblique francophone. 
Réponds UNIQUEMENT en JSON conforme au schéma (28 sections, ids 1..28, titres EXACTS).
Pas de texte hors JSON. Passage: "${reference}".
Consignes par section:
${TITLES.map((t,i)=>`[${i+1}] ${t}: ${BRIEFS[i]}`).join("\n")}
Style: précis, biblique, pastoral, sans polémique.`;

  const resp = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0,
    top_p: 0,
    max_output_tokens: 3200,
    response_format: { type: "json_schema", json_schema: { name: "Study28", schema, strict: true } },
    input: [
      { role: "system", content: system },
      { role: "user", content: `Produit l'étude complète pour: ${reference}.` }
    ]
  });

  const text = resp.output_text || "";
  try { return JSON.parse(text); } catch { return null; }
}

// --------- Détection des rubriques faibles ---------
const MIN_CHARS = Number(process.env.REFINE_MIN_CHARS || 180); // longueur mini par section
const MAX_REFINE = Number(process.env.REFINE_MAX_SECTIONS || 10); // évite d'optimiser tout à la fois

function findWeakSections(study) {
  const ids = [];
  for (const s of study.sections) {
    const id = s.id;

    // on ne retouche jamais les prières locales
    if (id === 1 || id === 28) continue;

    const txt = String(s.content || "");
    const tooShort = txt.replace(/\s+/g,' ').trim().length < MIN_CHARS;

    // règles spécifiques
    let specific = false;
    if (id === 3) { // Questions du chapitre précédent
      specific = (txt.match(/\?/g) || []).length < 3; // au moins 3 questions
    }
    if (id === 9) { // Verset-clé
      specific = specific || !/\d+:\d+/.test(txt);
    }
    if (id === 26) { // Versets à retenir
      specific = specific || (txt.match(/\d+:\d+/g) || []).length < 2;
    }

    if (tooShort || specific) ids.push(id);
  }
  return ids.slice(0, MAX_REFINE);
}

// --------- Appel OpenAI (passe 2 — affinage ciblé) ---------
async function refineWithOpenAI(reference, study, ids) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;
  if (!ids.length) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // On envoie à l'IA uniquement les sections à réécrire, avec brief précis.
  const sectionsPayload = ids.map(id => {
    const idx = id - 1;
    return {
      id,
      title: TITLES[idx],
      brief: BRIEFS[idx],
      previous: String(study.sections[idx].content || "").slice(0, 2000) // on borne
    };
  });

  // Retour attendu: { items: [{id, content, verses?}, ...] }
  const refineSchema = {
    type: "object",
    additionalProperties: false,
    properties: {
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer", minimum: 1, maximum: 28 },
            content: { type: "string" },
            verses: { type: "array", items: { type: "string" } }
          },
          required: ["id","content"]
        }
      }
    },
    required: ["items"]
  };

  const system = `
Tu es un éditeur biblique. Tu reçois certaines sections à RÉÉCRIRE pour le passage "${reference}".
Respecte strictement le titre et l'intention de chaque section (brief fourni).
Rédige un contenu plus consistant (6–12 phrases), biblique, cohérent, en français pastoral.
Pour [Verset-clé doctrinal] et [Versets à retenir], indique explicitement des références (Ex: Jean 3:16).
Réponds UNIQUEMENT en JSON conforme au schéma.`;

  const resp = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0,
    top_p: 0,
    max_output_tokens: 2000,
    response_format: { type: "json_schema", json_schema: { name: "RefineSections", schema: refineSchema, strict: true } },
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify({ reference, sections: sectionsPayload }) }
    ]
  });

  const text = resp.output_text || "";
  try { return JSON.parse(text); } catch { return null; }
}

// --------- Cache helpers ---------
const makeKey = (q, templateId, ver) => `study:${templateId || "v28"}:${ver || "LSG"}:${q}`;
const sha1 = (s) => `"${crypto.createHash("sha1").update(s).digest("hex")}"`;

// --------- Handler principal ---------
export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return KO(res, 405, "Method not allowed");
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const isGET = req.method === "GET";

    let q = "";
    let templateId = "v28-standard";
    let version = url.searchParams.get("version") || "LSG";

    if (isGET) {
      q = (url.searchParams.get("q") || "").trim();
      templateId = url.searchParams.get("templateId") || templateId;
    } else {
      const body = await new Promise((r) => { let b=""; req.on("data",c=>b+=c); req.on("end",()=>r(b)); });
      try {
        const j = JSON.parse(body || "{}");
        q = (j.q || "").trim();
        templateId = j.templateId || templateId;
        version = j.version || version;
      } catch {}
    }
    if (!q) return KO(res, 400, "Missing q");

    const key = makeKey(q, templateId, version);
    const ifNone = req.headers["if-none-match"];

    // --- Cache KV ---
    if (KV_ENABLED) {
      const cached = await kv.get(key);
      if (cached) {
        const etag = sha1(cached);
        if (ifNone && ifNone === etag) return send(res, 304, null);
        return OK(res, JSON.parse(cached), etag);
      }
    }

    // --- PASSE 1 : IA ou fallback ---
    let study = null;
    try {
      const ai = await generateWithOpenAI(q); // null si pas d'OpenAI
      const norm = normalizeStudy(ai);
      if (norm && norm.sections.length === 28) {
        norm.reference = norm.reference || q;
        study = patchGuarantees(norm);
      }
    } catch (e) {
      console.error("[AI PASS1 ERROR]", e);
    }
    if (!study) study = patchGuarantees(normalizeStudy(deterministicStudy(q)));

    // --- PASSE 2 : Affinage ciblé (si OpenAI dispo) ---
    try {
      if (OpenAI && process.env.OPENAI_API_KEY) {
        const ids = findWeakSections(study);
        if (ids.length) {
          const improved = await refineWithOpenAI(q, study, ids);
          if (improved?.items?.length) {
            for (const item of improved.items) {
              const id = Number(item.id);
              if (id >= 1 && id <= 28 && id !== 1 && id !== 28) {
                const idx = id - 1;
                study.sections[idx].content = String(item.content || "").trim() || study.sections[idx].content;
                if (Array.isArray(item.verses)) {
                  study.sections[idx].verses = item.verses.slice(0,10).map(String);
                }
              }
            }
            study = patchGuarantees(study); // on garantit de nouveau
          }
        }
      }
    } catch (e) {
      console.error("[AI PASS2 ERROR]", e);
      // on garde l'étude de la passe 1 (jamais d'échec côté client)
    }

    // --- Cache final & ETag ---
    const payload = JSON.stringify(study);
    const etag = sha1(payload);
    if (KV_ENABLED) await kv.set(key, payload, { ex: 60 * 60 * 24 * 7 }); // 7 jours

    return OK(res, study, etag);

  } catch (e) {
    console.error(e);
    return KO(res, 500, "Internal error");
  }
}

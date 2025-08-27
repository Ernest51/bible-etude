// api/chat.js — IA structurée, cache, corrections, fallback déterministe.
// Works on Vercel Node 20+. Optional KV cache. OpenAI is optional.

// ----- Imports serveur -----
import crypto from "node:crypto";
let OpenAI = null;
try { ({ default: OpenAI } = await import("openai")); } catch { /* no SDK -> fallback */ }

// ----- KV optionnelle (Upstash/Vercel KV) -----
const KV_ENABLED = !!process.env.KV_REST_API_URL && !!process.env.KV_REST_API_TOKEN;
let kv = null;
if (KV_ENABLED) {
  const { Redis } = await import("@upstash/redis");
  kv = new Redis({ url: process.env.KV_REST_API_URL, token: process.env.KV_REST_API_TOKEN });
}

// ----- Réponses utilitaires -----
const send = (res, status, body, etag) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  if (etag) res.setHeader("ETag", etag);
  res.end(JSON.stringify(body));
};
const OK = (res, data, etag) => send(res, 200, { ok: true, data }, etag);
const KO = (res, status, msg)   => send(res, status, { ok: false, error: msg });

// ----- Rubriques figées -----
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

// micro-brief précis pour chaque rubrique (guide l’IA)
const BRIEFS = [
  "Écris une prière courte demandant l’éclairage du Saint-Esprit pour la lecture du passage.",
  "Identifie le testament (Ancien/Nouveau) et la place canonique du livre choisi.",
  "Propose 5 questions de révision portant sur le chapitre précédent (compréhension, application, comparaison, mémorisation).",
  "Résume en 1–2 phrases le message doctrinal central du chapitre (titre synthétique).",
  "Situe période, contexte géopolitique, culturel et destinataires probables.",
  "Décris la structure/plan du chapitre (sections, mouvements narratifs).",
  "Précise le genre du texte (narratif, poétique, prophétique, épistolaire…), et implications d’interprétation.",
  "Donne les éléments clés sur l’auteur, son arrière-plan et ses liens bibliques pertinents.",
  "Choisis 1 verset clé (référence explicite) et explique brièvement pourquoi il est doctrinalement central.",
  "Analyse brève mot-à-mot ou verset-à-verset des points saillants (grec/hébreu si pertinent).",
  "Liste quelques mots clés avec sens et portée doctrinale.",
  "Donne 3–5 passages parallèles/complémentaires avec brève explication du lien.",
  "Expose les doctrines majeures mises en évidence par le chapitre.",
  "Dégage le thème doctrinal principal et ses sous-thèmes.",
  "Liste des fruits/vertus que le texte vise (avec versets d’appui du chapitre si possible).",
  "Explique les typologies/symboles (si applicables) et leur accomplissement.",
  "Ajoute des passages ailleurs dans la Bible qui renforcent l’enseignement ici.",
  "Compare 2–3 versets du chapitre pour mettre en relief une nuance importante.",
  "Fais un parallèle bienveillant avec Actes 2 (continuité/discontinuité, implications).",
  "Propose 1 verset à mémoriser, adapté et justifié.",
  "Applications pour l’Église locale (gouvernance, mission, culte, service).",
  "Applications pour la famille (transmission, éducation, relations).",
  "Applications pour enfants/adolescents (pédagogie simple, visuels ou activités).",
  "Axes missionnaires/évangélisation inspirés du texte.",
  "Conseils pastoraux/enseignants (précautions herméneutiques, accompagnement).",
  "Application personnelle : examen de conscience, repentir, engagements concrets.",
  "Liste 3–5 versets “incontournables” pour prédication/catéchése.",
  "Écris une prière de clôture remerciant Dieu et demandant la mise en pratique."
];

// ----- Helpers “canon/testament” & prières locales -----
function isOT(book) {
  const OT = new Set(["Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques","Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"]);
  return OT.has(book);
}
const prayerOpen = ref => `Père céleste, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans ta vérité. Au nom de Jésus, amen.`;
const prayerClose = ref => `Seigneur, merci pour la lumière reçue dans ${ref}. Donne-nous de mettre ta Parole en pratique à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;

// ----- Bouchon déterministe (garantie de service) -----
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

// ----- Validation & corrections -----
function normalizeStudy(study) {
  if (!study || typeof study !== "object") return null;
  if (!Array.isArray(study.sections)) return null;

  // map by id and align titles
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

  // inject missing with placeholders
  for (let i = 1; i <= 28; i++) {
    if (byId.has(i)) out.sections.push(byId.get(i));
    else out.sections.push({ id: i, title: TITLES[i-1], content: "", verses: [] });
  }
  return out;
}

function patchGuarantees(study) {
  const ref = study.reference || "—";
  // 1) prières toujours locales
  study.sections[0].content  = prayerOpen(ref);
  study.sections[27].content = prayerClose(ref);

  // 2) canon/testament si vide
  if (!study.sections[1].content) {
    const book = String(ref).split(/\s+/)[0] || "Livre";
    study.sections[1].content = `Le livre de ${book} appartient à l’${isOT(book) ? "Ancien" : "Nouveau"} Testament.`;
  }

  // 3) questions chapitre précédent si vide
  if (!study.sections[2].content) {
    study.sections[2].content = "Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
  }

  // 4) verset-clé doit contenir une référence
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

  // nettoyage texte
  study.sections.forEach(s => { s.content = String(s.content || "").trim(); });
  return study;
}

// ----- Appel IA (OpenAI Responses + JSON Schema) -----
async function generateWithOpenAI(reference) {
  if (!OpenAI || !process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // JSON schema strict (28 rubriques, ids 1..28)
  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      reference: { type: "string" },
      templateId: { type: "string" },
      sections: {
        type: "array",
        minItems: 28,
        maxItems: 28,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "integer", minimum: 1, maximum: 28 },
            title: { type: "string" },
            content: { type: "string" },
            verses: { type: "array", items: { type: "string" } }
          },
          required: ["id", "title", "content"]
        }
      }
    },
    required: ["reference", "sections"]
  };

  const system = `
Tu es un générateur d'étude biblique francophone. 
Tu dois répondre UNIQUEMENT en JSON conforme au schéma fourni (28 sections, ids 1..28, titres EXACTS).
Pas de texte hors JSON. Le passage est: "${reference}".
Pour chaque section, suis ces consignes:
${TITLES.map((t,i)=>`- [${i+1}] ${t}: ${BRIEFS[i]}`).join("\n")}
Précis, pastoral, biblique, sans polémique.`;

  const response = await client.responses.create({
    model: "gpt-4o-mini",
    temperature: 0,
    top_p: 0,
    max_output_tokens: 3000,
    response_format: { type: "json_schema", json_schema: { name: "Study28", schema, strict: true } },
    input: [
      { role: "system", content: system },
      { role: "user", content: `Génère l'étude complète pour: ${reference}. Titre de chaque section = EXACTEMENT la liste des 28 rubriques.` }
    ]
  });

  const text = response.output_text || "";
  let parsed = null;
  try { parsed = JSON.parse(text); } catch { parsed = null; }
  return parsed;
}

// ----- Cache helpers -----
const makeKey = (q, templateId, ver) => `study:${templateId || "v28"}:${ver || "LSG"}:${q}`;
const sha1 = (s) => `"${crypto.createHash("sha1").update(s).digest("hex")}"`;

// ----- Handler -----
export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return KO(res, 405, "Method not allowed");
    }

    // lecture params
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

    // KV cache
    if (KV_ENABLED) {
      const cached = await kv.get(key);
      if (cached) {
        const etag = sha1(cached);
        if (ifNone && ifNone === etag) return send(res, 304, null);
        return OK(res, JSON.parse(cached), etag);
      }
    }

    // IA -> normalisation -> patch garanties
    let study = null;
    try {
      const ai = await generateWithOpenAI(q);      // null si SDK/clés absentes
      const norm = normalizeStudy(ai);
      if (norm && norm.sections.length === 28) {
        norm.reference = norm.reference || q;
        study = patchGuarantees(norm);
      }
    } catch (e) {
      // on loggue côté serveur, mais on ne casse jamais
      console.error("[AI ERROR]", e);
    }

    // fallback déterministe si IA absente ou invalide
    if (!study) study = patchGuarantees(normalizeStudy(deterministicStudy(q)));

    // cache / ETag
    const payload = JSON.stringify(study);
    const etag = sha1(payload);
    if (KV_ENABLED) await kv.set(key, payload, { ex: 60 * 60 * 24 * 7 }); // 7 jours

    return OK(res, study, etag);

  } catch (e) {
    console.error(e);
    return KO(res, 500, "Internal error");
  }
}

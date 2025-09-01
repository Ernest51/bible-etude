// /api/chat.js — Endpoint JSON stable (POST recommandé)
// Réponse : { ok:true, source:"openai"|"fallback", data:{ reference, version, sections:[{id,title,content}] }, warn? }

const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
  "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
];

// ---------- util headers no-store ----------
function setNoStore(res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
}
function ok(res, payload) {
  setNoStore(res);
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}
function fail(res, status, message) {
  setNoStore(res);
  res.statusCode = status || 500;
  res.end(JSON.stringify({ ok:false, error: String(message || "Internal error") }));
}

// ---------- helpers ----------
function parseQ(q) {
  if (!q) return { book:"", chapter:NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m ? { book:m[1].trim(), chapter:Number(m[2]) } : { book:String(q).trim(), chapter:NaN };
}

function buildSectionsFromStrings(strings) {
  // strings = { s1: "...", ..., s28: "..." }
  const out = [];
  for (let i=1;i<=28;i++) {
    const id = i;
    const title = TITLES[i-1] || `Point ${i}`;
    const content = String(strings[`s${i}`] || "").trim();
    out.push({ id, title, content });
  }
  return out;
}

// ---------- Fallback (générique mais correct) ----------
function fallbackStudy(book, chapter, version) {
  const ref = `${book} ${chapter}`;
  const base = [
    `Seigneur, éclaire notre lecture de ${ref}.`,
    `Le livre de ${book} appartient au canon biblique (tradition LSG).`,
    `Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`,
    `Titre doctrinal synthétique du chapitre.`,
    `Repères ANE / contexte du peuple : ${book} ${chapter}.`,
    `Grandes unités littéraires et refrains du chapitre.`,
    `Type de texte : narratif / poétique / prophétique.`,
    `Auteur traditionnel et lien aux patriarches / à l’alliance.`,
    `${ref}:1 — Verset-clé proposé.`,
    `Notes exégétiques : termes, structure, progression.`,
    `Lexique des mots-clés et portée doctrinale.`,
    `Passages parallèles utiles à la compréhension.`,
    `Doctrines majeures mises en lumière par le chapitre.`,
    `Thème doctrinal dominant et articulation biblique.`,
    `Fruits spirituels attendus (foi, espérance, charité…).`,
    `Types/figures et leur accomplissement en Christ.`,
    `Autres passages qui confirment l’enseignement.`,
    `Comparer les versets clés internes au chapitre.`,
    `Parallèles avec Actes 2 (nouvelle création/Esprit).`,
    `${ref}:1 — verset à mémoriser (ou un autre très clé).`,
    `Implications pour l’Église (culte, mission, unité).`,
    `Implications pour la famille (transmission, éducation).`,
    `Version enfants : récit simple, deux questions.`,
    `Application missionnaire (annonce, justice, charité).`,
    `Points pour l’accompagnement pastoral.`,
    `Examen de conscience et engagement personnel.`,
    `Liste courte de versets à retenir pour prêcher.`,
    `Prière finale : merci pour ${ref}, aide-nous à obéir.`
  ];

  const sections = base.map((content, idx) => ({
    id: idx + 1,
    title: TITLES[idx] || `Point ${idx+1}`,
    content
  }));

  return {
    ok: true,
    source: "fallback",
    data: { reference: ref, version: version || "LSG", sections }
  };
}

// ---------- OpenAI JSON mode ----------
async function askOpenAI_JSON({ book, chapter, version, apiKey, timeoutMs = 18000 }) {
  const schema = {
    type: "object",
    properties: Object.fromEntries(Array.from({ length: 28 }, (_, i) => [`s${i+1}`, { type: "string" }])),
    required: Array.from({ length: 28 }, (_, i) => `s${i+1}`),
    additionalProperties: false
  };

  const SYSTEM = `
Tu réponds en **JSON strict** (aucun texte hors JSON), avec **28** clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, style pastoral, version ${version} pour les citations si besoin.
Correspondance exacte des rubriques : s1="${TITLES[0]}", …, s28="${TITLES[27]}".
`.trim();

  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Rédige pour une étude biblique en 28 points. Répondre **uniquement** par un JSON conforme au schéma.
`.trim();

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.35,
        max_tokens: 1600,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: USER }
        ]
      })
    });

    const raw = await r.text();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 300)}`);

    let data;
    try { data = JSON.parse(raw); } catch { throw new Error("OpenAI: réponse non JSON"); }

    const content = data?.choices?.[0]?.message?.content || "";
    let obj;
    try { obj = JSON.parse(content); } catch { throw new Error("OpenAI: contenu non JSON strict"); }

    // Validation minimale
    for (let i = 1; i <= 28; i++) {
      if (typeof obj[`s${i}`] !== "string") throw new Error(`OpenAI: champ manquant s${i}`);
    }

    // Construction sections
    const sections = buildSectionsFromStrings(obj);
    return {
      ok: true,
      source: "openai",
      data: { reference: `${book} ${chapter}`, version, sections }
    };
  } finally {
    clearTimeout(to);
  }
}

// ---------- Handler principal ----------
export default async function handler(req, res) {
  try {
    // Appliquer no-store pour toutes les branches
    setNoStore(res);

    // Lire body JSON (POST) si présent
    let body = {};
    if (req.method === "POST") {
      body = await new Promise((resolve) => {
        let b = "";
        req.on("data", (c) => (b += c));
        req.on("end", () => {
          try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); }
        });
      });
    }

    // Support GET (legacy) : ?q= "Genèse 1"
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());
    const probe = qp.probe === "1" || body.probe === true;

    // Paramètres prioritaires POST
    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter || NaN);
    let version = body.version || qp.version || "LSG";

    // Si "q" fourni, on parse "Livre Chapitre"
    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }

    // Défauts robustes
    if (!book) book = "Genèse";
    if (!chapter || !Number.isFinite(chapter)) chapter = 1;

    // Mode "probe" (si tu veux tester visuellement)
    if (probe) {
      const fb = fallbackStudy(book, chapter, version);
      return ok(res, fb);
    }

    const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim();
    if (!apiKey) {
      const fb = fallbackStudy(book, chapter, version);
      fb.warn = "OPENAI_API_KEY manquant: fallback";
      return ok(res, fb);
    }

    // Appel OpenAI -> JSON 28 sections
    try {
      const ai = await askOpenAI_JSON({ book, chapter, version, apiKey });
      return ok(res, ai);
    } catch (e) {
      // Échec OpenAI -> fallback
      const fb = fallbackStudy(book, chapter, version);
      fb.warn = `OpenAI error: ${String(e.message || e)}`;
      return ok(res, fb);
    }
  } catch (e) {
    return fail(res, 500, e?.message || e);
  }
}

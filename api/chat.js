// api/chat.js — API robuste: 28 rubriques en JSON (OpenAI → fallback)
// - GET  /api/chat?q="Genèse 1"[&version=LSG][&probe=1]
// - POST /api/chat   { book, chapter, version, probe }
// Réponse: { ok, source, data: { reference, version, sections:[{id,title,content}...] } }

const TITLES = [
  "Prière d’ouverture",                    // 1
  "Canon et testament",                    // 2
  "Questions du chapitre précédent",       // 3
  "Titre du chapitre",                     // 4
  "Contexte historique",                   // 5
  "Structure littéraire",                  // 6
  "Genre littéraire",                      // 7
  "Auteur et généalogie",                  // 8
  "Verset-clé doctrinal",                  // 9
  "Analyse exégétique",                    // 10
  "Analyse lexicale",                      // 11
  "Références croisées",                   // 12
  "Fondements théologiques",               // 13
  "Thème doctrinal",                       // 14
  "Fruits spirituels",                     // 15
  "Types bibliques",                       // 16
  "Appui doctrinal",                       // 17
  "Comparaison entre versets",             // 18
  "Comparaison avec Actes 2",              // 19
  "Verset à mémoriser",                    // 20
  "Enseignement pour l’Église",            // 21
  "Enseignement pour la famille",          // 22
  "Enseignement pour enfants",             // 23
  "Application missionnaire",              // 24
  "Application pastorale",                 // 25
  "Application personnelle",               // 26
  "Versets à retenir",                     // 27
  "Prière de fin"                          // 28
];

const N = TITLES.length;
const DEFAULT_VERSION = "LSG"; // Louis Segond 1910

function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m ? { book: m[1].trim(), chapter: Number(m[2]) } : { book: String(q).trim(), chapter: NaN };
}

function toSectionsFromMap(reference, version, map) {
  const sections = [];
  for (let i = 0; i < N; i++) {
    const id = i + 1;
    const key = `s${id}`;
    const content = (map && typeof map[key] === "string") ? map[key].trim() : "";
    sections.push({ id, title: TITLES[i], content });
  }
  return { reference, version, sections };
}

function ok(res, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.statusCode = 200;
  res.end(JSON.stringify(payload));
}

function fail(res, status, message) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.statusCode = status || 500;
  res.end(JSON.stringify({ ok: false, error: message || "Server error" }));
}

// --------- Fallback local (Markdown → JSON) ---------

function defaultOpenPrayer(reference) {
  return `Père céleste, nous venons devant toi pour lire ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`;
}
function defaultClosePrayer(reference) {
  return `Seigneur, merci pour la lumière reçue dans ${reference}. Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;
}

function fallbackData(book, chapter, version) {
  const reference = `${book} ${chapter}`;
  const base = {
    s1:  defaultOpenPrayer(reference),
    s2:  `Le livre de ${book} appartient à l’${isOT(book) ? "Ancien" : "Nouveau"} Testament.`,
    s3:  "Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).",
    s4:  `${book} ${chapter} — titre doctrinal synthétique.`,
    s5:  "Contexte historique: auteur traditionnel, cadre, destinataires, enjeux théologiques.",
    s6:  "Structure littéraire: découpage interne du chapitre (péricoses, refrains, parallélismes).",
    s7:  "Genre littéraire: narratif / poétique / prophétique / sapientiel (selon le cas).",
    s8:  "Auteur et généalogie: informations traditionnelles et liens aux patriarches / apôtres.",
    s9:  `${book} ${chapter}:1 — Verset-clé proposé (version ${version}).`,
    s10: "Analyse exégétique: remarques sur les tournures, les parallèles, les citations.",
    s11: "Analyse lexicale: termes-clés (hébreu/grec) et portée doctrinale.",
    s12: "Références croisées: passages parallèles dans l'Écriture.",
    s13: "Fondements théologiques majeurs du chapitre.",
    s14: "Thème doctrinal principal et sous-thèmes.",
    s15: "Fruits spirituels: vertus, attitudes, marqueurs de sanctification.",
    s16: "Types bibliques: symboles, figures, préfigurations.",
    s17: "Appui doctrinal: autres textes confirmant l'enseignement.",
    s18: "Comparaison interne: mise en relief entre versets du chapitre.",
    s19: "Comparaison avec Actes 2: dynamique de la Parole et de l'Esprit.",
    s20: `${book} ${chapter}:1 — Verset à mémoriser (version ${version}).`,
    s21: "Applications pour l’Église: vie communautaire et mission.",
    s22: "Applications pour la famille: transmission de la foi, éducation.",
    s23: "Applications pour enfants: formulation simple, images, activités.",
    s24: "Application missionnaire: annoncer l'Évangile en lien avec le chapitre.",
    s25: "Application pastorale: accompagnement, exhortation, counselling.",
    s26: "Application personnelle: examen, décisions, prière.",
    s27: `${book} ${chapter}:1 ; ${book} ${chapter}:2 ; ${book} ${chapter}:3 (à retenir).`,
    s28: defaultClosePrayer(reference)
  };
  return toSectionsFromMap(reference, version, base);
}

function isOT(book) {
  const NT = [
    "Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens",
    "1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre",
    "1 Jean","2 Jean","3 Jean","Jude","Apocalypse"
  ];
  return !NT.includes(book);
}

// --------- OpenAI (JSON mode) ---------

async function callOpenAI_JSON({ book, chapter, version, apiKey }) {
  const reference = `${book} ${chapter}`;

  const schema = {
    type: "object",
    properties: Object.fromEntries(Array.from({ length: N }, (_, i) => [`s${i + 1}`, { type: "string" }])),
    required: Array.from({ length: N }, (_, i) => `s${i + 1}`),
    additionalProperties: false
  };

  const SYSTEM = `
Tu DOIS répondre en **JSON strict** (rien d'autre), avec exactement **28** clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, ton pastoral/clair, citations en ${version}.
Respecte cette correspondance stricte:
${TITLES.map((t, i) => `- s${i + 1} => "${t}"`).join("\n")}
`.trim();

  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Renvoie UNIQUEMENT un JSON objet conforme au schéma annoncé (s1..s28).
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), 18000);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 200)}`);

    let data;
    try { data = JSON.parse(text); } catch { throw new Error("Réponse OpenAI: JSON global invalide"); }
    const raw = data?.choices?.[0]?.message?.content || "";
    let obj;
    try { obj = JSON.parse(raw); } catch { throw new Error("Réponse OpenAI: contenu non-JSON"); }

    // Validation simple
    for (let i = 1; i <= N; i++) {
      if (typeof obj[`s${i}`] !== "string") throw new Error(`Champ manquant s${i}`);
    }
    return { ok: true, data: toSectionsFromMap(reference, version, obj) };
  } finally {
    clearTimeout(to);
  }
}

// --------- Handler ---------

export default async function handler(req, res) {
  try {
    // Parse body / query
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
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());

    const probe = qp.probe === "1" || body.probe === true;

    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter);
    let version = (body.version || qp.version || DEFAULT_VERSION).trim() || DEFAULT_VERSION;

    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }

    // Valeurs par défaut
    book = book || "Genèse";
    chapter = chapter || 1;

    if (probe) {
      // Renvoie du Markdown "simple" (lecture directe utile en debug)
      const fb = fallbackData(book, chapter, version);
      const md = renderAsMarkdown(fb);
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.statusCode = 200;
      return res.end(md);
    }

    const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      // Pas de clé → fallback
      const fb = fallbackData(book, chapter, version);
      return ok(res, { ok: true, source: "fallback", data: fb });
    }

    try {
      const ai = await callOpenAI_JSON({ book, chapter, version, apiKey });
      if (ai?.ok && ai.data) {
        return ok(res, { ok: true, source: "openai", data: ai.data });
      }
      // Sécurité: si pas ok → fallback
      const fb = fallbackData(book, chapter, version);
      return ok(res, { ok: true, source: "fallback", data: fb });
    } catch (e) {
      // Erreur OpenAI → fallback
      const fb = fallbackData(book, chapter, version);
      return ok(res, { ok: true, source: "fallback", data: fb, warn: String(e?.message || e) });
    }
  } catch (e) {
    return fail(res, 500, String(e?.message || e));
  }
}

// --------- Utils ---------

function renderAsMarkdown({ reference, sections }) {
  const lines = [`# ${reference}`, ""];
  sections.forEach((s) => {
    lines.push(`${s.id}. ${s.title}`, "", s.content || "—", "");
  });
  return lines.join("\n");
}

// /api/chat.js — Endpoint JSON stable pour générer une étude en 28 rubriques

// ====== Configuration ======
const MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini"; // tu peux mettre "gpt-4o" si tu as l'accès
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// 28 titres fixes (ordre contractuel)
const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
  "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
];

// ====== Utils ======
function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
}

function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).trim().match(/^(.+?)\s+(\d+)\s*$/);
  return m ? { book: m[1].trim(), chapter: Number(m[2]) } : { book: String(q).trim(), chapter: NaN };
}

function clampChapter(n) {
  const x = Number(n);
  return Number.isFinite(x) && x > 0 && x < 1000 ? x : 1;
}

function toData(reference, version, blocks) {
  // blocks: array of 28 strings
  const sections = blocks.map((content, i) => ({
    id: i + 1,
    title: TITLES[i],
    content: String(content || "").trim()
  }));
  return { reference, version, sections };
}

// ====== Fallback (sûr et cohérent) ======
function fallbackBlocks(book, chapter) {
  const ref = `${book} ${chapter}`;
  return [
    `Père céleste, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`,
    `Le livre de ${book} appartient au canon biblique. Positionne-le correctement dans l’Ancien ou le Nouveau Testament selon ta tradition et ton usage pédagogique.`,
    `Préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`,
    `${book} ${chapter} — Résumé doctrinal synthétique du chapitre étudié.`,
    `Contexte : époque, auteur présumé, destinataires, enjeux historiques. Situe ${ref} par rapport aux récits environnants.`,
    `Structure possible (ex. ${ref}) : scènes, refrains, parallélismes, transitions. Décris la progression interne du texte.`,
    `Genre : narratif, poétique, prophétique, wisdom, épître, etc. Explique l’impact du genre sur l’interprétation.`,
    `Auteur & rattachements : tradition, liens aux patriarches / apôtres, lignes théologiques majeures.`,
    `Verset clé (référence + courte citation dans la version ${"LSG"}) à mémoriser, évite les passages trop longs.`,
    `Analyse exégétique : termes clés, contexte littéraire proche, échos dans le livre.`,
    `Analyse lexicale : mots originaux saillants (hébreu/grec), champ sémantique et doctrine sous-jacente.`,
    `Références croisées : passages parallèles ou éclairants (3-5).`,
    `Fondements doctrinaux : Dieu, création, péché, alliance, salut, sanctification, eschatologie…`,
    `Thème doctrinal principal : formule synthétique en 1-2 phrases.`,
    `Fruits spirituels : humilité, confiance, obéissance, compassion, espérance…`,
    `Typologie : symboles, figures, motifs qui annoncent Christ/Évangile si pertinent.`,
    `Appuis doctrinaux : autres textes qui consolident la lecture proposée.`,
    `Comparaison entre versets clefs du chapitre : convergences, contrastes, progression.`,
    `Lien avec Actes 2 (début de l’Église) : Parole, Esprit, communauté, mission (si pertinent).`,
    `Verset à mémoriser (référence + courte citation, version ${"LSG"}).`,
    `Implications pour l’Église locale : culte, discipline, diaconie, mission.`,
    `Implications pour la famille : transmission, prière, pratiques, service.`,
    `Implications pour enfants : langage simple, image, action concrète, activité.`,
    `Application missionnaire : annonce, compassion, justice, contextualisation.`,
    `Application pastorale : accompagnement, consolation, exhortation, formation.`,
    `Application personnelle : examen, repentance, décisions concrètes et mesurables.`,
    `5 versets à retenir (références) utiles pour prêcher/enseigner.`,
    `Seigneur, merci pour la lumière reçue dans ${ref}. Aide-nous à pratiquer ta Parole, en Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`
  ];
}

// ====== Appel OpenAI en JSON strict (s1..s28) ======
async function askOpenAI({ book, chapter, version }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY manquant");

  const SYSTEM = [
    "Tu es un assistant pastoral francophone.",
    "Réponds STRICTEMENT en JSON avec 28 chaînes s1..s28.",
    "Interdit d'ajouter du texte hors JSON.",
    "Chaque s# doit contenir 2–5 phrases courtes orientées étude biblique (pas un dump de versets).",
    "Respecte l'ordre doctrinal des 28 rubriques. Ne change pas le nombre.",
  ].join(" ");

  const USER = [
    `Livre="${book}", Chapitre="${chapter}", Version="${version || "LSG"}".`,
    "Produis un plan d'étude avec 28 rubriques (s1..s28).",
    "Rappels spécifiques :",
    "- s3 = phrase d’instruction: « Préparer au moins 5 questions… »",
    "- s9 & s20 = verset clé (réf + courte citation).",
    "Ne renvoie pas de longs passages, garde concis.",
  ].join("\n");

  const payload = {
    model: MODEL,
    temperature: 0.35,
    max_tokens: 1500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const raw = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${raw.slice(0, 300)}`);

  let data;
  try { data = JSON.parse(raw); } catch { throw new Error("Réponse OpenAI illisible"); }

  const content = data?.choices?.[0]?.message?.content || "";
  let obj;
  try { obj = JSON.parse(content); } catch { throw new Error("OpenAI n'a pas renvoyé un JSON strict"); }

  const out = [];
  for (let i = 1; i <= 28; i++) {
    const k = `s${i}`;
    if (typeof obj[k] !== "string") throw new Error(`Champ manquant: ${k}`);
    out.push(obj[k]);
  }
  return { source: "openai", blocks: out };
}

// ====== Handler principal ======
export default async function handler(req, res) {
  try {
    noStore(res);

    // CORS basique (si tu testes ailleurs)
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      return res.status(204).end();
    }
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Parse body JSON si POST
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

    // Query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());

    // Paramètres utilisateur
    let book = (body.book || qp.book || "").trim();
    let chapter = clampChapter(body.chapter || qp.chapter);
    const version = (body.version || qp.version || "LSG").trim();

    // Compat: ?q="Genèse 1"
    const q = body.q || qp.q;
    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter || 1;
    }

    // Défauts sûrs
    if (!book) book = "Genèse";
    if (!chapter || !Number.isFinite(chapter)) chapter = 1;

    const reference = `${book} ${chapter}`;

    // Mode "probe" pour debug rapide (retour JSON standard)
    const probe = qp.probe === "1" || body.probe === true;

    // ==== Génération ====
    let source = "fallback", blocks, warn = "";

    try {
      if (!probe) {
        const r = await askOpenAI({ book, chapter, version });
        source = r.source;
        blocks = r.blocks;
      }
    } catch (e) {
      warn = `OpenAI: ${e.message}`;
      blocks = null;
    }

    if (!blocks || blocks.length !== 28) {
      blocks = fallbackBlocks(book, chapter);
      source = source === "openai" ? "openai+fallback" : "fallback";
    }

    const data = toData(reference, version, blocks);

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      source,
      warn,
      model: MODEL,
      data
    });

  } catch (e) {
    noStore(res);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: false,
      error: String(e?.message || e),
      data: null
    });
  }
}

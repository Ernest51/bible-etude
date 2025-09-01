// /api/chat.js – Génération d'étude (28 rubriques) avec fallback et version par défaut LSG

// ---------- 28 rubriques (titres) ----------
const TITLES = [
  "Prière d’ouverture",
  "Canon et testament",
  "Questions du chapitre précédent",
  "Titre du chapitre",
  "Contexte historique",
  "Structure littéraire",
  "Genre littéraire",
  "Auteur et généalogie",
  "Verset-clé doctrinal",
  "Analyse exégétique",
  "Analyse lexicale",
  "Références croisées",
  "Fondements théologiques",
  "Thème doctrinal",
  "Fruits spirituels",
  "Types bibliques",
  "Appui doctrinal",
  "Comparaison entre versets",
  "Comparaison avec Actes 2",
  "Verset à mémoriser",
  "Enseignement pour l’Église",
  "Enseignement pour la famille",
  "Enseignement pour enfants",
  "Application missionnaire",
  "Application pastorale",
  "Application personnelle",
  "Versets à retenir",
  "Prière de fin",
];

// ---------- helpers ----------
function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m
    ? { book: m[1].trim(), chapter: Number(m[2]) }
    : { book: String(q).trim(), chapter: NaN };
}

function refFrom(book, chapter) {
  const b = (book || "").trim() || "Genèse";
  const c = Number(chapter) || 1;
  return `${b} ${c}`;
}

// Normalise les entrées de version vers un petit set de codes connus.
// Défaut = LSG (Louis Segond).
function normalizeVersion(v) {
  const raw = (v || "").toString().trim().toLowerCase();

  const TABLE = new Map([
    // Louis Segond
    ["lsg", "LSG"],
    ["segond", "LSG"],
    ["louis segond", "LSG"],
    ["louis segond 1910", "LSG"],
    ["louis segond 1900", "LSG"],
    ["ls-1910", "LSG"],
    ["segond 1910", "LSG"],
    // Parole de Vie
    ["pdv", "PDV"],
    ["parole de vie", "PDV"],
    // NIV
    ["niv", "NIV"],
    ["new international version", "NIV"],
    // Quelques autres fréquentes
    ["bds", "BDS"],  // La Bible du Semeur
    ["semur", "BDS"],
    ["neg79", "NEG79"],
    ["neg 1979", "NEG79"],
    ["colombe", "COL"],
    ["col", "COL"],
    ["nbs", "NBS"],
    ["new bible segond", "NBS"],
  ]);

  if (TABLE.has(raw)) return TABLE.get(raw);
  // Cas type "Parole de Vie (PDV)" -> extraire le token entre parenthèses
  const paren = raw.match(/\(([a-z0-9]+)\)/i);
  if (paren && TABLE.has(paren[1].toLowerCase())) {
    return TABLE.get(paren[1].toLowerCase());
  }
  // si on reçoit juste la sigle correct déjà propre
  const upper = (v || "").toString().trim().toUpperCase();
  if (["LSG", "PDV", "NIV", "BDS", "NEG79", "COL", "NBS"].includes(upper)) return upper;

  return "LSG"; // par défaut, Louis Segond (plus robuste côté BibleGateway)
}

// Fallback local (sans OpenAI)
function fallbackStudy({ reference, version }) {
  const [book, chapStr] = reference.split(/\s+/);
  const chapter = chapStr || "1";

  const sections = TITLES.map((title, idx) => {
    const id = idx + 1;
    let content = "";

    switch (id) {
      case 1:
        content =
          `Père céleste, nous venons devant toi pour lire ${reference}. ` +
          `Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. ` +
          `Au nom de Jésus, amen.`;
        break;

      case 2:
        content = `Le livre de ${book} appartient à l’${["Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"].includes(book) ? "Nouveau" : "Ancien"} Testament.`;
        break;

      case 3:
        content = `Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`;
        break;

      case 4:
        content = `${book} ${chapter} — Titre doctrinal synthétique du chapitre étudié.`;
        break;

      case 5:
        content = `Contexte historique : repères chrono, géopolitiques et culturels utiles à la lecture de ${book} ${chapter}.`;
        break;

      case 6:
        content = `Structure littéraire : séquençage narratif et composition interne du chapitre (ex : unités, refrains, contrastes).`;
        break;

      case 7:
        content = `Genre littéraire : narratif / poétique / prophétique / épistolaire (préciser pour ${book} ${chapter}).`;
        break;

      case 8:
        content = `Auteur (tradition / critique) et rattachements généalogiques pertinents.`;
        break;

      case 9:
        content =
          `Verset-clé doctrinal proposé : ${book} ${chapter}:1 — ` +
          `(Version ${version}).`;
        break;

      case 10:
        content =
          `Analyse exégétique : mots structurants, connecteurs, parallélismes ; ` +
          `remarques sur le texte original utiles à ${reference}.`;
        break;

      case 11:
        content =
          `Analyse lexicale : 3–5 mots-clés (hébreu/grec), sens principaux et portée doctrinale.`;
        break;

      case 12:
        content = `Références croisées suggérées autour de ${reference} (OT/NT) et passages parallèles.`;
        break;

      case 13:
        content = `Fondements théologiques majeurs (Dieu, création/salut/Esprit/Église…) dégagés du chapitre.`;
        break;

      case 14:
        content = `Thème doctrinal central synthétisé en 1–2 phrases.`;
        break;

      case 15:
        content = `Fruits spirituels visés : gratitude, foi, obéissance, espérance, mission…`;
        break;

      case 16:
        content = `Typologie éventuelle : figures/symboles qui annoncent Christ ou la nouvelle alliance.`;
        break;

      case 17:
        content = `Appui doctrinal : passages renforçant l’enseignement (liste brève et pertinente).`;
        break;

      case 18:
        content = `Comparaison interne des versets du chapitre pour mettre en relief sa dynamique.`;
        break;

      case 19:
        content = `Parallèle avec Actes 2 : rôle de la Parole, de l’Esprit et de la communauté.`;
        break;

      case 20:
        content = `Verset à mémoriser (1) proposé : ${book} ${chapter}:1 (${version}).`;
        break;

      case 21:
        content = `Enseignement pour l’Église : implications communautaires concrètes.`;
        break;

      case 22:
        content = `Enseignement pour la famille : transmission de la foi, pratiques à la maison.`;
        break;

      case 23:
        content = `Enseignement pour enfants : message simple, activités / récits possibles.`;
        break;

      case 24:
        content = `Application missionnaire : comment ce texte éclaire l’annonce de l’Évangile.`;
        break;

      case 25:
        content = `Application pastorale : repères pour l’accompagnement et l’enseignement.`;
        break;

      case 26:
        content = `Application personnelle : examen de conscience et décisions concrètes.`;
        break;

      case 27:
        content = `Versets à retenir : 3–5 références clefs du chapitre (à compléter).`;
        break;

      case 28:
        content =
          `Seigneur, merci pour la lumière reçue dans ${reference}. ` +
          `Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. ` +
          `Garde-nous dans ta paix. Amen.`;
        break;

      default:
        content = "";
    }

    return { id, title, content };
  });

  return {
    ok: true,
    data: { reference, version, sections },
  };
}

// ---------- OpenAI (optionnel) ----------
async function tryOpenAI({ reference, version, apiKey }) {
  // Modèle en JSON strict : s1..s28
  const schema = {
    type: "object",
    properties: Object.fromEntries(
      Array.from({ length: 28 }, (_, i) => [`s${i + 1}`, { type: "string" }])
    ),
    required: Array.from({ length: 28 }, (_, i) => `s${i + 1}`),
    additionalProperties: false,
  };

  const SYSTEM = `
Tu dois répondre en JSON **strict** uniquement (aucun texte autour), avec **28** clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, style pastoral. Utilise la version ${version} pour les citations.
Correspondance exacte:
s1=>"Prière d’ouverture", s2=>"Canon et testament", ..., s28=>"Prière de fin".
`.trim();

  const USER = `
Référence="${reference}". Donne un contenu utile pour une étude biblique en 28 rubriques.
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER },
    ],
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 300)}`);

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Réponse OpenAI invalide");
  }
  const raw = data?.choices?.[0]?.message?.content || "";
  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new Error("Contenu non-JSON renvoyé par OpenAI");
  }

  const sections = TITLES.map((title, i) => ({
    id: i + 1,
    title,
    content: String(obj[`s${i + 1}`] || "").trim(),
  }));

  return {
    ok: true,
    data: { reference, version, sections },
  };
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    // lecture body/json si POST
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

    // debug/probe : renvoie un petit JSON vite-fait
    if (qp.probe === "1" || body.probe === true) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        ok: true,
        probe: true,
        data: {
          reference: "Genèse 1",
          version: "LSG",
          sections: TITLES.map((t, i) => ({ id: i + 1, title: t, content: "" })),
        },
      });
    }

    // paramètres logiques
    let q = body.q || qp.q;
    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter);
    let version = normalizeVersion(body.version || qp.version || "LSG"); // <-- défaut LSG

    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }
    if (!book) book = "Genèse";
    if (!chapter) chapter = 1;

    const reference = refFrom(book, chapter);

    // Si API Key dispo -> tenter OpenAI, sinon fallback
    const apiKey = process.env.OPENAI_API_KEY;
    let out;

    if (apiKey) {
      try {
        out = await tryOpenAI({ reference, version, apiKey });
      } catch (e) {
        // en cas d'échec OpenAI -> fallback propre
        out = fallbackStudy({ reference, version });
        res.setHeader("X-OpenAI-Error", String(e?.message || e));
      }
    } else {
      out = fallbackStudy({ reference, version });
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json(out);
  } catch (e) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      data: {
        reference: "Genèse 1",
        version: "LSG",
        sections: TITLES.map((t, i) => ({
          id: i + 1,
          title: t,
          content:
            i === 0
              ? "Père céleste, merci de bénir cette lecture. Amen."
              : "",
        })),
      },
      error: String(e?.message || e),
    });
  }
}

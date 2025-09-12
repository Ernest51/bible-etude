// api/generate-study.js
// POST /api/generate-study
// Body: { passage: "Genèse 1", options?: { length?: 1500|2200|3000, translation?: "LSG"|"JND"|... } }
// Réponse: { study:{ sections:[{id,title,description,content}] }, metadata:{...} }

export const config = { runtime: "nodejs" };

/* ------------------------- Utils HTTP ------------------------- */
function setCommon(res) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  res.setHeader("cache-control", "no-store, max-age=0");
}
function send(res, status, payload) {
  setCommon(res);
  res.statusCode = status;
  res.end(JSON.stringify(payload, null, 2));
}
const CLEAN = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s([;:,.!?…])/g, "$1")
    .trim();

/* ------------------------- Passage parsing ------------------------- */
const BOOK_MAP = {
  "genèse": "Genèse",
  "gen": "Genèse",
  "exo": "Exode",
  "exode": "Exode",
  // (si besoin: compléter la map — pas requis pour le flux actuel)
};
function parsePassage(raw = "") {
  const t = String(raw).trim();
  // Formats tolérés : "Genèse 1", "GEN 1", "Gen 1"
  const m = t.match(/^([A-Za-zÉÈÊËÀÂÎÏÔÖÙÛÜÇéèêëàâîïôöùûüç' \.-]+)\s+(\d{1,3})\s*$/);
  if (!m) return null;
  const bookRaw = m[1].trim();
  const chapter = parseInt(m[2], 10);
  const key = bookRaw.toLowerCase().replace(/\./g, "").trim();
  const book = BOOK_MAP[key] || bookRaw; // on garde tel quel si non mappé
  return { book, chapter };
}

/* ------------------------- Récup versets (local d'abord) ------------------------- */
async function getVersesLocal(req, { book, chapter, count = 200 }) {
  try {
    const base = `http://${req.headers.host}`;
    const url = new URL(`/api/verses`, base);
    url.searchParams.set("book", book);
    url.searchParams.set("chapter", String(chapter));
    url.searchParams.set("count", String(count));

    const r = await fetch(url.toString(), { headers: { accept: "application/json" } });
    const j = await r.json();
    if (j?.ok && Array.isArray(j.verses)) return j;
  } catch (_) {}
  return null;
}

/* ------------------------- Aides de rédaction ------------------------- */
function pick(arr, n) {
  const a = [...arr];
  const out = [];
  while (a.length && out.length < n) {
    const i = Math.floor(Math.random() * a.length);
    out.push(a.splice(i, 1)[0]);
  }
  return out;
}
function countChainers(text) {
  const t = text.toLowerCase();
  const tokens = [" et ", " puis ", " alors ", " ensuite ", " et ", " et "];
  return tokens.reduce((acc, w) => acc + (t.split(w).length - 1), 0);
}
function keyThemes(verses) {
  const whole = CLEAN(verses.map(v => v.text).join(" "));
  const themes = [];
  if (/\b(lumi[eè]re|jour|nuit)\b/i.test(whole)) themes.push("Création et motif de la lumière/obscurité");
  if (/\bcr[eé]a|fit|dit|b[eé]nit|vit\b/i.test(whole)) themes.push("Parole efficace et souveraineté de Dieu");
  if (/\bhomme|image de dieu|m[aâ]le et femelle\b/i.test(whole)) themes.push("Anthropologie (imago Dei, vocation)");
  if (/\bmer[s]?|terre|cieux?\b/i.test(whole)) themes.push("Ordre cosmique et séparation");
  if (!themes.length) themes.push("Théologie de la création et providence");
  return themes;
}
function structureOutline(verses) {
  // repère les récurrences "Dieu dit / fit / vit / appela ... soir et matin ..."
  const lines = [];
  verses.forEach(({ v, text }) => {
    const t = text.toLowerCase();
    let tag = null;
    if (/\bdieu dit\b/.test(t)) tag = "Parole créatrice";
    else if (/\bdieu fit\b/.test(t)) tag = "Action divine";
    else if (/\bdieu vit\b/.test(t)) tag = "Évaluation divine (bon)";
    else if (/\bappela\b/.test(t)) tag = "Nomination";
    else if (/soir.*matin|jour\b/.test(t)) tag = "Cadence du jour";
    if (tag) lines.push(`- v.${v} — ${tag}`);
  });
  if (!lines.length) lines.push("- Progression narrative simple (début → fin)");
  return lines.join("\n");
}
function chooseMemoryVerse(verses) {
  // heuristique simple : v.1 ou v.27 ou le plus “thématique”
  const prefer = [1, 27, 31, 3];
  for (const n of prefer) {
    const hit = verses.find(v => v.v === n && CLEAN(v.text).length > 0);
    if (hit) return `${hit.v}. ${hit.text}`;
  }
  const longest = [...verses].sort((a, b) => CLEAN(b.text).length - CLEAN(a.text).length)[0];
  return longest ? `${longest.v}. ${longest.text}` : "—";
}

/* ------------------------- Génération de rubriques ------------------------- */
function buildSections(book, chapter, verses, opts = {}) {
  const version = opts.translation || "LSG";
  const totalVerses = verses.length;
  const plain = verses.map(v => `(${v.v}) ${v.text}`).join(" ");

  const themes = keyThemes(verses);
  const chainerScore = countChainers(plain);
  const memVerse = chooseMemoryVerse(verses);

  const ref = (title) => `### ${title}\n\n*Référence :* ${book} ${chapter}\n`;
  const bullets = (arr) => arr.map((x) => `- ${x}`).join("\n");

  const sections = [
    {
      id: 1,
      title: "Prière d’ouverture",
      description: "",
      content:
        ref("Prière d’ouverture") +
        `Père, nous venons recevoir ta Parole. Ouvre nos yeux sur ${book} ${chapter}, ` +
        `donne-nous l’intelligence spirituelle et conduis-nous à l’obéissance. Amen.`,
    },
    {
      id: 2,
      title: "Canon et testament",
      description: "",
      content:
        ref("Canon et testament") +
        `${book} appartient au **canon biblique** (${version}). Ici, ${book} ${chapter} ouvre la ` +
        `trajectoire canonique qui trouvera son accomplissement en Christ (cf. Col 1:16–17 ; Lc 24:27).`,
    },
    {
      id: 3,
      title: "Questions du chapitre précédent",
      description: "",
      content:
        ref("Questions du chapitre précédent") +
        `1) Quel est le fil conducteur doctrinal dégagé ?\n` +
        `2) Quelles tensions/interrogations le texte laisse-t-il ouvertes ?\n` +
        `3) Quels échos canoniques appellent une vérification (${book} ${chapter} et parallèles) ?\n` +
        `4) Quelle application est restée incomplète et doit être reprise cette semaine ?`,
    },
    {
      id: 4,
      title: "Titre du chapitre",
      description: "",
      content:
        ref("Titre du chapitre") +
        `**Proposition :** « Origine et ordre : Dieu parle et le monde advient ». ` +
        `(${themes.join(" · ")})`,
    },
    {
      id: 5,
      title: "Contexte historique",
      description: "",
      content:
        ref("Contexte historique") +
        `Le texte se présente comme un prologue théologique : il confesse Dieu comme Créateur. ` +
        `Il répond aux cosmologies environnantes par une catéchèse centrée sur la Parole de Dieu.`,
    },
    {
      id: 6,
      title: "Structure littéraire",
      description: "",
      content:
        ref("Structure littéraire") +
        `Indicateurs d’enchaînement (motifs « et / puis / alors » ≈ **${chainerScore}** occurrences) :\n` +
        structureOutline(verses),
    },
    {
      id: 7,
      title: "Genre littéraire",
      description: "",
      content:
        ref("Genre littéraire") +
        `Narration théologique à forte **structure répétitive** (formules : « Dieu dit / fit / vit »), ` +
        `portant un propos doctrinal et cultuel.`,
    },
    {
      id: 8,
      title: "Auteur et généalogie",
      description: "",
      content:
        ref("Auteur et généalogie") +
        `Tradition mosaïque reçue par Israël ; ${book} ouvre la généalogie de la foi et des promesses.`,
    },
    {
      id: 9,
      title: "Verset-clé doctrinal",
      description: "",
      content:
        ref("Verset-clé doctrinal") +
        `**À mettre en avant :** ${memVerse}`,
    },
    {
      id: 10,
      title: "Analyse exégétique",
      description: "",
      content:
        ref("Analyse exégétique") +
        bullets(
          pick(
            verses.map(({ v, text }) => `v.${v} : ${CLEAN(text)}`),
            Math.min(6, totalVerses)
          )
        ),
    },
    {
      id: 11,
      title: "Analyse lexicale",
      description: "",
      content:
        ref("Analyse lexicale") +
        bullets([
          "Motifs clés : « Dieu dit », « Dieu vit », « Dieu appela »",
          "Champs sémantiques : lumière/obscurité, séparation/ordre, bénédiction",
          "Formules refrain : « Et il y eut soir, et il y eut matin »",
        ]),
    },
    {
      id: 12,
      title: "Références croisées",
      description: "",
      content:
        ref("Références croisées") +
        bullets([
          "Jean 1:1–5 (Parole / Lumière)",
          "Colossiens 1:15–17 (Christ et création)",
          "Psaume 33:6–9 (Parole créatrice)",
          "Hébreux 11:3 (Comprendre par la foi)",
        ]),
    },
    {
      id: 13,
      title: "Fondements théologiques",
      description: "",
      content:
        ref("Fondements théologiques") +
        bullets(themes),
    },
    {
      id: 14,
      title: "Thème doctrinal",
      description: "",
      content:
        ref("Thème doctrinal") +
        `**Souveraineté créatrice** : Dieu parle, fait, voit, bénit, nomme — il ordonne le chaos et établit des vocations.`,
    },
    {
      id: 15,
      title: "Fruits spirituels",
      description: "",
      content:
        ref("Fruits spirituels") +
        bullets([
          "Adoration du Créateur",
          "Confiance en la Parole efficace de Dieu",
          "Respect de l’ordre et de la vocation reçus",
        ]),
    },
    {
      id: 16,
      title: "Types bibliques",
      description: "",
      content:
        ref("Types bibliques") +
        bullets([
          "Lumière initiale → anticipation de la lumière messianique",
          "Repos du cycle → prémices du sabbat et du repos en Christ",
        ]),
    },
    {
      id: 17,
      title: "Appui doctrinal",
      description: "",
      content:
        ref("Appui doctrinal") +
        bullets([
          "Création ex nihilo par la Parole",
          "Providence et bonté de la création",
          "Imago Dei et mandat (vocation humaine)",
        ]),
    },
    {
      id: 18,
      title: "Comparaison interne",
      description: "",
      content:
        ref("Comparaison interne") +
        `Comparer les refrains (dit/fit/vit/appela) et les jours — progression du **formé** → **rempli**.`,
    },
    {
      id: 19,
      title: "Parallèle ecclésial",
      description: "",
      content:
        ref("Parallèle ecclésial") +
        `La communauté est appelée à refléter l’ordre et la bonté de Dieu (culte, mission, éthique de la création).`,
    },
    {
      id: 20,
      title: "Verset à mémoriser",
      description: "",
      content:
        ref("Verset à mémoriser") +
        memVerse,
    },
    {
      id: 21,
      title: "Enseignement pour l’Église",
      description: "",
      content:
        ref("Enseignement pour l’Église") +
        bullets([
          "Adorer Dieu comme Créateur",
          "Prêcher la Parole qui crée et recrée",
          "Former aux vocations (travail, soin de la création)",
        ]),
    },
    {
      id: 22,
      title: "Enseignement pour la famille",
      description: "",
      content:
        ref("Enseignement pour la famille") +
        bullets([
          "Rythmer la semaine (travail/repos) selon Dieu",
          "Nommer le bien et s’en réjouir (« Dieu vit que c’était bon »)",
        ]),
    },
    {
      id: 23,
      title: "Enseignement pour enfants",
      description: "",
      content:
        ref("Enseignement pour enfants") +
        bullets([
          "Dieu a tout créé par sa parole",
          "La lumière/obscurité : Dieu sépare et protège",
          "Nous sommes à l’image de Dieu (précieux/présents pour Dieu)",
        ]),
    },
    {
      id: 24,
      title: "Application missionnaire",
      description: "",
      content:
        ref("Application missionnaire") +
        bullets([
          "Annoncer le Dieu Créateur dans une culture plurielle",
          "Relier création, rédemption et espérance nouvelle",
        ]),
    },
    {
      id: 25,
      title: "Application pastorale",
      description: "",
      content:
        ref("Application pastorale") +
        bullets([
          "Accompagner sur le sens du travail et du repos",
          "Guider vers une écologie de la bonté (soin de la création)",
        ]),
    },
    {
      id: 26,
      title: "Application personnelle",
      description: "",
      content:
        ref("Application personnelle") +
        bullets([
          "Prendre un temps d’adoration/lecture chaque jour",
          "Nommer une décision concrète pour refléter l’ordre/bonté de Dieu",
        ]),
    },
    {
      id: 27,
      title: "Versets à retenir",
      description: "",
      content:
        ref("Versets à retenir") +
        bullets(
          pick(
            verses.map(({ v, text }) => `${book} ${chapter}:${v} — ${CLEAN(text)}`),
            Math.min(4, totalVerses)
          )
        ),
    },
    {
      id: 28,
      title: "Prière de fin",
      description: "",
      content:
        ref("Prière de fin") +
        `Dieu Créateur, merci pour ta Parole qui met l’ordre et donne la vie. ` +
        `Affermis en nous l’obéissance et la louange. Amen.`,
    },
  ];

  return sections;
}

/* ------------------------- Handler ------------------------- */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method Not Allowed" });

  try {
    const body = await readBodyJSON(req);
    const passage = body?.passage || "";
    const options = body?.options || {};
    const parsed = parsePassage(passage);
    if (!parsed) {
      return send(res, 400, {
        ok: false,
        error: "Passage invalide. Exemple: \"Genèse 1\"",
      });
    }
    const { book, chapter } = parsed;

    // 1) Priorité: endpoint local /api/verses
    const local = await getVersesLocal(req, { book, chapter, count: 200 });

    let verses = [];
    let source = "fallback-generated";
    let usedLocalVerses = false;
    let usedApiBible = false;
    const diagnostics = [];

    if (local?.ok && Array.isArray(local.verses) && local.verses.length) {
      verses = local.verses.map(({ v, text }) => ({ v, text: CLEAN(text || "") }));
      source = String(local.source || "api.local");
      usedLocalVerses = true;
      usedApiBible = /api\.bible/i.test(source); // si notre /api/verses a tiré depuis api.bible
    } else {
      diagnostics.push("local_verses_empty");
      // Fallback propre: sections générées sans texte brut
      verses = Array.from({ length: 8 }, (_, i) => ({ v: i + 1, text: "" }));
    }

    const sections = buildSections(book, chapter, verses, options);

    return send(res, 200, {
      ok: true,
      study: { sections },
      metadata: {
        book,
        chapter,
        version: options.translation || (local?.version || "LSG"),
        generatedAt: new Date().toISOString(),
        source,
        usedLocalVerses,
        usedApiBible,
        verseCount: verses.filter((x) => CLEAN(x.text).length > 0).length,
        diagnostics,
      },
    });
  } catch (e) {
    return send(res, 500, {
      ok: false,
      error: String(e?.message || e),
    });
  }
}

/* ------------------------- Body reader ------------------------- */
async function readBodyJSON(req) {
  const chunks = [];
  for await (const ch of req) chunks.push(ch);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    // Autorise `application/x-www-form-urlencoded` minimal
    const m = raw.match(/passage=([^&]+)/);
    if (m) {
      return { passage: decodeURIComponent(m[1].replace(/\+/g, " ")) };
    }
    throw new Error('Payload JSON invalide (attendu: { "passage": "Genèse 1" })');
  }
}

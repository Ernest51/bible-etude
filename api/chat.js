// api/chat.js — API JSON (28 rubriques), robuste + garde-fous “anti-versets”

// --------- petites utilitaires ----------
function parseQ(q) {
  if (!q) return { book: "", chapter: NaN };
  const m = String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m
    ? { book: m[1].trim(), chapter: Number(m[2]) }
    : { book: String(q).trim(), chapter: NaN };
}

const BOOKS = [
  ["Genèse", 50], ["Exode", 40], ["Lévitique", 27], ["Nombres", 36], ["Deutéronome", 34],
  ["Josué", 24], ["Juges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
  ["1 Rois", 22], ["2 Rois", 25], ["1 Chroniques", 29], ["2 Chroniques", 36], ["Esdras", 10],
  ["Néhémie", 13], ["Esther", 10], ["Job", 42], ["Psaumes", 150], ["Proverbes", 31],
  ["Ecclésiaste", 12], ["Cantique des cantiques", 8], ["Ésaïe", 66], ["Jérémie", 52], ["Lamentations", 5],
  ["Ézéchiel", 48], ["Daniel", 12], ["Osée", 14], ["Joël", 3], ["Amos", 9],
  ["Abdias", 1], ["Jonas", 4], ["Michée", 7], ["Nahoum", 3], ["Habacuc", 3],
  ["Sophonie", 3], ["Aggée", 2], ["Zacharie", 14], ["Malachie", 4],
  ["Matthieu", 28], ["Marc", 16], ["Luc", 24], ["Jean", 21], ["Actes", 28],
  ["Romains", 16], ["1 Corinthiens", 16], ["2 Corinthiens", 13], ["Galates", 6], ["Éphésiens", 6],
  ["Philippiens", 4], ["Colossiens", 4], ["1 Thessaloniciens", 5], ["2 Thessaloniciens", 3], ["1 Timothée", 6],
  ["2 Timothée", 4], ["Tite", 3], ["Philémon", 1], ["Hébreux", 13], ["Jacques", 5],
  ["1 Pierre", 5], ["2 Pierre", 3], ["1 Jean", 5], ["2 Jean", 1], ["3 Jean", 1],
  ["Jude", 1], ["Apocalypse", 22],
];

const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
  "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
];

// --------- fallback local (sans OpenAI) ----------
function fallbackStudy(book, chapter, version = "LSG") {
  const ref = `${book} ${chapter}`;
  const secs = [];

  // Contenu synthétique minimal, 2–4 phrases par section (tu peux enrichir si tu veux)
  const base = [
    `Seigneur, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Esprit et conduis-nous dans ta vérité. Amen.`,
    `Le livre de ${book} appartient au canon biblique (tradition: ${BOOKS.find(b => b[0] === book) ? "Ancien" : "Nouveau"} Testament).`,
    `À préparer par l’animateur : au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`,
    `${book} ${chapter} — Titre doctrinal synthétique, centré sur l’action de Dieu et la vocation de l’homme.`,
    `Contexte: ${book} situe la foi d’Israël dans l’histoire. ${ref} affirme la souveraineté de Dieu et le sens donné au monde.`,
    `Structure (exemple): progression ordonnée, refrains, contrastes, et un sommet théologique clairement identifié.`,
    `Genre: narratif théologique avec portée liturgique et doctrinale.`,
    `Auteur (tradition) et liens aux patriarches; place dans l’ensemble du Pentateuque / corpus.`,
    `Verset-clé recommandé de ${ref}. Cite brièvement une clause (“…”) puis explique sa portée (LSG).`,
    `Analyse: mots répétés, parallélismes, motifs (lumière/tenèbres, parole/obéissance, bénédiction/repos).`,
    `Lexique: termes hébreux/grecs clés, nuance sémantique et portée doctrinale pour la vie de l’Église.`,
    `Références croisées: Jean 1; Col 1; Hé 11, etc. Montre l’unité biblique du thème.`,
    `Fondements: Dieu Créateur/Sauveur, dignité humaine, mandat, sabbat, alliance.`,
    `Thème: Dieu ordonne le chaos, confère vocation et bénédiction, oriente l’histoire vers sa gloire.`,
    `Fruits: gratitude, responsabilité, humilité, espérance, adoration.`,
    `Types: repos/sabbat, lumière, terre/jardin, image de Dieu, etc.`,
    `Appuis: Ps 8; Ps 104; Ap 4:11; Rom 1:20…`,
    `Comparer plusieurs versets-clés du chapitre (ouverture, refrain “bon”, repos).`,
    `Avec Actes 2: Parole, lumière, communauté ordonnée par l’Esprit (nouvelle création).`,
    `Verset à mémoriser: ${book} ${chapter}:1 — cite court et explique (LSG).`,
    `Église: confesser Dieu Créateur, protéger la dignité, sanctifier le temps (travail/repos).`,
    `Famille: transmettre la bonté de la création, éduquer à la gérance responsable.`,
    `Enfants: Dieu a tout fait; nous sommes précieux; prenons soin de la terre.`,
    `Mission: annoncer un Auteur et un sens; relier à Christ (Col 1).`,
    `Pastoral: accompagner le doute de valeur; prêcher une écologie biblique.`,
    `Personnel: examen de conscience, décisions concrètes, prière d’obéissance.`,
    `À retenir: 3–5 références essentielles et leurs leçons (simples à redire).`,
    `Père, merci pour ta Parole. Aide-nous à mettre en pratique ${ref}. Garde-nous dans ta paix. Amen.`
  ];

  for (let i = 0; i < 28; i++) {
    secs.push({ id: i + 1, title: TITLES[i] || "", content: base[i] || "" });
  }

  return { reference: ref, version, sections: secs };
}

// --------- appel OpenAI JSON strict + garde-fous ----------
async function askOpenAI_JSON({ book, chapter, version, apiKey, signal }) {
  const SYSTEM = `
Tu DOIS répondre en JSON STRICT (aucun texte hors JSON), avec exactement 28 clés: "s1"..."s28".
Langue: français, style pastoral clair (3–6 phrases par section).
INTERDIT:
- Copier/coller les versets ou produire une suite de versets.
- Lists de versets; tu écris de l'analyse/synthèse.
- Sections vides.

Mappage (ne renvoie pas les titres, seulement le contenu des rubriques):
s1:Prière d’ouverture
s2:Canon et testament
s3:Questions du chapitre précédent
s4:Titre du chapitre
s5:Contexte historique
s6:Structure littéraire
s7:Genre littéraire
s8:Auteur et généalogie
s9:Verset-clé doctrinal
s10:Analyse exégétique
s11:Analyse lexicale
s12:Références croisées
s13:Fondements théologiques
s14:Thème doctrinal
s15:Fruits spirituels
s16:Types bibliques
s17:Appui doctrinal
s18:Comparaison entre versets
s19:Comparaison avec Actes 2
s20:Verset à mémoriser
s21:Enseignement pour l’Église
s22:Enseignement pour la famille
s23:Enseignement pour enfants
s24:Application missionnaire
s25:Application pastorale
s26:Application personnelle
s27:Versets à retenir
s28:Prière de fin

Références:
- Tu peux citer brièvement 1–2 références au format "Genèse 1:1 (${version})".
- Jamais de longs blocs cités.
`.trim();

  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Renvoie UNIQUEMENT un JSON valide avec "s1"..."s28" remplis (3–6 phrases chacun).
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.4,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal,
  });

  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0, 200)}`);

  let data;
  try { data = JSON.parse(text); }
  catch { throw new Error("Réponse OpenAI invalide (JSON)"); }

  const raw = data?.choices?.[0]?.message?.content || "";
  let obj;
  try { obj = JSON.parse(raw); }
  catch { throw new Error("Contenu non-JSON renvoyé par OpenAI"); }

  // Validation / remplissage et garde-fous “anti-versets”
  for (let i = 1; i <= 28; i++) {
    const k = `s${i}`;
    if (typeof obj[k] !== "string" || !obj[k].trim()) throw new Error(`Champ manquant ${k}`);
  }

  const joined = Object.values(obj).join("\n");
  const refs = (joined.match(/\b\d{1,3}:\d{1,3}\b/g) || []).length;
  const lines = joined.split(/\r?\n/).length;
  const avgLen = joined
    .split(/[.!?]/)
    .map(s => s.trim().split(/\s+/).length)
    .filter(n => n > 0);
  const meanWords = avgLen.length ? avgLen.reduce((a, b) => a + b, 0) / avgLen.length : 0;

  // Heuristiques: si ça ressemble trop à un dump de versets, on rejette pour forcer un retry par l'appelant
  if (refs > 15 || lines > 200 || meanWords < 5) {
    throw new Error("Réponse détectée comme 'versets bruts'");
  }

  const sections = Array.from({ length: 28 }, (_, k) => ({
    id: k + 1,
    title: "", // on ne renvoie que le contenu, les titres sont gérés côté UI
    content: obj[`s${k + 1}`].trim()
  }));

  return { reference: `${book} ${chapter}`, version, sections };
}

// --------- handler principal ----------
export default async function handler(req, res) {
  try {
    // 1) Récupération des paramètres
    let body = {};
    if (req.method === "POST") {
      body = await new Promise((resolve) => {
        let b = "";
        req.on("data", c => b += c);
        req.on("end", () => {
          try { resolve(JSON.parse(b || "{}")); }
          catch { resolve({}); }
        });
      });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const qp = Object.fromEntries(url.searchParams.entries());

    // Support du POST probe (debug)
    if (req.method === "POST" && body.probe) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({ ok: true, probe: true });
    }

    // On accepte q="Genèse 1" ou { book, chapter, version }
    let book = body.book || qp.book;
    let chapter = Number(body.chapter || qp.chapter);
    let version = (body.version || qp.version || "LSG").trim() || "LSG";
    const q = body.q || qp.q;

    if ((!book || !chapter) && q) {
      const p = parseQ(q);
      book = book || p.book;
      chapter = chapter || p.chapter;
    }

    // Valeurs par défaut raisonnables
    if (!book) book = "Genèse";
    if (!chapter || Number.isNaN(chapter)) chapter = 1;

    const apiKey = process.env.OPENAI_API_KEY;

    // 2) Sans clé → fallback local
    if (!apiKey) {
      const data = fallbackStudy(book, chapter, version);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({ ok: true, source: "fallback", data });
    }

    // 3) Avec clé → on tente OpenAI (avec retry si “versets bruts”)
    let data, lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20000);
        data = await askOpenAI_JSON({ book, chapter, version, apiKey, signal: controller.signal });
        clearTimeout(timer);
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        // si c'est notre garde-fou, on ré-essaie
        if (String(e.message || e).includes("versets bruts")) {
          continue;
        } else {
          break;
        }
      }
    }

    if (!data) {
      // OpenAI a échoué → fallback
      const fb = fallbackStudy(book, chapter, version);
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.status(200).json({
        ok: true,
        source: "fallback",
        error: lastErr ? String(lastErr.message || lastErr) : undefined,
        data: fb
      });
    }

    // 4) Réponse JSON standard
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({ ok: true, source: "openai", data });

  } catch (e) {
    // Sécurité: dernier rempart
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.status(200).json({
      ok: true,
      source: "fallback",
      fatal: String(e?.message || e),
      data: fallbackStudy("Genèse", 1, "LSG")
    });
  }
}

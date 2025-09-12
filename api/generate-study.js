// /api/generate-study.js
// Génération d’une étude 1–28, en priorisant le contenu réel via /api/verses,
// puis fallback api.scripture.api.bible si besoin. Sortie sans "Contenu de base (fallback)".

export const config = { runtime: "nodejs" };

/* -------------------- Constantes & ENV -------------------- */
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const BIBLE_ID =
  process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || process.env.DARBY_BIBLE_ID || "";

const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

/* -------------------- Utilitaires HTTP -------------------- */
function json(res, status, body, { cache = "no-store" } = {}) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", cache === "no-store" ? "no-store, max-age=0" : cache);
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
async function readBody(req) {
  if (typeof req?.json === "function") try { return await req.json(); } catch {}
  if (req?.body && typeof req.body === "object") return req.body;
  const chunks = [];
  await new Promise((res, rej) => {
    req.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on("end", res);
    req.on("error", rej);
  });
  const raw = Buffer.concat(chunks).toString("utf8");
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}
function getOrigin(req) {
  const host = req?.headers?.host;
  if (!host) return "";
  const proto = host.includes("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}
const CLEAN = (s) =>
  String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s([;:,.!?…])/g, "$1")
    .trim();

/* -------------------- Fetch helpers -------------------- */
async function fetchJson(url, { headers = {}, timeout = 10000 } = {}) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { headers, signal: ctrl.signal });
    const t = await r.text();
    let j; try { j = t ? JSON.parse(t) : {}; } catch { j = { raw: t }; }
    if (!r.ok) { const e = new Error(j?.error?.message || `HTTP ${r.status}`); e.status = r.status; e.details = j; throw e; }
    return j;
  } finally { clearTimeout(tid); }
}

/* -------------------- Plan A : /api/verses (local) -------------------- */
async function fetchVersesLocal(req, book, chap, { count = 200, timeout = 10000 } = {}) {
  const origin = getOrigin(req);
  if (!origin) return { ok: false, verses: [], source: "no-origin" };
  const url = new URL("/api/verses", origin);
  url.searchParams.set("book", book);
  url.searchParams.set("chapter", String(chap));
  url.searchParams.set("count", String(count));

  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url.toString(), { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (j?.ok && Array.isArray(j?.verses) && j.verses.length) {
      return {
        ok: true,
        verses: j.verses
          .filter(x => Number.isFinite(x?.v) && typeof x?.text === "string")
          .map(x => ({ v: x.v, text: CLEAN(x.text) })),
        source: j?.source || "local"
      };
    }
    return { ok: false, verses: [], source: "local-empty" };
  } catch {
    return { ok: false, verses: [], source: "local-error" };
  } finally { clearTimeout(tid); }
}

/* -------------------- Plan B : api.bible (chapitre/verses) -------------------- */
async function fetchChapterApiBible(book, chap) {
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error("API_BIBLE_KEY/ID manquants ou livre non mappé");
  const headers = { accept: "application/json", "api-key": KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // Verses list
  try {
    const list = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000 });
    const items = Array.isArray(list?.data) ? list.data : [];
    if (items.length) {
      const verses = [];
      // récupérer chaque verset
      for (const it of items) {
        const url = new URL(`${API_ROOT}/bibles/${BIBLE_ID}/verses/${it.id}`);
        url.searchParams.set("content-type", "text");
        url.searchParams.set("include-verse-numbers", "false");
        url.searchParams.set("include-notes", "false");
        url.searchParams.set("include-titles", "false");
        try {
          const vj = await fetchJson(url.toString(), { headers, timeout: 10000 });
          const d = vj?.data || {};
          const text = CLEAN(d?.text || d?.content || "");
          // numéro à partir de reference
          let vNum;
          const m = String(d?.reference || it?.reference || "").match(/:(\d{1,3})$/);
          if (m) vNum = parseInt(m[1], 10);
          if (text && Number.isFinite(vNum)) verses.push({ v: vNum, text });
        } catch { /* continue */ }
      }
      verses.sort((a, b) => a.v - b.v);
      if (verses.length) return { ok: true, verses, usedApiBible: true };
    }
  } catch { /* ignore list errors */ }

  // Fallback: chapitre entier + découpe
  const chUrl = new URL(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${USFM[book]}.${chap}`);
  chUrl.searchParams.set("content-type", "text");
  chUrl.searchParams.set("include-verse-numbers", "true");
  chUrl.searchParams.set("include-notes", "false");
  chUrl.searchParams.set("include-titles", "false");
  try {
    const ch = await fetchJson(chUrl.toString(), { headers, timeout: 12000 });
    const content = CLEAN(ch?.data?.content || "");
    const out = [];
    if (content) {
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) out.push({ v: +m[1], text: CLEAN(m[2]) });
    }
    return { ok: !!out.length, verses: out, usedApiBible: true };
  } catch (e) {
    return { ok: false, verses: [], error: e?.message || "chapter_text_400", usedApiBible: false };
  }
}

/* -------------------- Noyau: génération de rubriques -------------------- */
function pickKeyVerse(verses) {
  if (!Array.isArray(verses) || !verses.length) return null;
  // pondération simple (mots doctrinaux + longueur lisible)
  const PRIOR = ["dieu","seigneur","christ","jésus","parole","esprit","foi","grâce","salut","alliance","vérité","vie"];
  let best = { v: null, text: "", score: -1 };
  for (const { v, text } of verses) {
    const t = text.toLowerCase();
    let s = 0;
    for (const w of PRIOR) if (t.includes(w)) s += 3;
    const L = text.length; if (L >= 50 && L <= 200) s += 4; else if (L >= 30 && L <= 260) s += 2;
    if (s > best.score) best = { v, text, score: s };
  }
  return best.v ? best : null;
}
function joinVersesRange(verses, maxChars = 400) {
  const buf = [];
  let len = 0;
  for (const { v, text } of verses) {
    const seg = `${v}. ${text}`;
    if (len + seg.length > maxChars && buf.length) break;
    buf.push(seg); len += seg.length + 1;
  }
  return buf.join(" ");
}

// Générateur concis, différent par rubrique, sans doublons “fallback”
function buildSections(book, chap, verses) {
  const key = pickKeyVerse(verses);
  const opening = `*Référence :* ${book} ${chap}`;
  const excerpt = key ? `> **Verset-clé** (${book} ${chap}:${key.v}) — ${key.text}` : "";
  const firstLines = joinVersesRange(verses.slice(0, 4), 360);

  const titles = [
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre","Contexte historique",
    "Structure littéraire","Genre littéraire","Auteur et généalogie","Verset-clé doctrinal","Analyse exégétique",
    "Analyse lexicale","Références croisées","Fondements théologiques","Thème doctrinal","Fruits spirituels",
    "Types bibliques","Appui doctrinal","Comparaison interne","Parallèle ecclésial","Verset à mémoriser",
    "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants","Application missionnaire",
    "Application pastorale","Application personnelle","Versets à retenir","Prière de fin"
  ];

  const out = [];

  titles.forEach((t, i) => {
    let content = `### ${t}\n\n${opening}\n\n`;
    switch (i + 1) {
      case 1: // prière d’ouverture
        content += `Père des lumières, nous recevons ta Parole avec foi. Par ton Esprit, rends-nous attentifs à ${book} ${chap}, pour que l’écoute devienne obéissance. ${excerpt ? "\n\n" + excerpt : ""}`;
        break;
      case 2: // canon
        content += `L’Écriture interprète l’Écriture : ${book} ${chap} s’inscrit dans l’unité des deux Testaments, dont le centre est le Christ. ${excerpt}`;
        break;
      case 3: // questions (avec réponses courtes)
        content += `1) **Fil doctrinal** : Dieu parle et ordonne, sa Parole crée et structure.\n2) **Tensions** : ce que le texte ne dit pas explicitement (chronologie fine, procédés) n’annule pas l’essentiel révélé.\n3) **Échos canoniques** : Jn 1, Col 1, Hé 11 éclairent ${book} ${chap}.\n4) **À reprendre** : prière et mise en pratique concrète cette semaine.`;
        break;
      case 4: // titre
        content += `Proposition : **${book} ${chap} — Dieu parle et met en ordre**. Premières lignes : ${firstLines || "lecture attentive du texte."}`;
        break;
      case 5: // contexte
        content += `Cadre : ouverture du livre, visée catéchétique et liturgique ; Dieu se révèle Créateur et Seigneur. ${excerpt}`;
        break;
      case 6: // structure
        content += `Repérer les **enchaînements** (“et… puis…”) et les **séparations** (lumière/ténèbres, eaux/terre) qui rythment la progression.`;
        break;
      case 7: // genre
        content += `Récit théologique fondateur, à lire avec méthode **grammatico-historique** et l’analogie de la foi.`;
        break;
      case 8: // auteur/généalogie
        content += `Tradition mosaïque pour la Torah ; l’autorité vient de l’inspiration divine, non d’un nom d’auteur seulement.`;
        break;
      case 9: // verset-clé doctrinal
        content += key ? `Sélection : ${book} ${chap}:${key.v}. Doctrine : Dieu parle, sa Parole est efficace et bonne.` : `Choisir un verset bref et mémorisable.`;
        break;
      case 10: // exégèse
        content += `Observation → Interprétation → Application. Relever verbes divins (“dit”, “fit”, “vit”), noms, parallélismes, et déduire le propos central.`;
        break;
      case 11: // lexicale
        content += `Mots porteurs : “Dieu”, “dit”, “lumière”, “sépara”, “appela”. Leur usage oriente le sens et l’application.`;
        break;
      case 12: // refs croisées
        content += `Jn 1:1–3 ; Hé 11:3 ; Col 1:16–17 ; Ps 33:6. Lire l’Écriture par l’Écriture pour garder la cohérence.`;
        break;
      case 13: // fondements
        content += `Création ex nihilo, bonté de l’ordre divin, Parole efficace, providence.`;
        break;
      case 14: // thème doctrinal
        content += `**Parole et ordre** : Dieu parle, crée, nomme et sépare. La création manifeste sa gloire.`;
        break;
      case 15: // fruits
        content += `Adoration (Dieu est bon), confiance (sa Parole tient), service (ordonner nos vies selon sa volonté).`;
        break;
      case 16: // types
        content += `Lumière originelle → lumière du Christ (2 Co 4:6). Repos → sabbat/Christ, accomplissement.`;
        break;
      case 17: // appui doctrinal
        content += `Confessions historiques : autorité, suffisance et clarté de l’Écriture ; Dieu Créateur et Providence.`;
        break;
      case 18: // comparaison interne
        content += `Comparer les jours, les verbes répétés, les formules (“Dieu dit… il y eut soir et matin”).`;
        break;
      case 19: // ecclésial
        content += `Culte : lecture publique, louange pour la création, prière de consécration du travail et du repos.`;
        break;
      case 20: // verset à mémoriser
        content += key ? `${book} ${chap}:${key.v}` : `Choisir un verset court (≤ 20 mots).`;
        break;
      case 21: // Église
        content += `Former à écouter la Parole, à travailler avec droiture, à sanctifier le temps (travail/repos).`;
        break;
      case 22: // famille
        content += `Transmission : lire, prier, pratiquer la justice au quotidien ; bénir Dieu pour sa création.`;
        break;
      case 23: // enfants
        content += `Dieu parle et le monde obéit : activité simple (nommer, classer, remercier Dieu).`;
        break;
      case 24: // mission
        content += `Annoncer le Créateur bon et vivant, dénoncer les idoles du hasard et du chaos.`;
        break;
      case 25: // pastorale
        content += `Accompagner dans l’ordre de vie : temps, travail, repos, parole vraie et promesse tenue.`;
        break;
      case 26: // personnelle
        content += `Décision concrète aujourd’hui : une obéissance simple à la Parole entendue (temps de prière, service, repos sanctifié).`;
        break;
      case 27: // versets à retenir
        content += key
          ? `Commencer par ${book} ${chap}:${key.v}. Ajouter un second verset bref pour la semaine.`
          : `Sélectionner 2–3 versets courts et clairs.`;
        break;
      case 28: // prière de fin
        content += `Nous te rendons grâce : scelle ta Parole dans nos cœurs ; fais-nous vivre selon ton ordre et ta lumière. Amen.`;
        break;
      default:
        content += excerpt;
    }
    out.push({ id: i + 1, title: t, description: "", content });
  });

  return out;
}

/* -------------------- Bâtisseur principal -------------------- */
function parsePassage(p) {
  const m = /^(.+?)\s+(\d+)(?:\s.*)?$/.exec(String(p || "").trim());
  return { book: m ? m[1].trim() : "Genèse", chap: m ? parseInt(m[2], 10) : 1 };
}
function normalizeTotal(len) {
  const n = Number(len);
  if (n === 1500 || n === 500) return 1500;
  if (n >= 1500 && n <= 3000) return n;
  return 2200;
}

async function buildStudyWithRealVerses(req, passage, length, version = "LSG") {
  const total = normalizeTotal(length);
  const { book, chap } = parsePassage(passage || "Genèse 1");

  const meta = { book, chapter: chap, version, diagnostics: [] };

  // Plan A: local /api/verses
  const local = await fetchVersesLocal(req, book, chap, { count: 220 });
  let verses = [];
  let usedLocal = false;
  let usedApiBible = false;

  if (local.ok && local.verses.length) {
    verses = local.verses;
    usedLocal = true;
  } else {
    meta.diagnostics.push(`local_${local.source || "fail"}`);
    // Plan B: api.bible
    const ab = await fetchChapterApiBible(book, chap);
    if (ab.ok && ab.verses.length) {
      verses = ab.verses;
      usedApiBible = !!ab.usedApiBible;
    } else {
      meta.diagnostics.push(ab?.error || "chapter_text_400");
    }
  }

  if (!verses.length) {
    // Rien à afficher ? On garde le site fonctionnel: sections sobres mais non vides
    const sections = buildSections(book, chap, []);
    return {
      study: { sections },
      metadata: { ...meta, verseCount: 0, usedLocalVerses: usedLocal, usedApiBible, generatedAt: new Date().toISOString() }
    };
  }

  const sections = buildSections(book, chap, verses);
  return {
    study: { sections },
    metadata: {
      ...meta,
      verseCount: verses.length,
      usedLocalVerses: usedLocal,
      usedApiBible,
      totalBudget: total,
      generatedAt: new Date().toISOString()
    }
  };
}

/* -------------------- Handler HTTP -------------------- */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      route: "/api/generate-study",
      hint:
        'POST { "passage":"Genèse 1", "options":{ "length":1500|2200|3000, "translation":"LSG|JND|..." } }'
    });
  }
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Method Not Allowed" });

  try {
    const body = await readBody(req);
    const passage = String(body?.passage || "").trim() || "Genèse 1";
    const length = Number(body?.options?.length);
    const version = String((body?.options?.translation || "LSG")).toUpperCase();

    const out = await buildStudyWithRealVerses(req, passage, length, version);
    return json(res, 200, out);
  } catch (e) {
    return json(res, 200, {
      study: { sections: [] },
      metadata: { emergency: true, error: String(e?.message || e) }
    });
  }
}

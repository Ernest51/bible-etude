// /api/study-28.js
// Étude en 28 rubriques — LLM-FREE — basé uniquement sur api.bible
// ENV requis: API_BIBLE_KEY  | optionnel: API_BIBLE_ID (bible par défaut)

export const config = { runtime: "nodejs18.x" };

// ---------- utils HTTP ----------
function send(res, status, payload) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(payload, null, 2));
  } catch {
    try { res.end('{"ok":false,"warn":"send_failed"}'); } catch {}
  }
}
const clip = (s, max=240) => {
  const t = String(s||"").replace(/\s+/g," ").trim();
  return t.length > max ? t.slice(0,max-1).trimEnd()+"…" : t;
};
const firstSentence = (s) => {
  const clean = String(s||"").replace(/\s+/g," ").trim();
  const m = clean.match(/(.+?[.!?])(\s|$)/u);
  return m ? m[1].trim() : clip(clean, 180);
};

// ---------- api.bible client minimal ----------
const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID = process.env.API_BIBLE_ID || "";

async function callApi(endpoint, { params={} } = {}) {
  if (!KEY) {
    const e = new Error("API_BIBLE_KEY missing");
    e.status = 500; throw e;
  }
  const url = new URL(API_ROOT + endpoint);
  for (const [k,v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k,String(v));
  }
  const r = await fetch(url, { headers: { accept:"application/json", "api-key": KEY } });
  const text = await r.text();
  let j; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }
  if (!r.ok) {
    const e = new Error(j?.error?.message || `api.bible ${r.status}`);
    e.status = r.status; e.details = j; throw e;
  }
  return j?.data ?? j;
}

async function resolveBibleId(explicitId) {
  if (explicitId) return explicitId;
  if (DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;
  const bibles = await callApi("/bibles");
  if (!Array.isArray(bibles) || bibles.length === 0) throw new Error("No bibles available");
  const fr = bibles.find(b => (b.language?.name||"").toLowerCase().startsWith("fr"));
  return (fr && fr.id) || bibles[0].id;
}

// normalisation douce pour faire matcher le nom FR du livre
const norm = (s) => String(s||"")
  .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/[^a-z0-9 ]+/g," ")
  .replace(/\s+/g," ").trim();

async function resolveBookId(bibleId, bookName) {
  const books = await callApi(`/bibles/${bibleId}/books`);
  const target = norm(bookName);
  // match exact title
  let hit = books.find(b => norm(b.name) === target || norm(b.abbreviationLocal) === target || norm(b.abbreviation) === target);
  if (!hit) {
    // match startsWith
    hit = books.find(b => norm(b.name).startsWith(target) || norm(b.abbreviationLocal).startsWith(target));
  }
  if (!hit) {
    // includes (dernier recours)
    hit = books.find(b => norm(b.name).includes(target));
  }
  if (!hit) throw new Error(`Book not found: ${bookName}`);
  return hit.id; // OSIS ex: GEN
}

async function getPassage({ bibleId, bookName, chapter, verse="" }) {
  const bookId = await resolveBookId(bibleId, bookName);
  // Ref OSIS: GEN.1  ou  GEN.1.1-5
  const ref = `${bookId}.${String(chapter)}` + (verse ? `.${String(verse)}` : "");
  const params = {
    "content-type": "html",
    "include-notes": false,
    "include-titles": true,
    "include-chapter-numbers": true,
    "include-verse-numbers": false,
    "include-verse-spans": false,
    "use-org-id": false,
  };
  const data = await callApi(`/bibles/${bibleId}/passages/${encodeURIComponent(ref)}`, { params });
  const contentHtml = data?.content || "";
  const reference = data?.reference || `${bookName} ${chapter}${verse?':'+verse:''}`;
  const plain = contentHtml
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { osis: ref, reference, html: contentHtml, text: plain };
}

// ---------- Génération des rubriques (sans IA) ----------
const TITLES_FULL = [
  "Thème central","Résumé en une phrase","Contexte historique","Auteur et date","Genre littéraire",
  "Structure du passage","Plan détaillé","Mots-clés","Termes clés (définis)","Personnages et lieux",
  "Problème / Question de départ","Idées majeures (développement)","Verset pivot (climax)",
  "Références croisées (AT)","Références croisées (NT)","Parallèles bibliques",
  "Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
  "Principes intemporels","Applications personnelles (3–5)","Applications communautaires",
  "Questions pour petits groupes (6)","Prière guidée","Méditation courte","Versets à mémoriser (2–3)",
  "Difficultés/objections & réponses","Ressources complémentaires"
];
const TITLES_MINI = ["Thème central","Idées majeures (développement)","Applications personnelles"];

function makeMiniSections(reference, passageText) {
  const s1 = firstSentence(passageText) || `Lecture de ${reference}.`;
  return [
    { index:1, title:TITLES_MINI[0], content: clip(`Passage étudié : ${reference}. ${s1}`), verses:[] },
    { index:2, title:TITLES_MINI[1], content: clip(`Idées maîtresses observables dans ${reference} : ordre du texte, thèmes récurrents, progression interne, sans extrapoler.`), verses:[] },
    { index:3, title:TITLES_MINI[2], content: clip(`À partir de ${reference}, pistes d’application pratiques (prière, obéissance, prudence herméneutique).`), verses:[] },
  ];
}
function makeFullSections(reference, passageText) {
  const intro = firstSentence(passageText) || `Lecture de ${reference}.`;
  const generic = (t) => clip(`${t} (${reference}).`);
  const qn = (q) => clip(`${q} — en s’appuyant uniquement sur ${reference}.`);
  const contents = [
    clip(`Passage étudié : ${reference}. ${intro}`),
    generic("Résumé factuel très bref du passage"),
    generic("Contexte littéraire immédiat que laisse entrevoir le texte"),
    generic("Attribution traditionnelle mentionnée prudemment"),
    generic("Nature du texte (récit, poésie, discours, prophétie) selon sa forme"),
    generic("Découpage interne visible à la lecture"),
    generic("Plan de lecture sobre (étapes logiques internes)"),
    generic("Termes/expressions saillants relevés"),
    generic("Courtes définitions d’expressions récurrentes"),
    generic("Acteurs et lieux tels qu’ils apparaissent"),
    qn("Question directrice"),
    generic("Développement des idées émergentes"),
    generic("Point culminant interne (pivot)"),
    generic("Éventuels renvois AT prudents"),
    generic("Éventuels renvois NT prudents"),
    generic("Échos/parallèles scripturaires"),
    generic("Lecture christocentrique mesurée"),
    generic("Vérités doctrinales suggérées"),
    generic("Promesses et avertissements"),
    generic("Principes généraux"),
    generic("Applications personnelles"),
    generic("Applications communautaires"),
    generic("Questions pour petit groupe"),
    generic("Prière guidée ancrée dans le passage"),
    generic("Méditation courte"),
    generic("Versets à mémoriser"),
    generic("Difficultés possibles & pistes"),
    generic("Ressources complémentaires")
  ];
  return contents.map((content, i) => ({ index:i+1, title: TITLES_FULL[i], content, verses: [] }));
}

// ---------- handler ----------
export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return send(res, 405, { ok:false, error:"Use GET" });
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sp = url.searchParams;

    // Entrées
    const book = sp.get("book") || "Genèse";
    const chapter = sp.get("chapter") || "1";
    const verse = sp.get("verse") || "";
    const translation = sp.get("translation") || "LSG";
    const bibleIdParam = sp.get("bibleId") || "";
    const mode = (sp.get("mode") || "full").toLowerCase(); // full | mini
    const dry = sp.has("dry");
    const selftest = sp.get("selftest") === "1";

    if (selftest) {
      return send(res, 200, { ok:true, engine:"LLM-FREE", modes:["mini","full"], source:"api.bible" });
    }

    // Dry-run
    const referenceDry = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;
    if (dry) {
      const sections = mode === "mini"
        ? makeMiniSections(referenceDry, "Exemple de texte.")
        : makeFullSections(referenceDry, "Exemple de texte.");
      return send(res, 200, { ok:true, data:{ meta:{ book, chapter, verse, translation, reference: referenceDry, osis:"" }, sections } });
    }

    // api.bible
    const bibleId = await resolveBibleId(bibleIdParam);
    const pass = await getPassage({ bibleId, bookName: book, chapter, verse });

    const reference = pass.reference || referenceDry;
    const passageText = pass.text || "";
    const sections = mode === "mini"
      ? makeMiniSections(reference, passageText)
      : makeFullSections(reference, passageText);

    const data = {
      meta: { book, chapter, verse, translation, reference, osis: pass.osis || "" },
      sections
    };
    return send(res, 200, { ok:true, data });
  } catch (e) {
    return send(res, e.status || 500, { ok:false, error: String(e.message || e) });
  }
}

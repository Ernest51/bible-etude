/**
 * Vercel Serverless: /api/generate-study
 *
 * ENV requis :
 *   API_BIBLE_KEY   = <ta clé api.bible>
 *   BIBLE_DARBY_ID  = <ID de la version DARBY sur api.bible>
 *   OPENAI_API_KEY  = <ta clé OpenAI>
 *   OPENAI_MODEL    = (optionnel, ex: gpt-4o-mini)
 */

const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

const DARBY_OSIS = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU",
  "Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA",
  "1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH",
  "Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA",
  "Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA",
  "Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS",
  "Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM",
  "Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM",
  "1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH",
  "1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB",
  "Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN",
  "3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

const RUBRICS = [
  { id: 1,  title: 'Prière d’ouverture',              desc: "Invocation du Saint-Esprit pour éclairer l’étude." },
  { id: 2,  title: 'Canon et testament',             desc: "Appartenance au canon (AT/NT)." },
  { id: 3,  title: 'Questions du chapitre précédent',desc: "Questions à reprendre de l’étude précédente." },
  { id: 4,  title: 'Titre du chapitre',              desc: "Résumé doctrinal synthétique du chapitre." },
  { id: 5,  title: 'Contexte historique',            desc: "Période, géopolitique, culture, carte." },
  { id: 6,  title: 'Structure littéraire',           desc: "Séquençage narratif et composition." },
  { id: 7,  title: 'Genre littéraire',               desc: "Type de texte : narratif, poétique, prophétique…" },
  { id: 8,  title: 'Auteur et généalogie',           desc: "Auteur et lien aux patriarches (généalogie)." },
  { id: 9,  title: 'Verset-clé doctrinal',           desc: "Verset central du chapitre." },
  { id:10,  title: 'Analyse exégétique',             desc: "Commentaire exégétique (original si utile)." },
  { id:11,  title: 'Analyse lexicale',               desc: "Mots-clés et portée doctrinale." },
  { id:12,  title: 'Références croisées',            desc: "Passages parallèles et complémentaires." },
  { id:13,  title: 'Fondements théologiques',        desc: "Doctrines majeures qui émergent du chapitre." },
  { id:14,  title: 'Thème doctrinal',                desc: "Correspondance avec les grands thèmes doctrinaux." },
  { id:15,  title: 'Fruits spirituels',              desc: "Vertus / attitudes visées." },
  { id:16,  title: 'Types bibliques',                desc: "Figures typologiques et symboles." },
  { id:17,  title: 'Appui doctrinal',                desc: "Passages d’appui concordants." },
  { id:18,  title: 'Comparaison entre versets',      desc: "Comparaison interne des versets." },
  { id:19,  title: 'Comparaison avec Actes 2',       desc: "Parallèle avec Actes 2." },
  { id:20,  title: 'Verset à mémoriser',             desc: "Verset à mémoriser." },
  { id:21,  title: 'Enseignement pour l’Église',     desc: "Implications pour l’Église." },
  { id:22,  title: 'Enseignement pour la famille',   desc: "Applications familiales." },
  { id:23,  title: 'Enseignement pour enfants',      desc: "Pédagogie enfants (jeux, récits, symboles)." },
  { id:24,  title: 'Application missionnaire',       desc: "Applications mission/évangélisation." },
  { id:25,  title: 'Application pastorale',          desc: "Applications pastorales/enseignement." },
  { id:26,  title: 'Application personnelle',        desc: "Application personnelle engagée." },
  { id:27,  title: 'Versets à retenir',              desc: "Versets utiles à retenir." },
  { id:28,  title: 'Prière de fin',                  desc: "Prière de clôture." },
];

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const { passage, options = {} } = req.body || {};
    const length = clampInt(options.length, 500, 2500);
    const translation = 'DARBY'; // imposé

    if (!passage || typeof passage !== 'string') {
      return res.status(400).json({ error: 'Paramètre "passage" invalide.' });
    }

    const bibleText = await fetchDarbyText(passage);

    const sections = await generateRubrics({
      passage,
      bibleText,
      length,
      translation,
    });

    return res.status(200).json({ study: { sections } });
  } catch (err) {
    console.error('generate-study error:', err);
    return res.status(500).json({ error: 'Erreur interne de génération.' });
  }
};

/* ------------------ BIBLE (api.bible) ------------------ */

async function fetchDarbyText(passageRef) {
  const API_BASE = 'https://api.scripture.api.bible/v1';
  const key = process.env.API_BIBLE_KEY;
  const bibleId = process.env.BIBLE_DARBY_ID;

  if (!key || !bibleId) throw new Error('API_BIBLE_KEY ou BIBLE_DARBY_ID manquant dans .env');

  const parsed = parsePassage(passageRef);
  if (!parsed) throw new Error('Référence de passage invalide.');
  const osis = buildOsisId(parsed);

  const url = `${API_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(osis)}`
            + `?content-type=text&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`;

  const r = await fetch(url, {
    headers: { 'accept':'application/json', 'api-key': key, 'X-Api-Key': key },
    cache: 'no-store',
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`api.bible ${r.status}: ${t}`);
  }
  const j = await r.json();
  const content = j?.data?.content || j?.data?.passages?.[0]?.content || '';
  return stripHtml(content).trim();
}

function parsePassage(s) {
  const m = /^([\p{L}\s\d]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/u.exec(String(s).trim());
  if (!m) return null;
  const book = m[1].trim();
  const ch = parseInt(m[2], 10);
  const v1 = m[3] ? parseInt(m[3], 10) : null;
  const v2 = m[4] ? parseInt(m[4], 10) : null;
  return { book, chapter: ch, from: v1, to: v2 };
}
function buildOsisId({ book, chapter, from, to }) {
  const code = DARBY_OSIS[book];
  if (!code) throw new Error(`Livre inconnu: ${book}`);
  if (!from) return `${code}.${chapter}`;
  const start = `${code}.${chapter}.${from}`;
  if (!to) return start;
  const end = `${code}.${chapter}.${to}`;
  return `${start}-${end}`;
}
function stripHtml(html) {
  return String(html || '').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
}
async function safeText(r){ try{return await r.text();}catch{return '';} }

/* ------------------ GÉNÉRATION (LLM) ------------------ */

async function generateRubrics({ passage, bibleText, length, translation }) {
  const out = [];
  const seen = new Set();

  for (const r of RUBRICS) {
    const content = await llmRubric({
      passage, bibleText, length,
      title: r.title, description: r.desc,
      translation,
      previous: out.map(s => `#${s.id} ${s.title}`).join(' | '),
    });
    const clean = enforceLength(noDuplicate(content, seen), length);
    out.push({ id: r.id, title: r.title, description: r.desc, content: clean });
  }

  // Panorama (id 0)
  const panoram = await llmRubric({
    passage, bibleText,
    length: Math.min(700, Math.max(400, Math.round(length * 0.5))),
    title: 'Rubrique 0 — Panorama des versets du chapitre',
    description: 'Aperçu narratif verset par verset, fil conducteur doctrinal.',
    translation, previous: out.map(s=>`#${s.id} ${s.title}`).join(' | '),
  });
  out.unshift({
    id: 0,
    title: 'Rubrique 0 — Panorama des versets du chapitre',
    description: 'Aperçu du chapitre verset par verset',
    content: enforceLength(noDuplicate(panoram, new Set()), Math.min(700, Math.max(400, Math.round(length * 0.5)))),
  });

  return out;
}

async function llmRubric({ passage, bibleText, length, title, description, translation, previous }) {
  const system = [
    'Tu es un exégète chrétien fidèle à la sainte doctrine, écrivant en français,',
    'avec un ton narratif, pastoral et explicatif.',
    'Tu t’appuies d’abord sur le texte biblique fourni (traduction Darby).',
    'Tu évites les doublons entre rubriques et tu réponds aux questions implicites de la rubrique.',
    'Tu cites éventuellement les versets (ex: v.3-5) sans longs copiés/collés.',
  ].join(' ');

  const user = [
    `Passage: ${passage} (traduction: ${translation}).`,
    `Texte (Darby): """${truncate(bibleText, 6000)}"""`,
    `Rubrique: ${title} — ${description}`,
    `Contraintes:`,
    `- Longueur visée ≈ ${length} caractères (±15%).`,
    `- Narratif, ancré dans la sainte doctrine, explications concrètes.`,
    `- Répondre aux questions si la rubrique en suppose.`,
    `- Éviter toute redite par rapport aux rubriques précédentes: ${previous || 'Aucune'}.`,
    `- Sortie: un seul bloc de texte, sans puces systématiques.`,
  ].join('\n');

  const txt = await openaiChat(system, user);
  return (txt || '').trim();
}

async function openaiChat(system, user) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquant dans .env');

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'authorization': `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!r.ok) {
    const t = await safeText(r);
    throw new Error(`OpenAI ${r.status}: ${t}`);
  }
  const j = await r.json();
  return j.choices?.[0]?.message?.content || '';
}

/* ------------------ UTILITAIRES ------------------ */

function clampInt(n, min, max) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}
function truncate(s, max){ s=String(s||''); return s.length<=max?s:s.slice(0,max-1)+'…'; }

function normalizeChunk(s){
  return String(s||'').toLowerCase().replace(/\s+/g,' ').replace(/[^\p{L}\p{N}\s]/gu,'').trim();
}
function noDuplicate(text, seen){
  const sample = normalizeChunk(text).slice(0, 200);
  const key = sample.slice(0, 80);
  if (key.length >= 30 && seen.has(key)) {
    return 'Approfondissement complémentaire: ' + text;
  }
  if (key.length >= 30) seen.add(key);
  return text;
}

function enforceLength(s, target){
  const min = Math.round(target * 0.85);
  const max = Math.round(target * 1.15);
  let t = String(s||'').trim();

  if (t.length > max) {
    const cut = t.slice(0, max + 50);
    const lastDot = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('!'), cut.lastIndexOf('?'));
    t = cut.slice(0, lastDot > 0 ? lastDot + 1 : max).trim();
  } else if (t.length < min) {
    t = (t + ' ' + t).slice(0, max).trim();
  }
  return t;
}

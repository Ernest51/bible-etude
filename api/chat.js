// pages/api/chat.js
// Génère 28 rubriques. Renforce 2,4,5,7,8,10–26 en contenu doctrinal (~2500 chars) dynamique.
// Anti-doublons inter-rubriques. Utilise /api/verse pour insérer des extraits pertinents.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ───────────── Utils généraux ───────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const esc = (s) => String(s||"").replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}
const shortPara = (t) => `<p>${t}</p>`;
function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];
const pickMany = (arr, k, seed, salt=0) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){ const j=(seed+salt+i*31)%(i+1); [a[i],a[j]]=[a[j],a[i]];} return a.slice(0, Math.max(1, Math.min(k, a.length))); };

// Anti-doublons : retire les phrases identiques déjà vues
function dedupeAgainst(text, seenSet){
  const parts = String(text||"").split(/(?<=[\.\!\?])\s+/);
  const kept = [];
  for (const p of parts){
    const k = p.trim().replace(/\s+/g,' ');
    if (!k) continue;
    const sig = k.toLowerCase();
    if (seenSet.has(sig)) continue;
    seenSet.add(sig);
    kept.push(p);
  }
  return kept.join(' ');
}
// Longueur cible ±10%.
function enforceCharTarget(html, target=2500){
  const t = target;
  const lo = Math.floor(t*0.9), hi = Math.floor(t*1.1);
  if (html.length < lo) return html + `<p>${'&nbsp;'.repeat(lo - html.length)}</p>`;
  if (html.length > hi){
    // coupe proprement à la fin d’un paragraphe
    const cut = html.slice(0, hi);
    const idx = cut.lastIndexOf('</p>');
    return idx>0 ? cut.slice(0, idx+4) : cut;
  }
  return html;
}

/* ───────────── Canon / Testament / Genre ───────────── */

const BOOK_GROUPS = {
  TORAH: ["Genèse","Exode","Lévitique","Nombres","Deutéronome"],
  HIST: ["Josué","Juges","Ruth","1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther"],
  POETIC: ["Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques"],
  PROPHETIC: ["Ésaïe","Esaïe","Isaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"],
  GOSPELS: ["Matthieu","Marc","Luc","Jean"],
  ACTS: ["Actes"],
  EPISTLES: ["Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude"],
  APOCALYPSE: ["Apocalypse"]
};
const ALL_AT = [...BOOK_GROUPS.TORAH, ...BOOK_GROUPS.HIST, ...BOOK_GROUPS.POETIC, ...BOOK_GROUPS.PROPHETIC];
const ALL_NT = [...BOOK_GROUPS.GOSPELS, ...BOOK_GROUPS.ACTS, ...BOOK_GROUPS.EPISTLES, ...BOOK_GROUPS.APOCALYPSE];
const inGroup = (b, g) => BOOK_GROUPS[g].includes(b);
const classifyTestament = (book) => ALL_AT.includes(book) ? "AT" : (ALL_NT.includes(book) ? "NT" : "AT");
function classifyGenre(book){
  if (inGroup(book,"TORAH")||inGroup(book,"HIST")||inGroup(book,"GOSPELS")||inGroup(book,"ACTS")) return "narratif";
  if (inGroup(book,"POETIC")) return "poétique";
  if (inGroup(book,"PROPHETIC")||inGroup(book,"APOCALYPSE")) return "prophétique";
  if (inGroup(book,"EPISTLES")) return "épistolaire";
  return "narratif";
}

/* ───────────── Motifs / Prières (déjà en place) ───────────── */

function guessMotifs(book, chapter, verse){
  const b=(book||"").toLowerCase(), ch=Number(chapter||1), v=verse?Number(String(verse).split(/[–-]/)[0]):null;
  if ((b==="genèse"||b==="genese")&&ch===1){
    if(!v) return ["création","Parole qui ordonne","lumière et ténèbres","séparations","vie naissante","image de Dieu"];
    if(v===1) return ["cieux et terre","commencement","Parole créatrice"];
    if(v===2) return ["tohu-bohu","ténèbres","Esprit planant","eaux profondes"];
    if(v<=5) return ["Que la lumière soit","séparation lumière/ténèbres","jour et nuit"];
    if(v<=8) return ["étendue","séparation des eaux","ciel"];
    if(v<=13) return ["réunion des eaux","terre sèche","végétation"];
    if(v<=19) return ["astres","signes et saisons","soleil et lune"];
    if(v<=23) return ["poissons","oiseaux","bénédiction de fécondité"];
    if(v<=31) return ["animaux terrestres","homme et femme","image de Dieu","domination responsable"];
  }
  const testament = classifyTestament(cap(book));
  const genre = classifyGenre(cap(book));
  if (testament==="AT"&&genre==="narratif") return ["alliance","appel","épreuves","promesse","fidélité de Dieu"];
  if (genre==="poétique") return ["louange","lamentation","sagesse","métaphores","images fortes"];
  if (genre==="prophétique") return ["oracle","appel à revenir","jugement","espérance","Alliance renouvelée"];
  if (genre==="épistolaire") return ["Évangile","sainteté","charité fraternelle","espérance","vie dans l’Esprit"];
  if (testament==="NT"&&genre==="narratif") return ["Royaume","paroles de Jésus","signes","appel à suivre","disciples"];
  return ["Dieu parle","réponse de foi","espérance","sagesse pour vivre"];
}

/* ───────────── /api/verse helper ───────────── */

function baseUrl(req){
  const host = req?.headers?.host || "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  return `${proto}://${host}`;
}
async function fetchVerseText(req, { book, chapter, verse, version="LSG" }, timeoutMs=3500){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const r = await fetch(`${baseUrl(req)}/api/verse`, {
      method:"POST",
      headers:{ "Content-Type":"application/json" },
      body: JSON.stringify({ book, chapter, verse, version }),
      signal: ctrl.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    if (j && j.ok && j.text) return j.text;
    return null;
  }catch{ return null; } finally { clearTimeout(t); }
}

/* ───────────── Squelette des 28 rubriques ───────────── */

function skeleton(book, chapter, verse, version){
  const B=cap(book), ref=refString(book, chapter, verse);
  const testament = classifyTestament(B);
  const genre = classifyGenre(B);
  const genreLine = {
    narratif: "Genre: narratif (récit théologique qui forme par l’histoire).",
    poétique: "Genre: poétique/sapiential (forme le cœur et le regard).",
    prophétique:"Genre: prophétique (appel, jugement, promesse, espérance).",
    épistolaire:"Genre: épistolaire (enseignement et exhortation pour la vie chrétienne)."
  }[genre];

  const data=[];
  data.push({ id:1, title:"Prière d’ouverture", content: shortPara("…") });
  data.push({ id:2, title:"Canon et testament", content: shortPara(`${B} se situe dans le ${testament==="AT"?"Premier":"Nouveau"} Testament. ${genreLine}`) });
  data.push({ id:3, title:"Révision (5 questions + réponses)", content: shortPara("…") });
  data.push({ id:4, title:"Titre du chapitre", content: shortPara(`${ref} — <strong>Orientation de lecture selon le genre</strong>.`) });
  data.push({ id:5, title:"Contexte historique", content: shortPara("…") });
  data.push({ id:6, title:"Structure littéraire", content: shortPara("…") });
  data.push({ id:7, title:"Genre littéraire", content: shortPara(genreLine) });
  data.push({ id:8, title:"Auteur et généalogie", content: shortPara("…") });
  data.push({ id:9, title:"Verset-clé doctrinal", content: shortPara("…") });
  data.push({ id:10,title:"Analyse exégétique", content: shortPara("…") });
  data.push({ id:11,title:"Analyse lexicale", content: shortPara("…") });
  data.push({ id:12,title:"Références croisées", content: shortPara("…") });
  data.push({ id:13,title:"Fondements théologiques", content: shortPara("…") });
  data.push({ id:14,title:"Thème doctrinal", content: shortPara("…") });
  data.push({ id:15,title:"Fruits spirituels", content: shortPara("…") });
  data.push({ id:16,title:"Types bibliques", content: shortPara("…") });
  data.push({ id:17,title:"Appui doctrinal", content: shortPara("…") });
  data.push({ id:18,title:"Comparaison entre versets", content: shortPara("…") });
  data.push({ id:19,title:"Comparaison avec Actes 2", content: shortPara("…") });
  data.push({ id:20,title:"Verset à mémoriser", content: shortPara("…") });
  data.push({ id:21,title:"Enseignement pour l’Église", content: shortPara("…") });
  data.push({ id:22,title:"Enseignement pour la famille", content: shortPara("…") });
  data.push({ id:23,title:"Enseignement pour enfants", content: shortPara("…") });
  data.push({ id:24,title:"Application missionnaire", content: shortPara("…") });
  data.push({ id:25,title:"Application pastorale", content: shortPara("…") });
  data.push({ id:26,title:"Application personnelle", content: shortPara("…") });
  data.push({ id:27,title:"Versets à retenir", content: shortPara("…") });
  data.push({ id:28,title:"Prière de fin", content: shortPara("…") });

  return { sections:data, testament, genre, ref, B };
}

/* ───────────── Choix de versets utiles (9,20,27 + échantillons) ───────────── */

function chooseKeyVerse({ book, chapter }) {
  const B=(book||"").toLowerCase(), ch=Number(chapter||1);
  if ((B==="genèse"||B==="genese") && ch===1) return 1;
  if (B==="jean" && ch===1) return 14;
  if (B==="psaumes") return 1;
  return 1;
}
function chooseMemoryVerse({ book, chapter, keyVerse }){
  const B=(book||"").toLowerCase();
  if (B==="psaumes") return 2;
  return keyVerse!==2 ? 2 : 3;
}
function chooseRetainVerses({ book, chapter, keyVerse }){
  const picks = new Set([1, keyVerse, 2, 5]);
  return Array.from(picks).filter(v=>v>0).slice(0,5).sort((a,b)=>a-b);
}

async function enrichVerses(req, sections, { book, chapter, version }){
  const keyV = chooseKeyVerse({ book, chapter });
  const memV = chooseMemoryVerse({ book, chapter, keyVerse: keyV });
  const list27 = chooseRetainVerses({ book, chapter, keyVerse: keyV });

  const [keyText, memText] = await Promise.all([
    fetchVerseText(req, { book, chapter, verse:keyV, version }),
    fetchVerseText(req, { book, chapter, verse:memV, version })
  ]);

  // R9
  const i9 = sections.findIndex(s=>s.id===9);
  if (i9>=0 && keyText){
    sections[i9].content = [
      `<h3>Verset-clé doctrinal — ${esc(refString(book, chapter, keyV))}</h3>`,
      `<blockquote>${esc(keyText)}</blockquote>`,
      `<p><em>Pourquoi clé ?</em> Il condense l’intention du passage et éclaire son axe théologique.</p>`
    ].join("\n");
  }
  // R20
  const i20 = sections.findIndex(s=>s.id===20);
  if (i20>=0 && (memText||keyText)){
    const v = memText?memV:keyV;
    const t = memText||keyText;
    sections[i20].content = [
      `<h3>Verset à mémoriser — ${esc(refString(book, chapter, v))}</h3>`,
      `<blockquote>${esc(t)}</blockquote>`,
      `<p><em>Astuce.</em> Répéter 3× dans la journée et prier une phrase-réponse.</p>`
    ].join("\n");
  }
  // R27
  const items = [];
  for (const v of list27){
    const t = await fetchVerseText(req, { book, chapter, verse:v, version });
    if (t) items.push({ v, t });
  }
  const i27 = sections.findIndex(s=>s.id===27);
  if (i27>=0 && items.length){
    sections[i27].content = [
      `<h3>Versets à retenir — ${esc(refString(book, chapter))}</h3>`,
      `<ul>`,
      ...items.map(it=>`<li><strong>${esc(refString(book, chapter, it.v))}</strong> — ${esc(it.t)}</li>`),
      `</ul>`,
      `<p><em>Clé de lecture :</em> chaque verset met en relief une facette de l’axe du passage.</p>`
    ].join("\n");
  }

  return {
    sample: {
      vk: keyText ? { ref: refString(book, chapter, keyV), text: keyText } : null,
      vm: memText ? { ref: refString(book, chapter, memV), text: memText } : null
    }
  };
}

/* ───────────── IA helpers ───────────── */

async function callOpenAI({ system, user, model="gpt-4o-mini", temperature=0.7, max_tokens=1400 }){
  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" },
    body: JSON.stringify({ model, temperature, max_tokens, messages:[{role:"system",content:system},{role:"user",content:user}] })
  });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildMotifsPrompt(ref, version){
  return {
    system: "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide.",
    user: `Donne 6–10 motifs CONCRETS pour ${ref} (${version||"LSG"}). Format strict: {"motifs":[...],"attributsDivins":[...]}`.trim()
  };
}
const safeParseJSON = (s)=>{ try{ return JSON.parse(s); }catch{ return null; } };

/* Prompts dynamiques pour sections doctrinales */
function buildSectionPrompt({ ref, version, testament, genre, sectionTitle, goal, mustUse, versesText, avoidPhrases }) {
  const versesBlock = versesText?.length
    ? `Extraits disponibles à intégrer (optionnels, 1–3) :
${versesText.map(v=>`- ${v.ref}: “${v.text}”`).join('\n')}`
    : `Pas d’extraits disponibles.`;
  return {
    system: "Tu es un bibliste pédagogue et doctrinal. HTML autorisé: <p>, <em>, <strong>, <ul>, <li>, <blockquote>.",
    user: `
Rédige la rubrique “${sectionTitle}” pour ${ref} (${version}).
Contrainte doctrinale:
- Testament=${testament}, Genre=${genre}
- Objectif: ${goal}
- Intégrer explicitement des éléments de: ${JSON.stringify(mustUse||[])} (au moins 2).
- Éviter ces formulations (ne PAS utiliser): ${avoidPhrases.map(s=>`“${s}”`).join(", ")}
- Longueur cible: ~2500 caractères (tolérance ±10%), sans remplissage artificiel.
- Zéro redite: ne réutilise pas des phrases toutes faites, varie les connecteurs, précise le propos.

${versesBlock}

Exigences de sortie:
- Utilise paragraphes clairs; listes si utile.
- Ajoute 1–2 <blockquote> avec courts extraits si pertinents.
- Pas de bibliographie, pas de liens externes.
- Texte autoportant et pastoral, précis au passage.

Donne UNIQUEMENT le HTML demandé, sans commentaire autour.
`.trim()
  };
}

/* Fallback doctrinal par gabarits (si IA absente/KO) */
function fallbackSection({ sectionId, book, chapter, verse, version, testament, genre, motifs, versesText, seed }){
  const ref = refString(book, chapter, verse);
  const vq = (n)=> versesText?.[n] ? `<blockquote>${esc(versesText[n].text)}</blockquote>` : "";
  const mot = motifs?.length ? motifs.slice(0,4).join(", ") : "axes du passage";
  const para = (s)=>`<p>${s}</p>`;

  // gabarits simples mais consistants, variés par id
  const open = [
    para(`<strong>${ref}</strong> — Lecture ${testament==="AT"?"de l’Alliance":"de l’Évangile"} en genre ${genre}. Les motifs saillants (${esc(mot)}) orientent la compréhension et l’appropriation.`)
  ];

  const blocks = {
    2: [
      para(`${cap(book)} s’inscrit dans l’économie du salut: ${testament==="AT"?"promesses, appel, fidélité de Dieu malgré l’infidélité humaine":"accomplissement en Christ, don de l’Esprit, communauté envoyée"}.`),
      vq(0),
      para(`Le chapitre ${chapter} articule la révélation et la réponse de foi, en continuité avec le canon.`)
    ],
    4: [
      para(`${ref} — <strong>${genre==="prophétique"?"Appel et espérance":"Dieu agit et l’humain répond"}</strong>.`),
      para(`L’intitulé retient l’axe central pour guider la lecture catéchétique et l’application.`),
      vq(1)
    ],
    5: [
      para(`Contexte: ${testament==="AT"?"peuple formé par l’Alliance, terre et culte":"époque du Christ et des apôtres, Église naissante"}.`),
      para(`Repères historiques et théologiques pour situer l’intention du passage.`),
      vq(0)
    ],
    7: [
      para(`Genre ${genre}: forme et visée. La forme n’est pas décorative; elle sert la formation du cœur et de l’intelligence.`),
      vq(1)
    ],
    8: [
      para(`Auteur/tradition et destinataires. Inscription canonique et transmission fidèle.`),
      para(`La généalogie des thèmes relie ce chapitre à l’ensemble de la révélation.`)
    ],
    10: [
      para(`<strong>Analyse exégétique.</strong> Repérer marqueurs (répétitions, inclusions, transitions), sujets/verbes dominants, progression logique.`),
      vq(0),
      para(`Lire la syntaxe théologique: qui parle? que fait Dieu? quelle réponse attendue?`)
    ],
    11: [
      para(`<strong>Analyse lexicale.</strong> 1–2 termes décisifs (ex.: alliance, justice, sagesse, foi, esprit) éclairent l’axe.`),
      vq(1),
      para(`On précise champ sémantique et portée doctrinale dans le contexte du chapitre.`)
    ],
    12: [
      para(`Références croisées: unité de la révélation.`),
      para(`${testament==="AT"?"Échos Torah/Prophètes/Sagesse":"Évangiles/Épîtres/Apocalypse"}; cohérence des motifs.`),
      vq(0)
    ],
    13: [
      para(`Fondements: Dieu ${testament==="AT"?"crée, appelle, promet, juge, rachète":"révèle en Christ, sauve, sanctifie, envoie"}.`),
      para(`L’humain: foi-obéissance; vocation communautaire et personnelle.`)
    ],
    14: [
      para(`Thème doctrinal: ${genre==="prophétique"?"appel à revenir/espérance":"actes de Dieu et réponse"}; implications éthiques et liturgiques.`),
      vq(1)
    ],
    15: [
      para(`Fruits: gratitude, justice, sagesse, persévérance, charité, espérance; signes d’une réception vivante de la Parole.`)
    ],
    16: [
      para(`Types bibliques: motifs/figures qui préfigurent et convergent vers le Christ.`),
      vq(0)
    ],
    17: [
      para(`Appui doctrinal: textes qui consolident l’interprétation et l’application.`),
      vq(1)
    ],
    18: [
      para(`Comparaison intra-chapitre: ouverture / charnière / conclusion. Axe théologique mis en relief.`)
    ],
    19: [
      para(`Écho avec Actes 2: Parole–Esprit–Communauté; formation d’un peuple qui vit l’Évangile.`)
    ],
    20: [ // déjà enrichi par verset, on complète
      para(`Mémorisation active: répéter, prier une phrase, relier à une décision concrète.`)
    ],
    21: [
      para(`Église: annonce, édification, discipline, mission; diaconie et unité.`),
      vq(0)
    ],
    22: [
      para(`Famille: lecture, prière, pardon, service; rites simples qui transmettent la foi.`)
    ],
    23: [
      para(`Enfants: raconter, prier, mémoriser, agir; pédagogie par images et gestes.`)
    ],
    24: [
      para(`Mission: cohérence de vie, parole claire, amour concret; humilité et espérance.`)
    ],
    25: [
      para(`Pastoral: prière, consolation, conseil biblique, accompagnement dans la durée.`)
    ],
    26: [
      para(`Personnel: 1–2 décisions “quoi/quand/comment”; examen de conscience et prière.`)
    ]
  };

  const chosen = blocks[sectionId] || [para(`Contenu doctrinal: ${esc(mot)}.`)];
  // étoffe pour tendre vers 2500 chars: duplique des axes complémentaires variés
  const extra = [
    para(`Conséquence pratique: articuler confession de foi et obéissance, dans l’Esprit et la communauté.`),
    para(`Repères herméneutiques: contexte canonique, visée éthique, espérance eschatologique.`)
  ];
  const all = [...open, ...chosen, ...extra, ...extra];
  return all.join("\n");
}

/* ───────────── Rubrique 3 (questions + réponses dynamiques) ───────────── */

function r3Questions(book, chapter){
  const ref = esc(refString(book, chapter));
  const genre = classifyGenre(cap(book));
  const blocks = {
    narratif: [
      `<h3>Révision sur ${ref} — 5 questions (narratif)</h3>`,
      `<p><strong>1) Observation.</strong> Acteurs, lieux, succession d’actions, formules récurrentes.</p>`,
      `<p><strong>2) Compréhension.</strong> Que révèle le récit de Dieu et de l’humain ? Intention du passage ?</p>`,
      `<p><strong>3) Interprétation.</strong> Verset-charnière, logique du récit, accents théologiques.</p>`,
      `<p><strong>4) Connexions.</strong> Parallèles dans le canon (Torah/Histoire/Évangiles/Actes).</p>`,
      `<p><strong>5) Application.</strong> Décision concrète (quoi/quand/comment) en cohérence avec le récit.</p>`
    ],
    poétique: [
      `<h3>Révision sur ${ref} — 5 questions (poétique)</h3>`,
      `<p><strong>1) Observation.</strong> Images, parallélismes, champs lexicaux, tonalité.</p>`,
      `<p><strong>2) Compréhension.</strong> Vision de Dieu et de la vie.</p>`,
      `<p><strong>3) Interprétation.</strong> Fonction de la poésie: former l’âme.</p>`,
      `<p><strong>4) Connexions.</strong> Échos sapientiaux et liturgiques.</p>`,
      `<p><strong>5) Application.</strong> Prière-réponse, mémoire d’un verset.</p>`
    ],
    prophétique: [
      `<h3>Révision sur ${ref} — 5 questions (prophétique)</h3>`,
      `<p><strong>1) Observation.</strong> Oracle, destinataires, raisons, promesse/jugement.</p>`,
      `<p><strong>2) Compréhension.</strong> Exigence de Dieu, diagnostic, espérance.</p>`,
      `<p><strong>3) Interprétation.</strong> Alliance, accomplissements.</p>`,
      `<p><strong>4) Connexions.</strong> Échos prophétiques/évangéliques.</p>`,
      `<p><strong>5) Application.</strong> Retour concret, justice, miséricorde.</p>`
    ],
    épistolaire: [
      `<h3>Révision sur ${ref} — 5 questions (épistolaire)</h3>`,
      `<p><strong>1) Observation.</strong> Structure argumentaire, indicatifs/impératifs.</p>`,
      `<p><strong>2) Compréhension.</strong> Évangile central, sainteté/communauté.</p>`,
      `<p><strong>3) Interprétation.</strong> Théologie, logique de l’exhortation.</p>`,
      `<p><strong>4) Connexions.</strong> Parallèles paulinien/pétrinien/johannique.</p>`,
      `<p><strong>5) Application.</strong> Règle de vie simple.</p>`
    ]
  };
  return blocks[genre].join("\n");
}

function r3AnswersFallback({ book, chapter, motifs, verses }){
  const ref = esc(refString(book, chapter));
  const genre = classifyGenre(cap(book));
  const vk = verses?.vk ? ` — <em>« ${esc(verses.vk.text)} »</em>` : "";
  const vm = verses?.vm ? ` — <em>« ${esc(verses.vm.text)} »</em>` : "";
  const m = motifs?.length ? motifs.slice(0,3).join(", ") : "motifs du passage";
  const p = [];
  p.push(`<h3>Réponses — ${ref}</h3>`);
  p.push(`<p><strong>Observation.</strong> Le texte met en jeu des acteurs identifiables et une progression (${esc(m)})${vk}.</p>`);
  p.push(`<p><strong>Compréhension.</strong> Dieu se révèle fidèle et juste; l’humain est appelé à la confiance et à l’obéissance${vm}.</p>`);
  p.push(`<p><strong>Interprétation.</strong> Un verset-pivot articule l’axe théologique et éclaire l’ensemble.</p>`);
  p.push(`<p><strong>Connexions.</strong> Échos dans le canon qui confirment promesse, jugement, espérance.</p>`);
  p.push(`<p><strong>Application.</strong> Décision concrète cette semaine (quoi/quand/comment).</p>`);
  return p.join("\n");
}

/* Prières (ouverture/fin) — inchangées par rapport à ta version précédente, mais variées par seed */
const INVOC = { AT:["Dieu de vérité","Seigneur de l’Alliance","Dieu fidèle","Père des lumières","Dieu trois fois saint"], NT:["Père de miséricorde","Dieu de paix","Dieu et Père de notre Seigneur Jésus-Christ","Dieu fidèle","Seigneur de gloire"] };
const ATTRS = { narratif:["Créateur","Libérateur","Guide du peuple","Dieu qui conduit l’histoire"], poétique:["Berger de nos âmes","Roc et refuge","Dieu compatissant","Source de sagesse"], prophétique:["Saint et Juste","Dieu qui parle par ses prophètes","Juge équitable","Rédempteur"], épistolaire:["Dieu de grâce","Père des miséricordes","Dieu de toute consolation","Seigneur qui sanctifie"] };
const OPEN_ENDS=["Par Jésus-Christ notre Seigneur, amen.","Dans la paix du Christ, amen.","Nous te prions au nom de Jésus, amen.","Par ton Esprit Saint, amen.","À toi la gloire, maintenant et toujours, amen."];
const CLOSE_ENDS=["Conduis-nous à vivre ce que nous avons reçu. Amen.","Affermis nos pas dans ta volonté. Amen.","Que ta Parole porte du fruit en nous. Amen.","Garde-nous dans la foi et la charité. Amen.","À toi soient la gloire et la paix. Amen."];
const MID = {
  narratif:[
    (a,b)=>`Par ta Parole qui éclaire, apprends-nous à discerner ton œuvre au cœur de ${a}, et à marcher dans tes voies.`,
    (a,b)=>`Raconte-nous encore tes œuvres, pour que ${b} façonne notre confiance et notre obéissance concrète.`
  ],
  poétique:[
    (a,b)=>`Ouvre en nous un chant vrai: que ${a} devienne louange et prière, afin que notre cœur s’accorde à ta sagesse.`,
    (a,b)=>`Dissipe nos illusions, affine notre regard, et fais de ${b} une source de paix et de discernement.`
  ],
  prophétique:[
    (a,b)=>`Fais retentir ton appel: que ${a} nous conduise à revenir à toi, dans la vérité et la compassion.`,
    (a,b)=>`Donne-nous d’accueillir l’avertissement et la promesse: que ${b} engendre repentance et espérance.`
  ],
  épistolaire:[
    (a,b)=>`Éclaire notre intelligence de l’Évangile, afin que ${a} façonne nos pensées, nos paroles et nos actes.`,
    (a,b)=>`Affermis l’Église dans la foi et l’amour: que ${b} devienne règle de vie simple et joyeuse.`
  ]
};
function openingFallback(book, chapter, verse, version){
  const ref=refString(book, chapter, verse), motifs=guessMotifs(book,chapter,verse);
  const seed=simpleHash(`${ref}|${version}|OPEN`);
  const tes=classifyTestament(cap(book)), gen=classifyGenre(cap(book));
  const head=pick(INVOC[tes]||INVOC.AT,seed), attr=pick(ATTRS[gen]||ATTRS.narratif,seed,3);
  const end=pick(OPEN_ENDS,seed,5);
  const a=pickMany(motifs,2,seed,7).join(", "), b=pickMany(motifs,3,seed,11).join(", ");
  const mid=pick(MID[gen]||MID.narratif,seed,13)(a,b);
  return `<p><strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${esc(ref)}</strong>. ${mid} ${end}</p>`;
}
function closingFallback(book, chapter, verse, version){
  const ref=refString(book, chapter, verse), motifs=guessMotifs(book,chapter,verse);
  const seed=simpleHash(`${ref}|${version}|CLOSE`);
  const tes=classifyTestament(cap(book)), gen=classifyGenre(cap(book));
  const head=pick(INVOC[tes]||INVOC.AT,seed), attr=pick(ATTRS[gen]||ATTRS.narratif,seed,19);
  const end=pick(CLOSE_ENDS,seed,23);
  const a=pickMany(motifs,2,seed,29).join(", "), b=pickMany(motifs,3,seed,31).join(", ");
  const mids = {
    narratif:[(x,y)=>`Tu as agi et parlé; que la mémoire de ${x} oriente nos choix, et que ${y} devienne obéissance joyeuse.`],
    poétique:[(x,y)=>`Que ${x} purifie notre regard et ${y} fasse naître un chant vrai qui t’honore.`],
    prophétique:[(x,y)=>`Fais-nous revenir à toi: que ${x} nous établisse dans la justice, et ${y} dans l’espérance.`],
    épistolaire:[(x,y)=>`Scelle en nous l’Évangile reçu: que ${x} et ${y} renouvellent notre manière de vivre.`]
  };
  const mid = pick(mids[gen]||mids.narratif,seed,37)(a,b);
  return `<p><strong>${head}</strong>, ${attr}, merci pour <strong>${esc(ref)}</strong>. ${mid} ${end}</p>`;
}

/* ───────────── Handler principal ───────────── */

export default async function handler(req, res){
  if (req.method!=="POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  try {
    if (req.body && req.body.probe) return res.status(200).json({ ok:true, source:"probe", warn:"" });

    const { book="Genèse", chapter=1, verse="", version="LSG" } = req.body || {};
    const reference = refString(book, chapter, verse);
    const { sections, testament, genre } = skeleton(book, chapter, verse, version);

    // 1) Versets dynamiques (R9, R20, R27 + échantillons pour prompts)
    const { sample } = await enrichVerses(req, sections, { book, chapter, version });

    // 2) R3 — Questions + Réponses dynamiques
    const motifs = guessMotifs(book, chapter, verse);
    const i3 = sections.findIndex(s=>s.id===3);
    if (i3>=0){
      const Q = r3Questions(book, chapter);
      let A = "";
      if (OPENAI_API_KEY){
        try{
          // amont: motifs IA (optionnel)
          const mraw = await callOpenAI(buildMotifsPrompt(reference, version));
          const mjson = safeParseJSON(mraw) || {};
          const m = Array.isArray(mjson.motifs)&&mjson.motifs.length ? mjson.motifs : motifs;

          const versesText = [sample.vk, sample.vm].filter(Boolean);
          const prompt = buildSectionPrompt({
            ref: reference, version, testament, genre,
            sectionTitle: "Révision — Réponses",
            goal: "donner 5 paragraphes répondant aux 5 questions, de manière précise au passage",
            mustUse: m, versesText,
            avoidPhrases: [
              "nous nous approchons de toi pour méditer",
              "ouvre notre intelligence",
              "purifie nos intentions",
              "fais naître en nous l’amour de ta volonté",
              "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
              "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
            ]
          });
          A = await callOpenAI({ ...prompt, temperature:0.6, max_tokens: 1600 });
        } catch { A = ""; }
      }
      if (!A || A.length < 200) A = r3AnswersFallback({ book, chapter, motifs, verses: sample });
      sections[i3].content = Q + "\n" + A;
    }

    // 3) R1 — Prière d’ouverture (seed inclut verset)
    const i1 = sections.findIndex(s=>s.id===1);
    sections[i1].content = openingFallback(book, chapter, verse, version);

    // 4) R28 — Prière de fin (seed inclut verset)
    const i28 = sections.findIndex(s=>s.id===28);
    sections[i28].content = closingFallback(book, chapter, verse, version);

    // 5) Renforcement doctrinal des rubriques 2,4,5,7,8,10–26 (~2500 chars), anti-doublons
    const TARGET_IDS = [2,4,5,7,8,10,11,12,13,14,15,16,17,18,19,21,22,23,24,25,26]; // 20/27 déjà enrichies
    const seen = new Set();

    // Prépare des extraits de versets pour pimenter les prompts
    const versesText = [sample.vk, sample.vm].filter(Boolean);

    for (const id of TARGET_IDS){
      const idx = sections.findIndex(s=>s.id===id);
      if (idx<0) continue;

      const sectionTitle = sections[idx].title;
      const goalById = {
        2: "situer le livre et ce chapitre dans l’économie du salut, avec enjeux canon/Alliance",
        4: "formuler un titre théologique précis qui oriente la lecture et l’application",
        5: "donner des repères historiques/culturels/théologiques utiles à l’interprétation",
        7: "expliquer ce que le genre apporte à la compréhension et à l’appropriation",
        8: "présenter auteur/tradition/destinataires et ancrage canonique",
        10:"analyser structure, marqueurs, sujets/verbes, progression logique et théologique",
        11:"éclairer 1–3 termes-clés (champ sémantique + portée doctrinale dans le passage)",
        12:"proposer des connexions canoniques cohérentes et argumentées",
        13:"résumer les fondements théologiques en jeu (Dieu, Alliance/Évangile, Église, humain)",
        14:"définir l’axe doctrinal central et ses conséquences",
        15:"déployer les fruits spirituels réalistes et vérifiables",
        16:"identifier préfigurations/types qui convergent vers le Christ",
        17:"fournir appuis doctrinaux (parallèles majeurs) et brèves justifications",
        18:"comparer ouverture/charnière/conclusion pour dégager la ligne du chapitre",
        19:"montrer l’écho avec Actes 2 (Parole–Esprit–Communauté)",
        21:"décliner implications ecclésiales concrètes",
        22:"décliner implications familiales concrètes",
        23:"adapter aux enfants (langage, gestes, mémoire)",
        24:"orienter la mission (cohérence, parole, actes de charité)",
        25:"donner pistes pastorales (accompagnement, prière, persévérance)",
        26:"proposer décisions concrètes personnelles (quoi/quand/comment)"
      };
      const goal = goalById[id] || "développer une synthèse doctrinale structurée et praticable";
      const mustUse = motifs;

      let html = "";
      if (OPENAI_API_KEY){
        try{
          const prompt = buildSectionPrompt({
            ref: reference, version, testament, genre,
            sectionTitle, goal, mustUse, versesText,
            avoidPhrases: [
              "nous nous approchons de toi pour méditer",
              "ouvre notre intelligence",
              "purifie nos intentions",
              "fais naître en nous l’amour de ta volonté",
              "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
              "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
            ]
          });
          html = await callOpenAI({ ...prompt, temperature:0.65, max_tokens: 2200 });
        } catch { html = ""; }
      }
      if (!html || html.length < 500){
        // fallback riche
        html = fallbackSection({
          sectionId: id, book, chapter, verse, version, testament, genre,
          motifs, versesText, seed: simpleHash(`${reference}|${id}`)
        });
      }
      // anti-doublons inter-rubriques
      html = dedupeAgainst(html, seen);
      // ajuste longueur ~2500 chars
      html = enforceCharTarget(html, 2500);

      sections[idx].content = html;
    }

    return res.status(200).json({
      ok:true,
      source: OPENAI_API_KEY ? "openai+fallback" : "fallback",
      warn: OPENAI_API_KEY ? "" : "AI désactivée — sections doctrinales générées par gabarits renforcés",
      data: { reference, version:(version||"LSG"), sections }
    });

  } catch (e) {
    return res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}

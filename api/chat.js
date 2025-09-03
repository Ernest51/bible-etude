// pages/api/chat.js
// Next.js API Route (Pages Router)
// POST JSON: { book, chapter, verse?, version?, directives? }
// Renvoie toujours 28 rubriques, avec rubrique 1 = prière d’ouverture spécifique.
// Fallback varié si l'IA est indisponible. Gère { probe:true }.

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPENAI_APIKEY ||
  process.env.OPENAI_KEY;

/* ---------- Utils ---------- */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  if (verse) return `${cap(book)} ${ch}:${verse}`;
  return `${cap(book)} ${ch}`;
}
const shortPara = (t) => `<p>${t}</p>`;

/* ---------- Heuristique motifs (fallback) ---------- */

function guessMotifs(book, chapter, verse) {
  const b = (book || "").toLowerCase();
  const ch = Number(chapter || 1);
  const v  = verse ? Number(String(verse).split(/[–-]/)[0]) : null;

  if (b === "genèse" || b === "genese") {
    if (ch === 1) {
      if (!v)  return ["création","Parole qui ordonne","lumière et ténèbres","séparations","vie naissante","image de Dieu"];
      if (v === 1)  return ["cieux et terre","commencement","Parole créatrice"];
      if (v === 2)  return ["tohu-bohu","ténèbres","Esprit planant","eaux profondes"];
      if (v <= 5)   return ["Que la lumière soit","séparation lumière/ténèbres","jour et nuit"];
      if (v <= 8)   return ["étendue","séparation des eaux","ciel"];
      if (v <= 13)  return ["réunion des eaux","terre sèche","végétation"];
      if (v <= 19)  return ["astres","signes et saisons","soleil et lune"];
      if (v <= 23)  return ["poissons","oiseaux","bénédiction de fécondité"];
      if (v <= 31)  return ["animaux terrestres","homme et femme","image de Dieu","domination responsable"];
    }
  }

  const isOT = [
    "genèse","exode","lévitique","nombres","deutéronome","josué","juges","ruth","1 samuel","2 samuel","1 rois","2 rois",
    "1 chroniques","2 chroniques","esdras","néhémie","esther","job","psaumes","proverbes","ecclésiaste","cantique des cantiques",
    "ésaïe","esaie","isaïe","isaie","jérémie","lamentations","ézéchiel","ezekiel","daniel","osée","joël","amos","abdias",
    "jonas","michée","nahoum","habacuc","sophonie","aggée","zacharie","malachie"
  ].includes(b);
  if (isOT) return ["Alliance","fidélité de Dieu","appel à l’obéissance","justice et miséricorde"];
  if (["matthieu","marc","luc","jean"].includes(b))
    return ["Royaume de Dieu","paroles de Jésus","signes et guérisons","appel à suivre le Christ"];
  if (b === "actes") return ["Esprit Saint","témoignage","Église naissante","communauté et mission"];
  if ([
    "romains","1 corinthiens","2 corinthiens","galates","éphésiens","philippiens","colossiens","1 thessaloniciens","2 thessaloniciens",
    "1 timothée","2 timothée","tite","philémon","hébreux","jacques","1 pierre","2 pierre","1 jean","2 jean","3 jean","jude"
  ].includes(b)) return ["Évangile","sainteté","espérance","vie dans l’Esprit","charité fraternelle"];
  if (b === "apocalypse") return ["Agneau","victoire","persévérance","nouvelle création"];
  return ["Dieu parle","réponse de foi","espérance","sagesse pour vivre"];
}

/* ---------- Prière d’ouverture fallback ---------- */

function simpleHash(str){ let h=0; for (let i=0;i<str.length;i++){ h=((h<<5)-h)+str.charCodeAt(i); h|=0;} return Math.abs(h); }
const pick = (arr, seed, salt=0) => arr[(seed + salt) % arr.length];

function buildOpeningPrayerFallback(book, chapter, verse, version) {
  const ref = refString(book, chapter, verse);
  const motifs = guessMotifs(book, chapter, verse);
  const seed = simpleHash(`${ref}|${version||"LSG"}|${motifs.join("|")}`);

  const invocations = ["Dieu de vérité","Père des lumières","Seigneur éternel","Dieu fidèle","Père de miséricorde"];
  const attributs  = ["Créateur","Libérateur","Souverain juste","Dieu compatissant","Dieu qui ordonne le chaos"];
  const conclusions= ["Par Jésus-Christ notre Seigneur, amen.","Dans la paix du Christ, amen.","Nous te prions au nom de Jésus, amen.","Au nom de Jésus, que cela soit, amen.","Par ton Esprit Saint, amen."];
  const head = pick(invocations, seed);
  const attr = pick(attributs, seed, 1);
  const end  = pick(conclusions, seed, 2);
  const m    = motifs.slice(0,3).join(", ");

  return [
    `<p><strong>${head}</strong>, ${attr}, nous venons à toi devant <strong>${ref}</strong>. `,
    `Tu fais surgir un sens précis dans ce passage — ${m}. `,
    `Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse. ${end}</p>`
  ].join("");
}

/* ---------- Rubrique 3 ---------- */

function buildRubrique3(book, chapter) {
  const ref = refString(book, chapter);
  return [
    `<h3>Révision sur ${ref} — 5 questions</h3>`,
    `<p><strong>1) Observation.</strong> Quels sont les faits majeurs du passage ? Identifier le <em>contexte immédiat</em> (avant/après), les <em>acteurs</em>, les <em>verbes</em> dominants…</p>`,
    `<p><strong>Réponse (ex).</strong> Le texte met en valeur l’initiative divine et l’ordre instauré par Dieu ; l’homme est placé dans une vocation précise…</p>`,
    `<p><strong>2) Compréhension.</strong> Que dit ce chapitre sur Dieu et sur l’homme ?</p>`,
    `<p><strong>3) Interprétation.</strong> Quel est le verset-clef et pourquoi ?</p>`,
    `<p><strong>4) Connexions bibliques.</strong> Relever 1–2 échos pertinents (AT/NT) et expliquer le lien.</p>`,
    `<p><strong>5) Application.</strong> Définir une mise en pratique concrète (personnelle, famille, église) et une courte prière.</p>`
  ].join("\n");
}

/* ---------- 28 rubriques “sûres” ---------- */

function canonicalStudy(book, chapter, verse, version) {
  const data = [];
  data.push({ id: 1, title: "Prière d’ouverture", content: shortPara("…") }); // remplacée ensuite
  data.push({ id: 2, title: "Canon et testament",
    content: shortPara(`${cap(book)} s’inscrit dans la révélation progressive de Dieu. Le chapitre ${chapter} met en valeur l’initiative divine et la vocation humaine.`)
  });
  data.push({ id: 3, title: "Questions du chapitre précédent", content: buildRubrique3(book, chapter) });
  data.push({ id: 4, title: "Titre du chapitre", content: shortPara(`${cap(book)} ${chapter} — <strong>Dieu parle et l’homme répond</strong>`) });
  for (let i=5;i<=28;i++){
    if (!data[i-1]) data[i-1] = { id: i, title: `Rubrique ${i}`, content: shortPara("Contenu à développer…") };
  }
  return data;
}

/* ---------- OpenAI helpers ---------- */

async function callOpenAI({ system, user, model = "gpt-4o-mini", temperature = 0.7, max_tokens = 600 }) {
  const url = "https://api.openai.com/v1/chat/completions";
  const body = { model, messages:[{role:"system",content:system},{role:"user",content:user}], temperature, max_tokens };
  const r = await fetch(url, { method:"POST", headers:{ "Authorization":`Bearer ${OPENAI_API_KEY}`, "Content-Type":"application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  const j = await r.json();
  return j.choices?.[0]?.message?.content || "";
}

function buildMotifsPrompt(ref, version, custom=""){
  return {
    system: "Tu es un bibliste rigoureux. Réponds uniquement en JSON valide.",
    user: `
Donne 6 à 10 motifs concrets pour ${ref} (${version||"LSG"}).
Format strict:
{"motifs":[...],"attributsDivins":[...]}
${custom ? `Note: ${custom}` : ""}`.trim()
  };
}
const safeParseJSON = (s)=>{ try{ return JSON.parse(s); }catch{ return null; } };

function buildPrayerPrompt(ref, version, motifs, attrs, custom="", seed=0){
  const forbid = [
    "nous nous approchons de toi pour méditer",
    "ouvre notre intelligence",
    "purifie nos intentions",
    "fais naître en nous l’amour de ta volonté",
    "Que ta Parole façonne notre pensée, notre prière et nos décisions."
  ];
  return {
    system: "Tu es un bibliste pastoral. HTML autorisé: <p>, <strong>, <em> uniquement.",
    user: `
Écris une Prière d’ouverture spécifique à ${ref} (${version||"LSG"}).
Contraintes:
- Utiliser au moins 2 éléments de: ${JSON.stringify(motifs||[])}
- Nommer Dieu avec un attribut de: ${JSON.stringify(attrs||["Créateur","Libérateur","Juste","Miséricordieux"])}
- 1 paragraphe, 70–120 mots, ton humble et précis au passage.
- Interdictions: ${forbid.map(s=>`“${s}”`).join(", ")}.
- Commencer par une invocation + attribut; conclure brièvement (variante “amen”).
Graines: ${seed}.
${custom ? `Directives:\n${custom}` : ""}`.trim()
  };
}

/* ---------- Handler ---------- */

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Method Not Allowed" });

  try {
    if (req.body && req.body.probe) {
      return res.status(200).json({ ok:true, source:"probe", warn:"" });
    }

    const { book="Genèse", chapter=1, verse="", version="LSG", directives={} } = req.body || {};
    const reference = refString(book, chapter, verse);

    let sections = canonicalStudy(book, chapter, verse, version);
    let source   = "canonical";
    let warn     = "";

    let opening = "";

    if (OPENAI_API_KEY) {
      try {
        const motifsRaw = await callOpenAI({
          ...buildMotifsPrompt(reference, version, directives.priere_ouverture || ""),
          model: "gpt-4o-mini",
          temperature: 0.2, max_tokens: 250
        });
        const motifsJson = safeParseJSON(motifsRaw) || {};
        const motifs = Array.isArray(motifsJson.motifs) ? motifsJson.motifs.filter(Boolean).slice(0, 8) : [];
        const attrs  = Array.isArray(motifsJson.attributsDivins) ? motifsJson.attributsDivins.filter(Boolean).slice(0, 6) : ["Créateur","Libérateur","Juste","Miséricordieux"];

        const seed = simpleHash(`${reference}|${version}|${motifs.join("|")}`);
        opening = await callOpenAI({
          ...buildPrayerPrompt(reference, version, motifs, attrs, directives.priere_ouverture || "", seed),
          model: "gpt-4o-mini",
          temperature: 0.9, max_tokens: 450
        });
        if (!opening || opening.length < 40) {
          opening = buildOpeningPrayerFallback(book, chapter, verse, version);
          warn = "IA: motifs/prière trop courts — fallback varié";
        } else {
          source = "openai";
        }
      } catch {
        opening = buildOpeningPrayerFallback(book, chapter, verse, version);
        source = "canonical";
        warn   = "OpenAI indisponible — fallback varié";
      }
    } else {
      opening = buildOpeningPrayerFallback(book, chapter, verse, version);
      source  = "canonical";
      warn    = "AI désactivée — fallback varié";
    }

    if (sections && sections[0]) sections[0].content = opening;

    res.status(200).json({
      ok: true,
      source,
      warn,
      data: { reference, version: (version || "LSG"), sections }
    });
  } catch (e) {
    res.status(500).json({ ok:false, error: String(e?.message || e) });
  }
}

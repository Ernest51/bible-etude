// api/chat.js — Serverless Node runtime, génération “style modèle” + 28 rubriques UI strictes
// - Jamais de 500 : fallback riche si OpenAI indispo/lent
// - GET ?q="Genèse 1" ou POST { book, chapter, version }, ?probe=1 pour test

// ---------- Titres EXACTS (doivent rester identiques à l'UI) ----------
const TITLES = [
  "1. Prière d’ouverture",
  "2. Canon et testament",
  "3. Questions du chapitre précédent",
  "4. Titre du chapitre",
  "5. Contexte historique",
  "6. Structure littéraire",
  "7. Genre littéraire",
  "8. Auteur et généalogie",
  "9. Verset-clé doctrinal",
  "10. Analyse exégétique",
  "11. Analyse lexicale",
  "12. Références croisées",
  "13. Fondements théologiques",
  "14. Thème doctrinal",
  "15. Fruits spirituels",
  "16. Types bibliques",
  "17. Appui doctrinal",
  "18. Comparaison entre versets",
  "19. Comparaison avec Actes 2",
  "20. Verset à mémoriser",
  "21. Enseignement pour l’Église",
  "22. Enseignement pour la famille",
  "23. Enseignement pour enfants",
  "24. Application missionnaire",
  "25. Application pastorale",
  "26. Application personnelle",
  "27. Versets à retenir",
  "28. Prière de fin",
];

// ---------- Gabarit Markdown (les titres ci-dessus DOIVENT apparaître tels quels) ----------
const TEMPLATE = `# {{BOOK}} {{CHAP}}

1. Prière d’ouverture

{{S1}}

2. Canon et testament

{{S2}}

3. Questions du chapitre précédent

{{S3}}

4. Titre du chapitre

{{S4}}

5. Contexte historique

{{S5}}

6. Structure littéraire

{{S6}}

7. Genre littéraire

{{S7}}

8. Auteur et généalogie

{{S8}}

9. Verset-clé doctrinal

{{S9}}

10. Analyse exégétique

{{S10}}

11. Analyse lexicale

{{S11}}

12. Références croisées

{{S12}}

13. Fondements théologiques

{{S13}}

14. Thème doctrinal

{{S14}}

15. Fruits spirituels

{{S15}}

16. Types bibliques

{{S16}}

17. Appui doctrinal

{{S17}}

18. Comparaison entre versets

{{S18}}

19. Comparaison avec Actes 2

{{S19}}

20. Verset à mémoriser

{{S20}}

21. Enseignement pour l’Église

{{S21}}

22. Enseignement pour la famille

{{S22}}

23. Enseignement pour enfants

{{S23}}

24. Application missionnaire

{{S24}}

25. Application pastorale

{{S25}}

26. Application personnelle

{{S26}}

27. Versets à retenir

{{S27}}

28. Prière de fin

{{S28}}`.trim();

// ---------- Utils ----------
function parseQ(q){ if(!q) return {book:"",chapter:NaN}; const m=String(q).match(/^(.+?)\s+(\d+)\s*$/); return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN}; }

function youVersionLink(book,chapter){
  const map={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const code=map[book]; return code?`https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`:"";
}

function ok28(md,book,chapter){ if(!md||!md.startsWith(`# ${book} ${chapter}`)) return false; return TITLES.every(t=>md.includes(t)); }

// ---------- Fallback “riche” proche de ton modèle Genèse 1 ----------
function fallbackMarkdown(book,chapter){
  const ref=`${book} ${chapter}`; const link=youVersionLink(book,chapter)||"—";
  const S={
    S1:`Seigneur Tout-Puissant, Créateur du ciel et de la terre, éclaire ma lecture. Ouvre mon cœur pour que je voie ta grandeur et que je reçoive la vérité de ta Parole avec humilité et obéissance. Amen.`,
    S2:`Le livre de ${book} appartient au canon biblique de l’${["Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens","2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens","1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre","1 Jean","2 Jean","3 Jean","Jude","Apocalypse"].includes(book)?"Nouveau":"Ancien"} Testament.`,
    S3:`(Préparer au moins 5 questions de révision sur le chapitre précédent : compréhension, application, comparaison, mémorisation.)`,
    S4:`${book} ${chapter} — titre doctrinal concis (ex.: “Dieu crée et ordonne le monde”).`,
    S5:`Traditionnellement attribuée à Moïse, la Genèse fonde l’identité d’Israël. ${book} ${chapter} se situe dans le Proche-Orient ancien, face à des cosmogonies païennes. Ici, un seul Dieu, personnel et souverain, crée par sa Parole.`,
    S6:`Le texte est rythmé par des refrains (“Dieu dit… il y eut un soir, il y eut un matin”) marquant l’ordre et l’intention. Progression logique du chaos à l’habitable.`,
    S7:`Narratif théologique (prose solennelle).`,
    S8:`Auteur : Moïse (tradition), rattaché aux patriarches ; contexte de sortie d’Égypte.`,
    S9:`Genèse ${chapter}:27 — « Dieu créa l’homme à son image… » (LSG).`,
    S10:`Bara’ (“créer”) réservé à l’action divine ; “tohu-bohu” (v.2) : chaos informe ; “image de Dieu” (tselem Elohim) : dignité et vocation humaines.`,
    S11:`Mots clés : “tôv” (bon), “raqia” (étendue), “dominer/soumettre” (mandat culturel) — nuance de gérance responsable.`,
    S12:`Jean 1:1-3 ; Colossiens 1:16 ; Hébreux 11:3. YouVersion : ${link}`,
    S13:`Dieu unique, Créateur sage ; bonté essentielle de la création ; dignité de l’humain ; mandat culturel ; sabbat comme couronnement.`,
    S14:`Thème majeur : Dieu ordonne le chaos et confère une vocation à l’humanité.`,
    S15:`Gratitude, émerveillement, responsabilité, adoration, repos.`,
    S16:`Jours de la création préfigurant l’ordre, le sabbat comme type d’achèvement.`,
    S17:`Appui : Psaume 8 ; Psaume 104 ; Apocalypse 4:11.`,
    S18:`Comparer 1:1, 1:31 et 2:1-3 : ouverture, refrain de bonté, repos.`,
    S19:`L’Esprit répandu (Ac 2) inaugure une “nouvelle création” en Christ : Parole, lumière, communauté ordonnée.`,
    S20:`Genèse 1:1 — « Au commencement, Dieu créa les cieux et la terre. »`,
    S21:`Célébrer Dieu Créateur ; protéger la dignité humaine ; rythmer le temps (travail/repos).`,
    S22:`Transmettre la bonté de la création ; éduquer à la gérance et au repos.`,
    S23:`Version enfants : Dieu a tout fait avec amour ; nous sommes précieux ; prenons soin de la terre.`,
    S24:`Annoncer un Dieu Auteur du sens, non l’absurde ; relier création et Bonne Nouvelle.`,
    S25:`Accompagner ceux qui doutent de leur valeur ; prêcher une écologie biblique.`,
    S26:`Examiner : où je méprise la création ou l’image de Dieu ? décisions concrètes cette semaine.`,
    S27:`Genèse 1:1 ; 1:27 ; 1:28 ; Psaume 8:4-6 ; Jean 1:3.`,
    S28:`Père Créateur, merci pour la vie et la dignité reçues. Aide-nous à refléter ton image, honorer ta création et reconnaître ton autorité. Amen.`
  };
  return TEMPLATE
    .replace("{{BOOK}}",book).replace("{{CHAP}}",String(chapter))
    .replace("{{S1}}",S.S1).replace("{{S2}}",S.S2).replace("{{S3}}",S.S3).replace("{{S4}}",S.S4)
    .replace("{{S5}}",S.S5).replace("{{S6}}",S.S6).replace("{{S7}}",S.S7).replace("{{S8}}",S.S8)
    .replace("{{S9}}",S.S9).replace("{{S10}}",S.S10).replace("{{S11}}",S.S11).replace("{{S12}}",S.S12)
    .replace("{{S13}}",S.S13).replace("{{S14}}",S.S14).replace("{{S15}}",S.S15).replace("{{S16}}",S.S16)
    .replace("{{S17}}",S.S17).replace("{{S18}}",S.S18).replace("{{S19}}",S.S19).replace("{{S20}}",S.S20)
    .replace("{{S21}}",S.S21).replace("{{S22}}",S.S22).replace("{{S23}}",S.S23).replace("{{S24}}",S.S24)
    .replace("{{S25}}",S.S25).replace("{{S26}}",S.S26).replace("{{S27}}",S.S27).replace("{{S28}}",S.S28);
}

// ---------- Appel OpenAI (REST) avec timeout contrôlé ----------
async function openaiChatMarkdown({ book, chapter, apiKey, version="LSG" }){
  const SYSTEM = `
Tu dois produire une **étude biblique complète** en **Markdown**, exactement **28 rubriques** avec ces titres (dans cet ordre, sans texte hors canevas) :
${TITLES.join(" | ")}.
Règles :
- Style clair et pastoral, 3–6 phrases par rubrique.
- Quand pertinent, structure la **rubrique 6** (“Structure littéraire”) en listes (p.ex. “Jour 1…7” pour Genèse 1).
- “10. Analyse exégétique” = observations verset/par mot ; “11. Analyse lexicale” = mots originaux (hébreu/grec) + sens.
- “9. Verset-clé doctrinal” + “20. Verset à mémoriser” contiennent **référence + citation** (${version}).
- Tu peux insérer “YouVersion : <url>” en 9/12/20/27 si utile.
- Pas d’intros ni de conclusions hors des 28 rubriques.`.trim();

  const link = youVersionLink(book, chapter) || "—";
  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Respecte **strictement** les titres/ordre ci-dessus et remplis ce gabarit :

${TEMPLATE}

Aide-toi de ce **style-cible** (extrait) pour ${book} ${chapter} :
- Contexte historique : Genèse donnée à Israël comme fondation ; à contre-courant des cosmogonies païennes ; Dieu crée par sa Parole.
- Structure littéraire (ex. Genèse 1) : Jour 1…7 avec références.
- Exégèse/lexique : bara’, tohu-bohu, tselem Elohim, etc.
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const controller = new AbortController();
  const timeout = setTimeout(()=>controller.abort(), 18000); // 18s

  try{
    const r = await fetch("https://api.openai.com/v1/chat/completions",{
      method:"POST",
      headers:{ "Authorization":`Bearer ${apiKey}`, "Content-Type":"application/json" },
      body:JSON.stringify(payload),
      signal:controller.signal
    });
    const text = await r.text();
    if(!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0,200)}`);
    let data; try{ data=JSON.parse(text); }catch{ throw new Error("Réponse OpenAI invalide"); }
    return String(data?.choices?.[0]?.message?.content||"").trim();
  } finally { clearTimeout(timeout); }
}

// ---------- Handler principal ----------
export default async function handler(req, res){
  try{
    // Body + query
    let body={}; if(req.method==="POST"){ body=await new Promise((resolve)=>{ let b=""; req.on("data",c=>b+=c); req.on("end",()=>{ try{ resolve(JSON.parse(b||"{}")); }catch{ resolve({}); } }); }); }
    const url=new URL(req.url,`http://${req.headers.host}`), qp=Object.fromEntries(url.searchParams.entries());
    const probe=qp.probe==="1"||body.probe===true;

    let book=body.book||qp.book, chapter=Number(body.chapter||qp.chapter), version=body.version||qp.version||"LSG";
    const q=body.q||qp.q; if((!book||!chapter)&&q){ const p=parseQ(q); book=book||p.book; chapter=chapter||p.chapter; }
    const b=book||"Genèse", c=chapter||1;

    // Probe immédiat
    if(probe){ const md=fallbackMarkdown(b,c); res.setHeader("Content-Type","text/markdown; charset=utf-8"); return res.status(200).send(md); }

    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey){ const md=fallbackMarkdown(b,c); res.setHeader("Content-Type","text/markdown; charset=utf-8"); res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`); return res.status(200).send(md); }

    // Appel OpenAI
    let md; try{
      md=await openaiChatMarkdown({book:b, chapter:c, apiKey, version});
    }catch(e){
      const fb=fallbackMarkdown(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error",String(e?.message||e));
      return res.status(200).send(fb);
    }

    // Strict 28
    if(!ok28(md,b,c)){ const fb=fallbackMarkdown(b,c); res.setHeader("Content-Type","text/markdown; charset=utf-8"); res.setHeader("X-Format-Note","Gabarit partiel: fallback"); return res.status(200).send(fb); }

    res.setHeader("Content-Type","text/markdown; charset=utf-8");
    res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
    return res.status(200).send(md);
  }catch(e){
    try{
      const url=new URL(req.url,`http://${req.headers.host}`); const p=parseQ(url.searchParams.get("q")||""); const md=fallbackMarkdown(p.book||"Genèse",p.chapter||1);
      res.setHeader("Content-Type","text/markdown; charset=utf-8"); res.setHeader("X-Last-Error",String(e?.message||e)); return res.status(200).send(md);
    }catch{ res.setHeader("Content-Type","text/markdown; charset=utf-8"); return res.status(200).send(fallbackMarkdown("Genèse",1)); }
  }
}

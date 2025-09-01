// api/chat.js — 28 rubriques JSON -> Markdown + fallback riche + diagnostic

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

function parseQ(q){
  if(!q) return {book:"",chapter:NaN};
  const m=String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN};
}

function merge(book,chapter,obj){
  let t=TEMPLATE.replace("{{BOOK}}",book).replace("{{CHAP}}",String(chapter));
  for(let i=1;i<=28;i++){
    t=t.replace(`{{S${i}}}`, String(obj[`S${i}`]||"—").trim());
  }
  return t;
}

// ===== Fallback RICHE (style demandé pour Genèse 1) =====
function fallbackRich(book,chapter){
  // Si ce n’est PAS Genèse 1, on garde des textes sûrs et utiles
  const isGen1 = book==="Genèse" && Number(chapter)===1;

  if(isGen1){
    const obj={
      S1:`Seigneur Tout-Puissant, Créateur du ciel et de la terre, éclaire ma lecture. Ouvre mon cœur pour que je voie ta grandeur et que je reçoive la vérité de ta Parole avec humilité et obéissance. Amen.`,
      S2:`La Genèse, traditionnellement attribuée à Moïse, a été donnée à Israël comme fondement de son identité et de sa foi. Genèse 1 se situe dans le Proche-Orient ancien, où de nombreux récits païens d’origine du monde circulaient. Ici, la différence est claire : un seul Dieu, souverain et personnel, crée par sa Parole.`,
      S3:`Préparer au moins 5 questions de révision (comprendre, appliquer, comparer, retenir).`,
      S4:`Prologue de la création : Dieu, Créateur souverain, ordonne le chaos et établit l’humanité à son image.`,
      S5:`Contexte ANE : récits concurrents, mais Genèse 1 affirme un Dieu unique, bon et transcendant.`,
      S6:`Jour 1 : Lumière/ ténèbres ; Jour 2 : Étendue ; Jour 3 : Terre/ végétation ; Jour 4 : Astres ; Jour 5 : Poissons/ oiseaux ; Jour 6 : Animaux/ homme ; Jour 7 : Repos (Gn 2:1-3).`,
      S7:`Narratif théologique solennel, structuré par les refrains (“Dieu dit… Il y eut un soir, il y eut un matin”).`,
      S8:`Auteur (tradition) : Moïse ; lien aux patriarches et à l’alliance.`,
      S9:`Genèse 1:27 — « Dieu créa l’homme à son image, il le créa à l’image de Dieu, il créa l’homme et la femme. »`,
      S10:`bara’ (créer) réservé à Dieu ; tohu-bohu (v.2) : chaos avant l’ordre ; tselem Elohim : dignité/ vocation.`,
      S11:`mèlékha (œuvre), shabbat (repos) : rythme et finalité ; raqia (étendue).`,
      S12:`Jean 1:1-3 ; Colossiens 1:16 ; Hébreux 11:3.`,
      S13:`Dieu unique, bon et ordonnateur ; dignité humaine ; mandat culturel ; sabbat.`,
      S14:`La création, œuvre d’un Dieu sage et bon, confère dignité et vocation à l’humanité.`,
      S15:`Gratitude, adoration, responsabilité, espérance.`,
      S16:`Repos du 7e jour, ordre/ lumière ; typologie de la nouvelle création.`,
      S17:`Psaume 8 ; Psaume 104 ; Apocalypse 4:11.`,
      S18:`Comparer 1:1 ; 1:31 ; 2:1-3 : ouverture/ “bon”/ repos.`,
      S19:`Actes 2 : Parole et Esprit inaugurent une communauté nouvelle (nouvelle création).`,
      S20:`Genèse 1:1 — « Au commencement, Dieu créa les cieux et la terre. »`,
      S21:`Affirmer Dieu Créateur, protéger la dignité humaine, rythmer travail/ repos.`,
      S22:`Transmettre aux enfants la bonté de la création, éduquer à la gérance.`,
      S23:`Dieu a tout fait avec amour ; je suis précieux ; je prends soin de la terre.`,
      S24:`Annoncer que le monde a un Auteur et un sens ; relier à Christ (Jn 1).`,
      S25:`Accompagner ceux qui doutent de leur valeur ; écologie biblique responsable.`,
      S26:`Examiner où je méprise la création/ l’image de Dieu ; prendre des décisions concrètes.`,
      S27:`Genèse 1:1 ; 1:27 ; 1:28 ; Psaume 8 ; Jean 1:3.`,
      S28:`Père Créateur, merci pour la vie et la dignité. Aide-nous à refléter ton image, honorer ta création et reconnaître ton autorité. Amen.`
    };
    return merge(book,chapter,obj);
  }

  // Fallback générique mais propre pour tous les autres chapitres
  const obj={};
  for(let i=1;i<=28;i++){
    obj[`S${i}`]=`(À compléter pour ${book} ${chapter} — rubrique ${i})`;
  }
  // Quelques valeurs utiles par défaut
  obj.S1 = `Père céleste, nous venons devant toi. Ouvre nos cœurs, éclaire notre intelligence et conduis-nous dans ta vérité. Au nom de Jésus, amen.`;
  obj.S20 = `${book} ${chapter}:1 — verset de mémoire (à préciser).`;
  obj.S28 = `Seigneur, merci pour ta Parole. Aide-nous à la mettre en pratique. Amen.`;
  return merge(book,chapter,obj);
}

// ===== OpenAI JSON =====
async function askOpenAI_JSON({book,chapter,apiKey,version="LSG"}){
  const SYSTEM = `
Tu DOIS répondre en **JSON strict** (aucun texte hors JSON), avec **28** clés "s1"..."s28".
Chaque clé contient 3–6 phrases en français, style pastoral. Références selon ${version}.
Correspondance exacte :
s1=Prière d’ouverture, s2=Canon et testament, ... s28=Prière de fin.
`.trim();

  const USER = `
Livre="${book}", Chapitre="${chapter}", Version="${version}".
Renvoie **uniquement** un JSON valide avec les clés s1..s28.
`.trim();

  const payload = {
    model: "gpt-4o-mini",
    temperature: 0.35,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: USER }
    ]
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${apiKey}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0,200)}`);

  let data; try{ data=JSON.parse(text); }catch{ throw new Error("Réponse OpenAI invalide"); }
  const raw = data?.choices?.[0]?.message?.content || "";
  let obj; try{ obj=JSON.parse(raw); }catch{ throw new Error("Contenu non-JSON renvoyé"); }

  // Validation simple
  for(let i=1;i<=28;i++){
    if(typeof obj[`s${i}`] !== "string") throw new Error(`Champ manquant s${i}`);
  }
  const mapped = Object.fromEntries(Array.from({length:28},(_,i)=>[`S${i+1}`,obj[`s${i+1}`]]));
  return mapped;
}

export default async function handler(req,res){
  try{
    // ---- DIAGNOSTIC ----
    if(new URL(req.url, `http://${req.headers.host}`).searchParams.get("diag")==="1"){
      return res.status(200).json({
        hasKey: !!process.env.OPENAI_API_KEY,
        project: process.env.VERCEL_URL || "local"
      });
    }

    // Lecture des params
    let body={};
    if(req.method==="POST"){
      body = await new Promise(resolve=>{
        let b=""; req.on("data",c=>b+=c);
        req.on("end",()=>{ try{ resolve(JSON.parse(b||"{}")) } catch{ resolve({}) }});
      });
    }
    const url=new URL(req.url,`http://${req.headers.host}`);
    const qp=Object.fromEntries(url.searchParams.entries());
    let book=body.book||qp.book, chapter=Number(body.chapter||qp.chapter), version=body.version||qp.version||"LSG";
    const q=body.q||qp.q; if((!book||!chapter)&&q){ const p=parseQ(q); book=book||p.book; chapter=chapter||p.chapter; }
    const b=book||"Genèse", c=chapter||1;

    // Si pas de clé -> fallback
    const apiKey=process.env.OPENAI_API_KEY;
    if(!apiKey){
      const md=fallbackRich(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
      return res.status(200).send(md);
    }

    // IA -> JSON -> Markdown
    try{
      const sections = await askOpenAI_JSON({book:b,chapter:c,apiKey,version});
      const md = merge(b,c,sections);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("Content-Disposition",`inline; filename="${b}-${c}.md"`);
      return res.status(200).send(md);
    }catch(e){
      const md=fallbackRich(b,c);
      res.setHeader("Content-Type","text/markdown; charset=utf-8");
      res.setHeader("X-OpenAI-Error", String(e?.message||e));
      return res.status(200).send(md);
    }
  }catch(e){
    res.setHeader("Content-Type","text/markdown; charset=utf-8");
    return res.status(200).send(fallbackRich("Genèse",1));
  }
}

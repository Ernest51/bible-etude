// /api/chat.js — API robuste : 28 rubriques garanties (JSON strict + fallback)

const TITLES = [
  "1. Prière d’ouverture","2. Canon et testament","3. Questions du chapitre précédent","4. Titre du chapitre",
  "5. Contexte historique","6. Structure littéraire","7. Genre littéraire","8. Auteur et généalogie",
  "9. Verset-clé doctrinal","10. Analyse exégétique","11. Analyse lexicale","12. Références croisées",
  "13. Fondements théologiques","14. Thème doctrinal","15. Fruits spirituels","16. Types bibliques",
  "17. Appui doctrinal","18. Comparaison entre versets","19. Comparaison avec Actes 2","20. Verset à mémoriser",
  "21. Enseignement pour l’Église","22. Enseignement pour la famille","23. Enseignement pour enfants","24. Application missionnaire",
  "25. Application pastorale","26. Application personnelle","27. Versets à retenir","28. Prière de fin"
];

function parseQ(q){
  if(!q) return {book:"",chapter:NaN};
  const m=String(q).match(/^(.+?)\s+(\d+)\s*$/);
  return m?{book:m[1].trim(),chapter:Number(m[2])}:{book:String(q).trim(),chapter:NaN};
}

function youVersionLink(book,chapter){
  const map={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahoum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const code=map[book]; return code?`https://www.bible.com/fr/bible/93/${code}.${chapter}.LSG`:"";
}

// -------- Fallback “propre” en 28 sections (style discipliné)
function buildFallbackSections(book,chapter,version){
  const ref = `${book} ${chapter}`;
  const link=youVersionLink(book,chapter)||"";
  const S = [];
  const P = (i, body) => S.push({ id:i, title:TITLES[i-1], content:body.trim() });

  P(1,  `Père céleste, nous venons devant toi pour lire ${ref}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`);
  P(2,  `Le livre de ${book} appartient au canon biblique (${book === "Matthieu" || book==="Marc" || book==="Luc" || book==="Jean" || book==="Actes" ? "Nouveau" : "Ancien"} Testament).`);
  P(3,  `Prépare au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`);
  P(4,  `${ref} — titre doctrinal synthétique.`);
  P(5,  `Contexte historique : repères d’auteurs / époque / situation du peuple. ${ref} s’inscrit dans la trajectoire théologique du livre.`);
  P(6,  `Structure : découpe interne claire du chapitre (péricopes, refrains, parallélismes, progression logique).`);
  P(7,  `Genre littéraire : narratif/poétique/prophétique/sapientiel… et incidences d’interprétation.`);
  P(8,  `Auteur et généalogie : tradition, destinataires, filiation avec les patriarches / apôtres.`);
  P(9,  `Verset-clé du chapitre (${version}) — insère la référence + courte citation. ${link ? "YouVersion : "+link : ""}`);
  P(10, `Analyse exégétique : observations sur les verbes, constructions, connecteurs, relations logique/théologique.`);
  P(11, `Analyse lexicale : mots hébreux/grecs clés et leur charge sémantique pour l’argument.`);
  P(12, `Références croisées : passages parallèles/complémentaires, canonicité et unité de la révélation.`);
  P(13, `Fondements : attributs divins, création/chute/rédemption, alliance, sainteté, grâce, foi, espérance.`);
  P(14, `Thème doctrinal principal explicitement articulé par le chapitre et ses sous-thèses.`);
  P(15, `Fruits spirituels : louange, repentance, obéissance, charité, espérance, persévérance.`);
  P(16, `Types bibliques (s’il y en a) : figures, symboles, préfigurations christologiques.`);
  P(17, `Appui doctrinal : autres textes qui confirment la lecture théologique proposée.`);
  P(18, `Comparaison interne : mise en parallèle de versets du même chapitre pour la mise en relief.`);
  P(19, `Comparaison avec Actes 2 : continuité/discontinuité avec l’ecclésiologie naissante.`);
  P(20, `Verset à mémoriser (${version}) : référence + brève citation (respecter le texte biblique).`);
  P(21, `Pour l’Église : implications communautaires, culte, mission, discipline, service, unité.`);
  P(22, `Pour la famille : transmission, liturgie domestique, éducation, compassion, gestion.`);
  P(23, `Pour enfants : récits, images, questions simples, activités, prière adaptée.`);
  P(24, `Application missionnaire : annonce, témoignage, hospitalité, justice, miséricorde.`);
  P(25, `Application pastorale : accompagnement, encouragement, correction, formation.`);
  P(26, `Application personnelle : examen de conscience, décisions concrètes, prière.`);
  P(27, `Versets à retenir : 3–5 passages du chapitre en lien direct avec le thème.`)
  P(28, `Seigneur, merci pour la lumière reçue dans ${ref}. Aide-nous à la mettre en pratique à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`);
  return S;
}

// ---------- heuristiques de validation JSON renvoyé par l’IA
function isBadAI(sections){
  if(!Array.isArray(sections) || sections.length !== 28) return true;
  // Exiger du texte non trivial (éviter le dump de versets/titres vides)
  let ok = 0;
  for(const s of sections){
    const text = String(s?.content||"");
    const title = String(s?.title||"");
    if(title.trim().length === 0) return true; // on veut nos 28 titres
    const letters = text.replace(/[^A-Za-zÀ-ÿ]/g,"");
    if(letters.length >= 60) ok++;
  }
  return ok < 18; // si < 18 rubriques avec contenu “utile”, on considère mauvais
}

// ---------- Appel OpenAI (JSON mode strict)
async function askOpenAI({book,chapter,version,apiKey}){
  const SYSTEM = `
Tu dois répondre en **JSON strict**: { "sections": [ { "id":1, "title":"${TITLES[0]}", "content":"..." }, ..., { "id":28, "title":"${TITLES[27]}", "content":"..." } ] }.
- 28 entrées, ids 1..28, titres EXACTS comme donnés.
- Français pastoral, 3–6 phrases par section. Toute citation biblique en ${version}.
- Pour "Verset-clé" et "Verset à mémoriser", inclure "Référence + citation" (${version}).
- Ne renvoie rien d’autre que cet objet JSON unique.`.trim();

  const USER = `Livre="${book}", Chapitre="${chapter}", Version="${version}".`;

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
    headers:{ "Authorization":`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body: JSON.stringify(payload)
  });

  const text = await r.text();
  if(!r.ok) throw new Error(`OpenAI ${r.status}: ${text.slice(0,200)}`);

  let outer; try{ outer = JSON.parse(text); }catch{ throw new Error("Réponse OpenAI non-JSON"); }
  const raw = outer?.choices?.[0]?.message?.content || "";
  let obj;  try{ obj   = JSON.parse(raw); }catch{ throw new Error("Contenu IA non-JSON"); }

  const sections = Array.isArray(obj.sections) ? obj.sections : [];
  // Normaliser : imposer nos titres et ids au cas où
  const normalized = TITLES.map((t, i) => {
    const idx = i+1;
    const found = sections.find(s => Number(s?.id)===idx) || {};
    return { id: idx, title: t, content: String(found.content||"").trim() };
  });

  return normalized;
}

// ---------- handler
export default async function handler(req,res){
  res.setHeader("Cache-Control","no-store, no-cache, must-revalidate, max-age=0");
  try{
    // lecture entrée
    let body={};
    if(req.method==="POST"){
      body = await new Promise(resolve=>{
        let b=""; req.on("data",c=>b+=c);
        req.on("end",()=>{ try{resolve(JSON.parse(b||"{}"))}catch{resolve({})} });
      });
    }
    const url = new URL(req.url,`http://${req.headers.host}`);
    const qp  = Object.fromEntries(url.searchParams.entries());

    // inputs
    const q          = body.q || qp.q || "";
    let   book       = body.book || qp.book || parseQ(q).book || "Genèse";
    let   chapter    = Number(body.chapter || qp.chapter || parseQ(q).chapter || 1);
    const version    = (body.version || qp.version || "LSG").trim();

    // endpoints utilitaires
    if(url.pathname.endsWith("/ping")){
      return res.status(200).json({ pong:true, time:new Date().toISOString() });
    }
    if(url.pathname.endsWith("/health")){
      return res.status(200).json({
        ok:true, env:{ hasOpenAIKey: !!process.env.OPENAI_API_KEY, region: process.env.VERCEL_REGION||"local", node: process.version },
        time:new Date().toISOString()
      });
    }

    const reference = `${book} ${chapter}`;
    const apiKey    = process.env.OPENAI_API_KEY;

    // Si pas de clé : fallback direct
    if(!apiKey){
      const sections = buildFallbackSections(book,chapter,version);
      return res.status(200).json({ ok:true, source:"fallback-no-key", data:{ reference, version, sections }});
    }

    // Mode “probe=1” -> renvoie un fallback markdown simple (si tu en as besoin)
    const probe = qp.probe === "1" || body.probe === true;

    try{
      const sections = await askOpenAI({book,chapter,version,apiKey});
      if(isBadAI(sections)){
        const fb = buildFallbackSections(book,chapter,version);
        return res.status(200).json({ ok:true, source:"fallback-bad-ai", data:{ reference, version, sections: fb }});
      }
      return res.status(200).json({ ok:true, source:"openai", data:{ reference, version, sections }});
    }catch(e){
      // panne OpenAI => fallback
      const fb = buildFallbackSections(book,chapter,version);
      return res.status(200).json({ ok:true, source:"fallback-error", error:String(e?.message||e), data:{ reference, version, sections: fb }});
    }

  }catch(e){
    return res.status(500).json({ ok:false, error:String(e?.message||e) });
  }
}

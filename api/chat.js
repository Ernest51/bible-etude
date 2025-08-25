// /api/chat.js
export const config = { runtime: 'nodejs18.x' }; // runtime explicite

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_PROJECT = process.env.OPENAI_PROJECT || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o';

// === Spécifications par point ===
const SPEC = { /* … même contenu que ta version, inchangé … */ };
const TITRES = [ /* … même contenu que ta version, inchangé … */ ];

/* ---- utils http ---- */
function bad(res,msg){ res.statusCode=400; res.setHeader('Content-Type','application/json'); res.end(JSON.stringify({error:msg})); }
function ok(res,data,code=200){ res.statusCode=code; res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store'); res.end(JSON.stringify(data)); }
function chunk(a,n){ const out=[]; for(let i=0;i<a.length;i+=n) out.push(a.slice(i,i+n)); return out; }

/* ---- validations ---- */
const BOILER = /(voici\s+\d+\s+points|cette étude présente|nous allons|dans cette section)/i;
function norm(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function isJe(s){ return /\b(je|moi|mon|ma|mes)\b/i.test(s); }
function hasRef(s){
  return /\b(Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1\s*Samuel|2\s*Samuel|1\s*Rois|2\s*Rois|1\s*Chroniques|2\s*Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique|Ésaïe|Esaïe|Jérémie|Lamentations|Ézéchiel|Ezechiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1\s*Corinthiens|2\s*Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1\s*Thessaloniciens|2\s*Thessaloniciens|1\s*Timothée|2\s*Timothée|Tite|Philémon|Hébreux|Jacques|1\s*Pierre|2\s*Pierre|1\s*Jean|2\s*Jean|3\s*Jean|Jude|Apocalypse)\s+\d{1,3}([:.]\d{1,3}([-–]\d{1,3})?)?\b/i.test(s);
}
function valid(n,text,{minChars,livre,chapitre}){
  const t = norm(text);
  if (!t || t.length < minChars) return false;
  if (BOILER.test(t)) return false;
  if ((n===1||n===28) && (!isJe(t) || !new RegExp(`\\b${livre}\\b\\s+${chapitre}\\b`,'i').test(t))) return false;
  if (n!==1 && n!==4 && n!==28 && !hasRef(t)) return false;
  return true;
}
function dedupe(out){
  const seen=new Set();
  for (const k of Object.keys(out)){
    const n = norm(out[k]).toLowerCase();
    if (seen.has(n)) out[k] = '(*) Réécrire ce point pour éviter toute redite, développer un angle distinct.';
    seen.add(n);
  }
}

/* ---- OpenAI chat ---- */
async function chat({messages}){
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${OPENAI_API_KEY}`
  };
  if (OPENAI_PROJECT) headers['OpenAI-Project'] = OPENAI_PROJECT;

  const body = {
    model: MODEL,
    temperature: 0,
    top_p: 0,
    response_format: { type:'json_object' },
    messages
  };

  const r = await fetch('https://api.openai.com/v1/chat/completions', {method:'POST', headers, body:JSON.stringify(body)});
  const txt = await r.text();
  let j; try { j = JSON.parse(txt); } catch { throw new Error('Réponse OpenAI non JSON : '+txt.slice(0,200)); }
  if (!r.ok) throw new Error(j?.error?.message || ('HTTP '+r.status));
  const content = j?.choices?.[0]?.message?.content || '{}';
  let data; try { data = JSON.parse(content); } catch { throw new Error('Contenu non JSON'); }
  return data;
}

/* ---- messages ---- */
function sys(){
  return { role:'system', content:"Assistant d’étude biblique en français. Respect strict des consignes doctrinales et structurelles." };
}
function userBatch({livre,chapitre,version,indices,minChars}){
  const plan = TITRES.map((t,i)=>`${i+1}. ${t}`).join('\n');
  const spec = indices.map(n=>`- ${n}. ${SPEC[n]}`).join('\n');
  const keys = indices.map(String); const keyStr = keys.map(k=>`"${k}"`).join(', ');
  return {
    role:'user',
    content:
`Étude sur **${livre} ${chapitre}** (version ${version||'LSG'}).

Plan (28 points) :
${plan}

Produis uniquement les sections : [${keyStr}]
- longueur min ${minChars} caractères
- Markdown riche (**gras**, listes, tableaux |a|b|, frises, images)
- références bibliques explicites (ex: Genèse 1:1–3)
- pas de boilerplate
- p1 et p28 : prières à la première personne ("je"), mention explicite de ${livre} ${chapitre}

Exigences spécifiques :
${spec}

FORMAT : JSON { ${keyStr} }`
  };
}
function reviseMsg({livre,chapitre,n,minChars,cause,prev}){
  return {
    role:'user',
    content:`Réécris uniquement ${n} pour ${livre} ${chapitre} (≥${minChars} caractères). Cause: ${cause}. Ancienne version:
"""${prev}"""
FORMAT: JSON { "${n}": "..." }`
  };
}

/* ---- handler ---- */
export default async function handler(req,res){
  try{
    if (req.method!=='POST') return bad(res,'POST attendu');
    if (!OPENAI_API_KEY) return ok(res,{error:'OPENAI_API_KEY manquant'},500);

    let body={}; try{ body = typeof req.body==='object' ? req.body : JSON.parse(req.body||'{}'); }catch{ return bad(res,'JSON invalide'); }

    const livre = String(body.livre||'').trim();
    const chapitre = parseInt(body.chapitre,10);
    const version = String(body.version||'LSG').trim();
    const minChars = Math.max(1200, parseInt(body.min_chars_per_point,10)||2500);
    const batch = Math.min(4, Math.max(1, parseInt(body.batch_size,10)||2));

    if (!livre || !Number.isFinite(chapitre)) return bad(res,'Paramètres requis : livre, chapitre');

    const subset = (Array.isArray(body.subset)&&body.subset.length)
      ? body.subset.map(x=>parseInt(x,10)).filter(n=>n>=1&&n<=28)
      : Array.from({length:28},(_,i)=>i+1);

    const groups = chunk(subset,batch);
    const out={};
    const system=sys();

    for (const g of groups){
      const user=userBatch({livre,chapitre,version,indices:g,minChars});
      let obj=await chat({messages:[system,user]});

      for(const n of g){
        const key=String(n);
        let txt=obj[key]||'';
        if (BOILER.test(txt)) txt=txt.replace(BOILER,'').trim();

        let okFlag=valid(n,txt,{minChars,livre,chapitre});
        let tries=0;
        while(!okFlag && tries<2){
          tries++;
          const cause=!txt?'vide':(norm(txt).length<minChars?`<${minChars} chars`:(!hasRef(txt)?'refs manquantes':'invalide'));
          const fix=await chat({messages:[system,reviseMsg({livre,chapitre,n,minChars,cause,prev:txt})]});
          txt=fix[key]||txt;
          if (BOILER.test(txt)) txt=txt.replace(BOILER,'').trim();
          okFlag=valid(n,txt,{minChars,livre,chapitre});
        }
        out['p'+n]=txt; // ⚠ clé normalisée (p1..p28)
      }
    }
    dedupe(out);

    // Fallback prières
    if (!out.p1 || out.p1.length<200) out.p1=`Seigneur, éclaire mon étude sur ${livre} ${chapitre}, rends ma méditation vivante...`;
    if (!out.p28 || out.p28.length<200) out.p28=`Merci Seigneur pour ${livre} ${chapitre}, aide-moi à mettre en pratique cet enseignement.`;

    return ok(res,{ meta:{livre,chapitre,version,model:MODEL,minChars,batch}, ...out });
  }catch(e){
    console.error('[api/chat] error',e);
    return ok(res,{error:String(e?.message||e)},500);
  }
}

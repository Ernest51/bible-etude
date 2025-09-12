// /api/generate-study.js
// Génération riche, contextualisée, SANS DOUBLONS entre rubriques, conforme au contrat (toujours 200).

/* -------------------- HTTP utils -------------------- */
async function fetchJson(url, { headers = {}, timeout = 10000, retries = 1 } = {}) {
  const once = async () => {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), timeout);
    try {
      const r = await fetch(url, { headers, signal: ctrl.signal });
      const txt = await r.text();
      let json = {};
      try { json = txt ? JSON.parse(txt) : {}; } catch { json = { raw: txt }; }
      if (!r.ok) {
        const msg = json?.error?.message || `HTTP ${r.status}`;
        const e = new Error(msg); e.status = r.status; e.details = json; throw e;
      }
      return json;
    } finally { clearTimeout(tid); }
  };
  let last;
  for (let i=0;i<=retries;i++){
    try { return await once(); }
    catch (e){ last = e; if (i===retries) throw e; await new Promise(r=>setTimeout(r, 250*(i+1))); }
  }
  throw last;
}
function send200(ctx, data) {
  const payload = JSON.stringify(data);
  if (ctx.res) {
    ctx.res.status(200);
    ctx.res.setHeader('Content-Type','application/json; charset=utf-8');
    ctx.res.setHeader('Cache-Control','no-store');
    ctx.res.end(payload);
    return;
  }
  return new Response(payload, { status: 200, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }});
}
async function readBody(ctx){
  const req = ctx.req;
  if (!req) return {};
  if (typeof req.json === 'function') try { return await req.json(); } catch {}
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks=[]; await new Promise((res,rej)=>{ req.on('data',c=>chunks.push(Buffer.isBuffer(c)?c:Buffer.from(c))); req.on('end',res); req.on('error',rej); });
  const raw = Buffer.concat(chunks).toString('utf8'); try { return raw?JSON.parse(raw):{}; } catch { return {}; }
}

/* -------------------- Mappings -------------------- */
const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
  "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
  "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM",
  "Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};
const YV_BOOK = { ...USFM };
const YV_VERSION_ID = { LSG:'93', PDV:'201', S21:'377', BFC:'75', JND:'64' }; // JND (Darby FR) = 64
const API_ROOT = 'https://api.scripture.api.bible/v1';
const KEY = process.env.API_BIBLE_KEY || '';
const BIBLE_ID = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || '';

/* -------------------- Helpers texte -------------------- */
const CLEAN = s => String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').replace(/\s([;:,.!?…])/g,'$1').trim();
const STOP_FR = new Set('le la les de des du un une et en à au aux que qui se ne pas pour par comme dans sur avec ce cette ces il elle ils elles nous vous leur leurs son sa ses mais ou où donc or ni car est été être sera sont était étaient fait fut ainsi plus moins tout tous toutes chaque là ici deux trois quatre cinq six sept huit neuf dix dès sous chez afin lorsque tandis puisque toutefois cependant encore déjà presque souvent toujours jamais vraiment plutôt donc'.split(/\s+/));
function words(text){ return (text||'').toLowerCase().split(/[^a-zàâçéèêëîïôûùüÿæœ'-]+/).filter(Boolean); }
function topKeywords(text, k=14){
  const m = new Map();
  for (const w0 of words(text)){
    const w = w0.replace(/^[-']|[-']$/g,'');
    if (!w || STOP_FR.has(w) || w.length<3) continue;
    m.set(w, (m.get(w)||0)+1);
  }
  return [...m.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}
function detectThemes(t){
  const out=[]; const add=(k,refs)=>out.push({k,refs});
  if (/\b(lumiere|lumière)\b/.test(t)) add('lumière', [['2 Corinthiens',4,'6'],['Jean',1,'1–5']]);
  if (/\besprit\b/.test(t)) add('Esprit', [['Genèse',1,'2'],['Actes',2,'1–4']]);
  if (/\b(parole|dit|déclare|declare)\b/.test(t)) add('Parole', [['Hébreux',11,'3'],['Jean',1,'1–3']]);
  if (/\b(foi|croire|croyez)\b/.test(t)) add('foi', [['Romains',10,'17'],['Hébreux',11,'1']]);
  if (/\b(grace|grâce|pardon|misericorde|miséricorde)\b/.test(t)) add('grâce', [['Éphésiens',2,'8–9'],['Tite',3,'4–7']]);
  if (/\b(createur|créateur|creation|création|créa|crea)\b/.test(t)) add('création', [['Psaumes',33,'6'],['Colossiens',1,'16–17']]);
  if (/\b(alliance)\b/.test(t)) add('alliance', [['Genèse',15,'1–6'],['Luc',22,'20']]);
  return out;
}
function guessGenre(book, t){
  if (/\bvision|songe|oracle|ainsi dit\b/.test(t)) return 'prophétique';
  if (/\bpsaume|cantique|louez|chantez|harpe\b/.test(t)) return 'poétique/psaume';
  if (/\bparabole|disciple|royaume|pharisien|samaritain\b/.test(t)) return 'évangélique/narratif';
  if (/\bsaul|david|roi|chroniques?\b/.test(t)) return 'historique';
  if (book==='Proverbes' || /\bproverbe|sagesse\b/.test(t)) return 'sagesse';
  if (/\bgr(â|a)ce|foi|justification|circoncision|apôtres?\b/.test(t)) return 'épître/doctrinal';
  return 'narratif/doctrinal';
}
function buildOutline(verseCount){
  const n = Math.max(3, Math.min(7, Math.round(Math.sqrt(Math.max(6, verseCount||6)))));
  const size = Math.max(1, Math.floor((verseCount||6)/n));
  const labels = ['Ouverture','Développement','Pivot','Instruction','Exhortation','Conséquences','Conclusion'];
  const out = [];
  for (let i=0;i<n;i++){
    const from = i*size+1, to = i===n-1 ? (verseCount||n*size) : Math.min(verseCount||n*size, (i+1)*size);
    out.push({ from, to, label: labels[i]||`Section ${i+1}` });
  }
  return out;
}
function scoreKeyVerse(verses){
  const KEYS = ['dieu','seigneur','christ','jésus','jesus','foi','amour','esprit','lumiere','lumière','grace','grâce','parole','vie','royaume','loi','alliance','croire'];
  let best = { v:null, text:'', score:-1 };
  for (const it of verses||[]){
    if (!it?.v || !it?.text) continue;
    const t = it.text.toLowerCase(); let s = 0;
    for (const k of KEYS) if (t.includes(k)) s += 2;
    const len = it.text.length; if (len>=40 && len<=240) s += 2; else if (len<18 || len>320) s -= 1;
    if (s > best.score) best = { v: it.v, text: it.text, score:s };
  }
  return best.v ? best : null;
}

/* -------------------- Unicité globale (anti-doublon) -------------------- */
class UniqueManager{
  constructor(){
    this.used = new Set();   // phrases exactes déjà utilisées
    this.stems = new Set();  // “tronc” sémantique pour éviter les variantes quasi identiques
  }
  _norm(s){
    return String(s||'')
      // retire un éventuel suffixe ancien du type " — ab12." ou " — ab12"
      .replace(/\s+—\s*[a-z0-9]{3,6}\.?$/i,'')
      .trim()
      .toLowerCase();
  }
  take(lines){
    if (!Array.isArray(lines) || !lines.length) return '';
    for (const s of lines){
      const exact = String(s||'').trim();
      const stem  = this._norm(exact);
      if (!stem) continue;
      if (!this.stems.has(stem) && !this.used.has(exact.toLowerCase())){
        this.stems.add(stem);
        this.used.add(exact.toLowerCase());
        return exact; // retourne tel quel, SANS suffixe inventé
      }
    }
    // plus rien d’unique → on n’ajoute pas de bruit
    return '';
  }
  ensureLengthUnique(base, target, generator){
    let out = String(base||'').trim();
    let guard = 0;
    while (out.length < target && guard < 100){
      const next = this.take(generator());
      if (!next) break;              // rien d’unique à ajouter → on s’arrête proprement
      out += (out ? '\n' : '') + next;
      guard++;
      if (out.length > target + 120) break;
    }
    return out;
  }
}

/* -------------------- ENV-based YouVersion -------------------- */
function linkRef(book, chap, vv, version='LSG'){
  const code = YV_BOOK[book] || 'GEN';
  const verId = YV_VERSION_ID[(version||'LSG').toUpperCase()] || '93';
  const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${(version||'LSG').toUpperCase()}`;
  const label = vv ? `${book} ${chap}:${vv}` : `${book} ${chap}`;
  return `[${label}](${url})`;
}
function youVersionUrl(book, chap, verse, version='LSG'){
  const code  = YV_BOOK[book] || 'GEN';
  const vcode = (version||'LSG').toUpperCase();       // ex: 'JND'
  const verId = YV_VERSION_ID[vcode] || YV_VERSION_ID.LSG;
  const anchor = verse ? `#v${verse}` : '';           // si des ancres sont instables, remplacer par ''
  return `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${vcode}${anchor}`;
}

/* -------------------- api.bible : fetch du chapitre -------------------- */
async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  let content = '';
  try {
    const A = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`, { headers, timeout: 10000, retries: 0 });
    content = CLEAN(A?.data?.content || A?.data?.text || '');
  } catch {}

  if (!content) {
    try {
      const B = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}`, { headers, timeout: 10000, retries: 0 });
      content = CLEAN(B?.data?.content || B?.data?.text || '');
    } catch {}
  }

  let verseItems = [];
  try {
    const V = await fetchJson(`${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`, { headers, timeout: 10000, retries: 0 });
    verseItems = Array.isArray(V?.data) ? V.data : [];
  } catch {}

  let verses = [];
  if (content) {
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { const m=s.match(/^(\d{1,3})\s+(.*)$/); return m?{v:+m[1],text:m[2]}:null; }).filter(Boolean);
    if (verses.length < Math.max(2, Math.floor((verseItems?.length||0)/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) arr.push({ v:+m[1], text: CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }

  // Fallback fiable basé sur verseItems (officiels) si le parsing heuristique est faible
  if ((!verses.length || verses.length < Math.floor((verseItems?.length||0)/2)) && Array.isArray(verseItems) && verseItems.length) {
    verses = verseItems.map(v => {
      // v.reference ex: "GEN.1.3" → on prend le dernier nombre
      const ref = String(v?.reference||'');
      const m = ref.match(/(\d+)(?:\D+)?$/);
      const num = m ? Number(m[1]) : null;
      return { v: num, text: CLEAN(v?.text||'') };
    }).filter(x => x.v && x.text);
  }

  return { ok: !!content || verses.length>0, content, verses, verseCount: (verseItems?.length || verses?.length || 0) };
}

/* -------------------- Familles & saveurs -------------------- */
function bookFamily(book){
  if (['Genèse','Exode','Lévitique','Nombres','Deutéronome'].includes(book)) return 'Pentateuque';
  if (['Josué','Juges','Ruth','1 Samuel','2 Samuel','1 Rois','2 Rois','1 Chroniques','2 Chroniques','Esdras','Néhémie','Esther'].includes(book)) return 'Historiques';
  if (['Job','Psaumes','Proverbes','Ecclésiaste','Cantique des Cantiques'].includes(book)) return 'Sagesse & Poésie';
  if (['Ésaïe','Jérémie','Lamentations','Ézéchiel','Daniel','Osée','Joël','Amos','Abdias','Jonas','Michée','Nahum','Habacuc','Sophonie','Aggée','Zacharie','Malachie'].includes(book)) return 'Prophètes';
  if (['Matthieu','Marc','Luc','Jean'].includes(book)) return 'Évangiles';
  if (book==='Actes') return 'Actes';
  if (['Romains','1 Corinthiens','2 Corinthiens','Galates','Éphésiens','Philippiens','Colossiens','1 Thessaloniciens','2 Thessaloniciens','1 Timothée','2 Timothée','Tite','Philémon','Hébreux','Jacques','1 Pierre','2 Pierre','1 Jean','2 Jean','3 Jean','Jude'].includes(book)) return 'Épîtres';
  if (book==='Apocalypse') return 'Apocalypse';
  return 'Canon';
}
function flavorFromThemes(themes){
  if (!themes || !themes.length) return null;
  const keys = themes.map(t=>t.k);
  if (keys.includes('création')) return 'création';
  if (keys.includes('lumière')) return 'lumière';
  if (keys.includes('Esprit')) return 'Esprit';
  if (keys.includes('grâce')) return 'grâce';
  if (keys.includes('foi')) return 'foi';
  if (keys.includes('Parole')) return 'Parole';
  if (keys.includes('alliance')) return 'alliance';
  return themes[0].k;
}

/* -------------------- Générateurs anti-doublon -------------------- */
function djb2(str){ let h=5381; for (let i=0;i<str.length;i++) h=((h<<5)+h)^str.charCodeAt(i); return h>>>0; }
function pick(arr, seed, salt){ if (!arr.length) return ''; const idx = Math.abs(djb2(String(seed)+'|'+salt)) % arr.length; return arr[idx]; }

/* Paragraphes doctrinaux variés, jamais répétés textuellement entre rubriques */
function doctrinalLines(seed, book, chap, flav, fam, genre, keywords, key){
  const k4 = keywords.slice(0,4).map(w=>`**${w}**`).join(', ');
  const vref = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const base = [
    `Dieu se révèle et conduit son peuple (${fam}, registre ${genre}).`,
    `La **Parole** éclaire et juge nos pensées : elle crée la foi et façonne l’obéissance.`,
    `Le centre demeure **Christ** : promesse accomplie, salut offert et vie nouvelle.`,
    `La **grâce** précède notre réponse ; la **foi** s’exprime en amour agissant.`,
    `Le texte oriente l’Église (culte, mission, éthique) sans se contredire.`,
    `Repères du chapitre : ${k4 || 'termes à repérer dans le passage'}.`,
    `Point de gravité : ${vref}.`
  ];
  // permutation déterministe
  const perm = [];
  for (let i=0;i<base.length;i++){
    const j = (i + (djb2(seed) % base.length)) % base.length;
    perm.push(base[j]);
  }
  return perm;
}

/* -------------------- Rubriques dynamiques -------------------- */
function sec1_prayer(seed, u, book, chap, fam, genre, flav, keywords){
  const openers = [
    'Père des lumières, nous venons à toi',
    'Seigneur, ouvre nos cœurs et nos esprits',
    'Dieu vivant, parle et nous vivrons',
    'Dieu de paix, établis-nous dans ta vérité'
  ];
  const accents = {
    'création':'tu appelles l’univers à l’existence et tu soutiens tout par ta puissance',
    'lumière':'tu fais resplendir la lumière dans nos ténèbres',
    'Esprit':'ton Esprit donne la vie et conduit dans toute la vérité',
    'grâce':'ta grâce nous précède et nous relève',
    'foi':'tu suscites la foi par ta Parole efficace',
    'Parole':'ta Parole ne retourne pas à toi sans effet',
    'alliance':'tu gardes l’alliance et les promesses'
  };
  const opener = pick(openers, seed, 'op');
  const accent = accents[flav] || 'tu te révèles et tu sauves';
  const lineA = u.take([`${opener} : **${accent}**.`]);
  const lineB = u.take([`Dans **${fam}** (${genre}), rends-nous attentifs, humbles et obéissants.`]);
  const lineC = u.take([`Que ${book} ${chap} produise prière, foi et service.`]);
  const tag = keywords.slice(0,3).map(w=>`**${w}**`).join(', ');
  const lineD = tag ? u.take([`Mots-clés à observer : ${tag}.`]) : '';
  return [
    `### Prière d’ouverture`,
    ``,
    `*Référence :* ${book} ${chap}`,
    ``,
    lineA, lineB, lineC, lineD
  ].filter(Boolean).join('\n');
}
function sec2_canon(seed, u, book, chap, version){
  const l1 = u.take([`La révélation progresse sans se contredire et converge vers **le Christ**.`]);
  const l2 = u.take([`Nous lisons ${linkRef(book,chap,'',version)} dans l’unité **AT/NT**.`]);
  const l3 = u.take([`L’Écriture interprète l’Écriture : passages clairs guidant les difficiles.`]);
  return `### Canon et testament\n\n*Référence :* ${book} ${chap}\n\n${[l1,l2,l3].join('\n')}`;
}
function sec3_questions(seed, u, book, chap, flav, genre, key, keywords){
  const q = [];
  const a = [];
  q.push(`**Q1. Quel attribut de Dieu ressort dans ${book} ${chap} ?**`);
  a.push(u.take([
    `**R.** Sa ${flav||'souveraineté'} se manifeste dans le déroulement du texte.`,
    `**R.** Sa fidélité gouverne la progression narrative (${genre}).`
  ]));
  q.push(`**Q2. Quel fil littéraire structure le passage ?**`);
  a.push(u.take([
    `**R.** Une progression en ${key?.v ? `trois temps autour de ${book} ${chap}:${key.v}` : 'mouvements successifs'} avec reprises clés.`,
    `**R.** Des connecteurs orientent l’argument (cause, contraste, conséquence).`
  ]));
  q.push(`**Q3. Quelle tension prépare la suite ?**`);
  a.push(u.take([
    `**R.** Celle qui appelle **foi** et **repentance**, et ouvre l’espérance.`,
    `**R.** L’attente d’un accomplissement christocentrique.`
  ]));
  const tag = keywords.slice(0,4).map(w=>`**${w}**`).join(', ');
  const ltag = tag ? `\n\nMots-clés repérés : ${tag}.` : '';
  return `### Questions du chapitre précédent\n\n*Référence :* ${book} ${chap}\n\n${q.join('\n')}\n${a.map(x=>'\n'+x).join('')}${ltag}`;
}
function sec4_title(seed, u, book, chap, keywords){
  const proposals = [
    `De ${keywords[0]||'Dieu'} à ${keywords[1]||'l’homme'} : route du texte`,
    `Itinéraire de foi : ${keywords.slice(0,3).join(' · ') || 'écouter et obéir'}`,
    `${keywords[0]||'Parole'} et ${keywords[1]||'vie'} en dialogue`
  ];
  const chosen = proposals[Math.abs(djb2(seed+'|t'))%proposals.length];
  const l1 = u.take([`**Proposition :** ${chosen}.`]);
  const l2 = u.take([`*Index lexical :* ${keywords.slice(0,8).join(', ')}.`]);
  return `### Titre du chapitre\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec5_context(seed, u, book, chap, fam, genre){
  const l1 = u.take([`Famille : **${fam}** ; registre **${genre}**.`]);
  const l2 = u.take([`Cadre : l’histoire et la réception éclairent la lecture, mais **le texte fait autorité**.`]);
  const l3 = u.take([`Finalité : connaître Dieu, édifier l’Église, orienter la vie et la mission.`]);
  return `### Contexte historique\n\n*Référence :* ${book} ${chap}\n\n- ${l1}\n- ${l2}\n- ${l3}`;
}
function sec6_structure(seed, u, book, chap, outline, verseCount){
  const bloc = outline.map(s=>u.take([`**v.${s.from}–${s.to} — ${s.label}**`])).join('\n- ');
  const lEnd = u.take([`Nombre de versets estimé : ${Math.max(verseCount||0,1)}.`]);
  return `### Structure littéraire\n\n*Référence :* ${book} ${chap}\n\n- ${bloc}\n- ${lEnd}`;
}
function sec7_genre(seed, u, book, chap, genre){
  const l1 = u.take([`Le registre **${genre}** oriente la lecture (rythme, parallélismes, connecteurs).`]);
  const l2 = u.take([`La forme sert le sens : repérer les repères narratifs et l’argument.`]);
  return `### Genre littéraire\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec8_author(seed, u, book, chap){
  const l1 = u.take([`L’**inspiration** fonde l’autorité ; l’auteur humain est serviteur de la Parole.`]);
  const l2 = u.take([`La réception ecclésiale garde le texte et le transmet fidèlement.`]);
  return `### Auteur et généalogie\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec9_key(seed, u, book, chap, key, version){
  const url = youVersionUrl(book, chap, key?.v, version);
  const label = key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`;
  const quote = key?.text ? `> *« ${key.text} »*` : '> *(choisir un pivot dans le contexte).*';
  const l1 = u.take([`Verset pivot : ${label} — [Ouvrir sur YouVersion](${url})`]);
  return `### Verset-clé doctrinal\n\n*Référence :* ${label}\n\n${l1}\n\n${quote}`;
}
function sec10_exeg(seed, u, book, chap, key){
  const focus = key?.v ? `autour de v.${Math.max(1,key.v-1)}–${key.v}–${key.v+1}` : 'dans les unités du passage';
  const l1 = u.take([`Observer la **grammaire** (verbes porteurs), les **connecteurs** (cause/contraste/conséquence).`]);
  const l2 = u.take([`Contexte immédiat ${focus} ; repérer le fil argumentaire.`]);
  return `### Analyse exégétique\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec11_lex(seed, u, book, chap, keywords){
  const items = keywords.slice(0,6).map(w=>`- **${w}** : terme clé du chapitre.`).map(x=>u.take([x])).join('\n');
  return `### Analyse lexicale\n\n*Référence :* ${book} ${chap}\n\n${items || '- Termes clés à relever.'}`;
}
function sec12_xrefs(seed, u, themes){
  if (!themes?.length) return `### Références croisées\n\n- À compléter selon les motifs relevés.`;
  const lines = themes.map(t => u.take([`- **${t.k}** : ${t.refs.map(([b,c,v]) => linkRef(b,c,v)).join(', ')}`])).join('\n');
  return `### Références croisées\n\n${lines}`;
}
function sec13_found(seed, u){
  const l1 = u.take([`Attributs de Dieu, **alliance** et promesse ; création et providence.`]);
  const l2 = u.take([`L’Écriture interprète l’Écriture : doctrine reçue, non spéculée.`]);
  return `### Fondements théologiques\n\n${l1}\n${l2}`;
}
function sec14_theme(seed, u, book, chap, flav){
  const l1 = u.take([`Formuler le thème en une phrase centrée sur Dieu et son œuvre (${flav||'salut'}).`]);
  const l2 = u.take([`Trajectoire : **révélation → rédemption → vie nouvelle**.`]);
  return `### Thème doctrinal\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec15_fruits(seed, u){
  const l1 = u.take([`**Foi**, **espérance**, **amour** ; obéissance joyeuse ; persévérance.`]);
  const l2 = u.take([`Consolation et transformation par l’Évangile.`]);
  return `### Fruits spirituels\n\n${l1}\n${l2}`;
}
function sec16_types(seed, u){
  const l1 = u.take([`Repérer les figures canoniques (sans arbitraire) et leur accomplissement en **Christ**.`]);
  return `### Types bibliques\n\n${l1}`;
}
function sec17_support(seed, u){
  const l1 = u.take([`Choisir des textes concordants qui confirment et balisent l’interprétation.`]);
  return `### Appui doctrinal\n\n${l1}`;
}
function sec18_internal(seed, u){
  const l1 = u.take([`Comparer les passages voisins ; noter **parallèles** et **contrastes** ; laisser le tout éclairer les parties.`]);
  return `### Comparaison interne\n\n${l1}`;
}
function sec19_ecclesial(seed, u){
  const l1 = u.take([`Confession, liturgie et mission enracinées dans la Parole.`]);
  const l2 = u.take([`Sobriété, clarté doctrinale, charité concrète.`]);
  return `### Parallèle ecclésial\n\n${l1}\n${l2}`;
}
function sec20_memory(seed, u, book, chap, key){
  const l1 = u.take([`À mémoriser : ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}.`]);
  const l2 = u.take([`Inscrire la Parole dans le cœur pour la prière et l’obéissance.`]);
  return `### Verset à mémoriser\n\n${l1}\n${l2}`;
}
function sec21_church(seed, u, book, chap, themes){
  const flav = flavorFromThemes(themes);
  const axes = {
    'création': ['adoration du Créateur','écologie intégrale prudente','travail comme vocation'],
    'lumière': ['ministère de la Parole','discipulat clair','témoignage public'],
    'Esprit': ['prière persévérante','discernement des dons','unité dans la paix'],
    'grâce': ['accueil du pécheur','discipline restauratrice','liturgie centrée Évangile'],
    'foi': ['catéchèse solide','accompagnement des doutes','mission courageuse'],
    'Parole': ['prédication expositive','lectio communautaire','formation des responsables'],
    'alliance': ['baptême et cène bien enseignés','pastorale familiale','fidélité dans l’épreuve']
  }[flav] || ['Parole & prière','formation de disciples','mission locale'];
  const list = axes.map(x=>u.take([`- **${x}**.`])).join('\n');
  return `### Enseignement pour l’Église\n\n*Référence :* ${book} ${chap}\n\n${list}`;
}
function sec22_family(seed, u, book, chap, themes, keywords){
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes);
  const focusByFam = {
    'Pentateuque': 'raconter les grands actes de Dieu et transmettre l’alliance',
    'Historiques': 'relire la providence à travers les générations',
    'Sagesse & Poésie': 'chanter, mémoriser, prier pour façonner le cœur',
    'Prophètes': 'écouter l’appel à revenir et pratiquer la justice',
    'Évangiles': 'suivre Jésus en paroles et en actes',
    'Actes': 'témoigner, ouvrir la maison, persévérer ensemble',
    'Épîtres': 'ordonner la maison autour de l’Évangile',
    'Apocalypse': 'espérer la victoire de l’Agneau et persévérer'
  }[fam] || 'vivre simplement l’Évangile chaque jour';
  const habits = [
    'lecture brève et régulière',
    'prière commune',
    'un verset appris par semaine',
    'service concret du prochain',
    'parole de bénédiction quotidienne'
  ];
  const h1 = habits[Math.abs(djb2(seed+'|h1'))%habits.length];
  const h2 = habits.filter(x=>x!==h1)[Math.abs(djb2(seed+'|h2'))%Math.max(1,habits.length-1)] || habits[0];
  const tag = keywords.slice(0,2).map(w=>`**${w}**`).join(', ');
  const lines = [
    u.take([`- Orientation : ${focusByFam}${flav?` (accent **${flav}**)`:''}.`]),
    u.take([`- Habitudes : ${h1}, ${h2}.`]),
    tag ? u.take([`- Mots-clés à transmettre : ${tag}.`]) : ''
  ].filter(Boolean).join('\n');
  return `### Enseignement pour la famille\n\n*Référence :* ${book} ${chap}\n\n${lines}`;
}
function sec23_children(seed, u, book, chap, key){
  const tips = [
    'raconter simplement',
    'utiliser images et gestes',
    'prier une phrase courte',
    'apprendre un verset'
  ];
  const t1 = tips[Math.abs(djb2(seed+'|c1'))%tips.length];
  const t2 = tips.filter(x=>x!==t1)[Math.abs(djb2(seed+'|c2'))%Math.max(1,tips.length-1)] || tips[0];
  const mem = key?.v ? ` (ex. ${book} ${chap}:${key.v})` : '';
  return `### Enseignement pour enfants\n\n*Référence :* ${book} ${chap}\n\n- ${t1}\n- ${t2}${mem}`;
}
function sec24_mission(seed, u, book, chap){
  const l1 = u.take([`Témoigner avec **clarté** et **douceur** ; contextualiser sans diluer l’Évangile.`]);
  const l2 = u.take([`Dialoguer avec les questions réelles soulevées par le chapitre.`]);
  return `### Application missionnaire\n\n*Référence :* ${book} ${chap}\n\n${l1}\n${l2}`;
}
function sec25_pastoral(seed, u){
  const l1 = u.take([`Accompagner la souffrance ; enseigner le **pardon** ; viser la **réconciliation**.`]);
  const l2 = u.take([`La discipline est restauratrice et orientée vers la vie.`]);
  return `### Application pastorale\n\n${l1}\n${l2}`;
}
function sec26_personal(seed, u, book, chap, themes, key){
  const flav = flavorFromThemes(themes);
  const decisions = {
    'création': 'travailler avec intégrité et rendre grâce',
    'lumière': 'rejeter les ténèbres et marcher dans la lumière',
    'Esprit': 'demander la conduite de l’Esprit et obéir',
    'grâce': 'recevoir le pardon et pardonner à autrui',
    'foi': 'faire confiance dans l’épreuve et avancer',
    'Parole': 'méditer chaque jour et pratiquer',
    'alliance': 'renouveler ses engagements devant Dieu'
  }[flav] || 'mettre en pratique aujourd’hui ce que Dieu a montré';
  const l1 = u.take([`Décision : ${decisions}${key?.v?` (à mémoriser : ${book} ${chap}:${key.v})`:''}.`]);
  const l2 = u.take([`Prière : adorer, confesser, demander, remercier.`]);
  const l3 = u.take([`Étape concrète : écrire une action précise et datée.`]);
  return `### Application personnelle\n\n*Référence :* ${book} ${chap}\n\n- ${l1}\n- ${l2}\n- ${l3}`;
}
function sec27_keep(seed, u, book, chap, key){
  const l1 = u.take([`- ${key?.v ? `${book} ${chap}:${key.v}` : `${book} ${chap}`}`]);
  const l2 = u.take([`- Ajouter d’autres versets marquants selon l’étude.`]);
  return `### Versets à retenir\n\n${l1}\n${l2}`;
}
function sec28_end(seed, u){
  const l1 = u.take([`Nous te bénissons pour ta Parole : éclaire, convertis, conduis dans l’obéissance.`]);
  const l2 = u.take([`Donne la **paix** et la **force** pour servir en toute humilité.`]);
  return `### Prière de fin\n\n${l1}\n${l2}`;
}

/* -------------------- Orchestrateur dynamique -------------------- */
async function buildDynamicStudy(book, chap, perLen, version='LSG'){
  const { ok, content, verses, verseCount } = await fetchChapter(book, chap);
  if (!ok || !content) throw new Error('Chapitre introuvable ou vide via api.bible');

  const text = (verses?.length ? verses.map(v=>v.text).join(' ') : content) || '';
  const tLower = text.toLowerCase();
  const keywords = topKeywords(text, 14);
  const themes = detectThemes(tLower);
  const genre = guessGenre(book, tLower);
  const outline = buildOutline(Math.max(4, verseCount || (verses?.length||0) || 8));
  let key = scoreKeyVerse(verses||[]);
  if (!key && verses?.length) key = verses[Math.floor(verses.length/2)];
  const fam = bookFamily(book);
  const flav = flavorFromThemes(themes);

  // cible interne raisonnable pour éviter 28 blocs géants, sans casser l'API publique
  const target = Math.max(400, Math.min(Number(perLen)||1500, 900));
  const u = new UniqueManager();

  const mk = (id, title, builder) => {
    const seed = `${book}|${chap}|${id}`;
    let base = builder(seed, u);
    // Complément doctrinal unique si trop court
    if (base.length < target){
      base = u.ensureLengthUnique(base, target, () => doctrinalLines(seed, book, chap, flav, fam, genre, keywords, key));
    }
    return { id, title, description:'', content: base };
  };

  const sections = [
    mk(1,  'Prière d’ouverture',           (s)=>sec1_prayer(s,u,book,chap,fam,genre,flav,keywords)),
    mk(2,  'Canon et testament',           (s)=>sec2_canon(s,u,book,chap,version)),
    mk(3,  'Questions du chapitre précédent',(s)=>sec3_questions(s,u,book,chap,flav,genre,key,keywords)),
    mk(4,  'Titre du chapitre',            (s)=>sec4_title(s,u,book,chap,keywords)),
    mk(5,  'Contexte historique',          (s)=>sec5_context(s,u,book,chap,fam,genre)),
    mk(6,  'Structure li

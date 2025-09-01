// public/app.js — FRONT-ONLY (no imports)
// Version robuste : accepte Markdown OU JSON depuis /api/chat, reconstruit un .md si besoin.
// Télécharge automatiquement le .md et remplit l’UI 28 points.
(function () {
  // ---------- utils / ui ----------
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => (progressBar && (progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fakePrep = async () => { setProgress(15); await wait(120); setProgress(55); await wait(120); setProgress(100); setTimeout(()=>setProgress(0),260); };

  const searchRef=$("searchRef"), bookSelect=$("bookSelect"), chapterSelect=$("chapterSelect"),
        verseSelect=$("verseSelect"), versionSelect=$("versionSelect"),
        validateBtn=$("validate"), generateBtn=$("generateBtn"),
        readLink=$("readLink"), lastStudy=$("lastStudy"),
        pointsList=$("pointsList"), edTitle=$("edTitle"), noteArea=$("noteArea"),
        prevBtn=$("prev"), nextBtn=$("next"), metaInfo=$("metaInfo"),
        btnDbg=$("debugBtn"), panel=$("debugPanel"),
        dotHealth=$("dot-health"), dotChat=$("dot-chat"), dotPing=$("dot-ping");

  $("y") && ($("y").textContent = new Date().getFullYear());
  const setMini=(dot,ok)=>{ if(!dot) return; dot.classList.remove('ok','ko'); if(ok===true) dot.classList.add('ok'); else if(ok===false) dot.classList.add('ko'); };
  const dlog=(msg)=>{ if(!panel) return; panel.style.display='block'; if(btnDbg) btnDbg.textContent='Fermer Debug'; const line='['+new Date().toISOString()+'] '+msg; panel.textContent+=(panel.textContent?'\n':'')+line; console.log(line); };

  // ---------- livres ----------
  const BOOKS = [
    ["Genèse",50],["Exode",40],["Lévitique",27],["Nombres",36],["Deutéronome",34],
    ["Josué",24],["Juges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
    ["1 Rois",22],["2 Rois",25],["1 Chroniques",29],["2 Chroniques",36],["Esdras",10],
    ["Néhémie",13],["Esther",10],["Job",42],["Psaumes",150],["Proverbes",31],
    ["Ecclésiaste",12],["Cantique des cantiques",8],["Ésaïe",66],["Jérémie",52],["Lamentations",5],
    ["Ézéchiel",48],["Daniel",12],["Osée",14],["Joël",3],["Amos",9],
    ["Abdias",1],["Jonas",4],["Michée",7],["Nahoum",3],["Habacuc",3],
    ["Sophonie",3],["Aggée",2],["Zacharie",14],["Malachie",4],
    ["Matthieu",28],["Marc",16],["Luc",24],["Jean",21],["Actes",28],
    ["Romains",16],["1 Corinthiens",16],["2 Corinthiens",13],["Galates",6],["Éphésiens",6],
    ["Philippiens",4],["Colossiens",4],["1 Thessaloniciens",5],["2 Thessaloniciens",3],["1 Timothée",6],
    ["2 Timothée",4],["Tite",3],["Philémon",1],["Hébreux",13],["Jacques",5],
    ["1 Pierre",5],["2 Pierre",3],["1 Jean",5],["2 Jean",1],["3 Jean",1],
    ["Jude",1],["Apocalypse",22]
  ];
  const NT_START_INDEX = BOOKS.findIndex(([n])=>n==="Matthieu"); // 39 (0-based)

  function renderBooks(){ if(!bookSelect) return; bookSelect.innerHTML=''; BOOKS.forEach(([n,ch])=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; o.dataset.ch=ch; bookSelect.appendChild(o); }); }
  function renderChapters(){ if(!chapterSelect || !bookSelect) return; chapterSelect.innerHTML=''; const ch=bookSelect.selectedOptions[0]?+bookSelect.selectedOptions[0].dataset.ch:1; for(let i=1;i<=ch;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);} }
  function renderVerses(max=60){ if(!verseSelect) return; verseSelect.innerHTML=''; const m=Math.max(1,Math.min(200,max)); for(let i=1;i<=m;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);} }
  function updateReadLink(){ if(!readLink || !bookSelect || !chapterSelect || !verseSelect || !versionSelect) return; const ref=`${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`; const ver=versionSelect.value; readLink.href='https://www.biblegateway.com/passage/?search='+encodeURIComponent(ref)+'&version='+encodeURIComponent(ver); }

  // ---------- rubriques fixes (28) ----------
  const FIXED_POINTS = [
    {t:"Prière d’ouverture",d:"Invocation du Saint-Esprit pour éclairer l’étude."},
    {t:"Canon et testament",d:"Identification du livre selon le canon biblique."},
    {t:"Questions du chapitre précédent",d:"(Min. 5) Réponses intégrales, éléments de compréhension exigés."},
    {t:"Titre du chapitre",d:"Résumé doctrinal synthétique du chapitre étudié."},
    {t:"Contexte historique",d:"Période, géopolitique, culture, carte localisée à l’époque."},
    {t:"Structure littéraire",d:"Séquençage narratif et composition interne du chapitre."},
    {t:"Genre littéraire",d:"Type de texte : narratif, poétique, prophétique, etc."},
    {t:"Auteur et généalogie",d:"Présentation de l’auteur et son lien aux patriarches."},
    {t:"Verset-clé doctrinal",d:"Verset central du chapitre avec lien cliquable."},
    {t:"Analyse exégétique",d:"Commentaire mot-à-mot avec références au grec/hébreu."},
    {t:"Analyse lexicale",d:"Analyse des mots-clés originaux et leur sens doctrinal."},
    {t:"Références croisées",d:"Passages parallèles ou complémentaires."},
    {t:"Fondements théologiques",d:"Doctrines majeures du chapitre."},
    {t:"Thème doctrinal",d:"Lien avec les 22 grands thèmes doctrinaux."},
    {t:"Fruits spirituels",d:"Vertus et attitudes inspirées par le chapitre."},
    {t:"Types bibliques",d:"Symboles / figures typologiques."},
    {t:"Appui doctrinal",d:"Autres passages qui renforcent l’enseignement."},
    {t:"Comparaison entre versets",d:"Mise en relief au sein du chapitre."},
    {t:"Comparaison avec Actes 2",d:"Parallèle avec le début de l’Église."},
    {t:"Verset à mémoriser",d:"Verset essentiel à retenir."},
    {t:"Enseignement pour l’Église",d:"Implications collectives / ecclésiales."},
    {t:"Enseignement pour la famille",d:"Valeurs à transmettre dans le foyer."},
    {t:"Enseignement pour enfants",d:"Approche simplifiée, jeux, récits, visuels."},
    {t:"Application missionnaire",d:"Comment le texte guide l’évangélisation."},
    {t:"Application pastorale",d:"Conseils pour ministres / enseignants."},
    {t:"Application personnelle",d:"Examen de conscience et engagement."},
    {t:"Versets à retenir",d:"Incontournables pour prédication pastorale."},
    {t:"Prière de fin",d:"Clôture spirituelle avec reconnaissance."}
  ];
  const N = FIXED_POINTS.length;

  // ---------- état ----------
  let current=0, notes={}, autosaveTimer=null, autoTimer=null, inFlight=false;

  function renderSidebar(){
    if(!pointsList) return;
    pointsList.innerHTML='';
    FIXED_POINTS.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='item'+(i===current?' active':'');
      row.dataset.idx=i;
      row.innerHTML=`<span class="idx">${i+1}</span>
      <div><div>${r.t}</div><span class="desc">${r.d||''}</span></div>
      <span class="dot ${notes[i]&&notes[i].trim()?'ok':''}"></span>`;
      row.addEventListener('click',()=>{ if(current!==i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){ document.querySelectorAll('.list .item').forEach(el=>{ const i=+el.dataset.idx, dot=el.querySelector('.dot'); if(!dot) return; if(notes[i]&&notes[i].trim()) dot.classList.add('ok'); else dot.classList.remove('ok'); }); }
  function select(i){ if(noteArea) notes[current]=noteArea.value; saveStorage(); current=i; document.querySelectorAll('.list .item').forEach(el=>el.classList.toggle('active',+el.dataset.idx===current)); if(edTitle) edTitle.textContent=`${i+1}. ${FIXED_POINTS[i].t}`; if(noteArea) noteArea.value=notes[i]||''; if(metaInfo) metaInfo.textContent=`Point ${i+1} / ${N}`; if(noteArea) noteArea.focus(); }
  function saveStorage(){ try{ localStorage.setItem('be_notes', JSON.stringify(notes)); renderSidebarDots(); }catch{} }

  // ---------- saisie / sélection ----------
  const norm = s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9: ]+/g,' ').replace(/\s+/g,' ').trim();
  function parseSearch(q){
    q=(q||'').trim(); const m=q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/); if(!m) return null;
    const title=norm(m[1]); let book=null;
    for(const [name] of BOOKS){ if(norm(name)===title){ book=name; break; } }
    if(!book){ const cand=BOOKS.find(([name])=> norm(name).startsWith(title)); if(cand) book=cand[0]; }
    if(!book) return null; return {book, chap:+m[2], vers:m[3]?+m[3]:null};
  }
  function applySelection(sel){
    if(!sel || !bookSelect) return; const idx=BOOKS.findIndex(([n])=>n===sel.book); if(idx>=0) bookSelect.selectedIndex=idx;
    renderChapters(); const chMax=bookSelect.selectedOptions[0]?+bookSelect.selectedOptions[0].dataset.ch:1; const chap=Math.max(1,Math.min(chMax, sel.chap||1)); if(chapterSelect) chapterSelect.value=String(chap);
    renderVerses(sel.book==="Psaumes"?200:60); if(sel.vers && verseSelect) verseSelect.value=String(sel.vers); updateReadLink();
  }
  function buildReference(){ const typed=(searchRef&&searchRef.value||'').trim(); if(typed) return typed; if(!bookSelect||!chapterSelect) return ''; const b=bookSelect.value, c=chapterSelect.value; return c?`${b} ${c}`:b; }

  // ---------- cache Markdown ----------
  function cacheKey(ref, ver){ return `be_cache_md:${ref}::${ver||'LSG'}`; }
  function loadCache(ref, ver){ try{ return localStorage.getItem(cacheKey(ref,ver)); }catch{ return null; } }
  function saveCache(ref, ver, md){ try{ localStorage.setItem(cacheKey(ref,ver), md); }catch{} }

  // ---------- helpers Markdown <-> JSON ----------
  function mdEscape(s){ return String(s||"").replace(/\r?\n/g, "\n"); }
  function buildMdFromSections(title, sections){
    // sections: [{id,title,content}] ou [{idx,title,content}]
    let md = "# " + title + "\n\n";
    for (let i=0;i<28;i++){
      const s = sections.find(x => (x.id||x.idx) === (i+1)) || sections[i] || {};
      const header = s.title ? s.title : `${i+1}.`;
      const body = mdEscape(s.content||"—");
      md += header + "\n\n" + body + "\n\n";
    }
    return md.trim() + "\n";
  }

  // ---------- téléchargement fichier ----------
  function download(text, filename) {
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "etude.md";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ---------- RÉCUPÉRATION depuis /api/chat ----------
  async function rawFetchChat_POST(book, chapter, version){
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ book, chapter, version })
    });
    const ct = r.headers.get("content-type") || "";
    const text = await r.text().catch(()=> "");
    return { ok:r.ok, status:r.status, ct, text };
  }
  async function rawFetchChat_GET(q){
    const r = await fetch(`/api/chat?q=${encodeURIComponent(q)}`);
    const ct = r.headers.get("content-type") || "";
    const text = await r.text().catch(()=> "");
    return { ok:r.ok, status:r.status, ct, text };
  }

  function tryParseJson(text){
    try { return JSON.parse(text); } catch { return null; }
  }

  function extractMarkdownOrBuild(refTitle, payload, contentType){
    // 1) Si c'est déjà du Markdown (heuristique simple)
    if (typeof payload === "string") {
      const txt = payload.trim();
      if (txt) return txt; // on accepte tout (plus de contrainte "^#")
    }
    // 2) JSON (formats possibles)
    const j = typeof payload === "string" ? tryParseJson(payload) : payload;
    if (j && j.ok && j.data) {
      // format ancien: { ok:true, data:{ reference, sections:[{id,title,content}]} }
      const title = j.data.reference || refTitle || "Étude";
      const sections = Array.isArray(j.data.sections) ? j.data.sections : [];
      return buildMdFromSections(title, sections);
    }
    // 3) JSON direct sections
    if (j && Array.isArray(j.sections)) {
      const title = j.reference || refTitle || "Étude";
      return buildMdFromSections(title, j.sections);
    }
    // 4) Rien d’exploitable
    return null;
  }

  async function fetchMarkdown({ book, chapter, version="LSG" }) {
    // 1) POST (préféré)
    try {
      const post = await rawFetchChat_POST(book, chapter, version);
      dlog(`POST /api/chat → ${post.status} (${post.ct})`);
      const md1 = extractMarkdownOrBuild(`${book} ${chapter}`, post.text, post.ct);
      if (post.ok && md1) return md1;
    } catch (e) {
      dlog(`POST /api/chat ERROR: ${e && e.message}`);
    }

    // 2) Fallback GET ?q=
    try {
      const getR = await rawFetchChat_GET(`${book} ${chapter}`);
      dlog(`GET /api/chat?q=… → ${getR.status} (${getR.ct})`);
      const md2 = extractMarkdownOrBuild(`${book} ${chapter}`, getR.text, getR.ct);
      if (getR.ok && md2) return md2;
      // remonte une erreur avec extrait de la réponse
      const sample = (getR.text||"").slice(0,220).replace(/\s+/g,' ').trim();
      throw new Error(`GET /api/chat a échoué (${getR.status}). Extrait: ${sample || "—"}`);
    } catch (e2) {
      throw e2;
    }
  }

  // ---------- post-traitements sûrs ----------
  function defaultPrayerOpen(reference){
    return `Père céleste, nous venons devant toi pour lire ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`;
  }
  function defaultPrayerClose(reference){
    return `Seigneur, merci pour la lumière reçue dans ${reference}. Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;
  }
  function ensureKeyVerse(body, reference){
    const txt=String(body||'');
    const hasRef = /\b\d+:\d+\b/.test(txt) || /[A-Za-zÀ-ÿ]+\s+\d+:\d+/.test(txt);
    if(hasRef) return txt;
    const ref = reference || buildReference(); const chap=(ref.match(/\b(\d+)\b/)||[])[1]||'1';
    return `Verset-clé proposé : ${ref.split(' ')[0]} ${chap}:1 — ${txt}`.trim();
  }

  // ---------- génération principale ----------
  async function generateStudy(){
    if(inFlight) return; inFlight = true;
    try{
      const b = bookSelect?.value || "Genèse";
      const c = Number(chapterSelect?.value||1);
      const v = versionSelect?.value || "LSG";
      const ref = `${b} ${c}`;

      await fakePrep();

      // Cache navigateur (Markdown brut)
      const cached = loadCache(ref, v);
      let md = cached;
      if (!md) {
        md = await fetchMarkdown({ book: b, chapter: c, version: v });
        if (!md) throw new Error("Réponse de l'API non exploitable.");
        saveCache(ref, v, md);
      }

      // Téléchargement automatique .md
      const safeName = b.replace(/[^\w\-]+/g,"_");
      download(md, `${safeName}-${c}.md`);

      // Parsing simple: "1. ...", ..., "28. ..."
      const parsed = parseMarkdownToSections(md);
      notes = {};
      parsed.forEach((s,i)=>{ if (i < N) notes[i] = String(s.content||'').trim(); });

      // Renforts locales
      notes[0]  = defaultPrayerOpen(ref);
      if(!notes[1]){
        const idx=bookSelect?bookSelect.selectedIndex:0;
        const testament = idx < NT_START_INDEX ? "Ancien Testament" : "Nouveau Testament";
        notes[1] = `Le livre de ${bookSelect?bookSelect.value:'—'} appartient à l’${testament}.`;
      }
      if(!notes[2]){
        notes[2] = "À compléter par l’animateur : préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
      }
      notes[8]  = ensureKeyVerse(notes[8], ref);
      notes[27] = defaultPrayerClose(ref);

      dlog(`[GEN] OK → fichier téléchargé + UI alimentée`);

      // mémoire “dernier”
      try{
        const book=bookSelect?.value, chap=chapterSelect?.value, vers=verseSelect?.value, ver=versionSelect?.value;
        lastStudy && (lastStudy.textContent = `Dernier : ${ref} (${ver})`);
        localStorage.setItem('be_last', JSON.stringify({book,chapter:chap,verse:vers,version:ver}));
      }catch{}

      renderSidebar(); select(0);
    } catch(e){
      console.error(e);
      dlog(`ERROR generateStudy: ${e && e.message}`);
      alert(`La génération a échoué.\n${e && e.message ? e.message : e}`);
    } finally {
      inFlight = false;
    }
  }

  // ---------- parsing Markdown → sections ----------
  function parseMarkdownToSections(md) {
    const lines = String(md||"").split(/\r?\n/);
    const sections = [];
    let current = null;
    for (let i=0;i<lines.length;i++){
      const line = lines[i];
      const m = line.match(/^\s*(\d{1,2})\.\s+(.*)$/);
      if (m) {
        if (current) sections.push(current);
        current = { idx: parseInt(m[1],10), title: m[0].trim(), buf: [] };
        continue;
      }
      if (!current) continue;
      current.buf.push(line);
    }
    if (current) sections.push(current);

    const arr = new Array(28).fill(null).map((_,i)=>({idx:i+1,title:`${i+1}.`,content:"—"}));
    sections.forEach(s=>{
      const i = Math.max(1, Math.min(28, s.idx)) - 1;
      const content = s.buf.join("\n").trim();
      arr[i] = { idx: i+1, title: s.title, content: content || "—" };
    });
    return arr;
  }

  // ---------- init ----------
  renderBooks(); renderChapters(); renderVerses(); updateReadLink();
  renderSidebar(); select(0);

  // recherche intelligente
  if(searchRef){
    searchRef.addEventListener('keydown',(e)=>{ if(e.key==='Enter'){ const sel=parseSearch(searchRef.value); if(sel){ applySelection(sel); autoGenerate(); } }});
    searchRef.addEventListener('blur',()=>{ const sel=parseSearch(searchRef.value); if(sel){ applySelection(sel); autoGenerate(); } });
  }

  // Valider => BibleGateway
  validateBtn && validateBtn.addEventListener('click',()=>{
    updateReadLink();
    try{
      const book=bookSelect?.value, chap=chapterSelect?.value, vers=verseSelect?.value, ver=versionSelect?.value;
      localStorage.setItem('be_last', JSON.stringify({book,chapter:chap,verse:vers,version:ver}));
      lastStudy && (lastStudy.textContent = `Dernier : ${book} ${chap||1} (${ver})`);
    }catch{}
    readLink && window.open(readLink.href, '_blank', 'noopener');
  });

  // Générer => /api/chat
  generateBtn && generateBtn.addEventListener('click', generateStudy);

  // auto-génération si pas de texte saisi
  function autoGenerate(){
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{ if(bookSelect?.value && chapterSelect?.value && !(searchRef?.value||'').trim()) generateStudy(); }, 300);
  }
  bookSelect && bookSelect.addEventListener('change',()=>{ renderChapters(); renderVerses(bookSelect.value==="Psaumes"?200:60); updateReadLink(); autoGenerate(); });
  chapterSelect && chapterSelect.addEventListener('change',()=>{ updateReadLink(); autoGenerate(); });
  verseSelect && verseSelect.addEventListener('change',()=>{ updateReadLink(); });

  // autosave
  noteArea && noteArea.addEventListener('input',()=>{ clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ notes[current]=noteArea.value; saveStorage(); },2000); });

  // debug footer (probes)
  btnDbg && btnDbg.addEventListener('click',()=>{
    const open=panel.style.display==='block';
    panel.style.display=open?'none':'block';
    btnDbg.textContent=open?'Debug':'Fermer Debug';
    if(!open){
      panel.textContent='[Debug démarré…]';
      (async()=>{
        try{ const r1=await fetch('/api/health'); setMini(dotHealth,r1.ok); dlog(`health → ${r1.status}`);}catch{ setMini(dotHealth,false); }
        try{
          const r2=await fetch('/api/chat?q=Gen%C3%A8se%201');
          const txt = await r2.text();
          setMini(dotChat,r2.ok);
          dlog(`chat(GET) → ${r2.status}; head="${(txt||"").slice(0,60).replace(/\s+/g,' ')}"`);
        }catch{ setMini(dotChat,false); }
        try{ const r3=await fetch('/api/ping'); setMini(dotPing,r3.ok); dlog(`ping → ${r3.status}`);}catch{ setMini(dotPing,false); }
      })();
    }
  });

})();

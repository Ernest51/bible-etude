// public/app.js — FRONT avec liens cliquables + thèmes (5) + gras auto dans l’aperçu
(function () {
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => { if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => { if (!el) return; el.disabled = !!on; el.classList.toggle("opacity-60", !!on); el.textContent = on ? "Génération..." : el.dataset.label || el.textContent; };
  const dpanel = $("debugPanel"), dbtn = $("debugBtn");
  const dlog = (m) => { if (!dpanel) return; dpanel.style.display = "block"; dbtn && (dbtn.textContent="Fermer Debug"); const line=`[${new Date().toISOString()}] ${m}`; dpanel.textContent += (dpanel.textContent? "\n":"")+line; console.log(line); };
  const setMini = (dot, ok) => { if (!dot) return; dot.classList.remove("ok","ko"); if (ok===true) dot.classList.add("ok"); else if (ok===false) dot.classList.add("ko"); };

  const searchRef = $("searchRef"),
    bookSelect = $("bookSelect"),
    chapterSelect = $("chapterSelect"),
    verseSelect = $("verseSelect"),
    versionSelect = $("versionSelect"),
    validateBtn = $("validate"),
    generateBtn = $("generateBtn"),
    readLink = $("readLink"),
    lastStudy = $("lastStudy"),
    pointsList = $("pointsList"),
    edTitle = $("edTitle"),
    noteArea = $("noteArea"),
    renderArea = $("renderArea"),
    prevBtn = $("prev"),
    nextBtn = $("next"),
    metaInfo = $("metaInfo"),
    dotHealth = $("dot-health"),
    dotChat = $("dot-chat"),
    dotPing = $("dot-ping"),
    sourceInfo = $("sourceInfo"),
    enrichedToggle = $("enrichedToggle"),
    themeRange = $("themeRange");

  $("y") && ($("y").textContent = new Date().getFullYear());

  // ---------- Thèmes (1..5) ----------
  (function initTheme(){
    try{
      const saved = localStorage.getItem("be_theme");
      const n = saved ? String(saved) : "1";
      document.body.setAttribute("data-theme", n);
      if (themeRange) themeRange.value = n;
    }catch{}
    if (themeRange){
      themeRange.addEventListener("input", ()=>{
        const v = String(themeRange.value || "1");
        document.body.setAttribute("data-theme", v);
        try{ localStorage.setItem("be_theme", v); }catch{}
      });
    }
  })();

  // ---------- livres / chapitres ----------
  const BOOKS = [
    ["Genèse", 50], ["Exode", 40], ["Lévitique", 27], ["Nombres", 36], ["Deutéronome", 34],
    ["Josué", 24], ["Juges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
    ["1 Rois", 22], ["2 Rois", 25], ["1 Chroniques", 29], ["2 Chroniques", 36], ["Esdras", 10],
    ["Néhémie", 13], ["Esther", 10], ["Job", 42], ["Psaumes", 150], ["Proverbes", 31],
    ["Ecclésiaste", 12], ["Cantique des cantiques", 8], ["Ésaïe", 66], ["Jérémie", 52], ["Lamentations", 5],
    ["Ézéchiel", 48], ["Daniel", 12], ["Osée", 14], ["Joël", 3], ["Amos", 9],
    ["Abdias", 1], ["Jonas", 4], ["Michée", 7], ["Nahoum", 3], ["Habacuc", 3],
    ["Sophonie", 3], ["Aggée", 2], ["Zacharie", 14], ["Malachie", 4],
    ["Matthieu", 28], ["Marc", 16], ["Luc", 24], ["Jean", 21], ["Actes", 28],
    ["Romains", 16], ["1 Corinthiens", 16], ["2 Corinthiens", 13], ["Galates", 6], ["Éphésiens", 6],
    ["Philippiens", 4], ["Colossiens", 4], ["1 Thessaloniciens", 5], ["2 Thessaloniciens", 3], ["1 Timothée", 6],
    ["2 Timothée", 4], ["Tite", 3], ["Philémon", 1], ["Hébreux", 13], ["Jacques", 5],
    ["1 Pierre", 5], ["2 Pierre", 3], ["1 Jean", 5], ["2 Jean", 1], ["3 Jean", 1],
    ["Jude", 1], ["Apocalypse", 22],
  ];
  function renderBooks(){ if(!bookSelect) return; bookSelect.innerHTML=""; BOOKS.forEach(([n,ch])=>{const o=document.createElement("option"); o.value=n; o.textContent=n; o.dataset.ch=ch; bookSelect.appendChild(o);}); }
  function renderChapters(){ if(!chapterSelect||!bookSelect) return; chapterSelect.innerHTML=""; const ch=bookSelect.selectedOptions[0]? +bookSelect.selectedOptions[0].dataset.ch:1; for(let i=1;i<=ch;i++){const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);} }
  function renderVerses(max=60){ if(!verseSelect) return; verseSelect.innerHTML=""; const m=Math.max(1,Math.min(200,max)); for(let i=1;i<=m;i++){const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);} }
  function updateReadLink(){ if(!readLink||!bookSelect||!chapterSelect||!verseSelect||!versionSelect) return; const ref=`${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`; const ver=versionSelect.value; readLink.href="https://www.biblegateway.com/passage/?search="+encodeURIComponent(ref)+"&version="+encodeURIComponent(ver); }

  // ---------- rubriques ----------
  const FIXED_POINTS = [
    { t: "Prière d’ouverture", d: "Invocation du Saint-Esprit pour éclairer l’étude." },
    { t: "Canon et testament", d: "Identification du livre selon le canon biblique." },
    { t: "Questions du chapitre précédent", d: "(Min. 5) Réponses intégrales, éléments de compréhension exigés." },
    { t: "Titre du chapitre", d: "Résumé doctrinal synthétique du chapitre étudié." },
    { t: "Contexte historique", d: "Période, géopolitique, culture, carte localisée à l’époque." },
    { t: "Structure littéraire", d: "Séquençage narratif et composition interne du chapitre." },
    { t: "Genre littéraire", d: "Type de texte : narratif, poétique, prophétique, etc." },
    { t: "Auteur et généalogie", d: "Présentation de l’auteur et son lien aux patriarches." },
    { t: "Verset-clé doctrinal", d: "Verset central du chapitre avec lien cliquable." },
    { t: "Analyse exégétique", d: "Commentaire mot-à-mot avec références au grec/hébreu." },
    { t: "Analyse lexicale", d: "Analyse des mots-clés originaux et leur sens doctrinal." },
    { t: "Références croisées", d: "Passages parallèles ou complémentaires." },
    { t: "Fondements théologiques", d: "Doctrines majeures du chapitre." },
    { t: "Thème doctrinal", d: "Lien avec les 22 grands thèmes doctrinaux." },
    { t: "Fruits spirituels", d: "Vertus et attitudes inspirées par le chapitre." },
    { t: "Types bibliques", d: "Symboles / figures typologiques." },
    { t: "Appui doctrinal", d: "Autres passages qui renforcent l’enseignement." },
    { t: "Comparaison entre versets", d: "Mise en relief au sein du chapitre." },
    { t: "Comparaison avec Actes 2", d: "Parallèle avec le début de l’Église." },
    { t: "Verset à mémoriser", d: "Verset essentiel à retenir." },
    { t: "Enseignement pour l’Église", d: "Implications collectives / ecclésiales." },
    { t: "Enseignement pour la famille", d: "Valeurs à transmettre dans le foyer." },
    { t: "Enseignement pour enfants", d: "Approche simplifiée, jeux, récits, visuels." },
    { t: "Application missionnaire", d: "Comment le texte guide l’évangélisation." },
    { t: "Application pastorale", d: "Conseils pour ministres / enseignants." },
    { t: "Application personnelle", d: "Examen de conscience et engagement." },
    { t: "Versets à retenir", d: "Incontournables pour prédication pastorale." },
    { t: "Prière de fin", d: "Clôture spirituelle avec reconnaissance." },
  ];
  const N = FIXED_POINTS.length;

  let current=0, notes={}, autosaveTimer=null, autoTimer=null, inFlight=false;

  function renderSidebar(){
    if(!pointsList) return;
    pointsList.innerHTML="";
    FIXED_POINTS.forEach((r,i)=>{
      const row=document.createElement("div");
      row.className="item"+(i===current?" active":"");
      row.dataset.idx=i;
      row.innerHTML=`
        <span class="idx">${i+1}</span>
        <div><div>${r.t}</div><span class="desc">${r.d||""}</span></div>
        <span class="dot ${notes[i]&&notes[i].trim()? "ok":""}"></span>`;
      row.addEventListener("click", ()=>{ if(current!==i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){
    document.querySelectorAll(".list .item").forEach((el)=>{
      const i=+el.dataset.idx, dot=el.querySelector(".dot");
      if(!dot) return;
      if(notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
  }
  function select(i){
    if (noteArea) notes[current]=noteArea.value;
    saveStorage();
    current=i;
    document.querySelectorAll(".list .item").forEach((el)=>el.classList.toggle("active", +el.dataset.idx===current));
    if (edTitle) edTitle.textContent=`${i+1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value=notes[i]||"";
    if (metaInfo) metaInfo.textContent=`Point ${i+1} / ${N} • Sauvegarde auto (2s)`;
    updateRender();
    if (noteArea) noteArea.focus();
  }
  function saveStorage(){ try{ localStorage.setItem("be_notes", JSON.stringify(notes)); renderSidebarDots(); }catch{} }

  const stripStarsAndTags = (s)=> String(s||"")
    .replace(/\*\*(.*?)\*\*/g,"$1")
    .replace(/<\/?[^>]+>/g,"")
    .replace(/\n{3,}/g,"\n\n")
    .trim();

  const gwUrl = (ref, ver)=> "https://www.biblegateway.com/passage/?search="+encodeURIComponent(ref)+"&version="+encodeURIComponent(ver||"LSG");

  // --- Aperçu cliquable + titres en gras ---
  function linkifyAndEmbolden(text){
    if (!text) return "";
    // échappe HTML
    const esc = (s)=> s.replace(/[&<>"']/g, (c)=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
    let html = esc(text);

    // URL -> lien
    const urlRe = /\bhttps?:\/\/[^\s)]+/gi;
    html = html.replace(urlRe, (u)=>`<a href="${u}" target="_blank" rel="noopener">${u}</a>`);

    // Titres / mots-clés → gras
    const heads = [
      "Observation","Compréhension","Interprétation",
      "Connexions bibliques","Application","Bonus",
      "Développement","Prière","Prière d’ouverture","Prière de fin",
      "Verset à mémoriser","Verset-clé","Verset clef"
    ];
    heads.forEach(h=>{
      const re = new RegExp(`(^|\\n)(${h})\\s*:`, "gi");
      html = html.replace(re, (_m, p1, p2)=> `${p1}<strong>${p2}</strong> :`);
    });

    // Listes simples : tirets → on laisse en texte ; retours de ligne
    return html.replace(/\n/g,"<br>");
  }
  function updateRender(){
    if (!renderArea) return;
    const raw = noteArea ? noteArea.value : "";
    renderArea.innerHTML = linkifyAndEmbolden(raw);
  }

  function enrichShort(text, book, chapter){
    const MIN = 1400; // un peu plus de matière
    let t = stripStarsAndTags(text);
    if (t.length >= MIN || !enrichedToggle?.checked) return t;
    const extra =
`\n\nDéveloppement :
Ce passage s’inscrit dans l’économie de la révélation : initiative divine, réponse humaine, effets communautaires.
Pistes : relever les verbes d’action de Dieu, les marqueurs d’alliance, les contrastes (lumière/ténèbres ; foi/doute), et relier doctrine, éthique, espérance.`;
    while ((t+extra).length < MIN) t += extra;
    return t;
  }

  function defaultPrayerOpen(book, chapter){
    return stripStarsAndTags(
`Prière d’ouverture :
Père céleste, nous venons devant toi pour lire ${book} ${chapter}.
Ouvre nos cœurs par ton Esprit, donne-nous intelligence et obéissance.
Que ta Parole éclaire nos choix, fortifie notre foi et forme en nous le caractère de Christ.
Au nom de Jésus, amen.`
    );
  }
  function defaultPrayerClose(book, chapter){
    return stripStarsAndTags(
`Prière de fin :
Seigneur, merci pour la lumière reçue dans ${book} ${chapter}.
Aide-nous à mettre en pratique ce que nous avons compris : dans l’Église, au foyer, et personnellement.
Garde-nous dans ta paix et rends-nous utiles à ton œuvre. Amen.`
    );
  }

  function buildRubrique3Answers(book, chapter, version){
    const mainRef = `${book} ${chapter}`;
    const mainUrl = gwUrl(mainRef, version);
    const echo1 = `Psaume 19:1 — ${gwUrl("Psaume 19:1", version)}`;
    const echo2 = `Jean 1:1-3 — ${gwUrl("Jean 1:1-3", version)}`;
    const keyRef = `${book} ${chapter}:1`;
    const keyUrl = gwUrl(keyRef, version);

    return stripStarsAndTags(
`Révision sur ${book} ${chapter} — réponses aux 5 questions

Observation :
- Passage étudié : ${mainRef} (${mainUrl})
- Structure globale : initiative de Dieu, réponse humaine, effets communautaires.
- Repères récurrents : verbes d’action divins, formules d’alliance, refrains, contrastes.
- Personnages/voix : Dieu (parole/ordre), médiateurs, assemblée.

Compréhension :
Dieu est souverain, sage et fidèle ; il établit l’ordre, instruit et sauve.
L’homme est appelé à écouter, croire et obéir au sein du peuple de Dieu, conscient de sa fragilité et de son besoin de grâce.

Interprétation :
Verset-clé proposé : ${keyRef} (${keyUrl})
Ce verset concentre l’élan du passage et offre l’axe doctrinal : identité de Dieu, initiative de sa Parole, finalité pour le peuple.

Connexions bibliques :
- Écho 1 : ${echo1}
- Écho 2 : ${echo2}
Ces parallèles soulignent la cohérence de la révélation : création, Parole, et accomplissement christologique.

Application (semaine) :
- Personnel : temps régulier d’écoute, une obéissance concrète et mesurable.
- Famille : partager ${mainRef}, prier un point d’obéissance commun.
- Église : servir humblement, fortifier un frère/une sœur par une promesse adaptée.

Bonus :
Verset à mémoriser : ${keyRef} (${keyUrl})
Prière :
Seigneur, tu parles encore aujourd’hui. Donne-moi un cœur docile, unis-moi à ton peuple et rends-moi persévérant dans l’obéissance.
Que Christ soit honoré par ma foi, mes paroles et mes choix. Amen.`
    );
  }

  async function postJSON(url, payload, tries=3){
    let lastErr;
    for (let k=0;k<tries;k++){
      try{
        const r = await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},cache:"no-store",body:JSON.stringify(payload)});
        if (!r.ok){ const msg=await r.text().catch(()=> ""); throw new Error(msg || `HTTP ${r.status}`); }
        return r;
      }catch(e){ lastErr=e; await new Promise(res=>setTimeout(res,300*(k+1))); }
    }
    throw lastErr;
  }
  async function getStudy(){
    const ver = versionSelect ? versionSelect.value : "LSG";
    const book = bookSelect?.value || "Genèse";
    const chapter = Number(chapterSelect?.value || 1);
    const r = await postJSON("/api/chat",{ book, chapter, version: ver },3);
    const ct = r.headers.get("Content-Type")||"";
    if (/application\/json/i.test(ct)){
      const j=await r.json().catch(()=> ({}));
      if (!j || (j.ok===false)) throw new Error(j?.error || "Réponse JSON invalide");
      window.__lastChatSource = j.source || "unknown";
      window.__lastChatWarn = j.warn || "";
      return { from: j.source || "api", data: j.data };
    }
    const text = await r.text();
    return { from:"api-md", data:{ reference:"", sections:[] } };
  }

  async function generateStudy(){
    if (inFlight) return;
    const ref = buildReference();
    if (!ref){ alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }
    inFlight = true;
    const btn=generateBtn; btn && (btn.dataset.label = btn.dataset.label || btn.textContent); busy(btn,true);
    try{
      setProgress(12); await wait(60); setProgress(55);

      const { data, from } = await getStudy();
      const book = bookSelect?.value || "Genèse";
      const chap = Number(chapterSelect?.value || 1);
      const ver = versionSelect?.value || "LSG";

      notes = {};
      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s)=>{
        const i=(s.id|0)-1;
        if (i>=0 && i<N){
          notes[i] = stripStarsAndTags(s.content||"");
        }
      });

      // Forçages / enrichissements
      notes[0]  = defaultPrayerOpen(book, chap);
      notes[2]  = buildRubrique3Answers(book, chap, ver);
      if (!notes[8] || notes[8].length<10){
        const keyRef = `${book} ${chap}:1`;
        notes[8] = `Verset-clé proposé : ${keyRef} (${gwUrl(keyRef, ver)})`;
      }
      notes[27] = defaultPrayerClose(book, chap);

      if (enrichedToggle?.checked){
        for (let i=0;i<N;i++){ notes[i] = enrichShort(notes[i]||"", book, chap); }
      }

      try{
        lastStudy && (lastStudy.textContent = `Dernier : ${book} ${chap} (${ver})`);
        // plus d’affichage "source=..."
        sourceInfo && (sourceInfo.style.display = "none");
        localStorage.setItem("be_last", JSON.stringify({book, chapter: chap, verse: verseSelect?.value, version: ver}));
      }catch{}

      renderSidebar(); select(0);
      setProgress(100); setTimeout(()=> setProgress(0), 300);
      dlog(`[GEN] OK → étude générée`);
    }catch(e){
      console.error(e); alert(String((e && e.message)||e));
    }finally{
      busy(btn,false); inFlight=false;
    }
  }

  const norm = (s)=> String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9: ]+/g," ").replace(/\s+/g," ").trim();
  function parseSearch(q){
    q=(q||"").trim();
    const m=q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
    if(!m) return null;
    const title = norm(m[1]); let book=null;
    for(const [name] of BOOKS){ if (norm(name)===title){ book=name; break; } }
    if(!book){ const cand=BOOKS.find(([name])=> norm(name).startsWith(title)); if (cand) book=cand[0]; }
    if(!book) return null;
    return { book, chap:+m[2], vers:m[3]? +m[3]:null };
  }
  function applySelection(sel){
    if (!sel || !bookSelect) return;
    const idx=BOOKS.findIndex(([n])=> n===sel.book);
    if (idx>=0) bookSelect.selectedIndex=idx;
    renderChapters();
    const chMax=bookSelect.selectedOptions[0]? +bookSelect.selectedOptions[0].dataset.ch:1;
    const chap=Math.max(1,Math.min(chMax, sel.chap||1));
    if (chapterSelect) chapterSelect.value=String(chap);
    renderVerses(sel.book==="Psaumes"? 200: 60);
    if (sel.vers && verseSelect) verseSelect.value=String(sel.vers);
    updateReadLink();
  }
  function buildReference(){
    const typed=(searchRef&&searchRef.value||"").trim();
    if (typed) return typed;
    if (!bookSelect||!chapterSelect) return "";
    const b=bookSelect.value, c=chapterSelect.value;
    return c ? `${b} ${c}` : b;
  }

  renderBooks(); renderChapters(); renderVerses(); updateReadLink();
  renderSidebar(); select(0);

  if (searchRef){
    searchRef.addEventListener("keydown",(e)=>{ if (e.key==="Enter"){ const sel=parseSearch(searchRef.value); if (sel){ applySelection(sel); autoGenerate(); } }});
    searchRef.addEventListener("blur",()=>{ const sel=parseSearch(searchRef.value); if (sel){ applySelection(sel); autoGenerate(); }});
  }

  validateBtn && validateBtn.addEventListener("click", ()=>{
    updateReadLink();
    try{
      const book=bookSelect?.value, chap=chapterSelect?.value, vers=verseSelect?.value, ver=versionSelect?.value;
      localStorage.setItem("be_last", JSON.stringify({book, chapter:chap, verse:vers, version:ver}));
      lastStudy && (lastStudy.textContent = `Dernier : ${book} ${chap||1} (${ver})`);
    }catch{}
    readLink && window.open(readLink.href,"_blank","noopener");
  });

  generateBtn && generateBtn.addEventListener("click", generateStudy);

  function autoGenerate(){
    clearTimeout(autoTimer);
    autoTimer=setTimeout(()=>{
      if (bookSelect?.value && chapterSelect?.value && !(searchRef?.value||"").trim()) generateStudy();
    },250);
  }
  bookSelect && bookSelect.addEventListener("change", ()=>{ renderChapters(); renderVerses(bookSelect.value==="Psaumes"?200:60); updateReadLink(); autoGenerate(); });
  chapterSelect && chapterSelect.addEventListener("change", ()=>{ updateReadLink(); autoGenerate(); });
  verseSelect && verseSelect.addEventListener("change", ()=>{ updateReadLink(); });

  noteArea && noteArea.addEventListener("input", ()=>{
    clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(()=>{ notes[current]=noteArea.value; saveStorage(); },700);
    updateRender();
  });

  prevBtn && prevBtn.addEventListener("click", ()=>{ if (current>0) select(current-1); });
  nextBtn && nextBtn.addEventListener("click", ()=>{ if (current<N-1) select(current+1); });

  dbtn && dbtn.addEventListener("click", ()=>{
    const open = dpanel.style.display==="block";
    dpanel.style.display = open ? "none":"block";
    dbtn.textContent = open ? "Debug":"Fermer Debug";
    if (!open){
      dpanel.textContent = "[Debug démarré…]";
      (async()=>{
        try{ const r1=await fetch("/api/health"); setMini(dotHealth, r1.ok); dlog(`health → ${r1.status}`);}catch{ setMini(dotHealth,false); }
        try{ const r2=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({probe:true})}); setMini(dotChat, r2.ok); dlog(`chat(POST) → ${r2.status}`);}catch{ setMini(dotChat,false); }
        try{ const r3=await fetch("/api/ping"); setMini(dotPing, r3.ok); dlog(`ping → ${r3.status}`);}catch{ setMini(dotPing,false); }
      })();
    }
  });

  updateRender();
})();

// public/app.js
(function () {
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => { if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const searchRef = $("searchRef"), bookSelect = $("bookSelect"), chapterSelect = $("chapterSelect"),
        verseSelect = $("verseSelect"), versionSelect = $("versionSelect"),
        validateBtn = $("validate"), generateBtn = $("generateBtn"), readBtn = $("readBtn"),
        pointsList = $("pointsList"), edTitle = $("edTitle"),
        noteArea = $("noteArea"), noteView = $("noteView"),
        prevBtn = $("prev"), nextBtn = $("next"),
        metaInfo = $("metaInfo"), themeSelect = $("themeSelect"),
        enrichToggle = $("enrichToggle"),
        linksPanel = $("linksPanel"), linksList = $("linksList");

  $("y").textContent = new Date().getFullYear();

  const BOOKS = [
    ["Genèse", 50],["Exode", 40],["Lévitique", 27],["Nombres", 36],["Deutéronome", 34],
    ["Josué", 24],["Juges", 21],["Ruth", 4],["1 Samuel", 31],["2 Samuel", 24],
    ["1 Rois", 22],["2 Rois", 25],["1 Chroniques", 29],["2 Chroniques", 36],["Esdras", 10],
    ["Néhémie", 13],["Esther", 10],["Job", 42],["Psaumes", 150],["Proverbes", 31],
    ["Ecclésiaste", 12],["Cantique des cantiques", 8],["Ésaïe", 66],["Jérémie", 52],["Lamentations", 5],
    ["Ézéchiel", 48],["Daniel", 12],["Osée", 14],["Joël", 3],["Amos", 9],
    ["Abdias", 1],["Jonas", 4],["Michée", 7],["Nahoum", 3],["Habacuc", 3],
    ["Sophonie", 3],["Aggée", 2],["Zacharie", 14],["Malachie", 4],
    ["Matthieu", 28],["Marc", 16],["Luc", 24],["Jean", 21],["Actes", 28],
    ["Romains", 16],["1 Corinthiens", 16],["2 Corinthiens", 13],["Galates", 6],["Éphésiens", 6],
    ["Philippiens", 4],["Colossiens", 4],["1 Thessaloniciens", 5],["2 Thessaloniciens", 3],["1 Timothée", 6],
    ["2 Timothée", 4],["Tite", 3],["Philémon", 1],["Hébreux", 13],["Jacques", 5],
    ["1 Pierre", 5],["2 Pierre", 3],["1 Jean", 5],["2 Jean", 1],["3 Jean", 1],
    ["Jude", 1],["Apocalypse", 22],
  ];

  function renderBooks(){ bookSelect.innerHTML=""; BOOKS.forEach(([n,ch])=>{ const o=document.createElement("option"); o.value=n; o.textContent=n; o.dataset.ch=ch; bookSelect.appendChild(o); }); }
  function renderChapters(){ chapterSelect.innerHTML=""; const ch=bookSelect.selectedOptions[0]?+bookSelect.selectedOptions[0].dataset.ch:1; for(let i=1;i<=ch;i++){ const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);} }
  function renderVerses(max=60){ verseSelect.innerHTML=""; const m=Math.max(1,Math.min(200,max)); for(let i=1;i<=m;i++){ const o=document.createElement("option"); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);} }

  const FIXED_POINTS = Array.from({length:28}).map((_,i)=>({ t: i===0?"Prière d’ouverture":(i===27?"Prière de fin":`Rubrique ${i+1}`), d: i===0?"Invocation du Saint-Esprit pour éclairer l’étude.":"" }));
  const N = FIXED_POINTS.length;

  let current=0, notes={}, autosaveTimer=null, autoTimer=null, inFlight=false;

  function renderSidebar(){
    pointsList.innerHTML="";
    FIXED_POINTS.forEach((r,i)=>{
      const row=document.createElement("div");
      row.className="item"+(i===current?" active":"");
      row.dataset.idx=i;
      row.innerHTML=`<span class="idx">${i+1}</span><div><div>${r.t}</div><span class="desc">${r.d||""}</span></div><span class="dot ${notes[i]&&notes[i].trim()?"ok":""}"></span>`;
      row.addEventListener("click",()=>{ if(current!==i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){
    document.querySelectorAll(".list .item").forEach((el)=>{ const i=+el.dataset.idx; const dot=el.querySelector(".dot"); if(!dot) return; if(notes[i]&&notes[i].trim()) dot.classList.add("ok"); else dot.classList.remove("ok"); });
  }
  function select(i){
    if (noteArea && i!==current) notes[current]=noteArea.value;
    saveStorage();
    current=i;
    document.querySelectorAll(".list .item").forEach((el)=>el.classList.toggle("active", +el.dataset.idx===current));
    if (edTitle) edTitle.textContent = `${i+1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i+1} / ${N}`;
    renderViewFromArea(); updateLinksPanel();
    (enrichToggle && enrichToggle.checked ? noteView : noteArea).focus();
  }
  function saveStorage(){ try{ localStorage.setItem("be_notes", JSON.stringify(notes)); renderSidebarDots(); }catch{} }

  const escapeRegExp=(s)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const BOOK_TITLES = BOOKS.map(([n])=>n);
  const bookAlt = BOOK_TITLES.map(escapeRegExp).join("|");
  const refRe = new RegExp(`\\b(${bookAlt})\\s+(\\d+)(?::(\\d+(?:[–-]\\d+)?))?(?:[–-](\\d+))?`, "gi");

  const sanitizeBasic = (t)=> String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const mdLite = (h)=> h.replace(/\*\*([^*]+)\*\*/g,"<strong>$1</strong>").replace(/\*([^*]+)\*/g,"<em>$1</em>");
  const autolinkURLs = (h)=> h.replace(/(\bhttps?:\/\/[^\s<>"'()]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  function bgwUrl(search, version){ return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${encodeURIComponent(version||"LSG")}`; }
  function makeBGWLink(book, chap, verseOrRange, chapEnd){
    const version = (versionSelect && versionSelect.value) || "LSG";
    if (chapEnd) return bgwUrl(`${book} ${chap}-${chapEnd}`, version);
    if (verseOrRange) return bgwUrl(`${book} ${chap}:${verseOrRange}`, version);
    return bgwUrl(`${book} ${chap}`, version);
  }
  const autolinkBible = (h)=> h.replace(refRe,(m,bk,ch,vr,chEnd)=>`<a href="${makeBGWLink(bk,ch,vr||"",chEnd||"")}" target="_blank" rel="noopener">${m}</a>`);
  const wrapParagraphs = (h)=> String(h||"").split(/\n{2,}/).map(b=> b.trim()? `<p>${b.replace(/\n/g,"<br>")}</p>` : "").join("");

  function renderViewFromArea(){
    const raw=noteArea.value||"";
    let html=sanitizeBasic(raw);
    html=mdLite(html); html=autolinkURLs(html); html=autolinkBible(html); html=wrapParagraphs(html);
    noteView.innerHTML = html || "<p style='color:#9aa2b1'>Écris ici…</p>";
  }
  function syncAreaFromView(){
    let html=noteView.innerHTML||"";
    html=html.replace(/<a\b[^>]*>(.*?)<\/a>/gi,"$1").replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n\n").replace(/<p[^>]*>/gi,"").replace(/<\/?strong>/gi,"**").replace(/<\/?em>/gi,"*").replace(/<\/?[^>]+>/g,"").replace(/\n{3,}/g,"\n\n").trim();
    noteArea.value=html; notes[current]=noteArea.value; saveStorage(); updateLinksPanel();
  }
  noteView.addEventListener("click",(e)=>{ const a=e.target.closest&&e.target.closest("a"); if(a&&a.href){ e.preventDefault(); window.open(a.href,"_blank","noopener"); } });

  function applyEnrichMode(){ const on=!!(enrichToggle&&enrichToggle.checked); if(on){ noteArea.style.display="none"; noteView.style.display="block"; renderViewFromArea(); noteView.focus(); }else{ noteView.style.display="none"; noteArea.style.display="block"; noteArea.focus(); } }
  enrichToggle && enrichToggle.addEventListener("change", applyEnrichMode);

  function stripDangerousTags(html){
    if(!html) return "";
    html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi,'**$1**').replace(/<b[^>]*>(.*?)<\/b>/gi,'**$1**').replace(/<em[^>]*>(.*?)<\/em>/gi,'*$1*').replace(/<i[^>]*>(.*?)<\/i>/gi,'*$1*');
    html = html.replace(/<\/p>/gi,'\n\n').replace(/<\/h[1-6]>/gi,'\n\n').replace(/<br\s*\/?>/gi,'\n');
    html = html.replace(/<\/?[^>]+>/g,'').replace(/\n{3,}/g,'\n\n').trim();
    return html;
  }
  const cleanGeneratedContent = (raw)=> stripDangerousTags(String(raw||""));

  function bgwLink(book, chap, vers, version){ const core = `${book} ${chap}${vers?':'+vers:''}`; return bgwUrl(core, version || (versionSelect && versionSelect.value) || "LSG"); }

  function defaultPrayerOpen(){
    const book=bookSelect.value, c=chapterSelect.value, v=verseSelect.value;
    const ref=`${book} ${c}${v?':'+v:''}`;
    return `Père saint, nous nous approchons de toi pour méditer **${ref}**. Par ton Esprit, conduis notre lecture et notre obéissance. Amen.`;
  }
  function defaultPrayerClose(){
    const book=bookSelect.value, c=chapterSelect.value;
    return `Dieu de grâce, merci pour la lumière reçue dans **${book} ${c}**. Fortifie notre foi et notre marche. Amen.`;
  }

  function buildRevisionSection(){
    const book=bookSelect.value, c=chapterSelect.value, v=versionSelect.value||"LSG";
    const url=bgwLink(book,c,null,v);
    return [
      `Révision sur ${book} ${c} — **5 questions**`,``,
      `1) **Observation** — Quels sont les 3 faits majeurs ?`,
      `2) **Compréhension** — Que révèle ce chapitre sur Dieu et l’homme ?`,
      `3) **Interprétation** — Quel verset-clef et pourquoi ?`,
      `4) **Connexions** — 1–2 parallèles/échos (AT/NT) et le lien.`,
      `5) **Application** — Décision concrète cette semaine.`,``,
      `➡ Lecture : ${url}`
    ].join("\n");
  }

  async function postJSON(url, payload){
    const r = await fetch(url,{ method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  async function getStudy(){
    const ver=versionSelect?versionSelect.value:"LSG";
    const book=bookSelect?.value||"Genèse";
    const chapter=Number(chapterSelect?.value||1);
    const verse=verseSelect?.value ? Number(verseSelect.value) : null;
    const j = await postJSON("/api/chat", { book, chapter, version:ver, verse, reference: `${book} ${chapter}${verse?':'+verse:''}` });
    return { from: j.source || "api", data: j.data };
  }

  async function fetchVerseText(){
    const ver=versionSelect?versionSelect.value:"LSG";
    const book=bookSelect?.value||"Genèse";
    const chapter=Number(chapterSelect?.value||1);
    const verse=Number(verseSelect?.value||0);
    if (!verse) return null;
    try{
      const j = await postJSON("/api/verse", { book, chapter, verse, version:ver });
      return j?.text || null;
    }catch{ return null; }
  }

  function dedupeParagraphs(raw){
    const lines=String(raw||"").split(/\r?\n/); const out=[]; let last="";
    for (const ln of lines){ const t=ln.trim(); if(t && t===last) continue; out.push(ln); last=t; }
    return out.join("\n");
  }
  const ensureLinksLineBreaks = (txt)=> String(txt||"").replace(/(\S)(https?:\/\/[^\s)]+)(\S)?/g,(_,a,url,b)=>`${a}\n${url}\n${b||""}`);

  async function generateStudy(){
    if (inFlight) return;
    inFlight=true; setProgress(15); await wait(60); setProgress(55);
    try{
      notes={}; // reset
      const { data } = await getStudy();
      const secs = Array.isArray(data.sections)? data.sections : [];

      secs.forEach((s)=> {
        const i=(s.id|0)-1;
        if (i>=0 && i<N) notes[i] = cleanGeneratedContent(String(s.content||"").trim());
      });

      // Defaults
      if (!notes[0]) notes[0] = cleanGeneratedContent(defaultPrayerOpen());
      if (!notes[2] || !notes[2].trim()) notes[2] = cleanGeneratedContent(buildRevisionSection());
      notes[27] = cleanGeneratedContent(defaultPrayerClose());

      // Injection du TEXTE du verset si disponible
      const verseTxt = await fetchVerseText();
      if (verseTxt){
        const book=bookSelect.value, c=chapterSelect.value, v=verseSelect.value;
        const ref = `${book} ${c}:${v}`;
        const lecture = `\n\n➡ Lecture : ${bgwUrl(ref, versionSelect.value || "LSG")}\n${ref} — ${verseTxt}`;
        notes[0] = (notes[0]||"").trim() + lecture;
      } else {
        // au minimum, lien de lecture
        const book=bookSelect.value, c=chapterSelect.value, v=verseSelect.value;
        const url = bgwLink(book,c,v,versionSelect.value||"LSG");
        notes[0] = (notes[0]||"").trim() + `\n\n➡ Lecture : ${url}`;
      }

      // Nettoyage soft
      Object.keys(notes).forEach(k=> notes[k] = dedupeParagraphs(ensureLinksLineBreaks(notes[k])));

      renderSidebar(); select(0); renderSidebarDots();
      setProgress(100); setTimeout(()=>setProgress(0), 300);
    } catch (e){
      alert(String(e && e.message || e));
    } finally {
      inFlight=false;
    }
  }

  function extractLinks(text){
    const links=[]; const raw=String(text||"");
    let m; const aTagRe=/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    while((m=aTagRe.exec(raw))) links.push({url:m[1],label:m[2]||m[1]});
    const urlRe=/https?:\/\/[^\s<>"'()]+/g; let n;
    while((n=urlRe.exec(raw))){ const u=n[0]; if(!links.find(l=>l.url===u)) links.push({url:u,label:u}); }
    return links;
  }
  function findBibleRefs(text){
    const out=[]; const seen=new Set(); const raw=String(text||""); let m;
    while((m=refRe.exec(raw))){
      const book=m[1], chap=m[2], verseOrRange=m[3]||"", chapEnd=m[4]||"";
      const url = bgwUrl(chapEnd? `${book} ${chap}-${chapEnd}` : (verseOrRange? `${book} ${chap}:${verseOrRange}` : `${book} ${chap}`), (versionSelect && versionSelect.value)||"LSG");
      const key=book+"|"+chap+"|"+verseOrRange+"|"+chapEnd;
      if(!seen.has(key)){ out.push({url, label:m[0]}); seen.add(key); }
    }
    return out;
  }
  function updateLinksPanel(){
    const txt=noteArea.value||"";
    const merged=[]; const seen=new Set();
    for (const l of [...findBibleRefs(txt), ...extractLinks(txt)]){ if(seen.has(l.url)) continue; merged.push(l); seen.add(l.url); }
    linksList.innerHTML="";
    if (!merged.length){ linksPanel.style.display="none"; return; }
    linksPanel.style.display="block";
    for (const l of merged){ const a=document.createElement("a"); a.href=l.url; a.target="_blank"; a.rel="noopener"; a.textContent=l.label; const div=document.createElement("div"); div.appendChild(a); linksList.appendChild(div); }
  }

  // init
  renderBooks(); renderChapters(); renderVerses(); renderSidebar(); select(0); renderSidebarDots(); updateLinksPanel(); applyEnrichMode();

  // recherche
  function norm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9: ]+/g," ").replace(/\s+/g," ").trim(); }
  function parseSearch(q){
    q=(q||"").trim(); const m=q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/); if(!m) return null;
    const title=norm(m[1]); let book=null;
    for (const [name] of BOOKS){ if(norm(name)===title){ book=name; break;} }
    if(!book){ const cand=BOOKS.find(([name])=> norm(name).startsWith(title)); if(cand) book=cand[0]; }
    if(!book) return null; return { book, chap:+m[2], vers: m[3]? +m[3] : null };
  }
  function applySelection(sel){
    if(!sel) return;
    const idx=BOOKS.findIndex(([n])=> n===sel.book);
    if(idx>=0) bookSelect.selectedIndex=idx;
    renderChapters();
    const chMax=bookSelect.selectedOptions[0]? +bookSelect.selectedOptions[0].dataset.ch : 1;
    const chap=Math.max(1,Math.min(chMax, sel.chap||1));
    chapterSelect.value=String(chap);
    renderVerses(sel.book==="Psaumes"?200:60);
    if(sel.vers) verseSelect.value=String(sel.vers);
  }

  if (searchRef){
    searchRef.addEventListener("keydown",(e)=>{ if(e.key==="Enter"){ const sel=parseSearch(searchRef.value); if(sel){ applySelection(sel); generateStudy(); } } });
    searchRef.addEventListener("blur",()=>{ const sel=parseSearch(searchRef.value); if(sel){ applySelection(sel); generateStudy(); } });
  }

  generateBtn && generateBtn.addEventListener("click", generateStudy);
  readBtn && readBtn.addEventListener("click", ()=>{ const b=bookSelect.value, c=chapterSelect.value, v=verseSelect.value, ver=versionSelect.value; window.open(bgwLink(b,c,v,ver), "_blank", "noopener"); });
  validateBtn && validateBtn.addEventListener("click", ()=>{ const b=bookSelect.value, c=chapterSelect.value, v=verseSelect.value, ver=versionSelect.value; window.open(bgwLink(b,c,v,ver), "_blank", "noopener"); });

  function autoGenerate(){ clearTimeout(autoTimer); autoTimer=setTimeout(()=>{ if(bookSelect?.value && chapterSelect?.value && !(searchRef?.value||"").trim()) generateStudy(); }, 250); }
  bookSelect.addEventListener("change", ()=>{ renderChapters(); renderVerses(bookSelect.value==="Psaumes"?200:60); autoGenerate(); });
  chapterSelect.addEventListener("change", autoGenerate);
  verseSelect.addEventListener("change", ()=>{ /* rien */ });

  noteArea.addEventListener("input", ()=>{ clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ notes[current]=noteArea.value; saveStorage(); renderViewFromArea(); updateLinksPanel(); }, 700); });
  noteView.addEventListener("input", syncAreaFromView);

  prevBtn.addEventListener("click", ()=>{ if(current>0) select(current-1); });
  nextBtn.addEventListener("click", ()=>{ if(current<N-1) select(current+1); });
})();

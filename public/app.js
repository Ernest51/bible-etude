// public/app.js
(function () {
  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const setProgress = (p) => { const el=$("progressBar"); if(el) el.style.width=Math.max(0,Math.min(100,p))+"%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const searchRef=$("searchRef"), bookSelect=$("bookSelect"), chapterSelect=$("chapterSelect"),
        verseSelect=$("verseSelect"), versionSelect=$("versionSelect"),
        generateBtn=$("generateBtn"), readBtn=$("readBtn"), validateBtn=$("validate"),
        pointsList=$("pointsList"), edTitle=$("edTitle"),
        noteArea=$("noteArea"), noteView=$("noteView"),
        prevBtn=$("prev"), nextBtn=$("next"), metaInfo=$("metaInfo"),
        enrichToggle=$("enrichToggle"), linksPanel=$("linksPanel"), linksList=$("linksList");
  $("y").textContent=new Date().getFullYear();

  // ---------- rubriques fixes ----------
  const FIXED_POINTS=[
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
    "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
    "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
    "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
    "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
    "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
    "Application missionnaire","Application pastorale","Application personnelle",
    "Versets à retenir","Prière de fin"
  ];
  const N=FIXED_POINTS.length;

  // ---------- état ----------
  let current=0, notes={}, autosaveTimer=null, autoTimer=null, inFlight=false;

  function renderSidebar(){
    pointsList.innerHTML="";
    FIXED_POINTS.forEach((t,i)=>{
      const row=document.createElement("div");
      row.className="item"+(i===current?" active":"");
      row.dataset.idx=i;
      row.innerHTML=`
        <span class="idx">${i+1}</span>
        <div><div>${t}</div><span class="desc">Rubrique ${i+1}</span></div>
        <span class="dot ${notes[i]&&notes[i].trim()?"ok":""}"></span>`;
      row.addEventListener("click",()=>{if(current!==i)select(i);});
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){
    document.querySelectorAll(".list .item").forEach(el=>{
      const i=+el.dataset.idx, dot=el.querySelector(".dot");
      if(!dot)return;
      if(notes[i]&&notes[i].trim())dot.classList.add("ok");else dot.classList.remove("ok");
    });
  }
  function select(i){
    if(noteArea&&i!==current)notes[current]=noteArea.value;
    saveStorage(); current=i;
    document.querySelectorAll(".list .item").forEach(el=>el.classList.toggle("active",+el.dataset.idx===current));
    if(edTitle)edTitle.textContent=`${i+1}. ${FIXED_POINTS[i]}`;
    if(noteArea)noteArea.value=notes[i]||"";
    if(metaInfo)metaInfo.textContent=`Point ${i+1} / ${N}`;
    renderViewFromArea(); updateLinksPanel();
    if(enrichToggle&&enrichToggle.checked){noteView&&noteView.focus();}else{noteArea&&noteArea.focus();}
  }
  function saveStorage(){ try{ localStorage.setItem("be_notes",JSON.stringify(notes)); renderSidebarDots(); }catch{} }

  // ---------- rendu enrichi ----------
  function renderViewFromArea(){
    const raw=noteArea.value||"";
    let html=raw.replace(/</g,"&lt;").replace(/>/g,"&gt;");
    html=html.replace(/\n\n+/g,"</p><p>").replace(/\n/g,"<br>");
    noteView.innerHTML=html?"<p>"+html+"</p>":"<p style='color:#9aa2b1'>Écris ici…</p>";
  }
  function syncAreaFromView(){
    let html=noteView.innerHTML||"";
    html=html.replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n\n").replace(/<[^>]+>/g,"");
    noteArea.value=html.trim(); notes[current]=noteArea.value; saveStorage(); updateLinksPanel();
  }

  // ---------- panneau liens ----------
  function extractLinks(text){
    const links=[]; const urlRe=/https?:\/\/[^\s<>"'()]+/g; let m;
    while((m=urlRe.exec(text||""))){ const url=m[0]; links.push({url,label:url}); }
    return links;
  }
  function updateLinksPanel(){
    const txt=noteArea.value||""; const links=extractLinks(txt);
    linksList.innerHTML=""; if(!links.length){linksPanel.classList.add("empty");return;}
    linksPanel.classList.remove("empty");
    for(const l of links){const a=document.createElement("a");a.href=l.url;a.target="_blank";a.rel="noopener";a.textContent=l.label;
      const div=document.createElement("div");div.appendChild(a);linksList.appendChild(div);}
  }

  // ---------- API ----------
  async function getStudy(){
    const book=bookSelect.value||"Genèse";
    const chapter=chapterSelect.value||"1";
    const verse=verseSelect.value||"";
    const ver=versionSelect.value||"LSG";
    const r=await fetch("/api/study-28",{
      method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({book,chapter,verse,translation:ver,mode:"full"})
    });
    const j=await r.json().catch(()=>({}));
    if(!j||j.ok===false)throw new Error(j.error||"Réponse invalide");
    return j.data;
  }

  async function generateStudy(){
    if(inFlight)return; inFlight=true; try{
      setProgress(30);
      const data=await getStudy(); notes={};
      const secs=Array.isArray(data.sections)?data.sections:[];
      secs.forEach(s=>{const i=(s.index|0)-1;if(i>=0&&i<N)notes[i]=s.content||"";});
      renderSidebar(); select(0); renderSidebarDots();
      setProgress(100); setTimeout(()=>setProgress(0),500);
    }catch(e){alert("Erreur: "+(e.message||e));}finally{inFlight=false;}
  }

  // ---------- init ----------
  renderSidebar(); select(0); renderSidebarDots(); updateLinksPanel();
  if(enrichToggle){ enrichToggle.addEventListener("change",()=>{if(enrichToggle.checked){noteArea.style.display="none";noteView.style.display="block";renderViewFromArea();}else{noteView.style.display="none";noteArea.style.display="block";}});}
  noteArea.addEventListener("input",()=>{clearTimeout(autosaveTimer);autosaveTimer=setTimeout(()=>{notes[current]=noteArea.value;saveStorage();renderViewFromArea();updateLinksPanel();},600);});
  noteView.addEventListener("input",()=>{syncAreaFromView();});
  prevBtn.addEventListener("click",()=>{if(current>0)select(current-1);});
  nextBtn.addEventListener("click",()=>{if(current<N-1)select(current+1);});
  generateBtn.addEventListener("click",generateStudy);
  readBtn.addEventListener("click",()=>{const b=bookSelect.value,c=chapterSelect.value;window.open(`https://www.biblegateway.com/passage/?search=${b}%20${c}&version=${versionSelect.value||"LSG"}`,"_blank");});
  validateBtn.addEventListener("click",()=>{updateLinksPanel();});
})();

// public/app.js
(function () {
  // --- Progress
  const progressBar = document.getElementById('progressBar');
  const setProgress = p => progressBar.style.width = Math.max(0, Math.min(100, p)) + '%';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fakePrep = async () => { setProgress(15); await wait(120); setProgress(55); await wait(120); setProgress(100); setTimeout(()=>setProgress(0), 260); };

  // --- UI
  const searchRef = document.getElementById('searchRef');
  const bookSelect = document.getElementById('bookSelect');
  const chapterSelect = document.getElementById('chapterSelect');
  const verseSelect = document.getElementById('verseSelect');
  const versionSelect = document.getElementById('versionSelect');
  const validateBtn = document.getElementById('validate');
  const generateBtn = document.getElementById('generateBtn');
  const readLink = document.getElementById('readLink');
  const lastStudy = document.getElementById('lastStudy');

  const pointsList = document.getElementById('pointsList');
  const edTitle = document.getElementById('edTitle');
  const noteArea = document.getElementById('noteArea');
  const prevBtn = document.getElementById('prev');
  const nextBtn = document.getElementById('next');
  const metaInfo = document.getElementById('metaInfo');

  document.getElementById('y').textContent = new Date().getFullYear();

  // --- Livres
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

  function renderBooks(){
    bookSelect.innerHTML='';
    BOOKS.forEach(([name,ch])=>{
      const o=document.createElement('option'); o.value=name; o.textContent=name; o.dataset.ch=ch; bookSelect.appendChild(o);
    });
  }
  function renderChapters(){
    chapterSelect.innerHTML='';
    const ch = bookSelect.selectedOptions[0] ? parseInt(bookSelect.selectedOptions[0].dataset.ch,10) : 1;
    for(let i=1;i<=ch;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o); }
  }
  function renderVerses(max=60){
    verseSelect.innerHTML=''; const m=Math.max(1,Math.min(200,max));
    for(let i=1;i<=m;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o); }
  }
  function updateReadLink(){
    const ref = `${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`;
    const ver = versionSelect.value;
    readLink.href = 'https://www.biblegateway.com/passage/?search=' + encodeURIComponent(ref) + '&version=' + encodeURIComponent(ver);
  }

  // --- Rubriques FIXES (de ton fichier)
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
    {t:"Références croisées",d:"Passages parallèles ou complémentaires dans la Bible."},
    {t:"Fondements théologiques",d:"Doctrines majeures qui émergent du chapitre."},
    {t:"Thème doctrinal",d:"Lien entre le chapitre et les 22 grands thèmes doctrinaux."},
    {t:"Fruits spirituels",d:"Vertus et attitudes inspirées par le chapitre."},
    {t:"Types bibliques",d:"Symboles ou figures typologiques présents."},
    {t:"Appui doctrinal",d:"Autres passages bibliques qui renforcent l'enseignement."},
    {t:"Comparaison entre versets",d:"Versets comparés au sein du chapitre pour mise en relief."},
    {t:"Comparaison avec Actes 2",d:"Parallèle avec le début de l’Église et le Saint-Esprit."},
    {t:"Verset à mémoriser",d:"Verset essentiel à retenir dans sa vie spirituelle."},
    {t:"Enseignement pour l’Église",d:"Implications collectives et ecclésiales."},
    {t:"Enseignement pour la famille",d:"Valeurs à transmettre dans le foyer chrétien."},
    {t:"Enseignement pour enfants",d:"Méthode simplifiée avec jeux, récits, symboles visuels."},
    {t:"Application missionnaire",d:"Comment le texte guide l’évangélisation."},
    {t:"Application pastorale",d:"Conseils pour les ministres, pasteurs et enseignants."},
    {t:"Application personnelle",d:"Examen de conscience et engagement individuel."},
    {t:"Versets à retenir",d:"Versets incontournables pour la prédication pastorale."},
    {t:"Prière de fin",d:"Clôture spirituelle de l’étude avec reconnaissance."}
  ]; // source: etude biblique 28 points.json :contentReference[oaicite:1]{index=1}
  const N = FIXED_POINTS.length;

  // --- État
  let current = 0;
  let notes = {};           // contenus (droite) par index
  let autosaveTimer = null;
  let autoTimer = null;

  // --- Rendu colonne fixe
  function renderSidebar(){
    pointsList.innerHTML = '';
    FIXED_POINTS.forEach((r,i)=>{
      const row = document.createElement('div');
      row.className = 'item' + (i===current?' active':'');
      row.dataset.idx = i;
      row.innerHTML = `<span class="idx">${i+1}</span>
        <div><div>${r.t}</div><span class="desc">${r.d||''}</span></div>
        <span class="dot ${notes[i]&&notes[i].trim()?'ok':''}"></span>`;
      row.addEventListener('click', ()=>{ if(current!==i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){
    document.querySelectorAll('.list .item').forEach(el=>{
      const i=Number(el.dataset.idx), dot=el.querySelector('.dot');
      if(!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add('ok'); else dot.classList.remove('ok');
    });
  }

  function select(i){
    notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document.querySelectorAll('.list .item').forEach(el=> el.classList.toggle('active', Number(el.dataset.idx)===current));
    edTitle.textContent = `${i+1}. ${FIXED_POINTS[i].t}`;
    noteArea.value = notes[i] || '';
    metaInfo.textContent = `Point ${i+1} / ${N}`;
    noteArea.focus();
  }

  function saveStorage(){
    try{
      localStorage.setItem('be_notes', JSON.stringify(notes));
      renderSidebarDots();
    }catch{}
  }

  // --- Helpers
  const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\./g,'').trim();
  function parseSearch(q){
    q = q.trim();
    const m = q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
    if(!m) return null;
    let book = null, raw = norm(m[1]);
    for (const [name] of BOOKS) if (norm(name)===norm(m[1]).trim()) { book=name; break; }
    if (!book) {
      const cand = BOOKS.find(([name]) => norm(name).startsWith(norm(m[1]).trim()));
      if (cand) book = cand[0];
    }
    if (!book) return null;
    return { book, chap: parseInt(m[2],10), vers: m[3]?parseInt(m[3],10):null };
  }

  function applySelection(sel){
    if(!sel) return;
    const idx = BOOKS.findIndex(([n])=> n===sel.book);
    if (idx>=0) bookSelect.selectedIndex = idx;
    renderChapters();
    const chMax = bookSelect.selectedOptions[0] ? parseInt(bookSelect.selectedOptions[0].dataset.ch,10):1;
    const chap = Math.max(1, Math.min(chMax, sel.chap||1));
    chapterSelect.value = String(chap);
    renderVerses(sel.book==="Psaumes" ? 200 : 60);
    if (sel.vers){ verseSelect.value = String(sel.vers); }
    updateReadLink();
  }

  function buildReference(){
    const typed = (searchRef.value || '').trim();
    if (typed) return typed;
    const b = bookSelect.value, c = chapterSelect.value, v = verseSelect.value;
    // pour la génération : Livre + Chapitre suffisent
    return c ? `${b} ${c}` : b;
  }

  // --- Génération: on NE change pas la colonne fixe, on remplit seulement les contenus
  async function generateStudy(){
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }

    await fakePrep();

    let resp=null, payload=null;
    try{
      const url = `/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
      resp = await fetch(url, { method: 'GET' });
      try { payload = await resp.json(); } catch { payload = { ok:false, error:'Réponse non JSON' }; }
    }catch(e){
      payload = { ok:false, error: 'Erreur réseau: '+(e?.message || e) };
    }
    if (!resp || !resp.ok || !payload?.ok) {
      const panel = document.getElementById('debugPanel'); const btnDbg = document.getElementById('debugBtn');
      if (panel) { panel.style.display='block'; btnDbg.textContent='Fermer Debug'; panel.textContent += `\n[API KO] ${(resp&&resp.status)||0}\n`+JSON.stringify(payload,null,2); }
      alert(payload?.error || `Erreur HTTP ${resp ? resp.status : 0}`);
      return;
    }

    const data = payload.data || payload;      // {reference, sections}
    const sections = Array.isArray(data.sections) ? data.sections.slice(0, N) : [];

    // Remplir notes[] en mappant 1..28 -> sections[i].content (si vide, on laisse "")
    notes = {};
    for (let i=0; i<N; i++){
      const s = sections[i] || {};
      notes[i] = String(s.content || "");
    }

    // mémorise “dernier”
    try {
      const book=bookSelect.value, chap=chapterSelect.value, vers=verseSelect.value, ver=versionSelect.value;
      localStorage.setItem('be_last', JSON.stringify({book, chapter:chap, verse:vers, version:ver}));
      lastStudy.textContent = `Dernier : ${data.reference || `${book} ${chap}`} (${ver})`;
    } catch {}

    // rafraîchir UI (titres inchangés)
    renderSidebar();
    select(0);
  }

  // --- Initialisation
  renderBooks(); renderChapters(); renderVerses(); updateReadLink();
  renderSidebar(); select(0);

  // Recherche intelligente
  searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const sel=parseSearch(searchRef.value); if(sel){applySelection(sel); autoGenerate();} }});
  searchRef.addEventListener('blur', ()=>{ const sel=parseSearch(searchRef.value); if(sel){applySelection(sel); autoGenerate();} });

  // Valider => BibleGateway uniquement
  validateBtn.addEventListener('click', ()=>{
    updateReadLink();
    try{
      const book=bookSelect.value, chap=chapterSelect.value, vers=verseSelect.value, ver=versionSelect.value;
      localStorage.setItem('be_last', JSON.stringify({book, chapter:chap, verse:vers, version:ver}));
      lastStudy.textContent = `Dernier : ${book} ${chap||1} (${ver})`;
    }catch{}
    window.open(readLink.href, '_blank', 'noopener');
  });

  // Générer => /api/chat -> remplit notes (colonne gauche figée)
  generateBtn.addEventListener('click', generateStudy);

  // Auto-génération dès qu’on a Livre + Chapitre (sans saisie libre)
  let autoTimer=null;
  function autoGenerate(){
    clearTimeout(autoTimer);
    autoTimer = setTimeout(()=>{
      if (bookSelect.value && chapterSelect.value && !(searchRef.value||'').trim()){
        generateStudy();
      }
    }, 300);
  }
  bookSelect.addEventListener('change', ()=>{ renderChapters(); renderVerses(bookSelect.value==="Psaumes"?200:60); updateReadLink(); autoGenerate(); });
  chapterSelect.addEventListener('change', ()=>{ updateReadLink(); autoGenerate(); });
  verseSelect.addEventListener('change', ()=>{ updateReadLink(); });

  // nav + autosave
  prevBtn.addEventListener('click', ()=> select((current-1+N)%N));
  nextBtn.addEventListener('click', ()=> select((current+1)%N));
  noteArea.addEventListener('input', ()=>{ clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ notes[current]=noteArea.value; saveStorage(); }, 2000); });

  // Debug footer
  const btnDbg = document.getElementById('debugBtn');
  const panel = document.getElementById('debugPanel');
  const dotHealth = document.getElementById('dot-health');
  const dotChat = document.getElementById('dot-chat');
  const dotPing = document.getElementById('dot-ping');
  const setMini = (dot,ok)=>{ dot.classList.remove('ok','ko'); if(ok===true) dot.classList.add('ok'); else if(ok===false) dot.classList.add('ko'); };
  async function ping(path, options){ try{ const c=new AbortController(); const t=setTimeout(()=>c.abort(),2500); const r=await fetch(path,{...(options||{}),signal:c.signal}); clearTimeout(t); return r; }catch(e){ return {ok:false,status:0}; } }
  async function runChecks(){
    setMini(dotHealth,undefined); setMini(dotChat,undefined); setMini(dotPing,undefined);
    const r1=await ping('/api/health'); setMini(dotHealth,!!(r1&&r1.ok));
    const r2=await ping('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({probe:true})}); setMini(dotChat,!!(r2&&r2.ok));
    const r3=await ping('/api/ping'); setMini(dotPing,!!(r3&&r3.ok));
  }
  btnDbg.addEventListener('click', ()=>{ const open=panel.style.display==='block'; panel.style.display=open?'none':'block'; btnDbg.textContent=open?'Debug':'Fermer Debug'; if(!open){ panel.textContent='[Debug démarré…]'; runChecks(); } });

})();

// public/app.js
(function () {
  // ===== UI helpers =====
  const progressBar = document.getElementById('progressBar');
  const setProgress = p => progressBar.style.width = Math.max(0, Math.min(100, p)) + '%';
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fakePrep = async () => { setProgress(15); await wait(120); setProgress(55); await wait(120); setProgress(100); setTimeout(()=>setProgress(0), 260); };

  const $ = id => document.getElementById(id);
  const searchRef = $('searchRef'), bookSelect=$('bookSelect'), chapterSelect=$('chapterSelect'),
        verseSelect=$('verseSelect'), versionSelect=$('versionSelect'),
        validateBtn=$('validate'), generateBtn=$('generateBtn'), readLink=$('readLink'), lastStudy=$('lastStudy'),
        pointsList=$('pointsList'), edTitle=$('edTitle'), noteArea=$('noteArea'),
        prevBtn=$('prev'), nextBtn=$('next'), metaInfo=$('metaInfo'),
        btnDbg=$('debugBtn'), panel=$('debugPanel'), dotHealth=$('dot-health'), dotChat=$('dot-chat'), dotPing=$('dot-ping');
  const setMini = (dot,ok)=>{ dot.classList.remove('ok','ko'); if(ok===true) dot.classList.add('ok'); else if(ok===false) dot.classList.add('ko'); };
  const dlog = msg => { if(!panel) return; panel.style.display='block'; btnDbg.textContent='Fermer Debug'; const line='['+new Date().toISOString()+'] '+msg; panel.textContent += (panel.textContent?'\n':'')+line; console.log(line); };
  $('y') && ($('y').textContent = new Date().getFullYear());

  // ===== Livres =====
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
  function renderBooks(){ bookSelect.innerHTML=''; BOOKS.forEach(([n,ch])=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; o.dataset.ch=ch; bookSelect.appendChild(o); }); }
  function renderChapters(){ chapterSelect.innerHTML=''; const ch=bookSelect.selectedOptions[0]?+bookSelect.selectedOptions[0].dataset.ch:1; for(let i=1;i<=ch;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);} }
  function renderVerses(max=60){ verseSelect.innerHTML=''; const m=Math.max(1,Math.min(200,max)); for(let i=1;i<=m;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);} }
  function updateReadLink(){ const ref = `${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`; const ver=versionSelect.value; readLink.href='https://www.biblegateway.com/passage/?search='+encodeURIComponent(ref)+'&version='+encodeURIComponent(ver); }

  // ===== Rubriques fixes =====
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
  ];
  const N = FIXED_POINTS.length;

  // ===== État =====
  let current = 0;
  let notes = {};
  let autosaveTimer = null;
  let autoTimer = null;

  // ===== Rendu colonne fixe =====
  function renderSidebar(){
    pointsList.innerHTML='';
    FIXED_POINTS.forEach((r,i)=>{
      const row=document.createElement('div');
      row.className='item'+(i===current?' active':'');
      row.dataset.idx=i;
      row.innerHTML = `<span class="idx">${i+1}</span>
        <div><div>${r.t}</div><span class="desc">${r.d||''}</span></div>
        <span class="dot ${notes[i]&&notes[i].trim()?'ok':''}"></span>`;
      row.addEventListener('click', ()=>{ if(current!==i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots(){ document.querySelectorAll('.list .item').forEach(el=>{ const i=+el.dataset.idx, dot=el.querySelector('.dot'); if(!dot) return; if(notes[i]&&notes[i].trim()) dot.classList.add('ok'); else dot.classList.remove('ok'); }); }
  function select(i){ notes[current]=noteArea.value; saveStorage(); current=i; document.querySelectorAll('.list .item').forEach(el=> el.classList.toggle('active', +el.dataset.idx===current)); edTitle.textContent=`${i+1}. ${FIXED_POINTS[i].t}`; noteArea.value=notes[i]||''; metaInfo.textContent=`Point ${i+1} / ${N}`; noteArea.focus(); }
  function saveStorage(){ try{ localStorage.setItem('be_notes', JSON.stringify(notes)); renderSidebarDots(); }catch{} }

  // ===== Saisie / sélection =====
  const norm = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9: ]+/g,' ').replace(/\s+/g,' ').trim();
  function parseSearch(q){
    q = (q||'').trim(); const m = q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
    if(!m) return null; const title=norm(m[1]);
    let book = null; for(const [name] of BOOKS){ if(norm(name)===title) { book=name; break; } }
    if(!book){ const cand=BOOKS.find(([name])=> norm(name).startsWith(title)); if(cand) book=cand[0]; }
    if(!book) return null; return { book, chap:+m[2], vers:m[3]?+m[3]:null };
  }
  function applySelection(sel){
    if(!sel) return;
    const idx = BOOKS.findIndex(([n])=> n===sel.book);
    if(idx>=0) bookSelect.selectedIndex=idx;
    renderChapters();
    const chMax=bookSelect.selectedOptions[0]?+bookSelect.selectedOptions[0].dataset.ch:1;
    const chap=Math.max(1,Math.min(chMax, sel.chap||1));
    chapterSelect.value=String(chap);
    renderVerses(sel.book==="Psaumes"?200:60);
    if(sel.vers) verseSelect.value=String(sel.vers);
    updateReadLink();
  }
  function buildReference(){ const typed=(searchRef.value||'').trim(); if(typed) return typed; const b=bookSelect.value, c=chapterSelect.value; return c?`${b} ${c}`:b; }

  // ===== API robuste GET -> POST =====
  async function fetchChat(ref){
    const url=`/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
    try{ const r=await fetch(url,{method:'GET'}); const j=await r.json().catch(()=>({})); if(r.ok&&(j?.ok||j?.data)) return {ok:true,payload:j,status:r.status}; }catch(_){}
    try{ const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:ref,templateId:'v28-standard'})}); const j=await r.json().catch(()=>({})); if(r.ok&&(j?.ok||j?.data)) return {ok:true,payload:j,status:r.status}; return {ok:false,payload:j,status:r.status}; }catch(e){ return {ok:false,payload:{error:String(e)},status:0}; }
  }

  // ===== Profils de rubriques (mots-clés) =====
  const PROFILE = [
    {i:0,  k:["priere","ouverture","saint esprit","ouvre nos coeurs","amen"]},
    {i:1,  k:["canon","testament","ancien","nouveau","corpus","livre"]},
    {i:2,  k:["questions","precedent","retour","reponses","revision"]},
    {i:3,  k:["titre","resume","theme central","synthese"]},
    {i:4,  k:["contexte","historique","epoque","geographie","culture","carte"]},
    {i:5,  k:["structure","plan","sequences","composition"]},
    {i:6,  k:["genre","litteraire","poetique","narratif","proph"]},
    {i:7,  k:["auteur","genealogie","biographie","patriarche"]},
    {i:8,  k:["verset","cle","central","doctrinal"]},
    {i:9,  k:["exegese","exegetique","mot a mot","grec","hebreu"]},
    {i:10, k:["lexique","lexical","mots cles","termes","sens"]},
    {i:11, k:["references","croisees","paralleles","renvois"]},
    {i:12, k:["fondements","theologiques","doctrines","dogme"]},
    {i:13, k:["theme doctrinal","theme","doctrinal"]},
    {i:14, k:["fruits","spirituels","vertus"]},
    {i:15, k:["types","typologie","symboles","figures"]},
    {i:16, k:["appui doctrinal","appui","renforce","preuve"]},
    {i:17, k:["comparaison","versets","mise en relief"]},
    {i:18, k:["actes 2","pentecote","debut de l eglise"]},
    {i:19, k:["memoriser","par coeur","retenir"]},
    {i:20, k:["eglise","assemblee","communaut"]},
    {i:21, k:["famille","foyer","parents","enfants"]},
    {i:22, k:["enfants","pedagogie","jeux","recits"]},
    {i:23, k:["mission","evangelisation","temoigner","annoncer"]},
    {i:24, k:["pastorale","ministres","enseignants","pasteur"]},
    {i:25, k:["personnelle","application","examen","engagement"]},
    {i:26, k:["versets a retenir","incontournables","predication"]},
    {i:27, k:["priere de fin","cloture","amen","merci seigneur"]}
  ];

  // scorer titre+contenu -> index de rubrique
  function scoreFor(section, target){
    const t = norm(section.title||'');
    const b = norm(section.body||'');
    let s = 0;
    target.k.forEach(k=>{
      if(t.includes(k)) s += 3;        // poids fort dans le titre
      if(b.includes(k)) s += 1;        // poids léger dans le contenu
    });
    // bonus si ça commence par un mot clé majeur
    if (t && target.k.some(k=> t.startsWith(k))) s += 2;
    return s;
  }

  // assignation globale (glouton mais stable)
  function assignSections(sections){
    // construit matrice score [sec][rubrique]
    const M = sections.map(sec=> PROFILE.map(p => scoreFor(sec, p)));
    const takenRub = new Set();
    const assigned = Array(sections.length).fill(-1);
    // on choisit pour chaque section la meilleure rubrique libre
    sections.forEach((sec, si)=>{
      let bestI=-1, bestScore=0;
      PROFILE.forEach((p,ri)=>{
        if(takenRub.has(p.i)) return;
        const sc = M[si][ri];
        if(sc>bestScore){ bestScore=sc; bestI=p.i; }
      });
      if(bestScore>0){ assigned[si]=bestI; takenRub.add(bestI); }
    });
    return assigned; // tableau d'index de rubrique (ou -1)
  }

  // post-traitements : prières + verset-clé
  function defaultPrayerOpen(reference){
    return `Père céleste, nous venons devant toi pour lire ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`;
  }
  function defaultPrayerClose(reference){
    return `Seigneur, merci pour la lumière reçue dans ${reference}. Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;
  }
  function ensureKeyVerse(body, reference){
    const hasVerseRef = /\b\d+[:]\d+\b/.test(body) || /[A-Za-zÀ-ÿ]+\s+\d+[:]\d+/.test(body);
    if (hasVerseRef) return body;
    const ref = reference || buildReference();
    // on propose un “voir : Livre Chap:1” (déterministe et non aléatoire)
    const chap = (ref.match(/\b(\d+)\b/)||[])[1]||'1';
    return `Verset-clé proposé : ${ref.split(' ')[0]} ${chap}:1 — ${body}`;
  }

  // ===== Génération =====
  async function fetchChat(ref){
    const url=`/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
    try{ const r=await fetch(url,{method:'GET'}); const j=await r.json().catch(()=>({})); if(r.ok&&(j?.ok||j?.data)) return {ok:true,payload:j,status:r.status}; }catch(_){}
    try{ const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:ref,templateId:'v28-standard'})}); const j=await r.json().catch(()=>({})); if(r.ok&&(j?.ok||j?.data)) return {ok:true,payload:j,status:r.status}; return {ok:false,payload:j,status:r.status}; }catch(e){ return {ok:false,payload:{error:String(e)},status:0}; }
  }

  async function generateStudy(){
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }

    await fakePrep();

    const { ok, payload, status } = await fetchChat(ref);
    if (!ok) { dlog(`[API KO] /api/chat → ${status} ${JSON.stringify(payload).slice(0,300)}…`); alert(payload?.error || `Erreur HTTP ${status}`); return; }

    const data = payload.data || payload;
    const rawSections = Array.isArray(data.sections) ? data.sections : [];
    if (!rawSections.length){ dlog(`[API OK mais sans sections]`); alert("Réponse API sans sections."); return; }

    // normalisation
    const secs = rawSections.slice(0, 40).map(s => ({
      title: s.title || s.titre || '',
      body: String(s.content ?? s.description ?? s.text ?? '')
    })).filter(s => s.body.trim() || s.title.trim());

    // 1) assignation par score
    const assigned = assignSections(secs);
    // 2) si < 12 points mappés, on complète par positionnel pour remplir visuellement
    const usedRub = new Set(assigned.filter(i=>i>=0));
    let mappedCount = usedRub.size;
    if (mappedCount < Math.min(12, secs.length)){
      for (let i=0; i<Math.min(N, secs.length); i++){
        if (!usedRub.has(i) && !(assigned[i]>=0)) { assigned[i]=i; usedRub.add(i); mappedCount++; }
      }
    }

    // 3) construire notes[]
    notes = {};
    for (let si=0; si<secs.length; si++){
      const ri = assigned[si];
      if (ri>=0 && ri<N){
        const body = secs[si].body.trim();
        if (!notes[ri]) notes[ri] = body;
      }
    }

    // 4) post-traitements sûrs
    if (!notes[0]) notes[0] = defaultPrayerOpen(data.reference || ref);
    if (notes[8]) notes[8] = ensureKeyVerse(notes[8], data.reference || ref);
    else notes[8] = ensureKeyVerse("Le passage central met en avant la seigneurie du Christ.", data.reference || ref);
    if (!notes[27]) notes[27] = defaultPrayerClose(data.reference || ref);

    dlog(`[GEN] sections=${secs.length}, mapped≈${mappedCount}, filled=${Object.keys(notes).length}`);

    // mémoire “dernier”
    try {
      const book=bookSelect.value, chap=chapterSelect.value, vers=verseSelect.value, ver=versionSelect.value;
      localStorage.setItem('be_last', JSON.stringify({book, chapter:chap, verse:vers, version:ver}));
      lastStudy.textContent = `Dernier : ${data.reference || `${book} ${chap}`} (${ver})`;
    } catch {}

    renderSidebar();
    select(0);
  }

  // ===== Initialisation =====
  renderBooks(); renderChapters(); renderVerses(); updateReadLink();
  renderSidebar(); select(0);

  // Recherche intelligente
  searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter'){ const sel=parseSearch(searchRef.value); if(sel){applySelection(sel); autoGenerate();} }});
  searchRef.addEventListener('blur', ()=>{ const sel=parseSearch(searchRef.value); if(sel){applySelection(sel); autoGenerate();} });

  // Valider -> BibleGateway (aucun appel API)
  validateBtn.addEventListener('click', ()=>{
    updateReadLink();
    try{ const book=bookSelect.value, chap=chapterSelect.value, vers=verseSelect.value, ver=versionSelect.value;
      localStorage.setItem('be_last', JSON.stringify({book, chapter:chap, verse:vers, version:ver}));
      lastStudy.textContent = `Dernier : ${book} ${chap||1} (${ver})`;
    }catch{}
    window.open(readLink.href, '_blank', 'noopener');
  });

  // Générer -> /api/chat
  generateBtn.addEventListener('click', generateStudy);

  // Auto-génération Livre+Chapitre (si pas de saisie texte)
  function autoGenerate(){
    clearTimeout(autoTimer);
    autoTimer = setTimeout(()=>{ if (bookSelect.value && chapterSelect.value && !(searchRef.value||'').trim()){ generateStudy(); } }, 300);
  }
  bookSelect.addEventListener('change', ()=>{ renderChapters(); renderVerses(bookSelect.value==="Psaumes"?200:60); updateReadLink(); autoGenerate(); });
  chapterSelect.addEventListener('change', ()=>{ updateReadLink(); autoGenerate(); });
  verseSelect.addEventListener('change', ()=>{ updateReadLink(); });

  // Autosave notes
  noteArea.addEventListener('input', ()=>{ clearTimeout(autosaveTimer); autosaveTimer=setTimeout(()=>{ notes[current]=noteArea.value; saveStorage(); }, 2000); });

  // Debug footer
  btnDbg.addEventListener('click', ()=>{
    const open=panel.style.display==='block';
    panel.style.display=open?'none':'block';
    btnDbg.textContent=open?'Debug':'Fermer Debug';
    if(!open){
      panel.textContent='[Debug démarré…]';
      (async ()=>{
        try{ const r1=await fetch('/api/health'); setMini(dotHealth, r1.ok); dlog(`health → ${r1.status}`); }catch{ setMini(dotHealth,false); }
        try{ const r2=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({probe:true})}); setMini(dotChat, r2.ok); dlog(`chat(POST) → ${r2.status}`); }catch{ setMini(dotChat,false); }
        try{ const r3=await fetch('/api/ping'); setMini(dotPing, r3.ok); dlog(`ping → ${r3.status}`); }catch{ setMini(dotPing,false); }
      })();
    }
  });

})();

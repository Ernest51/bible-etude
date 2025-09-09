/* app.js — Thème GLOBAL via variables CSS (+ exclure boutons),
   Reset total (recherche vide + selects neutres) mais conserve "Dernière",
   66 livres + chapitres bornés, 28 rubriques, densité 500/1500/2500, API prête.
*/

(function () {
  // ---------- Helpers ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const esc = (s)=>String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  // ---------- Constantes ----------
  const STORAGE_LAST='lastStudy', STORAGE_DENS='density8', STORAGE_THEME='theme8';
  const TITLE0='Rubrique 0 — Panorama des versets du chapitre';
  const DENSITY_CHOICES=[500,1500,2500];

  // Thèmes → variables CSS (couleurs de base). Boutons fixés séparément.
  const THEMES=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate'];
  const THEME_VARS = {
    cyan:   { bg:'#f0f9ff', text:'#0c4a6e', primary:'#06b6d4', border:'#e2e8f0' },
    violet: { bg:'#f5f3ff', text:'#4c1d95', primary:'#8b5cf6', border:'#e2e8f0' },
    vert:   { bg:'#f0fdf4', text:'#064e3b', primary:'#22c55e', border:'#e2e8f0' },
    rouge:  { bg:'#fef2f2', text:'#7f1d1d', primary:'#ef4444', border:'#e2e8f0' },
    mauve:  { bg:'#fdf4ff', text:'#581c87', primary:'#a855f7', border:'#e2e8f0' },
    indigo: { bg:'#eef2ff', text:'#312e81', primary:'#6366f1', border:'#e2e8f0' },
    ambre:  { bg:'#fffbeb', text:'#78350f', primary:'#f59e0b', border:'#e2e8f0' },
    slate:  { bg:'#f8fafc', text:'#0f172a', primary:'#475569', border:'#e2e8f0' },
  };

  const CHAPTERS_66 = {"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};
  const ORDER_66 = Object.keys(CHAPTERS_66);

  const TITLES_DEFAULT={1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",17:"Appui doctrinal",18:"Comparaison entre versets",19:"Comparaison avec Actes 2",20:"Verset à mémoriser",21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",27:"Versets à retenir",28:"Prière de fin"};
  const DESCS_DEFAULT={1:"Invocation du Saint-Esprit pour éclairer l’étude.",2:"Appartenance au canon (AT/NT).",3:"Questions à reprendre de l’étude précédente.",4:"Résumé doctrinal synthétique du chapitre.",5:"Période, géopolitique, culture, carte.",6:"Séquençage narratif et composition.",7:"Type de texte : narratif, poétique, prophétique…",8:"Auteur et lien aux patriarches (généalogie).",9:"Verset central du chapitre.",10:"Commentaire exégétique (original si utile).",11:"Mots-clés et portée doctrinale.",12:"Passages parallèles et complémentaires.",13:"Doctrines majeures qui émergent du chapitre.",14:"Correspondance avec les grands thèmes doctrinaux.",15:"Vertus / attitudes visées.",16:"Figures typologiques et symboles.",17:"Passages d’appui concordants.",18:"Comparaison interne des versets.",19:"Parallèle avec Actes 2.",20:"Verset à mémoriser.",21:"Implications pour l’Église.",22:"Applications familiales.",23:"Pédagogie enfants (jeux, récits, symboles).",24:"Applications mission/évangélisation.",25:"Applications pastorales/enseignement.",26:"Application personnelle engagée.",27:"Versets utiles à retenir.",28:"Prière de clôture."};

  // ---------- État ----------
  const state = {
    book:'Genèse', chapter:1, verse:1, version:'LSG',
    density:1500, currentIdx:0,
    titles:{...TITLES_DEFAULT}, descs:{...DESCS_DEFAULT},
    sectionsByN:new Map(), leds:new Map()
  };
  for(let i=0;i<=28;i++) state.leds.set(i,'warn');

  // ---------- Éléments ----------
  const pointsList   = $('#pointsList');
  const edTitle      = $('#edTitle');
  const metaInfo     = $('#metaInfo');

  const searchRef    = $('#searchRef');
  const applyBtn     = $('#applySearchBtn') || $('#validate'); // aligné avec index.html
  const bookSelect   = $('#bookSelect');
  const chapterSelect= $('#chapterSelect');
  const verseSelect  = $('#verseSelect');
  const versionSelect= $('#versionSelect');

  const readBtn      = $('#readBtn');
  const generateBtn  = $('#generateBtn');
  const resetBtn     = $('#resetBtn'); // peut être absent (ok)
  const prevBtn      = $('#prev');
  const nextBtn      = $('#next');

  const noteArea     = $('#noteArea'); // Cœur de l’édition (textarea)

  // Éléments éventuels (absents dans index → safe)
  const lastBadge    = $('#lastBadge');
  const themeBar     = $('#themeBar');
  const themeThumb   = $('#themeThumb');

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    injectFixedButtonStyles();   // boutons NON thémés
    injectDescStyle();
    ensureListScroll();
    injectDensitySelector();     // no-op si pas de contrôles de densité
    ensureSelectPlaceholders();  // options "—" neutres

    restoreTheme();              // applique thème GLOBAL via variables
    restoreLast(); refreshLastBadge();

    wireEvents();
    if (state.book) {            // si on a un livre, on remplit
      fillBooks(); fillChapters(); fillVerses();
      bookSelect && (bookSelect.value = state.book);
      chapterSelect && (chapterSelect.value = String(state.chapter));
      verseSelect && (verseSelect.value = String(state.verse));
    } else {                     // sinon on laisse les placeholders
      fillBooks(true);           // true => ne sélectionne pas le livre
    }
    versionSelect && (versionSelect.value = state.version || 'LSG');

    renderPointsList(); updateHeader(); renderSection(0);
  }

  // ---------- Styles ----------
  function injectDescStyle(){
    const st=document.createElement('style');
    st.textContent=`#pointsList .txt .desc{display:block;margin-top:4px;font-size:12.5px;line-height:1.3;color:#64748b;white-space:normal}`;
    document.head.appendChild(st);
  }
  // Boutons fixes (non dépendants du thème)
  function injectFixedButtonStyles(){
    const st=document.createElement('style');
    st.textContent = `
      button.btn-fixed, .btn-fixed {
        background:#111827 !important; color:#fff !important; border:1px solid #111827 !important;
      }
      button.btn-fixed:hover, .btn-fixed:hover { filter:brightness(1.08); }
    `;
    document.head.appendChild(st);
  }

  // ---------- Thème GLOBAL ----------
  function setTheme(theme){
    const vars = THEME_VARS[theme] || THEME_VARS.cyan;
    applyThemeVars(document.documentElement, vars);
    applyThemeVars(document.body, vars);
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    THEMES.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+theme);
    try{ localStorage.setItem(STORAGE_THEME, theme); }catch{}
    placeThumbForTheme(theme);
    window.dispatchEvent(new CustomEvent('themechange',{ detail:{ theme, vars } }));
  }
  function applyThemeVars(el, vars){
    el.style.setProperty('--bg', vars.bg);
    el.style.setProperty('--text', vars.text);
    el.style.setProperty('--primary', vars.primary);
    el.style.setProperty('--border', vars.border);
    el.style.setProperty('--chip', vars.bg);
    el.style.setProperty('--muted', '#64748b');
  }
  function getTheme(){ try{ return localStorage.getItem(STORAGE_THEME) || 'cyan'; }catch{ return 'cyan'; } }
  function restoreTheme(){ setTheme(getTheme()); }
  function onThemePointer(ev){
    if (!themeBar) return;
    themeBar.setPointerCapture?.(ev.pointerId);
    const rect=themeBar.getBoundingClientRect();
    const move=(e)=>{
      const clientX=(e.touches?e.touches[0].clientX:e.clientX);
      const x=Math.max(0,Math.min(rect.width, clientX-rect.left));
      const pct=x/rect.width;
      themeThumb && (themeThumb.style.left=(pct*100)+'%');
      const idx=Math.min(THEMES.length-1, Math.floor(pct*THEMES.length));
      setTheme(THEMES[idx]);
    };
    const up=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      window.removeEventListener('touchmove',move);
      window.removeEventListener('touchend',up);
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('touchend',up);
    move(ev);
  }
  function placeThumbForTheme(theme){
    if (!themeThumb) return;
    const idx=Math.max(0, THEMES.indexOf(theme));
    const pct=(idx+0.5)/THEMES.length;
    themeThumb.style.left=(pct*100)+'%';
  }

  // ---------- Événements ----------
  function wireEvents(){
    applyBtn && applyBtn.addEventListener('click', applySearch);
    searchRef && searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter') applySearch(); });

    bookSelect && bookSelect.addEventListener('change', ()=>{
      state.book=bookSelect.value||''; 
      if (state.book){
        state.chapter=1; state.verse=1;
        fillChapters(); fillVerses();
      } else {
        clearChaptersAndVerses();
      }
      saveLast(); refreshLastBadge(); rerender();
    });

    chapterSelect && chapterSelect.addEventListener('change', ()=>{
      const max = CHAPTERS_66[state.book] || 1;
      const next = parseInt(chapterSelect.value,10);
      if (Number.isFinite(next)) { state.chapter = clamp(next,1,max); chapterSelect.value=String(state.chapter); }
      fillVerses(); saveLast(); refreshLastBadge(); rerender();
    });

    verseSelect && verseSelect.addEventListener('change', ()=>{
      const v = parseInt(verseSelect.value,10);
      state.verse = Number.isFinite(v) ? v : 1;
      saveLast(); refreshLastBadge(); rerender();
    });

    versionSelect && versionSelect.addEventListener('change', ()=>{ state.version=versionSelect.value||'LSG'; saveLast(); });

    readBtn && readBtn.addEventListener('click', ()=>{
      if (!state.book) return;
      const url = youVersionURL(state.book, state.chapter || 1, state.verse || 1, state.version);
      window.open(url, '_blank', 'noopener,noreferrer');
    });

    generateBtn && generateBtn.addEventListener('click', onGenerate);

    resetBtn && resetBtn.addEventListener('click', onResetTotal);

    prevBtn && prevBtn.addEventListener('click', ()=>goTo(state.currentIdx-1));
    nextBtn && nextBtn.addEventListener('click', ()=>goTo(state.currentIdx+1));

    if (themeBar) themeBar.addEventListener('pointerdown', onThemePointer);
  }

  // ---------- Placeholders & sélecteurs ----------
  function ensureSelectPlaceholders(){
    [bookSelect, chapterSelect, verseSelect].forEach(sel=>{
      if (!sel) return;
      if (!sel.querySelector('option[value=""]')){
        const opt=document.createElement('option');
        opt.value=''; opt.textContent='—';
        sel.insertBefore(opt, sel.firstChild);
      }
    });
  }
  function clearChaptersAndVerses(){
    if (chapterSelect){
      chapterSelect.innerHTML='';
      const opt=document.createElement('option'); opt.value=''; opt.textContent='—';
      chapterSelect.appendChild(opt); chapterSelect.value='';
    }
    if (verseSelect){
      verseSelect.innerHTML='';
      const opt=document.createElement('option'); opt.value=''; opt.textContent='—';
      verseSelect.appendChild(opt); verseSelect.value='';
    }
  }

  function fillBooks(keepNeutral=false){
    if (!bookSelect) return;
    bookSelect.innerHTML='';
    const opt0=document.createElement('option'); opt0.value=''; opt0.textContent='—'; bookSelect.appendChild(opt0);
    ORDER_66.forEach(b=>{
      const o=document.createElement('option'); o.value=b; o.textContent=b; bookSelect.appendChild(o);
    });
    if (!keepNeutral && state.book){ bookSelect.value=state.book; }
    else bookSelect.value='';
  }
  function fillChapters(){
    if (!chapterSelect) return;
    const max = CHAPTERS_66[state.book]||0;
    chapterSelect.innerHTML='';
    const opt0=document.createElement('option'); opt0.value=''; opt0.textContent='—'; chapterSelect.appendChild(opt0);
    for(let i=1;i<=max;i++){
      const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);
    }
    chapterSelect.value = state.chapter? String(clamp(state.chapter,1,max)) : '';
  }
  function fillVerses(){
    if (!verseSelect) return;
    verseSelect.innerHTML='';
    const opt0=document.createElement('option'); opt0.value=''; opt0.textContent='—'; verseSelect.appendChild(opt0);
    for(let i=1;i<=150;i++){
      const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);
    }
    verseSelect.value = state.verse? String(state.verse) : '';
  }

  // ---------- Recherche (Valider) ----------
  function applySearch(){
    if (!searchRef) return;
    const raw=(searchRef.value||'').trim(); if(!raw) return;
    const m = /^([\p{L}\d\s]+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/u.exec(raw);
    if (m){
      const bookName=normalizeBook(m[1]); const chap=parseInt(m[2],10); const vers=m[3]||null;
      const found=findBook(bookName);
      if (found){
        state.book=found;
        const max=CHAPTERS_66[found]||1;
        state.chapter=clamp(chap,1,max);
        state.verse=vers?parseInt(vers.split('-')[0],10):1;
        fillBooks(); bookSelect && (bookSelect.value=state.book);
        fillChapters(); chapterSelect && (chapterSelect.value=String(state.chapter));
        fillVerses(); verseSelect && (verseSelect.value=String(state.verse));
        saveLast(); refreshLastBadge(); rerender(); return;
      }
    }
    const bn=normalizeBook(raw); const fb=findBook(bn);
    if (fb){
      state.book=fb; state.chapter=1; state.verse=1;
      fillBooks(); bookSelect&&(bookSelect.value=fb);
      fillChapters(); fillVerses();
      saveLast(); refreshLastBadge(); rerender();
    }
  }
  function normalizeBook(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
  function findBook(normName){ for(const b of ORDER_66){ const n=normalizeBook(b); if(n===normName||n.startsWith(normName)||normName.startsWith(n)) return b; } return null; }

  // ---------- Liste 0..28 ----------
  function getTitle(n){ return state.titles[n] || TITLES_DEFAULT[n] || `Point ${n}`; }
  function getDesc (n){ return state.descs [n] || DESCS_DEFAULT [n] || ''; }

  function renderPointsList(){
    if (!pointsList) return;
    pointsList.innerHTML='';
    pointsList.appendChild(renderItem({ idx:0, title:TITLE0, desc:'Aperçu du chapitre verset par verset' }));
    for(let i=1;i<=28;i++) pointsList.appendChild(renderItem({ idx:i, title:getTitle(i), desc:getDesc(i) }));
    highlightActive();
  }
  function renderItem({ idx, title, desc }){
    const li=document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
    const idxEl=document.createElement('div'); idxEl.className='idx'; idxEl.textContent=String(idx);
    const txt=document.createElement('div'); txt.className='txt';
    txt.innerHTML=`<div>${esc(title)}</div>${desc?`<span class="desc">${esc(desc)}</span>`:''}`;
    const dot=document.createElement('div'); dot.className='dot '+(state.leds.get(idx)==='ok'?'ok':'');
    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click', ()=>goTo(idx));
    return li;
  }
  function highlightActive(){ $$('#pointsList .item').forEach(el=>el.classList.toggle('active', Number(el.dataset.idx)===state.currentIdx)); }
  function goTo(idx){ if(idx<0) idx=0; if(idx>28) idx=28; state.currentIdx=idx; updateHeader(); renderSection(idx); highlightActive(); }
  function updateHeader(){ if (!edTitle || !metaInfo) return; edTitle.textContent = state.currentIdx===0?TITLE0:getTitle(state.currentIdx); metaInfo.textContent=`Point ${state.currentIdx} / 28`; }

  function rerender(){ renderPointsList(); renderSection(state.currentIdx); updateHeader(); }

  // ---------- Rendu section ----------
  function renderSection(n){
    if (!noteArea) return;
    const txt = state.sectionsByN.get(n) || defaultContent(n);
    noteArea.value = txt;
    // Simule une frappe pour que le script de progress/verdissage réagisse
    noteArea.dispatchEvent(new Event('input', {bubbles:true}));
  }
  function defaultContent(n){
    const ref = state.book ? `${state.book} ${state.chapter||''}`.trim() : '—';
    if (n===0) return `### ${TITLE0}

*Référence :* ${ref}

Clique sur **Générer** pour charger chaque verset avec explications.`;
    return `### ${getTitle(n)}

*Référence :* ${ref}

À générer…`;
  }

  // ---------- API Génération ----------
  async function onGenerate(){
    if (!generateBtn) return;
    if (!state.book){ alert('Choisis un livre (et chapitre) avant de générer.'); return; }
    const old=generateBtn.textContent; generateBtn.disabled=true; generateBtn.textContent='Génération…';
    try{
      const passage = `${state.book} ${state.chapter||1}`;
      const r = await fetch('/api/generate-study', {
        method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
        body: JSON.stringify({ passage, options:{ length: state.density } })
      });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();
      const sections = j.study?.sections || j.sections || [];
      const t={}, d={};
      for (const s of sections){
        const id=Number(s.id ?? s.n); if(!Number.isFinite(id)) continue;
        const title=String((s.title ?? s.titre ?? '')).trim();
        const desc =String((s.description ?? s.desc ?? '')).trim();
        const content=String(s.content||'').trim();
        if (title) t[id]=title;
        if (desc)  d[id]=desc;
        if (content){ state.sectionsByN.set(id, content); state.leds.set(id,'ok'); }
      }
      if (Object.keys(t).length) state.titles={...state.titles, ...t};
      if (Object.keys(d).length) state.descs ={...state.descs , ...d};
      renderPointsList(); renderSection(state.currentIdx); saveLast(); refreshLastBadge();
    }catch(err){
      console.warn('Erreur génération:', err);
      alert('La génération a échoué. Un gabarit a été inséré.');
      insertSkeleton(); renderPointsList(); renderSection(state.currentIdx);
    }finally{
      generateBtn.disabled=false; generateBtn.textContent=old;
    }
  }

  function insertSkeleton(){
    const ref = state.book ? `${state.book} ${state.chapter||''}`.trim() : '—';
    state.sectionsByN.set(0, `### ${TITLE0}
*Référence :* ${ref}

Cliquer sur **Lire** puis **Générer** quand l’API sera dispo.`);
    for(let i=1;i<=28;i++){
      state.sectionsByN.set(i, `### ${getTitle(i)}
*Référence :* ${ref}

Contenu provisoire (gabarit).`);
      state.leds.set(i,'warn');
    }
  }

  // ---------- RESET total ----------
  function onResetTotal(){
    if (!confirm('Tout vider (recherche et sélecteurs à —), conserver “Dernière”, et repasser les voyants en jaune ?')) return;

    state.sectionsByN.clear();
    for (let i=0;i<=28;i++) state.leds.set(i,'warn');

    if (searchRef) searchRef.value='';

    state.book=''; state.chapter=null; state.verse=null;
    fillBooks(true);
    clearChaptersAndVerses();
    if (bookSelect)   bookSelect.value='';
    if (chapterSelect)chapterSelect.value='';
    if (verseSelect)  verseSelect.value='';

    renderPointsList(); renderSection(0); updateHeader();
  }

  // ---------- YouVersion ----------
  const YV_BOOK = {"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const YV_VERSION_ID = { 'LSG': '93' };

  function youVersionURL(book, chapter, verse, version){
    const code = YV_BOOK[book] || 'GEN';
    const verId = YV_VERSION_ID[version || 'LSG'] || '93';
    const vtag  = (version || 'LSG').toUpperCase();
    const u = new URL(`https://www.bible.com/fr/bible/${verId}/${code}.${chapter||1}.${vtag}`);
    return u.toString();
  }

  // ---------- Divers ----------
  function ensureListScroll(){
    if (!pointsList) return;
    pointsList.style.overflowY='auto';
    if (!pointsList.style.maxHeight) pointsList.style.maxHeight='calc(100vh - 220px)';
  }

  // Ancienne fonction de rendu HTML → ici on renvoie le texte tel quel (textarea)
  function mdToHtml(md){ return String(md || ''); }

  function refreshLastBadge(){ if (!lastBadge) return; const b=localStorage.getItem(STORAGE_LAST); if(!b){ lastBadge.textContent='Dernière : —'; return; } try{ const j=JSON.parse(b)||{}; const label = j.book ? `${j.book} ${j.chapter || ''}${j.verse?':'+j.verse:''}`.trim() : '—'; lastBadge.textContent='Dernière : '+label; }catch{ lastBadge.textContent='Dernière : —'; } }
  function saveLast(){ try{ localStorage.setItem(STORAGE_LAST, JSON.stringify({ book:state.book||'', chapter:state.chapter||'', verse:state.verse||'', version:state.version||'LSG', density:state.density })); }catch{} }

  function restoreLast(){
    try{
      const raw=localStorage.getItem(STORAGE_LAST); if(!raw) return;
      const j=JSON.parse(raw);
      if (j && CHAPTERS_66[j.book]){
        state.book=j.book;
        state.chapter=clamp(parseInt(j.chapter,10)||1, 1, CHAPTERS_66[j.book]);
        state.verse=parseInt(j.verse,10)||1;
        state.version=j.version||'LSG';
        if (DENSITY_CHOICES.includes(Number(j.density))) state.density=Number(j.density);
      } else {
        state.book=''; state.chapter=null; state.verse=null;
      }
    }catch{}
  }

  // Densité : no-op si pas d’UI
  function injectDensitySelector(){ /* Optionnel : UI absente → rien à faire */ }

})();

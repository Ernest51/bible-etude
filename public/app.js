/* app.js — Palette GLOBALE + YouVersion + Reset sûr + Limite chapitres
   - Palette : applique data-theme sur <html> ET <body> (+ classe theme-*)
   - Lire la Bible : ouvre YouVersion (bible.com) sur le livre/chapitre/verset (LSG)
   - Reset : vide l’étude, conserve “Dernière : …”, met toutes les diodes en jaune
   - Livres : liste 66 + chapitres strictement limités (Genèse=50, Exode=40, …)
   - Conserve densité 500/1500/2500, bouton Valider, API /api/generate-study
*/

(function () {
  // ---------- Utils ----------
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const esc = (s)=>String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  // ---------- Constantes ----------
  const STORAGE_LAST='lastStudy', STORAGE_DENS='density8', STORAGE_THEME='theme8';
  const TITLE0='Rubrique 0 — Panorama des versets du chapitre';
  const DENSITY_CHOICES=[500,1500,2500];
  const THEMES=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate'];

  // 66 livres + nb chapitres
  const CHAPTERS_66 = {
    "Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,
    "1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,
    "Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,
    "Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,
    "Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,
    "Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,
    "Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,
    "2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,
    "2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22
  };
  const ORDER_66 = Object.keys(CHAPTERS_66);

  // YouVersion: codes de livres (anglais, format bible.com) + ID de version LSG=93
  // Exemples vérifiables: https://www.bible.com/fr/bible/93/JER.1.LSG , https://www.bible.com/fr/bible/93/LUK.1.LSG
  const YV_BOOK = {
    "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
    "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR",
    "Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG",
    "Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA",
    "Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL",
    "Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI",
    "Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
  };
  const YV_VERSION_ID = { 'LSG': '93' /* autres versions => fallback 93 */ };

  // Trame 28 (titres + desc par défaut)
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

  // ---------- Récup éléments ----------
  const pointsList   = $('#pointsList');
  const edTitle      = $('#edTitle');
  const noteView     = $('#noteView');
  const metaInfo     = $('#metaInfo');
  const lastBadge    = $('#lastBadge');

  const searchRef    = $('#searchRef');
  const applyBtn     = $('#applySearchBtn');
  const bookSelect   = $('#bookSelect');
  const chapterSelect= $('#chapterSelect');
  const verseSelect  = $('#verseSelect');
  const versionSelect= $('#versionSelect');

  const readBtn      = $('#readBtn');
  const generateBtn  = $('#generateBtn');
  const resetBtn     = $('#resetBtn');
  const prevBtn      = $('#prev');
  const nextBtn      = $('#next');

  const themeBar     = $('#themeBar');
  const themeThumb   = $('#themeThumb');

  // ---------- Boot ----------
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    ensureListScroll();
    injectDescStyle();
    injectDensitySelector();

    restoreTheme();               // Palette appliquée globalement
    restoreLast(); refreshLastBadge();

    wireEvents();
    fillBooks(); fillChapters(); fillVerses();
    versionSelect && (versionSelect.value = state.version);

    renderPointsList(); updateHeader(); renderSection(0);
  }

  // ---------- Événements ----------
  function wireEvents(){
    applyBtn && applyBtn.addEventListener('click', applySearch);
    searchRef && searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter') applySearch(); });

    bookSelect && bookSelect.addEventListener('change', ()=>{
      state.book=bookSelect.value; state.chapter=1; // ← reset chapitre au 1
      fillChapters(); fillVerses(); saveLast(); refreshLastBadge();
    });
    chapterSelect && chapterSelect.addEventListener('change', ()=>{
      // ← limite stricte au nb de chapitres du livre
      const max = CHAPTERS_66[state.book] || 1;
      state.chapter = clamp(parseInt(chapterSelect.value,10)||1, 1, max);
      chapterSelect.value = String(state.chapter);
      fillVerses(); saveLast(); refreshLastBadge();
    });
    verseSelect && verseSelect.addEventListener('change', ()=>{
      state.verse=parseInt(verseSelect.value,10)||1; saveLast(); refreshLastBadge();
    });
    versionSelect && versionSelect.addEventListener('change', ()=>{ state.version=versionSelect.value; });

    // Lire la Bible → YouVersion (bible.com)
    readBtn && readBtn.addEventListener('click', openYouVersion);

    generateBtn && generateBtn.addEventListener('click', onGenerate);

    // Reset qui garde “Dernière” et remet diodes en jaune
    resetBtn && resetBtn.addEventListener('click', onResetKeepLast);

    prevBtn && prevBtn.addEventListener('click', ()=>goTo(state.currentIdx-1));
    nextBtn && nextBtn.addEventListener('click', ()=>goTo(state.currentIdx+1));

    // Palette thème
    if (themeBar) themeBar.addEventListener('pointerdown', onThemePointer);
  }

  // ---------- Livres/chapitres/versets ----------
  function fillBooks(){
    if (!bookSelect) return;
    bookSelect.innerHTML = ORDER_66.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('');
    bookSelect.value = state.book;
  }
  function fillChapters(){
    if (!chapterSelect) return;
    const max = CHAPTERS_66[state.book]||1;
    const cur = clamp(state.chapter,1,max);
    chapterSelect.innerHTML = Array.from({length:max},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
    state.chapter = cur;
    chapterSelect.value = String(cur);
  }
  function fillVerses(){
    if (!verseSelect) return;
    verseSelect.innerHTML = Array.from({length:150},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join('');
    verseSelect.value = String(state.verse||1);
  }

  // ---------- Densité ----------
  function injectDensitySelector(){
    const controls=document.querySelector('.controls'); if(!controls) return;
    if ($('#densitySelect')) return;
    const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    const label=document.createElement('label'); label.textContent='Densité'; label.style.fontSize='13px'; label.style.color='#64748b';
    const sel=document.createElement('select'); sel.id='densitySelect'; sel.title='Densité par rubrique';
    sel.style.border='1px solid var(--border)'; sel.style.borderRadius='10px'; sel.style.padding='10px 12px'; sel.style.minHeight='42px';
    sel.innerHTML = DENSITY_CHOICES.map(v=>`<option value="${v}">${v}</option>`).join('');
    const saved=localStorage.getItem(STORAGE_DENS);
    sel.value = DENSITY_CHOICES.includes(Number(saved)) ? String(saved) : String(state.density);
    state.density = parseInt(sel.value,10);
    sel.addEventListener('change', ()=>{ state.density=Number(sel.value); localStorage.setItem(STORAGE_DENS, sel.value); });
    const anchor = readBtn || controls.lastChild;
    controls.insertBefore(wrap, anchor); wrap.appendChild(label); wrap.appendChild(sel);
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
        bookSelect&&(bookSelect.value=state.book);
        fillChapters(); chapterSelect&&(chapterSelect.value=String(state.chapter));
        fillVerses(); if(vers) verseSelect&&(verseSelect.value=String(state.verse));
        saveLast(); refreshLastBadge(); return;
      }
    }
    const bn=normalizeBook(raw); const fb=findBook(bn);
    if (fb){ state.book=fb; state.chapter=1; state.verse=1; bookSelect&&(bookSelect.value=fb); fillChapters(); fillVerses(); saveLast(); refreshLastBadge(); }
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

  // ---------- Rendu section ----------
  function renderSection(n){
    if (!noteView) return;
    const md = state.sectionsByN.get(n) || defaultContent(n);
    noteView.innerHTML = mdToHtml(md);
  }
  function defaultContent(n){
    if (n===0) return `### ${TITLE0}

*Référence :* ${state.book} ${state.chapter}

Clique sur **Générer** pour charger chaque verset avec explications.`;
    return `### ${getTitle(n)}

*Référence :* ${state.book} ${state.chapter}

À générer…`;
  }

  // ---------- API Génération ----------
  async function onGenerate(){
    if (!generateBtn) return;
    const old=generateBtn.textContent; generateBtn.disabled=true; generateBtn.textContent='Génération…';
    try{
      const passage = `${state.book} ${state.chapter}`;
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
    state.sectionsByN.set(0, `### ${TITLE0}
*Référence :* ${state.book} ${state.chapter}

Cliquer sur **Lire la Bible** (YouVersion) puis **Générer** quand l’API sera dispo.`);
    for(let i=1;i<=28;i++){
      state.sectionsByN.set(i, `### ${getTitle(i)}
*Référence :* ${state.book} ${state.chapter}

Contenu provisoire (gabarit).`);
      state.leds.set(i,'warn');
    }
  }

  // ---------- RESET (garde “Dernière”, diodes → jaune) ----------
  function onResetKeepLast(){
    if (!confirm('Tout vider (conserver “Dernière”) et repasser les voyants en jaune ?')) return;
    // Ne PAS toucher au localStorage "lastStudy" → badge conservé
    state.sectionsByN.clear();
    for (let i=0;i<=28;i++) state.leds.set(i,'warn'); // jaune
    renderPointsList(); renderSection(state.currentIdx);
  }

  // ---------- YouVersion ----------
  function openYouVersion(){
    const url = youVersionURL(state.book, state.chapter, state.verse, state.version);
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  function youVersionURL(book, chapter, verse, version){
    const code = YV_BOOK[book] || 'GEN';
    const verId = YV_VERSION_ID[version] || '93'; // LSG par défaut
    const vtag  = (version || 'LSG').toUpperCase(); // .LSG
    const path = verse && Number(verse)>0
      ? `${code}.${chapter}.${vtag}`
      : `${code}.${chapter}.${vtag}`;
    // Format bible.com /fr/bible/{idVersion}/{BOOK}.{chap}.{version}
    const u = new URL(`https://www.bible.com/fr/bible/${verId}/${path}`);
    return u.toString();
  }

  // ---------- Palette : applique à tout le site ----------
  function setTheme(theme){
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    // On pose aussi une classe pour les CSS qui ciblent .theme-*
    THEMES.forEach(t=>document.body.classList.remove('theme-'+t));
    document.body.classList.add('theme-'+theme);
    localStorage.setItem(STORAGE_THEME, theme);
    // Event pour styles réactifs éventuels
    window.dispatchEvent(new CustomEvent('themechange',{ detail:{ theme } }));
  }
  function getTheme(){ return localStorage.getItem(STORAGE_THEME) || 'cyan'; }
  function restoreTheme(){
    const t=getTheme();
    setTheme(t);
    placeThumbForTheme(t);
  }
  function onThemePointer(ev){
    if (!themeBar) return;
    themeBar.setPointerCapture?.(ev.pointerId);
    const rect=themeBar.getBoundingClientRect();
    const move=(e)=>{
      const clientX=(e.touches?e.touches[0].clientX:e.clientX);
      const x=Math.max(0,Math.min(rect.width, clientX-rect.left));
      const pct=x/rect.width;
      themeThumb && (themeThumb.style.left=(pct*100)+'%');
      const idx=Math.min(THEMES.length-1, Math.max(0, Math.floor(pct*THEMES.length)));
      setTheme(THEMES[idx]); // ← change tout le site en direct
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

  // ---------- Divers ----------
  function ensureListScroll(){
    if (!pointsList) return;
    pointsList.style.overflowY='auto';
    if (!pointsList.style.maxHeight) pointsList.style.maxHeight='calc(100vh - 220px)';
  }
  function injectDescStyle(){
    const st=document.createElement('style');
    st.textContent=`#pointsList .txt .desc{display:block;margin-top:4px;font-size:12.5px;line-height:1.3;color:#64748b;white-space:normal}`;
    document.head.appendChild(st);
  }
  function mdToHtml(md){
    let h=String(md||'');
    h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
    h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
    h=h.replace(/^\s*-\s+(.*)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)(?!\s*<li>)/gs,'<ul>$1</ul>');
    h=h.split(/\n{2,}/).map(b=>/^<h\d|^<ul|^<li|^<p|^<blockquote/.test(b.trim())?b:`<p>${b.replace(/\n/g,'<br/>')}</p>`).join('\n');
    return h;
  }
  function refreshLastBadge(){ if (!lastBadge) return; lastBadge.textContent=`Dernière : ${state.book} ${state.chapter}${state.verse?':'+state.verse:''}`; }
  function saveLast(){ localStorage.setItem(STORAGE_LAST, JSON.stringify({ book:state.book, chapter:state.chapter, verse:state.verse, version:state.version, density:state.density })); }
  function restoreLast(){
    try{
      const raw=localStorage.getItem(STORAGE_LAST); if(!raw) return;
      const j=JSON.parse(raw);
      if(j && CHAPTERS_66[j.book]){
        state.book=j.book;
        state.chapter=clamp(parseInt(j.chapter,10)||1, 1, CHAPTERS_66[j.book]);
        state.verse=parseInt(j.verse,10)||1;
        state.version=j.version||'LSG';
        if (DENSITY_CHOICES.includes(Number(j.density))) state.density=Number(j.density);
      }
    }catch{}
  }
})();

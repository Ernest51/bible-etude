/* app.js — 28 titres + descriptions visibles (API title|titre + description|desc) + fallback + mock + densité + fix scroll */

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  // --------- Style pour forcer l’affichage des descriptions ----------
  (function injectDescStyle(){
    const css = `
    #pointsList .item .txt .desc{
      display:block!important;
      margin-top:2px;
      font-size:12px;
      line-height:1.25;
      color:var(--muted, #64748b);
      opacity:.95;
      white-space:normal;
    }`;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
  })();

  // --- MOCK PUBLIC ---
  const urlParams = new URLSearchParams(location.search);
  const MOCK_PUBLIC = urlParams.get('mock') === '1' || localStorage.getItem('mockPublic') === '1';
  const norm = s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'").replace(/\s+/g,' ').trim().toLowerCase();

  // DOM
  const pointsList = $('#pointsList');
  const edTitle = $('#edTitle');
  const noteView = $('#noteView');
  const linksPanel = $('#linksPanel');
  const linksList = $('#linksList');
  const metaInfo = $('#metaInfo');
  const lastBadge = $('#lastBadge');
  const readBtn = $('#readBtn');
  const generateBtn = $('#generateBtn');
  const resetBtn = $('#resetBtn');
  const pdfBtn = $('#pdfBtn');
  const prevBtn = $('#prev');
  const nextBtn = $('#next');
  const searchRef = $('#searchRef');
  const applySearchBtn = $('#applySearchBtn');
  const bookSelect = $('#bookSelect');
  const chapterSelect = $('#chapterSelect');
  const verseSelect = $('#verseSelect');
  const versionSelect = $('#versionSelect');
  const themeBar = $('#themeBar');
  const themeThumb = $('#themeThumb');

  // Constantes & fallback
  const STORAGE_LAST='lastStudy', STORAGE_DENS='density8', STORAGE_THEME='theme8';
  const TITLE0='Rubrique 0 — Panorama des versets du chapitre';

  const TITLES_DEFAULT={1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",17:"Appui doctrinal",18:"Comparaison entre versets",19:"Comparaison avec Actes 2",20:"Verset à mémoriser",21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",27:"Versets à retenir",28:"Prière de fin"};
  const DESCS_DEFAULT={1:"Invocation du Saint-Esprit pour éclairer l’étude.",2:"Identification du livre et appartenance au canon (AT/NT).",3:"Questions à reprendre de l’étude précédente (min. 5).",4:"Résumé doctrinal synthétique du chapitre.",5:"Période, géopolitique, culture, carte localisée.",6:"Séquençage narratif et composition interne.",7:"Type de texte : narratif, poétique, prophétique, etc.",8:"Présentation de l’auteur et lien aux patriarches (généalogie).",9:"Verset central du chapitre (avec lien).",10:"Commentaire mot-à-mot, original hébreu/grec si utile.",11:"Analyse des mots-clés et portée doctrinale.",12:"Passages parallèles et complémentaires.",13:"Doctrines majeures qui émergent du chapitre.",14:"Correspondance avec les 22 grands thèmes doctrinaux.",15:"Vertus et attitudes visées par le texte.",16:"Figures typologiques et symboles bibliques.",17:"Autres passages qui confirment l’enseignement.",18:"Comparaison de versets pour mise en relief.",19:"Parallèle avec Actes 2 / œuvre du Saint-Esprit.",20:"Verset essentiel à mémoriser.",21:"Implications pour la vie de l’Église.",22:"Applications pour la famille chrétienne.",23:"Pédagogie enfants : jeux, récits, symboles.",24:"Guides pour l’évangélisation et la mission.",25:"Conseils pour pasteurs et enseignants.",26:"Examen de conscience et engagement personnel.",27:"Sélection pour prédication/pastorale.",28:"Prière de clôture."};

  const CHAPTERS_66={"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};
  const ORDER_66=Object.keys(CHAPTERS_66);
  const BG_VERSION={'LSG':'LSG','PDV':'PDV-FR','S21':'SG21','BFC':'BFC'};

  // État
  const state={
    book:'Genèse',chapter:1,verse:1,version:'LSG',
    currentIdx:0,
    sectionsByN:new Map(),
    leds:new Map(),
    density:1500,
    titles:{...TITLES_DEFAULT},
    descs:{...DESCS_DEFAULT}
  };

  init();

  function init(){
    restoreTheme(); fillBooks(); fillChapters(); fillVerses();
    if (pointsList){ pointsList.style.overflowY='auto'; if(!pointsList.style.maxHeight) pointsList.style.maxHeight='calc(100vh - 220px)'; }
    $('#readBtn')?.addEventListener('click', openBG);
    $('#generateBtn')?.addEventListener('click', onGenerate);
    $('#resetBtn')?.addEventListener('click', onReset);
    $('#pdfBtn')?.addEventListener('click', ()=>window.print());
    $('#prev')?.addEventListener('click', ()=>goTo(state.currentIdx-1));
    $('#next')?.addEventListener('click', ()=>goTo(state.currentIdx+1));
    $('#applySearchBtn')?.addEventListener('click', applySearch);
    $('#searchRef')?.addEventListener('keydown', e=>{ if(e.key==='Enter') applySearch(); });
    bookSelect?.addEventListener('change', ()=>{ state.book=bookSelect.value; state.chapter=1; fillChapters(); fillVerses(); saveLast(); refreshBadge(); });
    chapterSelect?.addEventListener('change', ()=>{ state.chapter=parseInt(chapterSelect.value,10)||1; fillVerses(); saveLast(); refreshBadge(); });
    verseSelect?.addEventListener('change', ()=>{ state.verse=parseInt(verseSelect.value,10)||1; saveLast(); refreshBadge(); });
    versionSelect?.addEventListener('change', ()=>{ state.version=versionSelect.value; });
    if (themeBar){ themeBar.addEventListener('pointerdown', onThemePointer); placeThumbForTheme(document.body.getAttribute('data-theme')||'cyan'); }
    injectDensitySelector(); restoreLast(); refreshBadge();
    for(let i=0;i<=28;i++) state.leds.set(i,'warn');
    renderPointsList(); updateHeader(); renderSection(0);
  }

  function injectDensitySelector(){
    const controls=document.querySelector('.controls'); if(!controls) return;
    const wrap=document.createElement('div'); wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    const label=document.createElement('label'); label.textContent='Densité'; label.style.fontSize='13px'; label.style.color='#64748b';
    const sel=document.createElement('select'); sel.id='densitySelect'; sel.style.border='1px solid var(--border)'; sel.style.borderRadius='10px'; sel.style.padding='10px 12px'; sel.style.minHeight='42px';
    sel.innerHTML=`<option value="500">500</option><option value="1500" selected>1500</option><option value="2500">2500</option>`;
    const saved=localStorage.getItem(STORAGE_DENS); sel.value=(saved&&['500','1500','2500'].includes(saved))?saved:'1500';
    state.density=parseInt(sel.value,10);
    sel.addEventListener('change',()=>{ state.density=parseInt(sel.value,10); localStorage.setItem(STORAGE_DENS,String(state.density)); });
    const anchor=readBtn||controls.lastChild; controls.insertBefore(wrap,anchor); wrap.appendChild(label); wrap.appendChild(sel);
  }

  // --------- API meta (titres & descriptions) ----------
  const getTitle = n => state.titles[n] || TITLES_DEFAULT[n] || `Point ${n}`;
  const getDesc  = n => state.descs[n]  || '';
  function mergeMetaFromAPI(sections){
    if(!Array.isArray(sections)) return;
    const t={}, d={};
    for(const s of sections){
      const id=Number(s.id ?? s.n);
      const title = String((s.title ?? s.titre ?? '')).trim();
      const desc  = String((s.description ?? s.desc ?? '')).trim();
      if(id>=1 && id<=28){
        if(title) t[id]=title;
        if(desc)  d[id]=desc;
      }
    }
    if(Object.keys(t).length) state.titles={...state.titles, ...t};
    if(Object.keys(d).length) state.descs ={...state.descs , ...d};
  }

  // --------- Liste à gauche ----------
  function renderPointsList(){
    pointsList.innerHTML='';
    pointsList.appendChild(renderItem({ idx:0, title:TITLE0, desc:'Aperçu du chapitre verset par verset' }));
    for(let i=1;i<=28;i++){
      pointsList.appendChild(renderItem({ idx:i, title:getTitle(i), desc:getDesc(i) }));
    }
    highlightActive();
  }
  function renderItem({idx,title,desc}){
    const li=document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
    const idxEl=document.createElement('div'); idxEl.className='idx'; idxEl.textContent=String(idx);
    const txt=document.createElement('div'); txt.className='txt';
    txt.innerHTML = `<div>${escapeHtml(title)}</div>${desc?`<span class="desc">${escapeHtml(desc)}</span>`:''}`;
    const dot=document.createElement('div'); dot.className='dot '+(state.leds.get(idx)==='ok'?'ok':'');
    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click',()=>goTo(idx));
    return li;
  }
  function highlightActive(){ $$('#pointsList .item').forEach(d=>d.classList.toggle('active', Number(d.dataset.idx)===state.currentIdx)); }
  function goTo(idx){ if(idx<0) idx=0; if(idx>28) idx=28; state.currentIdx=idx; updateHeader(); renderSection(idx); highlightActive(); }
  function updateHeader(){ const t=state.currentIdx===0?TITLE0:getTitle(state.currentIdx); edTitle.textContent=t; metaInfo.textContent=`Point ${state.currentIdx} / 28`; }

  // --------- Génération ----------
  async function onGenerate(){
    const old=generateBtn.textContent; generateBtn.disabled=true; generateBtn.textContent='Génération…';
    try{
      const passage = `${state.book} ${state.chapter}`;
      if(MOCK_PUBLIC){
        const key=`${norm(state.book).replace(/\s+/g,'-')}-${state.chapter}`;
        let url=`/tests/generate-study.${key}.json`;
        let r=await fetch(url,{cache:'no-store'}); if(!r.ok){ url='/tests/generate-study.jeremie-1.json'; r=await fetch(url,{cache:'no-store'}); }
        const j=await r.json();
        const sections=j.study?.sections || j.sections || [];
        mergeMetaFromAPI(sections);
        state.sectionsByN.clear();
        for(const s of sections){ const n=Number(s.id ?? s.n); if(!Number.isFinite(n)) continue; const c=String(s.content||'').trim(); if(c) state.sectionsByN.set(n,c); }
      }else{
        const r=await fetch('/api/generate-study',{method:'POST',headers:{'Content-Type':'application/json'},cache:'no-store',body:JSON.stringify({passage,options:{length:state.density}})});
        if(!r.ok) throw new Error('HTTP '+r.status);
        const j=await r.json();
        const sections=j.study?.sections || j.sections || [];
        mergeMetaFromAPI(sections);
        state.sectionsByN.clear();
        for(const s of sections){ const n=Number(s.id ?? s.n); if(!Number.isFinite(n)) continue; const c=String(s.content||'').trim(); if(c) state.sectionsByN.set(n,c); }
      }
      for(let i=1;i<=28;i++){ if(state.titles[i]) state.leds.set(i,'ok'); }
      renderPointsList(); renderSection(state.currentIdx); saveLast(); refreshBadge();
    }catch(e){
      console.warn(e);
      alert('La génération a échoué. Un gabarit a été inséré.');
      insertSkeleton(); renderPointsList(); renderSection(state.currentIdx);
    }finally{
      generateBtn.disabled=false; generateBtn.textContent=old;
    }
  }

  function insertSkeleton(){
    state.sectionsByN.set(0, `### Rubrique 0 — Panorama des versets du chapitre

*Référence :* ${state.book} ${state.chapter}

Clique sur **Générer** pour charger chaque verset avec explications.`);
    for(let i=1;i<=28;i++){
      const t=getTitle(i);
      state.sectionsByN.set(i, `### ${t}

*Référence :* ${state.book} ${state.chapter}

Contenu provisoire (gabarit).`);
      state.leds.set(i,'warn');
    }
  }

  // --------- Divers utilitaires UI ----------
  function onReset(){ if(!confirm('Tout vider ?')) return; state.sectionsByN.clear(); for(let i=0;i<=28;i++) state.leds.set(i,'warn'); renderPointsList(); renderSection(state.currentIdx); }
  function renderSection(n){ const md=state.sectionsByN.get(n)||`### ${n===0?TITLE0:getTitle(n)}\n\n*Référence :* ${state.book} ${state.chapter}\n\nÀ générer…`; noteView.innerHTML=md.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/\n{2,}/g,'</p><p>').replace(/^/,'<p>').concat('</p>'); linksPanel?.classList.add('empty'); linksList&&(linksList.innerHTML=''); }
  function openBG(){ const v=BG_VERSION[state.version]||'LSG'; const u=new URL('https://www.biblegateway.com/passage/'); u.searchParams.set('search',`${state.book} ${state.chapter}`); u.searchParams.set('version',v); window.open(u,'_blank','noopener'); }

  // Sélecteurs livres/chapitres/versets
  function fillBooks(){ bookSelect.innerHTML=ORDER_66.map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join(''); bookSelect.value=state.book; }
  function fillChapters(){ const m=CHAPTERS_66[state.book]||1; chapterSelect.innerHTML=Array.from({length:m},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join(''); if(state.chapter>m) state.chapter=m; chapterSelect.value=String(state.chapter); }
  function fillVerses(){ verseSelect.innerHTML=Array.from({length:150},(_,i)=>`<option value="${i+1}">${i+1}</option>`).join(''); verseSelect.value=String(state.verse); }

  // Thème
  function onThemePointer(ev){ const rect=themeBar.getBoundingClientRect(); const move=(e)=>{ const x=Math.max(0,Math.min(rect.width,(e.touches?e.touches[0].clientX:e.clientX)-rect.left)); const pct=x/rect.width; themeThumb.style.left=(pct*100)+'%'; const arr=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate']; document.body.setAttribute('data-theme', arr[Math.min(arr.length-1,Math.max(0,Math.floor(pct*arr.length)))]); }; const up=()=>{ saveTheme(); window.removeEventListener('pointermove',move); window.removeEventListener('pointerup',up); window.removeEventListener('touchmove',move); window.removeEventListener('touchend',up); }; window.addEventListener('pointermove',move); window.addEventListener('pointerup',up); window.addEventListener('touchmove',move,{passive:false}); window.addEventListener('touchend',up); move(ev); }
  function placeThumbForTheme(theme){ const arr=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate']; const idx=Math.max(0,arr.indexOf(theme)); const pct=(idx+.5)/arr.length; themeThumb.style.left=(pct*100)+'%'; }
  function saveTheme(){ localStorage.setItem(STORAGE_THEME, document.body.getAttribute('data-theme')||'cyan'); }
  function restoreTheme(){ const t=localStorage.getItem(STORAGE_THEME); if(t) document.body.setAttribute('data-theme', t); }

  // Persistance
  function refreshBadge(){ if(!lastBadge) return; lastBadge.textContent=`Dernière : ${state.book} ${state.chapter}${state.verse?':'+state.verse:''}`; }
  function saveLast(){ localStorage.setItem(STORAGE_LAST, JSON.stringify({book:state.book,chapter:state.chapter,verse:state.verse,version:state.version,density:state.density})); }
  function restoreLast(){ try{ const raw=localStorage.getItem(STORAGE_LAST); if(!raw) return; const j=JSON.parse(raw); if(j&&CHAPTERS_66[j.book]){ state.book=j.book; state.chapter=Math.max(1,Math.min(CHAPTERS_66[j.book], parseInt(j.chapter,10)||1)); state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG'; if(typeof j.density==='number') state.density=j.density; bookSelect.value=state.book; fillChapters(); chapterSelect.value=String(state.chapter); fillVerses(); versionSelect.value=state.version; } }catch{}

  // Utils
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
})();

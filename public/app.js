/* app.js — conforme runbook (DOM ready, diodes, Reset, appel API minimal) */
(function () {
  const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const pick = (...selectors) => { for (const sel of selectors) { const el = document.querySelector(sel); if (el) return el; } return null; };

  const STORAGE_LAST='lastStudy', STORAGE_PREV='prevStudy', STORAGE_DENS='density8', STORAGE_THEME='theme8';
  const DENSITY_CHOICES=[500,1500,2500];

  const CHAPTERS_66={"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};

  const state={ book:'Genèse', chapter:1, density:1500, currentIdx:0, sectionsByN:new Map(), leds:new Map() };
  for(let i=0;i<=28;i++) state.leds.set(i,'warn');

  let pointsList, edTitle, metaInfo, bookSelect, chapterSelect, densitySelect, generateBtn, resetBtn, noteArea;

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    pointsList   = pick('#pointsList');
    edTitle      = pick('#edTitle');
    metaInfo     = pick('#metaInfo');
    bookSelect   = pick('#bookSelect','#book','#livre');
    chapterSelect= pick('#chapterSelect','#chapter','#chapitre');
    densitySelect= pick('#densitySelect','#density','#length');
    generateBtn  = pick('#generateBtn','#btn-generate');
    resetBtn     = pick('#resetBtn','#btn-reset');
    noteArea     = pick('#noteArea','textarea');

    setupDensity();
    fillBooks(); fillChapters();

    bookSelect.addEventListener('change', ()=>{
      state.book=bookSelect.value||'Genèse'; state.chapter=1; fillChapters(); rerender();
    });
    chapterSelect.addEventListener('change', ()=>{
      const max=CHAPTERS_66[state.book]||1;
      const n=parseInt(chapterSelect.value,10); state.chapter=Number.isFinite(n)?clamp(n,1,max):1; rerender();
    });
    densitySelect.addEventListener('change', ()=>{ const v=parseInt(densitySelect.value,10); if([500,1500,2500].includes(v)) state.density=v; });

    generateBtn.addEventListener('click', onGenerate);
    resetBtn.addEventListener('click', onReset);

    renderPointsList(); updateHeader(); renderSection(0);
  }

  function setupDensity(){
    if (!densitySelect.options.length){
      [500,1500,2500].forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=String(v); densitySelect.appendChild(o); });
    }
    densitySelect.value=String(state.density);
  }

  function fillBooks(){
    if(!bookSelect) return;
    bookSelect.innerHTML=''; const o0=document.createElement('option'); o0.value='Genèse'; o0.textContent='Genèse'; bookSelect.appendChild(o0);
    bookSelect.value=state.book;
  }
  function fillChapters(){
    if(!chapterSelect) return;
    const max=CHAPTERS_66[state.book]||50;
    chapterSelect.innerHTML='';
    for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o); }
    chapterSelect.value=String(state.chapter);
  }

  function renderPointsList(){
    if (!pointsList) return;
    pointsList.innerHTML='';
    for(let i=1;i<=28;i++) pointsList.appendChild(renderItem(i));
    highlightActive();
  }
  function renderItem(idx){
    const li=document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
    const idxEl=document.createElement('div'); idxEl.className='idx'; idxEl.textContent=String(idx);
    const txt=document.createElement('div'); txt.className='txt'; txt.innerHTML=`<div>Rubrique ${idx}</div>`;
    const dot=document.createElement('div'); dot.className='dot '+(state.leds.get(idx)==='ok'?'ok':'');
    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click', ()=>goTo(idx));
    return li;
  }
  function highlightActive(){
    document.querySelectorAll('#pointsList .item').forEach(el=>el.classList.toggle('active', Number(el.dataset.idx)===state.currentIdx));
  }
  function goTo(idx){ state.currentIdx=Math.max(0,Math.min(28,idx)); updateHeader(); renderSection(state.currentIdx); highlightActive(); }
  function updateHeader(){ if(!edTitle||!metaInfo) return; edTitle.textContent=state.currentIdx?`Rubrique ${state.currentIdx}`:'—'; metaInfo.textContent=`Point ${state.currentIdx} / 28`; }

  function renderSection(n){
    if (!noteArea) return;
    const ref=`${state.book} ${state.chapter}`;
    const txt=state.sectionsByN.get(n) || `### Rubrique ${n}\n\n*Référence :* ${ref}\n\nÀ générer…`;
    noteArea.value = txt;
  }

  async function onGenerate(){
    const passage=`${state.book} ${state.chapter}`;
    const btn=generateBtn, old=btn.textContent; btn.disabled=true; btn.textContent='Génération…';
    try{
      const r=await fetch('/api/generate-study',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ passage, options:{ length: state.density } })
      });
      const j=await r.json();
      const sections=(j.study && Array.isArray(j.study.sections))? j.study.sections : (Array.isArray(j.sections)? j.sections : []);
      if (sections.length!==28) throw new Error('sections.length != 28');
      for (const s of sections){
        const id=Number(s.id); if (!Number.isFinite(id)) continue;
        const content=String(s.content||'').trim();
        state.sectionsByN.set(id, content);
        state.leds.set(id, content ? 'ok' : 'warn');
      }
      renderPointsList(); renderSection(state.currentIdx||1);
      try{ localStorage.setItem('Dernière étude', JSON.stringify({ passage, density: state.density, ts:new Date().toISOString() })); }catch{}
    }catch(e){
      alert('Erreur de génération : '+e.message);
    }finally{
      btn.disabled=false; btn.textContent=old;
    }
  }

  function onReset(){
    // Rubriques → orange, champs vidés, "Dernière étude" conservée (runbook)
    state.sectionsByN.clear();
    for(let i=1;i<=28;i++) state.leds.set(i,'warn');
    renderPointsList(); renderSection(0); updateHeader();
    // champs
    if (bookSelect) bookSelect.value='Genèse';
    if (chapterSelect) chapterSelect.value='1';
    if (densitySelect) densitySelect.value='1500';
    state.book='Genèse'; state.chapter=1; state.density=1500;
  }
})();

/* app.js — Interface complète, stable, typographiée
   - 28 rubriques (liste à gauche)
   - Rendu “reader” à droite (police Spectral, liens vers YouVersion)
   - Génération via POST /api/generate-study (length 500/1500/2500)
   - Aucune zone de texte brute visible (juste le rendu formaté)
*/

(function () {
  // ---------- Utils
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const debug=(m)=>{ const p=$('#debugPanel'); if(!p) return; p.style.display='block'; p.textContent+=`\n${m}`; };

  // ---------- Constantes & données
  const STORAGE_LAST='lastStudy9', STORAGE_DENS='density9', STORAGE_THEME='theme9';
  const TITLE0='Rubrique 0 — Panorama des versets du chapitre';
  const DENSITY_CHOICES=[500,1500,2500];

  const CHAPTERS_66={"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};
  const ORDER_66=Object.keys(CHAPTERS_66);

  const RUBRICS = {
    1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",17:"Appui doctrinal",18:"Comparaison entre versets",19:"Parallèle avec Actes 2",20:"Verset à mémoriser",21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",27:"Versets à retenir",28:"Prière de fin"
  };

  // YouVersion mapping (LSG=93, Darby=6)
  const YV_BOOK={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const YV_VERSION_ID = { LSG:'93', DARBY:'6' };

  // ---------- État
  const state={
    book:'Genèse', chapter:1, verse:1, version:'LSG',
    density:1500, currentIdx:0,
    sectionsByN:new Map(), leds:new Map()
  };
  for(let i=0;i<=28;i++) state.leds.set(i,'warn');

  // ---------- Éléments
  const pointsList=$('#pointsList'), edTitle=$('#edTitle'), metaInfo=$('#metaInfo');
  const readerTitle=$('#readerTitle'), readerRef=$('#readerRef'), readerMD=$('#readerMD');
  const searchRef=$('#searchRef'), applyBtn=$('#validate')||$('#applySearchBtn');
  const bookSelect=$('#bookSelect'), chapterSelect=$('#chapterSelect'), verseSelect=$('#verseSelect'), versionSelect=$('#versionSelect');
  const densitySelect=$('#densitySelect');
  const readBtn=$('#readBtn'), generateBtn=$('#generateBtn');
  const prevBtn=$('#prev'), nextBtn=$('#next');
  const chatgptBtn=$('#chatgptBtn'), lastBtn=$('#lastBtn'), resetBtn=$('#resetBtn');

  document.addEventListener('DOMContentLoaded', ()=>{
    try{ init(); }catch(e){ debug('INIT ERROR: '+(e?.stack||e)); }
  });

  // ---------- Init
  function init(){
    fillBooks(); fillChapters(); fillVerses();
    restoreLast();
    if (bookSelect) bookSelect.value=state.book;
    if (chapterSelect) chapterSelect.value=String(state.chapter);
    if (verseSelect) verseSelect.value=String(state.verse);
    if (versionSelect) versionSelect.value=state.version||'LSG';
    if (densitySelect) densitySelect.value=String(state.density||1500);

    wireEvents();
    renderPointsList(); updateHeader(); renderSection(0);
    const y=$('#y'); if(y) y.textContent=new Date().getFullYear();
  }

  // ---------- Events
  function wireEvents(){
    applyBtn && applyBtn.addEventListener('click', applySearch);
    searchRef && searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter') applySearch(); });

    bookSelect && bookSelect.addEventListener('change', ()=>{
      state.book=bookSelect.value||''; state.chapter=1; state.verse=1; fillChapters(); fillVerses(); saveLast(); rerender();
    });
    chapterSelect && chapterSelect.addEventListener('change', ()=>{
      const max=CHAPTERS_66[state.book]||1; const n=parseInt(chapterSelect.value,10);
      if (Number.isFinite(n)) state.chapter=clamp(n,1,max); chapterSelect.value=String(state.chapter);
      fillVerses(); saveLast(); rerender();
    });
    verseSelect && verseSelect.addEventListener('change', ()=>{
      const v=parseInt(verseSelect.value,10); state.verse=Number.isFinite(v)?v:1; saveLast();
    });
    versionSelect && versionSelect.addEventListener('change', ()=>{ state.version=versionSelect.value||'LSG'; saveLast(); });

    readBtn && readBtn.addEventListener('click', ()=>{
      if(!state.book) return;
      window.open(youVersionURL(state.book,state.chapter||1,state.verse||1,state.version),'_blank','noopener,noreferrer');
    });
    generateBtn && generateBtn.addEventListener('click', onGenerate);

    prevBtn && prevBtn.addEventListener('click', ()=>goTo(state.currentIdx-1));
    nextBtn && nextBtn.addEventListener('click', ()=>goTo(state.currentIdx+1));

    chatgptBtn && chatgptBtn.addEventListener('click', ()=>window.open('https://chatgpt.com/','_blank','noopener,noreferrer'));
    lastBtn && lastBtn.addEventListener('click', loadLastStudy);
    resetBtn && resetBtn.addEventListener('click', onResetTotal);

    // debug
    const dbg=$('#debugBtn'); dbg && dbg.addEventListener('click', ()=>{ const p=$('#debugPanel'); p.style.display = p.style.display==='block'?'none':'block'; });
  }

  // ---------- Sélecteurs
  function fillBooks(){
    if(!bookSelect) return;
    bookSelect.innerHTML='';
    ORDER_66.forEach(b=>{ const o=document.createElement('option'); o.value=b; o.textContent=b; bookSelect.appendChild(o); });
  }
  function fillChapters(){
    if(!chapterSelect) return;
    const max=CHAPTERS_66[state.book]||0;
    chapterSelect.innerHTML='';
    for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o); }
  }
  function fillVerses(){
    if(!verseSelect) return;
    verseSelect.innerHTML='';
    for(let i=1;i<=150;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o); }
  }

  function applySearch(){
    if (!searchRef) return;
    const raw=(searchRef.value||'').trim(); if(!raw) return;
    const m=/^([\p{L}\d\s]+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/u.exec(raw);
    if (m){
      const bookName=normalize(m[1]), chap=parseInt(m[2],10), vers=m[3]||null;
      const found=findBook(bookName);
      if (found){
        state.book=found; const max=CHAPTERS_66[found]||1;
        state.chapter=clamp(chap,1,max); state.verse=vers?parseInt(vers.split('-')[0],10):1;
        fillBooks(); bookSelect.value=state.book; fillChapters(); chapterSelect.value=String(state.chapter); fillVerses(); verseSelect.value=String(state.verse);
        saveLast(); rerender(); return;
      }
    }
    const bn=normalize(raw), fb=findBook(bn);
    if (fb){ state.book=fb; state.chapter=1; state.verse=1; fillBooks(); bookSelect.value=fb; fillChapters(); fillVerses(); saveLast(); rerender(); }
  }
  const normalize=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  function findBook(norm){ for(const b of ORDER_66){ const n=normalize(b); if(n===norm||n.startsWith(norm)||norm.startsWith(n)) return b; } return null; }

  // ---------- Liste 0..28
  function renderPointsList(){
    if (!pointsList) return;
    pointsList.innerHTML='';
    pointsList.appendChild(renderItem(0, TITLE0, 'Aperçu du chapitre verset par verset'));
    for(let i=1;i<=28;i++) pointsList.appendChild(renderItem(i, RUBRICS[i], ''));
    highlightActive();
  }
  function renderItem(idx,title,desc){
    const li=document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
    const idxEl=document.createElement('div'); idxEl.className='idx'; idxEl.textContent=String(idx);
    const txt=document.createElement('div'); txt.className='txt';
    txt.innerHTML=`<div class="t">${esc(title)}</div>${desc?`<span class="desc">${esc(desc)}</span>`:''}`;
    const dot=document.createElement('div'); dot.className='dot '+(state.leds.get(idx)==='ok'?'ok':'');
    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click', ()=>goTo(idx));
    return li;
  }
  function highlightActive(){ $$('#pointsList .item').forEach(el=>el.classList.toggle('active', Number(el.dataset.idx)===state.currentIdx)); }
  function goTo(idx){ if(idx<0) idx=0; if(idx>28) idx=28; state.currentIdx=idx; updateHeader(); renderSection(idx); highlightActive(); }
  function updateHeader(){ if(!edTitle||!metaInfo) return; edTitle.textContent=state.currentIdx===0?TITLE0:(RUBRICS[state.currentIdx]||(`Point ${state.currentIdx}`)); metaInfo.textContent=`Point ${state.currentIdx} / 28`; }
  function rerender(){ renderPointsList(); renderSection(state.currentIdx); updateHeader(); }

  // ---------- Rendu section (Reader)
  function renderSection(n){
    const ref=state.book?`${state.book} ${state.chapter||''}`.trim():'—';
    readerTitle.textContent = n===0 ? TITLE0 : (RUBRICS[n]||`Point ${n}`);
    readerRef.textContent   = `Référence : ${ref}`;

    const raw = state.sectionsByN.get(n) || defaultContent(n, ref);
    readerMD.innerHTML = linkifyVerses(esc(raw)).replace(/\n{2,}/g,'<br/><br/>').replace(/\n/g,'<br/>');
  }
  function defaultContent(n, ref){
    if (n===0) return `Clique sur **Générer** pour charger chaque verset avec explications.`;
    return `À générer…`;
  }

  // ---------- YouVersion linkifier
  function youVersionURL(book,chapter,verse,version){
    const code=YV_BOOK[book]||'GEN'; const verId=YV_VERSION_ID[(version||'LSG').toUpperCase()]||'93';
    const vtag=(version||'LSG').toUpperCase();
    return `https://www.bible.com/fr/bible/${verId}/${code}.${chapter||1}.${vtag}`;
  }
  function linkifyVerses(html){
    // transforme "Genèse 1:2–5" ou "Jérémie 1:2-5" etc.
    return html.replace(/([A-ZÉÂÀÎÔÙÏÜÇa-zéèêàîïùûçŒœ\s1-3]+)\s(\d+):(\d+(?:[–-]\d+)?)/g, (m,book,chap,vv)=>{
      book=book.trim(); const code=YV_BOOK[book]; if(!code) return m;
      const verId=YV_VERSION_ID[(state.version||'LSG').toUpperCase()]||'93';
      const url=`https://www.bible.com/fr/bible/${verId}/${code}.${chap}.${state.version.toUpperCase()}`;
      return `<a href="${url}" target="_blank" rel="noopener">${esc(`${book} ${chap}:${vv}`)}</a>`;
    });
  }

  // ---------- Génération
  async function onGenerate(){
    if (!state.book){ alert('Choisis un livre (et chapitre) avant de générer.'); return; }
    const btn=generateBtn, old=btn.textContent; btn.disabled=true; btn.textContent='Génération…';
    try{
      const passage=`${state.book} ${state.chapter||1}`;
      const r=await fetch('/api/generate-study',{ method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
        body: JSON.stringify({ passage, options:{ length: state.density } })
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      const sections=j.study?.sections||[];
      if (!Array.isArray(sections) || sections.length===0) throw new Error('Réponse invalide');

      // Reset & load
      state.sectionsByN.clear();
      for(const s of sections){
        const id=Number(s.id); if(!Number.isFinite(id)) continue;
        const content=String(s.content||'').trim();
        if(content){ state.sectionsByN.set(id,content); state.leds.set(id,'ok'); }
      }
      renderPointsList(); renderSection(state.currentIdx); saveLast();
    }catch(e){
      debug('GEN ERROR: '+(e?.stack||e));
      alert('La génération a échoué. Un gabarit a été inséré.');
      insertSkeleton(); renderPointsList(); renderSection(state.currentIdx);
    }finally{
      btn.disabled=false; btn.textContent=old;
    }
  }

  function insertSkeleton(){
    const ref=state.book?`${state.book} ${state.chapter||''}`.trim():'—';
    state.sectionsByN.set(0,`*Référence :* ${ref}\n\nClique sur Générer pour charger les rubriques.`);
    for(let i=1;i<=28;i++){
      state.sectionsByN.set(i, `*Référence :* ${ref}\n\nContenu provisoire (gabarit).`);
      state.leds.set(i,'warn');
    }
  }

  // ---------- Reset & mémoire
  function onResetTotal(){
    if(!confirm('Tout vider ? (rubriques → orange, recherche vidée, sélecteurs gardés)')) return;
    state.sectionsByN.clear();
    for(let i=0;i<=28;i++) state.leds.set(i,'warn');
    renderPointsList(); renderSection(0); updateHeader();
  }

  function saveLast(){
    try{
      const next={ book:state.book||'', chapter:state.chapter||'', verse:state.verse||'', version:state.version||'LSG', density:state.density };
      localStorage.setItem(STORAGE_LAST, JSON.stringify(next));
    }catch(e){ debug('SAVE ERROR: '+e); }
  }
  function restoreLast(){
    try{
      const raw=localStorage.getItem(STORAGE_DENS); const d=raw?parseInt(raw,10):1500; if(DENSITY_CHOICES.includes(d)) state.density=d;
      const j=JSON.parse(localStorage.getItem(STORAGE_LAST)||'{}');
      if (j && CHAPTERS_66[j.book]){ state.book=j.book; state.chapter=clamp(parseInt(j.chapter,10)||1,1,CHAPTERS_66[j.book]); state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG'; if (DENSITY_CHOICES.includes(Number(j.density))) state.density=Number(j.density); }
    }catch(e){ debug('RESTORE ERROR: '+e); }
  }
  function loadLastStudy(){
    const j=JSON.parse(localStorage.getItem(STORAGE_LAST)||'{}');
    if (j && CHAPTERS_66[j.book]){
      state.book=j.book; state.chapter=clamp(parseInt(j.chapter,10)||1,1,CHAPTERS_66[j.book]); state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG';
      if (DENSITY_CHOICES.includes(Number(j.density))) state.density=Number(j.density);
      fillBooks(); fillChapters(); fillVerses();
      if (bookSelect) bookSelect.value=state.book;
      if (chapterSelect) chapterSelect.value=String(state.chapter);
      if (verseSelect) verseSelect.value=String(state.verse);
      if (densitySelect) densitySelect.value=String(state.density);
      rerender();
    } else {
      alert('Aucune “dernière étude” sauvegardée.');
    }
  }
})();

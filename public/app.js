/* app.js — Restauration stable
   - Palette 12 couleurs (thème global)
   - Densité 500/1500/2500 liée à options.length (API)
   - 66 livres + chapitres, 28 rubriques, diodes ok/orange
   - Boutons: ChatGPT, Dernière étude (last+prev), Reset (orange + champs neutres)
   - Correctifs: placeholders <option>, try/catch + debug panel
*/
(function () {
  // -------- Utils
  const $  = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  const esc=(s)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const debug=(m)=>{ const p=$('#debugPanel'); if(!p) return; p.style.display='block'; p.textContent+=`\n${m}`; };

  // -------- Constantes
  const STORAGE_LAST='lastStudy', STORAGE_PREV='prevStudy', STORAGE_DENS='density8', STORAGE_THEME='theme8';
  const TITLE0='Rubrique 0 — Panorama des versets du chapitre';
  const DENSITY_CHOICES=[500,1500,2500];

  const THEMES=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate','rose','bleu','lime','teal'];
  const THEME_VARS = {
    cyan:{bg:'#f0f9ff',text:'#0c4a6e',primary:'#06b6d4',border:'#e2e8f0'},
    violet:{bg:'#f5f3ff',text:'#4c1d95',primary:'#8b5cf6',border:'#e2e8f0'},
    vert:{bg:'#f0fdf4',text:'#064e3b',primary:'#22c55e',border:'#e2e8f0'},
    rouge:{bg:'#fef2f2',text:'#7f1d1d',primary:'#ef4444',border:'#e2e8f0'},
    mauve:{bg:'#fdf4ff',text:'#581c87',primary:'#a855f7',border:'#e2e8f0'},
    indigo:{bg:'#eef2ff',text:'#312e81',primary:'#6366f1',border:'#e2e8f0'},
    ambre:{bg:'#fffbeb',text:'#78350f',primary:'#f59e0b',border:'#e2e8f0'},
    slate:{bg:'#f8fafc',text:'#0f172a',primary:'#475569',border:'#e2e8f0'},
    rose:{bg:'#fff1f2',text:'#831843',primary:'#f472b6',border:'#e2e8f0'},
    bleu:{bg:'#eff6ff',text:'#1e3a8a',primary:'#3b82f6',border:'#e2e8f0'},
    lime:{bg:'#f7fee7',text:'#365314',primary:'#84cc16',border:'#e2e8f0'},
    teal:{bg:'#f0fdfa',text:'#115e59',primary:'#14b8a6',border:'#e2e8f0'},
  };

  const CHAPTERS_66={"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};
  const ORDER_66=Object.keys(CHAPTERS_66);

  const TITLES_DEFAULT={1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",17:"Appui doctrinal",18:"Comparaison entre versets",19:"Parallèle avec Actes 2",20:"Verset à mémoriser",21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",27:"Versets utiles à retenir",28:"Prière de fin"};
  const DESCS_DEFAULT={1:"Invocation du Saint-Esprit pour éclairer l’étude.",2:"Appartenance au canon (AT/NT).",3:"Questions à reprendre de l’étude précédente.",4:"Résumé doctrinal synthétique du chapitre.",5:"Période, géopolitique, culture, carte.",6:"Séquençage narratif et composition.",7:"Type de texte : narratif, poétique, prophétique…",8:"Auteur et lien aux patriarches (généalogie).",9:"Verset central du chapitre.",10:"Commentaire exégétique (original si utile).",11:"Mots-clés et portée doctrinale.",12:"Passages parallèles et complémentaires.",13:"Doctrines majeures qui émergent du chapitre.",14:"Correspondance avec les grands thèmes doctrinaux.",15:"Vertus / attitudes visées.",16:"Figures typologiques et symboles.",17:"Passages d’appui concordants.",18:"Comparaison interne des versets.",19:"Parallèle avec Actes 2.",20:"Verset à mémoriser.",21:"Implications pour l’Église.",22:"Applications familiales.",23:"Pédagogie enfants (jeux, récits, symboles).",24:"Applications mission/évangélisation.",25:"Applications pastorales/enseignement.",26:"Application personnelle engagée.",27:"Versets utiles à retenir.",28:"Prière de clôture."};

  // -------- État
  const state={
    book:'Genèse', chapter:1, verse:1, version:'LSG',
    density:1500, currentIdx:0,
    titles:{...TITLES_DEFAULT}, descs:{...DESCS_DEFAULT},
    sectionsByN:new Map(), leds:new Map()
  };
  for(let i=0;i<=28;i++) state.leds.set(i,'warn');

  // -------- Éléments
  const pointsList=$('#pointsList'), edTitle=$('#edTitle'), metaInfo=$('#metaInfo');
  const searchRef=$('#searchRef'), applyBtn=$('#applySearchBtn')||$('#validate');
  const bookSelect=$('#bookSelect'), chapterSelect=$('#chapterSelect'), verseSelect=$('#verseSelect'), versionSelect=$('#versionSelect');
  const densitySelect=$('#densitySelect');
  const readBtn=$('#readBtn'), generateBtn=$('#generateBtn');
  const prevBtn=$('#prev'), nextBtn=$('#next');
  const noteArea=$('#noteArea');
  const themeBar=$('#themeBar');
  const chatgptBtn=$('#chatgptBtn'), lastBtn=$('#lastBtn'), resetBtn=$('#resetBtn']);

  document.addEventListener('DOMContentLoaded', ()=>{
    try{ init(); }catch(e){ debug('INIT ERROR: '+(e?.stack||e)); }
  });

  function init(){
    ensureListScroll();
    ensureSelectPlaceholders();
    setupDensitySelector();
    restoreTheme();
    restoreLast();

    wireEvents();
    if (state.book){
      fillBooks(); fillChapters(); fillVerses();
      if (bookSelect)   bookSelect.value=state.book;
      if (chapterSelect)chapterSelect.value=String(state.chapter);
      if (verseSelect)  verseSelect.value=String(state.verse);
    } else {
      fillBooks(true);
    }
    if (versionSelect) versionSelect.value=state.version||'LSG';
    if (densitySelect) densitySelect.value=String(state.density||1500);

    renderPointsList(); updateHeader(); renderSection(0);
    initThemeBar();
  }

  // -------- Thème (micro-patch robuste)
  function setTheme(name){
    const v = THEME_VARS[name] || THEME_VARS.cyan;

    const apply = (el) => {
      el.style.setProperty('--bg', v.bg);
      el.style.setProperty('--panel', '#fff');
      el.style.setProperty('--text', v.text);
      el.style.setProperty('--border', v.border);
      el.style.setProperty('--accent', v.primary);
      el.style.setProperty('--accent-soft', 'rgba(0,0,0,.04)');
      el.setAttribute('data-theme', name);
    };

    apply(document.documentElement);
    apply(document.body);

    try { localStorage.setItem(STORAGE_THEME, name); } catch {}
  }
  function restoreTheme(){ try{ setTheme(localStorage.getItem(STORAGE_THEME)||'cyan'); }catch{ setTheme('cyan'); } }
  function initThemeBar(){
    if (!themeBar) return;
    themeBar.innerHTML='';
    THEMES.forEach(name=>{
      const b=document.createElement('button');
      b.type='button'; b.dataset.role='swatch'; b.dataset.theme=name;
      b.style.background=THEME_VARS[name].primary; b.title=name;
      b.addEventListener('click',()=>setTheme(name));
      themeBar.appendChild(b);
    });
  }

  // -------- Densité
  function setupDensitySelector(){
    if (!densitySelect) return;
    if (!densitySelect.options.length){
      DENSITY_CHOICES.forEach(v=>{
        const o=document.createElement('option'); o.value=String(v); o.textContent=`${v} caractères`;
        densitySelect.appendChild(o);
      });
    }
    try{
      const raw=localStorage.getItem(STORAGE_DENS);
      const val=raw?parseInt(raw,10):1500;
      if (DENSITY_CHOICES.includes(val)) state.density=val;
    }catch{}
    densitySelect.addEventListener('change', ()=>{
      const v=parseInt(densitySelect.value,10);
      if (DENSITY_CHOICES.includes(v)){
        state.density=v;
        try{ localStorage.setItem(STORAGE_DENS,String(v)); }catch{}
      }
    });
  }

  // -------- Événements
  function wireEvents(){
    applyBtn && applyBtn.addEventListener('click', applySearch);
    searchRef && searchRef.addEventListener('keydown', e=>{ if(e.key==='Enter') applySearch(); });
    bookSelect && bookSelect.addEventListener('change', ()=>{
      rememberAsPrevious();
      state.book=bookSelect.value||'';
      if (state.book){ state.chapter=1; state.verse=1; fillChapters(); fillVerses(); }
      else { clearChaptersAndVerses(); }
      saveLast(); rerender();
    });
    chapterSelect && chapterSelect.addEventListener('change', ()=>{
      const max=CHAPTERS_66[state.book]||1;
      const n=parseInt(chapterSelect.value,10);
      if (Number.isFinite(n)){ state.chapter=clamp(n,1,max); chapterSelect.value=String(state.chapter); }
      fillVerses(); saveLast(); rerender();
    });
    verseSelect && verseSelect.addEventListener('change', ()=>{
      const v=parseInt(verseSelect.value,10);
      state.verse=Number.isFinite(v)?v:1; saveLast();
    });
    versionSelect && versionSelect.addEventListener('change', ()=>{
      state.version=versionSelect.value||'LSG'; saveLast();
    });

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
  }

  // -------- Sélecteurs / Recherche (placeholders corrects)
  function ensureSelectPlaceholders(){
    [bookSelect,chapterSelect,verseSelect].forEach(sel=>{
      if(!sel) return;
      if(!sel.querySelector('option[value=""]')){
        const o=document.createElement('option'); o.value=''; o.textContent='—';
        sel.insertBefore(o, sel.firstChild);
      }
    });
  }
  function clearChaptersAndVerses(){
    if (chapterSelect){
      chapterSelect.innerHTML='';
      const o=document.createElement('option'); o.value=''; o.textContent='—'; chapterSelect.appendChild(o);
      chapterSelect.value='';
    }
    if (verseSelect){
      verseSelect.innerHTML='';
      const o=document.createElement('option'); o.value=''; o.textContent='—'; verseSelect.appendChild(o);
      verseSelect.value='';
    }
  }
  function fillBooks(keepNeutral=false){
    if(!bookSelect) return;
    bookSelect.innerHTML='';
    const o0=document.createElement('option'); o0.value=''; o0.textContent='—'; bookSelect.appendChild(o0);
    ORDER_66.forEach(b=>{ const o=document.createElement('option'); o.value=b; o.textContent=b; bookSelect.appendChild(o); });
    bookSelect.value=(!keepNeutral&&state.book)?state.book:'';
  }
  function fillChapters(){
    if(!chapterSelect) return;
    const max=CHAPTERS_66[state.book]||0;
    chapterSelect.innerHTML='';
    const o0=document.createElement('option'); o0.value=''; o0.textContent='—'; chapterSelect.appendChild(o0);
    for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o); }
    chapterSelect.value=state.chapter?String(clamp(state.chapter,1,max)):'';
  }
  function fillVerses(){
    if(!verseSelect) return;
    verseSelect.innerHTML='';
    const o0=document.createElement('option'); o0.value=''; o0.textContent='—'; verseSelect.appendChild(o0);
    for(let i=1;i<=150;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o); }
    verseSelect.value=state.verse?String(state.verse):'';
  }

  function applySearch(){
    if (!searchRef) return;
    const raw=(searchRef.value||'').trim(); if(!raw) return;
    const m=/^([\p{L}\d\s]+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/u.exec(raw);
    if (m){
      rememberAsPrevious();
      const bookName=normalize(m[1]), chap=parseInt(m[2],10), vers=m[3]||null;
      const found=findBook(bookName);
      if (found){
        state.book=found; const max=CHAPTERS_66[found]||1;
        state.chapter=clamp(chap,1,max); state.verse=vers?parseInt(vers.split('-')[0],10):1;
        fillBooks(); if (bookSelect) bookSelect.value=state.book;
        fillChapters(); if (chapterSelect) chapterSelect.value=String(state.chapter);
        fillVerses(); if (verseSelect) verseSelect.value=String(state.verse);
        saveLast(); rerender(); return;
      }
    }
    const bn=normalize(raw), fb=findBook(bn);
    if (fb){
      rememberAsPrevious();
      state.book=fb; state.chapter=1; state.verse=1;
      fillBooks(); if (bookSelect) bookSelect.value=fb;
      fillChapters(); fillVerses();
      saveLast(); rerender();
    }
  }
  const normalize=(s)=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
  function findBook(norm){ for(const b of ORDER_66){ const n=normalize(b); if(n===norm||n.startsWith(norm)||norm.startsWith(n)) return b; } return null; }

  // -------- Liste 0..28
  function getTitle(n){ return state.titles[n]||TITLES_DEFAULT[n]||`Point ${n}`; }
  function getDesc(n){ return state.descs[n] ||DESCS_DEFAULT[n] ||''; }

  function renderPointsList(){
    if (!pointsList) return;
    pointsList.innerHTML='';
    pointsList.appendChild(renderItem({idx:0,title:TITLE0,desc:'Aperçu du chapitre verset par verset'}));
    for(let i=1;i<=28;i++) pointsList.appendChild(renderItem({idx:i,title:getTitle(i),desc:getDesc(i)}));
    highlightActive();
  }
  function renderItem({idx,title,desc}){
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
  function updateHeader(){ if(!edTitle||!metaInfo) return; edTitle.textContent=state.currentIdx===0?TITLE0:getTitle(state.currentIdx); metaInfo.textContent=`Point ${state.currentIdx} / 28`; }
  function rerender(){ renderPointsList(); renderSection(state.currentIdx); updateHeader(); }
  function ensureListScroll(){ const pl=$('#pointsList'); if(!pl) return; pl.style.overflowY='auto'; if(!pl.style.maxHeight) pl.style.maxHeight='calc(100vh - 220px)'; }

  // -------- Rendu section (textarea)
  function renderSection(n){
    if (!noteArea) return;
    const txt=state.sectionsByN.get(n)||defaultContent(n);
    noteArea.value=txt;
    noteArea.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function defaultContent(n){
    const ref=state.book?`${state.book} ${state.chapter||''}`.trim():'—';
    if (n===0) return `### ${TITLE0}

*Référence :* ${ref}

Clique sur **Générer** pour charger chaque verset avec explications.`;
    return `### ${getTitle(n)}

*Référence :* ${ref}

À générer…`;
  }

  // -------- Génération (micro-patch garde-fou sur bouton)
  async function onGenerate(){
    if (!state.book){ alert('Choisis un livre (et chapitre) avant de générer.'); return; }
    if (!generateBtn) { console.warn('generateBtn manquant'); return; }

    const btn=generateBtn, old=btn.textContent; btn.disabled=true; btn.textContent='Génération…';
    try{
      const passage=`${state.book} ${state.chapter||1}`;
      const r=await fetch('/api/generate-study',{ method:'POST', headers:{'Content-Type':'application/json'}, cache:'no-store',
        body: JSON.stringify({ passage, options:{ length: state.density, translation:'DARBY', rubrics: Array.from({length:28},(_,i)=>i+1) } })
      });
      if(!r.ok) throw new Error('HTTP '+r.status);
      const j=await r.json();
      const sections=j.study?.sections||j.sections||[];
      const t={}, d={};
      for(const s of sections){
        const id=Number(s.id ?? s.n); if(!Number.isFinite(id)) continue;
        const title=String((s.title ?? s.titre ?? '')).trim();
        const desc =String((s.description ?? s.desc ?? '')).trim();
        const content=String(s.content||'').trim();
        if(title) t[id]=title;
        if(desc)  d[id]=desc;
        if(content){
          state.sectionsByN.set(id,content);
          state.leds.set(id,'ok');     // ✅ diode verte
        } else {
          state.leds.set(id,'warn');   // 🟠 si contenu vide
        }
      }
      if(Object.keys(t).length) state.titles={...state.titles,...t};
      if(Object.keys(d).length) state.descs ={...state.descs ,...d};
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
    state.sectionsByN.set(0,`### ${TITLE0}
*Référence :* ${ref}

Cliquer sur **Lire** puis **Générer** quand l’API sera dispo.`);
    for(let i=1;i<=28;i++){
      state.sectionsByN.set(i, `### ${getTitle(i)}
*Référence :* ${ref}

Contenu provisoire (gabarit).`);
      state.leds.set(i,'warn');
    }
  }

  // -------- Reset total (ne touche pas last/prev)
  function onResetTotal(){
    if(!confirm('Tout vider ? (rubriques → orange, recherche vidée, sélecteurs à "—", mémoire des études conservée)')) return;
    state.sectionsByN.clear();
    for(let i=0;i<=28;i++) state.leds.set(i,'warn'); // orange

    if (searchRef) searchRef.value='';
    state.book=''; state.chapter=null; state.verse=null;
    fillBooks(true); clearChaptersAndVerses();
    if (bookSelect)   bookSelect.value='';
    if (chapterSelect)chapterSelect.value='';
    if (verseSelect)  verseSelect.value='';

    state.currentIdx=0;
    renderPointsList(); renderSection(0); updateHeader();
  }

  // -------- Mémoire last/prev
  function loadJSON(k){ try{ const r=localStorage.getItem(k); return r?JSON.parse(r):null; }catch{return null;} }
  function saveLast(){
    try{
      const prev=loadJSON(STORAGE_LAST);
      const next={ book:state.book||'', chapter:state.chapter||'', verse:state.verse||'', version:state.version||'LSG', density:state.density };
      if(prev && (prev.book!==next.book || String(prev.chapter)!==String(next.chapter))){
        localStorage.setItem(STORAGE_PREV, JSON.stringify(prev));
      }
      localStorage.setItem(STORAGE_LAST, JSON.stringify(next));
    }catch(e){ debug('SAVE ERROR: '+e); }
  }
  function rememberAsPrevious(){
    try{ const cur=loadJSON(STORAGE_LAST); if(cur) localStorage.setItem(STORAGE_PREV, JSON.stringify(cur)); }catch{}
  }
  function restoreLast(){
    try{
      const j=loadJSON(STORAGE_LAST);
      if (j && CHAPTERS_66[j.book]){
        state.book=j.book; state.chapter=clamp(parseInt(j.chapter,10)||1,1,CHAPTERS_66[j.book]);
        state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG';
        if (DENSITY_CHOICES.includes(Number(j.density))) state.density=Number(j.density);
      } else { state.book=''; state.chapter=null; state.verse=null; }
    }catch(e){ debug('RESTORE ERROR: '+e); }
  }
  function loadLastStudy(){
    const last=loadJSON(STORAGE_LAST);
    if(last && last.book && CHAPTERS_66[last.book]){
      state.book=last.book;
      state.chapter=clamp(parseInt(last.chapter,10)||1,1,CHAPTERS_66[last.book]);
      state.verse=parseInt(last.verse,10)||1;
      state.version=last.version||'LSG';
      state.density=DENSITY_CHOICES.includes(Number(last.density))?Number(last.density):state.density;
      fillBooks(); fillChapters(); fillVerses();
      if (bookSelect)   bookSelect.value=state.book;
      if (chapterSelect)chapterSelect.value=String(state.chapter);
      if (verseSelect)  verseSelect.value=String(state.verse);
      if (densitySelect)densitySelect.value=String(state.density);
      rerender();
    } else {
      alert('Aucune “dernière étude” sauvegardée.');
    }
  }

  // -------- YouVersion
  const YV_BOOK={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const YV_VERSION_ID={ 'LSG':'93' };
  function youVersionURL(book,chapter,verse,version){
    const code=YV_BOOK[book]||'GEN'; const verId=YV_VERSION_ID[version||'LSG']||'93'; const vtag=(version||'LSG').toUpperCase();
    return `https://www.bible.com/fr/bible/${verId}/${code}.${chapter||1}.${vtag}`;
  }
})();

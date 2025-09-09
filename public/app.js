/* app.js — Fix palette + Dernière étude + Générer avec fallback + titres centrés + mobile Valider + MOCK PUBLIC */

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const log = (...a) => { try{ const d=$('#debugPanel'); if(d){ d.textContent+='\n'+a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');} }catch{} };

  // --- MODE MOCK PUBLIC (nouveau) ---
  const urlParams = new URLSearchParams(location.search);
  const MOCK_PUBLIC = urlParams.get('mock') === '1' || localStorage.getItem('mockPublic') === '1';
  function normMock(s){
    return String(s||'')
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[’']/g,"'")
      .replace(/\s+/g,' ')
      .trim()
      .toLowerCase();
  }

  // Eléments
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

  // Constantes & titres
  const STORAGE_LAST   = 'lastStudy';
  const STORAGE_DENS   = 'density8';
  const STORAGE_THEME  = 'theme8';

  const TITLE0 = 'Rubrique 0 — Panorama des versets du chapitre';
  const TITLES = {
    1: 'Prière d’ouverture',
    2: 'Contexte et fil narratif',
    3: 'Questions du chapitre précédent',
    4: 'Canonicité et cohérence',
    5: 'Ancien/Nouveau Testament',
    6: 'Promesses',
    7: 'Péché et grâce',
    8: 'Christologie',
    9: 'Esprit Saint',
    10: 'Alliance',
    11: 'Église',
    12: 'Discipulat',
    13: 'Éthique',
    14: 'Prière',
    15: 'Mission',
    16: 'Espérance',
    17: 'Exhortation',
    18: 'Application personnelle',
    19: 'Application communautaire',
    20: 'Liturgie',
    21: 'Méditation',
    22: 'Verset-clé',
    23: 'Typologie',
    24: 'Théologie systématique',
    25: 'Histoire du salut',
    26: 'Thèmes secondaires',
    27: 'Doutes/objections',
    28: 'Synthèse & plan de lecture',
  };

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
  const BG_VERSION = { 'LSG':'LSG','PDV':'PDV-FR','S21':'SG21','BFC':'BFC' };

  // Etat
  const state = {
    book: 'Genèse',
    chapter: 1,
    verse: 1,
    version: 'LSG',
    currentIdx: 0,
    sectionsByN: new Map(),
    leds: new Map(),
    density: 1500,
  };

  init();

  function init(){
    const yEl = $('#y'); if (yEl) yEl.textContent = String(new Date().getFullYear());
    restoreTheme();
    fillBooks(); fillChapters(); fillVerses();

    $('#debugBtn')?.addEventListener('click', ()=>{ const d=$('#debugPanel'); if(d) d.style.display=(d.style.display==='none'?'block':'none'); });
    readBtn?.addEventListener('click', openBibleGatewayFromSelectors);
    generateBtn?.addEventListener('click', onGenerate);
    resetBtn?.addEventListener('click', onReset);
    pdfBtn?.addEventListener('click', ()=>window.print());
    prevBtn?.addEventListener('click', ()=>goTo(state.currentIdx-1));
    nextBtn?.addEventListener('click', ()=>goTo(state.currentIdx+1));

    applySearchBtn?.addEventListener('click', applySearch);
    searchRef?.addEventListener('keydown', (e)=>{ if(e.key==='Enter') applySearch(); });

    bookSelect?.addEventListener('change', ()=>{ state.book=bookSelect.value; state.chapter=1; fillChapters(); fillVerses(); saveLastStudy(); refreshLastBadge(); });
    chapterSelect?.addEventListener('change', ()=>{ state.chapter=parseInt(chapterSelect.value,10)||1; fillVerses(); saveLastStudy(); refreshLastBadge(); });
    verseSelect?.addEventListener('change', ()=>{ state.verse=parseInt(verseSelect.value,10)||1; saveLastStudy(); refreshLastBadge(); });
    versionSelect?.addEventListener('change', ()=>{ state.version=versionSelect.value; });

    if (themeBar) {
      themeBar.addEventListener('pointerdown', onThemePointer);
      placeThumbForTheme(document.body.getAttribute('data-theme')||'cyan');
    }

    injectDensitySelector();
    restoreLastStudy();
    refreshLastBadge();

    for (let i=0;i<=28;i++) state.leds.set(i,'warn');

    renderPointsList();
    updateHeader();
    renderSection(0);
  }

  /* ---------- Densité ---------- */
  function injectDensitySelector(){
    const controls = document.querySelector('.controls');
    if (!controls) return;
    const wrap = document.createElement('div');
    wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    const label = document.createElement('label');
    label.textContent='Densité'; label.style.fontSize='13px'; label.style.color='#64748b';
    const sel = document.createElement('select');
    sel.id='densitySelect'; sel.title='Densité par rubrique';
    sel.style.border='1px solid var(--border)'; sel.style.borderRadius='10px'; sel.style.padding='10px 12px'; sel.style.minHeight='42px';
    sel.innerHTML = `<option value="500">500</option><option value="1500">1500</option><option value="2500">2500</option>`;
    const saved = localStorage.getItem(STORAGE_DENS);
    sel.value = (saved && ['500','1500','2500'].includes(saved)) ? saved : String(state.density);
    state.density = parseInt(sel.value,10);
    sel.addEventListener('change', ()=>{ state.density=parseInt(sel.value,10); localStorage.setItem(STORAGE_DENS, String(state.density)); });
    const anchor = readBtn || controls.lastChild;
    controls.insertBefore(wrap, anchor);
    wrap.appendChild(label); wrap.appendChild(sel);
  }

  /* ---------- Liste Rubrique 0 + 28 ---------- */
  function renderPointsList(){
    pointsList.innerHTML='';
    pointsList.appendChild(renderItem({ idx:0, title:TITLE0, desc:'Aperçu du chapitre verset par verset' }));
    for (let i=1;i<=28;i++){
      pointsList.appendChild(renderItem({ idx:i, title:TITLES[i]||`Point ${i}`, desc:'' }));
    }
    highlightActive();
  }
  function renderItem({ idx, title, desc }){
    const li=document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
    const idxEl=document.createElement('div'); idxEl.className='idx'; idxEl.textContent=String(idx);
    const txt=document.createElement('div'); txt.className='txt';
    txt.innerHTML=`<div>${escapeHtml(title)}</div>${desc?`<span class="desc">${escapeHtml(desc)}</span>`:''}`;
    const dot=document.createElement('div'); dot.className='dot '+(state.leds.get(idx)==='ok'?'ok':'');
    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click', ()=>goTo(idx));
    return li;
  }
  function highlightActive(){ $$('#pointsList .item').forEach(d=>d.classList.toggle('active', Number(d.dataset.idx)===state.currentIdx)); }
  function goTo(idx){ if(idx<0) idx=0; if(idx>28) idx=28; state.currentIdx=idx; updateHeader(); renderSection(idx); highlightActive(); }
  function updateHeader(){ const t = state.currentIdx===0?TITLE0:(TITLES[state.currentIdx]||`Point ${state.currentIdx}`); edTitle.textContent=t; metaInfo.textContent=`Point ${state.currentIdx} / 28`; }

  /* ---------- Génération API + mock public + fallback ---------- */
  async function onGenerate(){
    const old=generateBtn.textContent; generateBtn.disabled=true; generateBtn.textContent='Génération…';
    try{
      const q = new URLSearchParams({ book: state.book, chapter: String(state.chapter), length: String(state.density) }).toString();

      // URL par défaut = API
      let url = `/api/generate-study?${q}`;

      // En mode MOCK PUBLIC, on va lire un JSON statique
      if (MOCK_PUBLIC) {
        const key = `${normMock(state.book).replace(/\s+/g,'-')}-${state.chapter}`; // ex: jeremie-1
        let testUrl = `/tests/generate-study.${key}.json`;
        let r = await fetch(testUrl, { cache:'no-store' });
        if (!r.ok) {
          // fallback fourni (Jérémie 1)
          testUrl = `/tests/generate-study.jeremie-1.json`;
          r = await fetch(testUrl, { cache:'no-store' });
          if (!r.ok) throw new Error('Mock introuvable');
        }
        url = testUrl;
      }

      const r = await fetch(url, { cache:'no-store' });
      if (!r.ok) throw new Error('HTTP '+r.status);
      const j = await r.json();

      state.sectionsByN.clear();
      if (Array.isArray(j.sections)) for (const s of j.sections) state.sectionsByN.set(Number(s.n), String(s.content||'').trim());
      for (const n of state.sectionsByN.keys()) state.leds.set(n,'ok');

      renderPointsList(); renderSection(state.currentIdx);
      saveLastStudy(); refreshLastBadge();

      // Indication visible en mock
      if (MOCK_PUBLIC) { log('MOCK PUBLIC actif →', url); }
    }catch(err){
      log('generate error', String(err));
      alert('La génération a échoué. Un gabarit a été inséré.');
      insertSkeleton();
      renderPointsList(); renderSection(state.currentIdx);
    } finally {
      generateBtn.disabled=false; generateBtn.textContent=old;
    }
  }

  function insertSkeleton(){
    state.sectionsByN.set(0, `### Rubrique 0 — Panorama des versets du chapitre
*Référence :* ${state.book} ${state.chapter}

Cliquer sur **Lire la Bible** pour lire le texte source, puis utiliser **Générer** quand l’API sera disponible.`);
    for (let i=1;i<=28;i++){
      const t=TITLES[i]||`Point ${i}`;
      state.sectionsByN.set(i, `### ${t}
*Référence :* ${state.book} ${state.chapter}

Contenu provisoire (gabarit). Réessaie la génération plus tard.`);
      state.leds.set(i,'warn');
    }
  }

  /* ---------- Reset ---------- */
  function onReset(){
    if (!confirm('Vider l’étude en cours et repasser les voyants en orange ?')) return;
    state.sectionsByN.clear();
    for (let i=0;i<=28;i++) state.leds.set(i,'warn');
    renderPointsList(); renderSection(state.currentIdx);
  }

  /* ---------- Rendu section + liens BG ---------- */
  function renderSection(n){
    const md = state.sectionsByN.get(n) || defaultContent(n);
    const html = mdToHtml(md);
    const htmlWithLinks = linkifyScripture(html, state.version);
    noteView.innerHTML = htmlWithLinks;

    const refs = extractRefsFromHtml(htmlWithLinks);
    if (refs.length){
      linksPanel.classList.remove('empty');
      linksList.innerHTML = refs.map(r=>{
        const url = bibleGatewayURLFromLabel(r.label, state.version);
        return `<div><a href="${url}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a></div>`;
      }).join('');
    } else { linksPanel.classList.add('empty'); linksList.innerHTML=''; }
  }
  function defaultContent(n){
    if (n===0) return `### Rubrique 0 — Panorama des versets du chapitre

*Référence :* ${state.book} ${state.chapter}

Clique sur **Générer** pour charger chaque verset avec explications.`;
    const t=TITLES[n]||`Point ${n}`; 
    return `### ${t}

*Référence :* ${state.book} ${state.chapter}

À générer…`;
  }

  /* ---------- Recherche intelligente ---------- */
  function applySearch(){
    const raw=(searchRef.value||'').trim(); if(!raw) return;
    const m = /^([\p{L}\d\s]+?)\s+(\d+)(?::(\d+(?:-\d+)?))?$/u.exec(raw);
    if (m){
      const bookName=normalizeBook(m[1]); const chap=parseInt(m[2],10); const vers=m[3]||null;
      const found=findBook(bookName);
      if (found){
        state.book=found; state.chapter=clamp(chap,1,CHAPTERS_66[found]); state.verse=vers?parseInt(vers.split('-')[0],10):1;
        bookSelect.value=state.book; fillChapters(); chapterSelect.value=String(state.chapter); fillVerses(); if(vers) verseSelect.value=String(state.verse);
        saveLastStudy(); refreshLastBadge(); return;
      }
    }
    const bn=normalizeBook(raw); const fb=findBook(bn);
    if (fb){ state.book=fb; state.chapter=1; state.verse=1; bookSelect.value=state.book; fillChapters(); fillVerses(); saveLastStudy(); refreshLastBadge(); }
  }
  function normalizeBook(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
  function findBook(normName){ for(const b of ORDER_66){ const n=normalizeBook(b); if(n===normName||n.startsWith(normName)||normName.startsWith(n)) return b; } return null; }

  /* ---------- Sélecteurs Livre/Chapitre/Verset ---------- */
  function fillBooks(){ bookSelect.innerHTML=ORDER_66.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join(''); bookSelect.value=state.book; }
  function fillChapters(){ const max=CHAPTERS_66[state.book]||1; chapterSelect.innerHTML=''; for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o);} if(state.chapter>max) state.chapter=max; chapterSelect.value=String(state.chapter); }
  function fillVerses(){ verseSelect.innerHTML=''; for(let i=1;i<=150;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o);} verseSelect.value=String(state.verse); }

  /* ---------- Palette thème ---------- */
  function onThemePointer(ev){
    themeBar.setPointerCapture?.(ev.pointerId);
    const rect=themeBar.getBoundingClientRect();
    const move=(e)=>{
      const clientX = (e.touches?e.touches[0].clientX:e.clientX);
      const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = x / rect.width;
      themeThumb.style.left = (pct*100)+'%';
      applyThemeFromPct(pct);
    };
    const up=()=>{
      saveTheme();
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
  function applyThemeFromPct(pct){
    const themes=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate'];
    const idx=Math.min(themes.length-1,Math.max(0,Math.floor(pct*themes.length)));
    document.body.setAttribute('data-theme', themes[idx]);
  }
  function placeThumbForTheme(theme){
    const themes=['cyan','violet','vert','rouge','mauve','indigo','ambre','slate'];
    const idx=Math.max(0, themes.indexOf(theme));
    const pct = (idx + 0.5)/themes.length;
    themeThumb.style.left=(pct*100)+'%';
  }
  function saveTheme(){ localStorage.setItem(STORAGE_THEME, document.body.getAttribute('data-theme')||'cyan'); }
  function restoreTheme(){ const t=localStorage.getItem(STORAGE_THEME); if(t) document.body.setAttribute('data-theme', t); }

  /* ---------- Dernière étude ---------- */
  function refreshLastBadge(){ if(!lastBadge) return; const label=`${state.book} ${state.chapter}${state.verse?':'+state.verse:''}`; lastBadge.textContent='Dernière : '+label; }
  function saveLastStudy(){ const payload={ book:state.book, chapter:state.chapter, verse:state.verse, version:state.version, density:state.density }; localStorage.setItem(STORAGE_LAST, JSON.stringify(payload)); }
  function restoreLastStudy(){ try{ const raw=localStorage.getItem(STORAGE_LAST); if(!raw) return; const j=JSON.parse(raw); if(j&&CHAPTERS_66[j.book]){ state.book=j.book; state.chapter=clamp(parseInt(j.chapter,10)||1,1,CHAPTERS_66[j.book]); state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG'; if(typeof j.density==='number') state.density=j.density; bookSelect.value=state.book; fillChapters(); chapterSelect.value=String(state.chapter); fillVerses(); versionSelect.value=state.version; } }catch{} }

  /* ---------- BibleGateway ---------- */
  function openBibleGatewayFromSelectors(){ const url=bibleGatewayURL(state.book,state.chapter,null,state.version); window.open(url,'_blank','noopener'); }
  function bibleGatewayURL(book,chapter,verses,version){ const v=BG_VERSION[version]||'LSG'; const query=verses?`${book} ${chapter}:${verses}`:`${book} ${chapter}`; const u=new URL('https://www.biblegateway.com/passage/'); u.searchParams.set('search',query); u.searchParams.set('version',v); return u.toString(); }
  function bibleGatewayURLFromLabel(label,version){ const v=BG_VERSION[version]||'LSG'; const u=new URL('https://www.biblegateway.com/passage/'); u.searchParams.set('search',label); u.searchParams.set('version',v); return u.toString(); }

  /* ---------- Mini Markdown + Linkify ---------- */
  function mdToHtml(md){
    let h=String(md||'');
    h=h.replace(/^### (.*)$/gm,'<h3>$1</h3>').replace(/^## (.*)$/gm,'<h2>$1</h2>').replace(/^# (.*)$/gm,'<h1>$1</h1>');
    h=h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
    h=h.replace(/^\s*-\s+(.*)$/gm,'<li>$1</li>').replace(/(<li>.*<\/li>)(?!\s*<li>)/gs,'<ul>$1</ul>');
    h=h.split(/\n{2,}/).map(block=>{ if(/^<h\d|^<ul|^<li|^<p|^<blockquote/.test(block.trim())) return block; const withBr=block.replace(/\n/g,'<br/>'); return `<p>${withBr}</p>`; }).join('\n');
    return h;
  }
  function linkifyScripture(html,version){
    const booksRe = ORDER_66.slice().sort((a,b)=>b.length-a.length).map(escapeReg).join('|');
    const re = new RegExp(`\\b(${booksRe})\\s+(\\d+)(?::(\\d+(?:-\\d+)?))?\\b`,'g');
    return html.replace(re,(m,b,c,v)=>{ const u=bibleGatewayURL(b,c,v||null,version); const label=v?`${b} ${c}:${v}`:`${b} ${c}`; return `<a href="${u}" target="_blank" rel="noopener">${label}</a>`; });
  }
  function extractRefsFromHtml(html){ const out=[]; const div=document.createElement('div'); div.innerHTML=html; const as=div.querySelectorAll('a[href*="biblegateway.com/passage/"]'); as.forEach(a=>out.push({ label:a.textContent })); return out; }

  // Utils
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function escapeReg(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
})();

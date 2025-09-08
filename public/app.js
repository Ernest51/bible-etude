/* app.js — Rubrique 0 + Sélecteur Densité + Logs Debug */

(function () {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const log = (...a) => {
    try {
      const d = $('#debugPanel');
      if (d) { d.textContent += '\n' + a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' '); }
      console.debug('[DBG]', ...a);
    } catch {}
  };

  // Elements
  const pointsList = $('#pointsList');
  const edTitle = $('#edTitle');
  const noteView = $('#noteView');
  const linksPanel = $('#linksPanel');
  const linksList = $('#linksList');
  const metaInfo = $('#metaInfo');

  const readBtn = $('#readBtn');
  const generateBtn = $('#generateBtn');
  const prevBtn = $('#prev');
  const nextBtn = $('#next');

  const searchRef = $('#searchRef');
  const bookSelect = $('#bookSelect');
  const chapterSelect = $('#chapterSelect');
  const verseSelect = $('#verseSelect');
  const versionSelect = $('#versionSelect');

  // Constantes
  const STORAGE_LAST   = 'lastStudy';
  const STORAGE_DENS   = 'density8';

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

  // State
  const state = {
    book: 'Genèse',
    chapter: 1,
    verse: 1,
    version: 'LSG',
    currentIdx: 0, // 0 = Rubrique 0
    sectionsByN: new Map(),
    leds: new Map(),
    density: 1500, // 500 | 1500 | 2500
  };

  init();

  function init() {
    log('init start');

    // Checks de base
    if (!pointsList || !noteView || !readBtn || !generateBtn) {
      log('DOM manquant:', { pointsList: !!pointsList, noteView: !!noteView, readBtn: !!readBtn, generateBtn: !!generateBtn });
    }

    // Footer année
    const yEl = $('#y'); if (yEl) yEl.textContent = String(new Date().getFullYear());

    fillBooks(); fillChapters(); fillVerses();
    injectDensitySelector();

    renderPointsList();

    $('#debugBtn')?.addEventListener('click', () => {
      const d = $('#debugPanel'); if (!d) return;
      d.style.display = d.style.display === 'none' ? 'block' : 'none';
    });

    readBtn?.addEventListener('click', openBibleGatewayFromSelectors);
    generateBtn?.addEventListener('click', onGenerate);
    prevBtn?.addEventListener('click', () => goTo(state.currentIdx - 1));
    nextBtn?.addEventListener('click', () => goTo(state.currentIdx + 1));

    bookSelect?.addEventListener('change', () => { state.book = bookSelect.value; state.chapter = 1; fillChapters(); fillVerses(); saveLastStudy(); log('book change', state.book); });
    chapterSelect?.addEventListener('change', () => { state.chapter = parseInt(chapterSelect.value,10)||1; fillVerses(); saveLastStudy(); log('chapter change', state.chapter); });
    verseSelect?.addEventListener('change', () => { state.verse = parseInt(verseSelect.value,10)||1; saveLastStudy(); });
    versionSelect?.addEventListener('change', () => { state.version = versionSelect.value; });

    // Recherche rapide (Enter)
    searchRef?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applySearch(); });

    restoreLastStudy();

    updateHeader();
    renderSection(0); // Rubrique 0 visible dès le départ (contenu par défaut)

    log('init done');
  }

  /* ===== Densité ===== */
  function injectDensitySelector() {
    const controls = document.querySelector('.controls');
    if (!controls) { log('controls missing'); return; }

    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '8px';

    const label = document.createElement('label');
    label.textContent = 'Densité';
    label.style.fontSize = '13px';
    label.style.color = '#64748b';

    const sel = document.createElement('select');
    sel.id = 'densitySelect';
    sel.title = 'Densité par rubrique';
    sel.style.border = '1px solid var(--border)';
    sel.style.borderRadius = '10px';
    sel.style.padding = '10px 12px';
    sel.style.minHeight = '42px';
    sel.innerHTML = `
      <option value="500">500 caractères</option>
      <option value="1500">1500 caractères</option>
      <option value="2500">2500 caractères</option>
    `;

    // Restore/persist
    const saved = localStorage.getItem(STORAGE_DENS);
    if (saved && ['500','1500','2500'].includes(saved)) {
      sel.value = saved;
      state.density = parseInt(saved,10);
    } else {
      sel.value = String(state.density);
    }

    sel.addEventListener('change', () => {
      state.density = parseInt(sel.value,10);
      localStorage.setItem(STORAGE_DENS, String(state.density));
      log('density change', state.density);
    });

    wrap.appendChild(label);
    wrap.appendChild(sel);

    // Insertion juste avant "Lire la Bible"
    if (readBtn && readBtn.parentElement === controls) {
      controls.insertBefore(wrap, readBtn);
    } else {
      controls.appendChild(wrap);
    }

    log('density selector injected');
  }

  /* ===== Liste Rubrique 0 + 28 ===== */
  function renderPointsList() {
    pointsList.innerHTML = '';

    pointsList.appendChild(renderItem({ idx: 0, title: TITLE0, desc: 'Aperçu du chapitre verset par verset' }));
    for (let i=1;i<=28;i++){
      pointsList.appendChild(renderItem({ idx:i, title:TITLES[i]||`Point ${i}`, desc:'' }));
    }
    highlightActive();
    log('points rendered');
  }

  function renderItem({ idx, title, desc }) {
    const li = document.createElement('div');
    li.className = 'item'; li.dataset.idx = String(idx);

    const idxEl = document.createElement('div');
    idxEl.className = 'idx'; idxEl.textContent = String(idx);

    const txt = document.createElement('div');
    txt.style.textAlign = 'left';
    txt.innerHTML = `<div>${escapeHtml(title)}</div>${desc?`<span class="desc">${escapeHtml(desc)}</span>`:''}`;

    const dot = document.createElement('div');
    dot.className = 'dot ' + ((state.leds.get(idx) === 'ok') ? 'ok' : '');

    li.appendChild(idxEl); li.appendChild(txt); li.appendChild(dot);
    li.addEventListener('click', () => goTo(idx));
    return li;
  }

  function highlightActive(){ $$('#pointsList .item').forEach(d=>d.classList.toggle('active', Number(d.dataset.idx)===state.currentIdx)); }
  function goTo(idx){ if(idx<0) idx=0; if(idx>28) idx=28; state.currentIdx=idx; updateHeader(); renderSection(idx); highlightActive(); }
  function updateHeader(){ const t = state.currentIdx===0 ? TITLE0 : (TITLES[state.currentIdx]||`Point ${state.currentIdx}`); edTitle.textContent = t; metaInfo.textContent = `Point ${state.currentIdx} / 28`; }

  /* ===== Génération ===== */
  async function onGenerate() {
    const old = generateBtn.textContent;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Génération…';
    log('generate start', { book: state.book, chapter: state.chapter, density: state.density });

    try {
      const q = new URLSearchParams({ book: state.book, chapter: String(state.chapter), length: String(state.density) }).toString();
      const r = await fetch(`/api/generate-study?${q}`);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();

      state.sectionsByN.clear();
      if (Array.isArray(j.sections)) {
        for (const s of j.sections) state.sectionsByN.set(Number(s.n), String(s.content || '').trim());
      }

      // leds → vert
      for (const n of state.sectionsByN.keys()) state.leds.set(n, 'ok');

      renderPointsList();
      renderSection(state.currentIdx);
      saveLastStudy();

      log('generate done', { received: Array.from(state.sectionsByN.keys()) });
    } catch (e) {
      console.error(e);
      log('generate error', String(e));
      alert('La génération a échoué. Vérifie l’API et réessaie.');
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = old;
    }
  }

  /* ===== Rendu section ===== */
  function renderSection(n) {
    const md = state.sectionsByN.get(n) || defaultContent(n);
    const html = mdToHtml(md);
    const htmlWithLinks = linkifyScripture(html, state.version);
    noteView.innerHTML = htmlWithLinks;

    // Liens détectés (panel)
    const refs = extractRefsFromHtml(htmlWithLinks);
    if (refs.length) {
      linksPanel.classList.remove('empty');
      linksList.innerHTML = refs.map(r => {
        const url = bibleGatewayURLFromLabel(r.label, state.version);
        return `<div><a href="${url}" target="_blank" rel="noopener">${escapeHtml(r.label)}</a></div>`;
      }).join('');
    } else { linksPanel.classList.add('empty'); linksList.innerHTML = ''; }
  }

  function defaultContent(n) {
    if (n===0) return `### Rubrique 0 — Panorama des versets du chapitre\n\n*Référence :* ${state.book} ${state.chapter}\n\nClique sur **Générer** pour charger chaque verset avec une explication claire.`;
    const t = TITLES[n] || `Point ${n}`;
    return `### ${t}\n\n*Référence :* ${state.book} ${state.chapter}\n\nÀ générer…`;
  }

  /* ===== BibleGateway ===== */
  function openBibleGatewayFromSelectors() {
    const url = bibleGatewayURL(state.book, state.chapter, null, state.version);
    window.open(url, '_blank', 'noopener');
  }
  function bibleGatewayURL(book, chapter, verses, version) {
    const v = BG_VERSION[version] || 'LSG';
    const query = verses ? `${book} ${chapter}:${verses}` : `${book} ${chapter}`;
    const u = new URL('https://www.biblegateway.com/passage/');
    u.searchParams.set('search', query);
    u.searchParams.set('version', v);
    return u.toString();
  }
  function bibleGatewayURLFromLabel(label, version){
    const v = BG_VERSION[version] || 'LSG';
    const u = new URL('https://www.biblegateway.com/passage/');
    u.searchParams.set('search', label);
    u.searchParams.set('version', v);
    return u.toString();
  }

  /* ===== Recherche rapide ===== */
  function applySearch() {
    const raw = (searchRef.value || '').trim();
    if (!raw) return;
    const m = /^([\p{L}\d\s]+?)\s+(\d+)(?::(\d+(?:-\\d+)?))?$/u.exec(raw);
    if (m) {
      const bookName = normalizeBook(m[1]);
      const chap = parseInt(m[2], 10);
      const vers = m[3] || null;
      const found = findBook(bookName);
      if (found) {
        state.book = found;
        state.chapter = clamp(chap, 1, CHAPTERS_66[found]);
        state.verse = vers ? parseInt(vers.split('-')[0], 10) : 1;
        bookSelect.value = state.book; fillChapters();
        chapterSelect.value = String(state.chapter); fillVerses();
        if (vers) verseSelect.value = String(state.verse);
        saveLastStudy();
        return;
      }
    }
    const bn = normalizeBook(raw); const fb = findBook(bn);
    if (fb) {
      state.book = fb; state.chapter = 1; state.verse = 1;
      bookSelect.value = state.book; fillChapters(); fillVerses(); saveLastStudy();
    }
  }
  function normalizeBook(s){ return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase(); }
  function findBook(normName){
    for (const b of ORDER_66){ const n=normalizeBook(b); if(n===normName||n.startsWith(normName)||normName.startsWith(n)) return b; }
    return null;
  }

  /* ===== Sélecteurs ===== */
  function fillBooks(){
    if (!bookSelect) return;
    bookSelect.innerHTML = ORDER_66.map(b=>`<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
    bookSelect.value = state.book;
  }
  function fillChapters(){
    if (!chapterSelect) return;
    const max = CHAPTERS_66[state.book] || 1;
    chapterSelect.innerHTML = '';
    for(let i=1;i<=max;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); chapterSelect.appendChild(o); }
    if (state.chapter>max) state.chapter=max;
    chapterSelect.value = String(state.chapter);
  }
  function fillVerses(){
    if (!verseSelect) return;
    verseSelect.innerHTML = '';
    for(let i=1;i<=150;i++){ const o=document.createElement('option'); o.value=String(i); o.textContent=String(i); verseSelect.appendChild(o); }
    verseSelect.value = String(state.verse);
  }

  /* ===== Persistance ===== */
  function saveLastStudy(){
    const payload = { book: state.book, chapter: state.chapter, verse: state.verse, version: state.version, density: state.density };
    localStorage.setItem(STORAGE_LAST, JSON.stringify(payload));
  }
  function restoreLastStudy(){
    try{
      const raw = localStorage.getItem(STORAGE_LAST); if(!raw) return;
      const j = JSON.parse(raw);
      if (j && CHAPTERS_66[j.book]) {
        state.book=j.book; state.chapter=clamp(parseInt(j.chapter,10)||1,1,CHAPTERS_66[j.book]);
        state.verse=parseInt(j.verse,10)||1; state.version=j.version||'LSG';
        if (typeof j.density==='number') state.density=j.density;
        if (bookSelect) bookSelect.value=state.book; if (chapterSelect){ fillChapters(); chapterSelect.value=String(state.chapter); } if (verseSelect){ fillVerses(); verseSelect.value=String(state.verse); }
        if (versionSelect) versionSelect.value=state.version;
      }
    }catch{}
  }

  /* ===== Mini Markdown ===== */
  function mdToHtml(md){
    let h = String(md||'');
    h = h.replace(/^### (.*)$/gm,'<h3>$1</h3>')
         .replace(/^## (.*)$/gm,'<h2>$1</h2>')
         .replace(/^# (.*)$/gm,'<h1>$1</h1>');
    h = h.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
         .replace(/\*(.+?)\*/g,'<em>$1</em>');
    h = h.replace(/^\s*-\s+(.*)$/gm,'<li>$1</li>')
         .replace(/(<li>.*<\/li>)(?!\s*<li>)/gs,'<ul>$1</ul>');
    h = h.split(/\n{2,}/).map(block=>{
      if(/^<h\d|^<ul|^<li|^<p|^<blockquote/.test(block.trim())) return block;
      const withBr = block.replace(/\n/g,'<br/>');
      return `<p>${withBr}</p>`;
    }).join('\n');
    return h;
  }

  function linkifyScripture(html, version){
    const booksRe = ORDER_66.slice().sort((a,b)=>b.length-a.length).map(escapeReg).join('|');
    const re = new RegExp(`\\b(${booksRe})\\s+(\\d+)(?::(\\d+(?:-\\d+)?))?\\b`,'g');
    return html.replace(re,(m,b,c,v)=>{
      const u = bibleGatewayURL(b,c,v||null,version);
      const label = v ? `${b} ${c}:${v}` : `${b} ${c}`;
      return `<a href="${u}" target="_blank" rel="noopener">${label}</a>`;
    });
  }
  function extractRefsFromHtml(html){
    const out=[]; const div=document.createElement('div'); div.innerHTML=html;
    const as=div.querySelectorAll('a[href*="biblegateway.com/passage/"]');
    as.forEach(a=> out.push({ label:a.textContent }) );
    return out;
  }

  // Utils
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,(c)=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}
  function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
  function escapeReg(s){return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

})();

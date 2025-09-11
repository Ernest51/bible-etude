/* app.js — UI complète
   - Recherche + Valider (aliases FR)
   - Sélecteurs Livre/Chapitre/Verset (66 livres, chapitres bloqués)
   - Palette 12 couleurs (thème global, persisté)
   - Bouton Bible (YouVersion LSG)
   - Rubriques 1..28 : affichage “beau”, liens versets bleus + soulignés, suppression des doublons de titre
   - Rubrique 0 : ÉTUDE VERSET PAR VERSET (dynamique)
       * suit toujours state.book/state.chapter
       * par verset : TEXTE du verset (via /api/verses si dispo) puis EXPLICATION en dessous
       * aucun lien avec la génération 1..28
*/

(function () {
  /* ====== Livres / Codes / Alias ====== */
  const CHAPTERS_66 = {"Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,"1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22};

  // Codes YouVersion (LSG) / USFM
  const YV_BOOK = {"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
  const YV_VERSION_ID = { LSG:'93' };

  // Alias de recherche (FR, sans accents, variantes)
  const ALIASES = {"gen":"Genèse","genese":"Genèse","ge":"Genèse","exo":"Exode","exode":"Exode","ex":"Exode","lev":"Lévitique","levitique":"Lévitique","lv":"Lévitique","nbr":"Nombres","nombres":"Nombres","nb":"Nombres","deu":"Deutéronome","deuteronome":"Deutéronome","dt":"Deutéronome","josue":"Josué","jos":"Josué","juges":"Juges","jg":"Juges","ruth":"Ruth","rut":"Ruth","1samuel":"1 Samuel","1sa":"1 Samuel","1sam":"1 Samuel","2samuel":"2 Samuel","2sa":"2 Samuel","2sam":"2 Samuel","1rois":"1 Rois","1r":"1 Rois","2rois":"2 Rois","2r":"2 Rois","1chroniques":"1 Chroniques","1ch":"1 Chroniques","2chroniques":"2 Chroniques","2ch":"2 Chroniques","esdras":"Esdras","esd":"Esdras","nehemie":"Néhémie","neh":"Néhémie","esther":"Esther","est":"Esther","job":"Job","jb":"Job","psaumes":"Psaumes","psaume":"Psaumes","ps":"Psaumes","proverbes":"Proverbes","prov":"Proverbes","pr":"Proverbes","ecclesiaste":"Ecclésiaste","qohelet":"Ecclésiaste","ecc":"Ecclésiaste","cantique":"Cantique des Cantiques","cantiquedescantiques":"Cantique des Cantiques","ct":"Cantique des Cantiques","esaie":"Ésaïe","esaïe":"Ésaïe","esa":"Ésaïe","jeremie":"Jérémie","jer":"Jérémie","lamentations":"Lamentations","lam":"Lamentations","ezekiel":"Ézéchiel","ezechiel":"Ézéchiel","ez":"Ézéchiel","daniel":"Daniel","dan":"Daniel","osee":"Osée","hos":"Osée","joel":"Joël","joe":"Joël","amos":"Amos","amo":"Amos","abdias":"Abdias","abd":"Abdias","jonas":"Jonas","jon":"Jonas","michee":"Michée","mic":"Michée","nahum":"Nahum","nah":"Nahum","habacuc":"Habacuc","hab":"Habacuc","sophonie":"Sophonie","sop":"Sophonie","zep":"Sophonie","aggee":"Aggée","agg":"Aggée","zacharie":"Zacharie","zac":"Zacharie","zec":"Zacharie","malachie":"Malachie","mal":"Malachie","matthieu":"Matthieu","mt":"Matthieu","marc":"Marc","mc":"Marc","luc":"Luc","lc":"Luc","jean":"Jean","jn":"Jean","actes":"Actes","ac":"Actes","romains":"Romains","rom":"Romains","ro":"Romains","1corinthiens":"1 Corinthiens","1co":"1 Corinthiens","2corinthiens":"2 Corinthiens","2co":"2 Corinthiens","galates":"Galates","ga":"Galates","ephesiens":"Éphésiens","eph":"Éphésiens","philippiens":"Philippiens","php":"Philippiens","ph":"Philippiens","colossiens":"Colossiens","col":"Colossiens","1thessaloniciens":"1 Thessaloniciens","1th":"1 Thessaloniciens","2thessaloniciens":"2 Thessaloniciens","2th":"2 Thessaloniciens","1timothee":"1 Timothée","1ti":"1 Timothée","2timothee":"2 Timothée","2ti":"2 Timothée","tite":"Tite","tit":"Tite","philemon":"Philémon","phm":"Philémon","hebreux":"Hébreux","heb":"Hébreux","jacques":"Jacques","jac":"Jacques","ja":"Jacques","1pierre":"1 Pierre","1pi":"1 Pierre","1pe":"1 Pierre","2pierre":"2 Pierre","2pi":"2 Pierre","2pe":"2 Pierre","1jean":"1 Jean","1jn":"1 Jean","2jean":"2 Jean","2jn":"2 Jean","3jean":"3 Jean","3jn":"3 Jean","jude":"Jude","jud":"Jude","apocalypse":"Apocalypse","apo":"Apocalypse","apoc":"Apocalypse","ap":"Apocalypse"};

  /* ====== Utils ====== */
  const $ = (s) => document.querySelector(s);
  const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
  const strip = (s)=>String(s||'').trim();
  const normalize = (s)=>strip(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,'');
  const digits = (s)=> (s||'').replace(/[^\d]/g,'');
  const store = { get:k=>{ try{return JSON.parse(localStorage.getItem(k)||'null');}catch{return null;} }, set:(k,v)=>{ try{localStorage.setItem(k,JSON.stringify(v));}catch{} } };

  /* ====== State ====== */
  const state = {
    book: 'Genèse',
    chapter: 1,
    verse: '',
    density: 1500,
    sections: [{ id:0, title:'Rubrique 0', description:'étude verset par verset', content:'' }]
      .concat(Array.from({ length: 28 }, (_, i) => ({ id:i+1, title:`Rubrique ${i+1}`, description:'', content:'' }))),
    current: 1
  };

  /* ====== DOM ====== */
  let listEl, edTitle, edMeta, bookEl, chapEl, verseEl, densEl, genBtn, resetBtn, searchEl, validateBtn, bibleLink, paletteEl, sectionTitleEl, sectionDescEl, previewEl, pvWrap, pvCountEl, pvGrid, pvBtn;

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    listEl = $('#list'); edTitle=$('#edTitle'); edMeta=$('#edMeta');
    sectionTitleEl=$('#sectionTitle'); sectionDescEl=$('#sectionDesc'); previewEl=$('#preview');
    bookEl=$('#book'); chapEl=$('#chapter'); verseEl=$('#verse'); densEl=$('#density');
    genBtn=$('#btn-generate'); resetBtn=$('#btn-reset'); searchEl=$('#search');
    validateBtn=$('#btn-validate'); bibleLink=$('#btn-bible'); paletteEl=$('#palette');
    pvWrap = $('#pv'); pvCountEl = $('#pv-count'); pvGrid = $('#pv-grid'); pvBtn = $('#pv-generate');

    fillBooks(); fillChapters();

    // Palette: restaurer / init
    const saved = store.get('palette');
    if (saved && typeof saved.h==='number') {
      applyTheme(saved.h, saved.s||'84%', saved.l||'46%');
      paletteEl.querySelectorAll('.swatch').forEach(sw=>{
        if (Number(sw.dataset.h)===saved.h) sw.setAttribute('data-active','1'); else sw.removeAttribute('data-active');
      });
    } else {
      const def = paletteEl.querySelector('.swatch[data-active="1"]');
      if (def) applyTheme(Number(def.dataset.h), def.dataset.s, def.dataset.l);
    }

    /* ---- Listeners ---- */
    searchEl.addEventListener('keydown', (e)=>{ if (e.key==='Enter') { e.preventDefault(); onValidate(); } });
    validateBtn.addEventListener('click', onValidate);
    bibleLink.addEventListener('click', ()=> updateBibleHref());

    bookEl.addEventListener('change', ()=>{
      state.book = bookEl.value; state.chapter = 1; state.verse = '';
      fillChapters(); verseEl.value = ''; renderEditorMeta(); updateBibleHref();
      if (state.current===0) generatePerVerse(); // Rubrique 0 reste liée
    });
    chapEl.addEventListener('change', ()=>{
      const max = CHAPTERS_66[state.book] || 1;
      const n = parseInt(chapEl.value,10);
      state.chapter = Number.isFinite(n) ? clamp(n,1,max) : 1; renderEditorMeta(); updateBibleHref();
      if (state.current===0) generatePerVerse(); // Rubrique 0 reste liée
    });
    verseEl.addEventListener('input', ()=>{ state.verse = digits(verseEl.value); renderEditorMeta(); updateBibleHref(); });
    densEl.addEventListener('change', ()=>{ const v=parseInt(densEl.value,10); if([500,1500,2500].includes(v)) state.density=v; });

    genBtn.addEventListener('click', onGenerate);
    resetBtn.addEventListener('click', onReset);

    // Palette
    paletteEl.querySelectorAll('.swatch').forEach(sw=>{
      sw.addEventListener('click', ()=>{
        paletteEl.querySelectorAll('.swatch').forEach(x=>x.removeAttribute('data-active'));
        sw.setAttribute('data-active','1');
        const h = Number(sw.dataset.h), s = sw.dataset.s || '84%', l = sw.dataset.l || '46%';
        applyTheme(h, s, l); store.set('palette', { h, s, l });
      });
    });

    // Rubrique 0
    pvBtn.addEventListener('click', generatePerVerse);

    renderList(); renderEditor(); renderEditorMeta(); updateBibleHref();
  }

  /* ====== Recherche + Valider ====== */
  function onValidate(){
    const q = normalize(searchEl.value);
    if (!q) return;
    const m = /^([1-3]?\s*[a-z]+)(\d+)?(?::(\d+))?$/i.exec(q);
    if (!m) { autoSet('Genèse',1,''); return; }

    const rawBook = (m[1]||'').replace(/\s+/g,'');
    const rawChap = m[2] || '';
    const rawVerse= m[3] || '';

    const book = resolveBook(rawBook);
    if (!book) { autoSet('Genèse',1,''); return; }

    const max = CHAPTERS_66[book] || 1;
    const chap = rawChap ? clamp(parseInt(rawChap,10)||1, 1, max) : 1;
    const verse = rawVerse ? String(parseInt(rawVerse,10)||'') : '';

    autoSet(book, chap, verse);
    if (state.current===0) generatePerVerse(); // Rubrique 0 se met à jour
  }
  function resolveBook(key){
    if (ALIASES[key]) return ALIASES[key];
    for (const name of Object.keys(CHAPTERS_66)) {
      if (normalize(name).startsWith(key)) return name;
    }
    return null;
  }
  function autoSet(book, chap, verse){
    state.book = book; state.chapter = chap; state.verse = verse || '';
    bookEl.value = book; fillChapters(); chapEl.value = String(chap); verseEl.value = state.verse;
    renderEditorMeta(); updateBibleHref();
  }

  /* ====== YouVersion (LSG) ====== */
  function buildYouVersionHref(b=state.book, c=state.chapter, v=state.verse){
    const code = YV_BOOK[b] || 'GEN';
    const verId = YV_VERSION_ID['LSG'] || '93';
    const anchor = v ? ('#v'+v) : '';
    return `https://www.bible.com/fr/bible/${verId}/${code}.${c}.LSG${anchor}`;
  }
  function updateBibleHref(){
    const a = $('#btn-bible');
    if (a) a.href = buildYouVersionHref();
  }

  /* ====== Sélecteurs ====== */
  function fillBooks(){
    bookEl.innerHTML = '';
    for (const name of Object.keys(CHAPTERS_66)) {
      const o = document.createElement('option'); o.value = name; o.textContent = name;
      bookEl.appendChild(o);
    }
    bookEl.value = state.book;
  }
  function fillChapters(){
    const max = CHAPTERS_66[state.book] || 1;
    chapEl.innerHTML = '';
    for (let i=1;i<=max;i++){
      const o = document.createElement('option'); o.value = String(i); o.textContent = String(i);
      chapEl.appendChild(o);
    }
    chapEl.value = String(clamp(state.chapter,1,max));
  }

  /* ====== Liste rubriques & affichage ====== */
  function sectionById(id){ return state.sections.find(s=>s.id===id); }
  function renderList(){
    listEl.innerHTML = '';
    for (const s of state.sections) {
      const row = document.createElement('div'); row.className='item'; row.dataset.id=s.id;
      const idx = document.createElement('div'); idx.className='idx'; idx.textContent=String(s.id);
      const titleWrap = document.createElement('div'); titleWrap.style.display='flex'; titleWrap.style.flexDirection='column'; titleWrap.style.flex='1';
      const title = document.createElement('div'); title.className='title'; title.textContent=(s.id===0? 'Rubrique 0' : (s.title || `Rubrique ${s.id}`));
      titleWrap.appendChild(title);
      if (s.id===0) { const sub=document.createElement('div'); sub.className='subtitle'; sub.textContent='étude verset par verset'; titleWrap.appendChild(sub); }
      const dot = document.createElement('div'); dot.className='dot'+(s.content && s.content.trim() ? ' ok':'');
      row.appendChild(idx); row.appendChild(titleWrap); row.appendChild(dot);
      row.addEventListener('click', ()=>{ state.current=s.id; renderEditor(); highlightActive(); });
      listEl.appendChild(row);
    }
    highlightActive();
  }
  function highlightActive(){
    document.querySelectorAll('.item').forEach(el=>el.classList.toggle('active', Number(el.dataset.id)===state.current));
  }
  function renderEditor(){
    const s = sectionById(state.current);
    $('#edTitle').textContent = s ? (s.id===0 ? 'Rubrique 0 — Étude verset par verset' : (s.title || `Rubrique ${state.current}`)) : '—';

    if (s && s.id===0) {
      sectionTitleEl.style.display='none';
      sectionDescEl.style.display='none';
      previewEl.style.display='none';
      pvWrap.style.display='flex';
      if (!pvCountEl.value) pvCountEl.value = 31;
      generatePerVerse(); // toujours dynamique à l’ouverture
      renderEditorMeta();
      return;
    }

    // 1..28 — UNE zone preview
    pvWrap.style.display='none';
    sectionTitleEl.style.display='block';
    sectionDescEl.style.display='block';
    previewEl.style.display='block';

    sectionTitleEl.textContent = s ? (s.title || `Rubrique ${state.current}`) : '—';
    sectionDescEl.textContent  = s ? (s.description || '') : '';

    // Supprime le 1er titre pour rubriques 2..28, sinon dédoublonne s’il est identique
    const stripHeading = (state.current>=2 && state.current<=28);
    previewEl.innerHTML = beautifyContent(s?.content || '', (s?.title || `Rubrique ${state.current}`), { stripFirstHeading: stripHeading });

    renderEditorMeta();
  }
  function renderEditorMeta(){
    $('#edMeta').textContent = `Point ${state.current} — ${state.book} ${state.chapter}${state.verse? ':'+state.verse:''}`;
  }
  function updateDot(id){
    const row = listEl.querySelector(`.item[data-id="${id}"]`);
    if (!row) return;
    const dot = row.querySelector('.dot');
    const s = sectionById(id);
    if (s && s.content && s.content.trim()) dot.classList.add('ok'); else dot.classList.remove('ok');
  }

  /* ====== Rendu riche (beau + liens versets) + dédoublonnage titre ====== */
  function beautifyContent(raw, sectionTitle, opts={}){
    const norm = (x)=> String(x||'').trim().toLowerCase()
                     .normalize('NFD').replace(/\p{Diacritic}/gu,'')
                     .replace(/\s+/g,' ').replace(/[^\w\s-]/g,'').trim();

    let src = String(raw||'');

    if (opts.stripFirstHeading) {
      const mm = /^(#{1,6})\s*[^\n]+\s*\n?/m.exec(src);
      if (mm) src = src.slice(mm[0].length);
    } else {
      const m = /^(#{1,6})\s*([^\n]+)\s*\n?/m.exec(src);
      if (m && norm(m[2]) === norm(sectionTitle)) {
        src = src.slice(m[0].length);
      } else {
        const firstLine = (src.split('\n')[0]||'');
        if (norm(firstLine) === norm(sectionTitle)) {
          src = src.slice(firstLine.length).replace(/^\n+/, '');
        }
      }
    }

    // Échappe HTML
    let s = src.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

    // Markdown léger
    s = s.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>')
         .replace(/^##\s+(.*)$/gm, '<h2>$1</h2>')
         .replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
         .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    s = s.replace(/^\>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    s = s.replace(/^\s*---\s*$/gm, '<hr/>');
    s = s.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>')
         .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');
    s = s.replace(/(^|\n)\*?Référence\s*:\*/gi, '$1<span class="label">Référence :</span>');

    // Liens markdown
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_m, txt, href) => `<a href="${href}" target="_blank" rel="noopener" class="verse-link">${txt}</a>`);

    // Références bibliques → lien YouVersion
    s = s.replace(/\b(Genèse|Exode|Lévitique|Nombres|Deutéronome|Josué|Juges|Ruth|1 Samuel|2 Samuel|1 Rois|2 Rois|1 Chroniques|2 Chroniques|Esdras|Néhémie|Esther|Job|Psaumes|Proverbes|Ecclésiaste|Cantique des Cantiques|Ésaïe|Jérémie|Lamentations|Ézéchiel|Daniel|Osée|Joël|Amos|Abdias|Jonas|Michée|Nahum|Habacuc|Sophonie|Aggée|Zacharie|Malachie|Matthieu|Marc|Luc|Jean|Actes|Romains|1 Corinthiens|2 Corinthiens|Galates|Éphésiens|Philippiens|Colossiens|1 Thessaloniciens|2 Thessaloniciens|1 Timothée|2 Timothée|Tite|Philémon|Hébreux|Jacques|1 Pierre|2 Pierre|1 Jean|2 Jean|3 Jean|Jude|Apocalypse)\s+(\d+)(?::(\d+(?:[–-]\d+)?))?/g,
      (_m, book, chap, vv) => {
        const code = YV_BOOK[book] || 'GEN';
        const verId = YV_VERSION_ID['LSG'] || '93';
        const anchor = vv ? ('#v'+vv.replace(/[–-].*/,'') ) : '';
        const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.LSG${anchor}`;
        return `<a href="${url}" target="_blank" rel="noopener" class="verse-link">${book} ${chap}${vv?':'+vv:''}</a>`;
      });

    // Paragraphes
    s = s.split(/\n{2,}/).map(p => /<(h\d|ul|blockquote|hr)/.test(p.trim())
           ? p : `<p>${p.replace(/\n/g,'<br/>')}</p>`).join('\n');

    return s;
  }

  /* ====== API — génération 28 rubriques ====== */
  async function onGenerate(){
    const passage = `${state.book} ${state.chapter}`;
    const density = state.density;
    const btn = genBtn, old=btn.textContent; btn.disabled=true; btn.textContent='Génération…';
    try{
      const r = await fetch('/api/generate-study', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ passage, options:{ length: density } })
      });
      const data = await r.json();
      const sections = data?.study?.sections;
      if (!Array.isArray(sections) || sections.length !== 28) throw new Error('sections.length != 28');
      const head = state.sections[0];
      state.sections = [head].concat(sections.map((s,i)=>({
        id:Number(s.id)||i+1,
        title:s.title||`Rubrique ${i+1}`,
        description:String(s.description||''),
        content:String(s.content||'')
      })));
      renderList();
      if (state.current===0) state.current = 1;
      renderEditor();
      try { localStorage.setItem('Dernière étude', JSON.stringify({ passage, density, ts: new Date().toISOString() })); } catch {}
    } catch (e){
      alert('Erreur : ' + e.message);
    } finally {
      btn.disabled=false; btn.textContent=old;
    }
  }

  function onReset(){
    const head = state.sections[0];
    state.sections = [head].concat(state.sections.slice(1).map(s=>({ ...s, content:'' })));
    document.querySelectorAll('.dot').forEach(d=>d.classList.remove('ok'));

    $('#search').value = '';
    bookEl.value = 'Genèse'; state.book='Genèse';
    fillChapters(); chapEl.value='1'; state.chapter=1;
    verseEl.value=''; state.verse='';
    densEl.value='1500'; state.density=1500;

    pvGrid.innerHTML = '';
    pvCountEl.value = 31;

    state.current=1;
    renderList(); renderEditor(); updateBibleHref();
  }

  /* ====== Rubrique 0 — DYNAMIQUE : verset PUIS explication ====== */
  async function generatePerVerse(){
    const book = state.book;
    const chapter = state.chapter;

    // combien de versets afficher (contrôle utilisateur)
    const nWant = clamp(parseInt(pvCountEl.value,10)||31, 1, 200);

    pvGrid.innerHTML = '';
    const loading = document.createElement('div');
    loading.textContent = 'Chargement des versets…';
    loading.style.color = '#64748b';
    pvGrid.appendChild(loading);

    let verses = [];
    try{
      const url = `/api/verses?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}`;
      const r = await fetch(url);
      const data = await r.json();
      if (Array.isArray(data?.verses) && data.verses.length) {
        verses = data.verses;
      }
      if (!verses.length) {
        for (let v=1; v<=nWant; v++) verses.push({ v, text: '' });
      }
    } catch(e){
      for (let v=1; v<=nWant; v++) verses.push({ v, text: '' });
    }

    pvGrid.innerHTML = '';
    for (const { v, text } of verses.slice(0, nWant)) {
      const url = buildYouVersionHref(book, chapter, v);

      const item = document.createElement('div');
      item.className = 'pv-item';

      // En-tête : référence + lien YV
      const head = document.createElement('div');
      head.className = 'vhead';

      const title = document.createElement('div');
      title.className = 'vtitle';
      title.textContent = `${book} ${chapter}:${v}`;
      head.appendChild(title);

      const link = document.createElement('a');
      link.href = url; link.target = '_blank'; link.rel = 'noopener';
      link.className = 'verse-link';
      link.textContent = 'Ouvrir sur YouVersion';
      head.appendChild(link);

      // 1) TEXTE DU VERSET (en premier)
      const vtext = document.createElement('div');
      vtext.className = 'vbody';
      vtext.style.marginTop = '6px';
      vtext.style.fontWeight = '600';
      vtext.textContent = (text && text.trim()) ? text.trim() : '— (texte indisponible ici, voir YouVersion)';

      // 2) EXPLICATION (juste en dessous)
      const body = document.createElement('div');
      body.className = 'vbody';
      body.style.marginTop = '6px';
      body.innerHTML = [
        `<strong>Observation</strong> — Note le mouvement du texte et les mots-clés.`,
        `<strong>Contexte</strong> — Situe ce verset dans ${book} ${chapter}.`,
        `<strong>Doctrine</strong> — Quelle vérité sur Dieu ou l’humain ressort ?`,
        `<strong>Lien canonique</strong> — Où retrouve-t-on ce thème ailleurs ?`,
        `<strong>Application</strong> — Une réponse concrète aujourd’hui.`
      ].join(' ');

      item.appendChild(head);
      item.appendChild(vtext);
      item.appendChild(body);
      pvGrid.appendChild(item);
    }
  }

  /* ====== Thème (palette) ====== */
  function applyTheme(h, s='84%', l='46%'){
    const root = document.documentElement.style;
    root.setProperty('--primary-h', String(h));
    root.setProperty('--primary-s', String(s));
    root.setProperty('--primary-l', String(l));
    root.setProperty('--bg', `hsl(${h} 60% 97%)`);
    root.setProperty('--panel', `#ffffff`);
    root.setProperty('--panel-2', `hsl(${h} 55% 96%)`);
    root.setProperty('--border', `hsl(${h} 30% 86%)`);
    root.setProperty('--active', `hsl(${h} 100% 90%)`);
    root.setProperty('--hover', `hsl(${h} 90% 95%)`);
  }
})();

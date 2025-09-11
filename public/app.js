/* app.js — recherche + Valider + Bible (YouVersion) + palette 12 couleurs + 66 livres */
(function () {
  /* ====== Config Livres & YV ====== */
  const CHAPTERS_66 = {
    "Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,
    "1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,"Néhémie":13,"Esther":10,
    "Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,"Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,
    "Osée":14,"Joël":3,"Amos":9,"Abdias":1,"Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,
    "Matthieu":28,"Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,"Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,"2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,"2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22
  };
  const YV_BOOK = {
    "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
    "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST",
    "Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
    "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL",
    "Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
  };
  const YV_VERSION_ID = { LSG:'93' };

  /* ====== Alias Recherche ====== */
  const ALIASES = {
    "gen":"Genèse","genese":"Genèse","ge":"Genèse",
    "exo":"Exode","exode":"Exode","ex":"Exode",
    "lev":"Lévitique","levitique":"Lévitique","lv":"Lévitique",
    "nbr":"Nombres","nombres":"Nombres","nb":"Nombres",
    "deu":"Deutéronome","deuteronome":"Deutéronome","dt":"Deutéronome",
    "josue":"Josué","jos":"Josué",
    "juges":"Juges","jg":"Juges",
    "ruth":"Ruth","rut":"Ruth",
    "1samuel":"1 Samuel","1sa":"1 Samuel","1sam":"1 Samuel",
    "2samuel":"2 Samuel","2sa":"2 Samuel","2sam":"2 Samuel",
    "1rois":"1 Rois","1r":"1 Rois",
    "2rois":"2 Rois","2r":"2 Rois",
    "1chroniques":"1 Chroniques","1ch":"1 Chroniques",
    "2chroniques":"2 Chroniques","2ch":"2 Chroniques",
    "esdras":"Esdras","esd":"Esdras",
    "nehemie":"Néhémie","neh":"Néhémie",
    "esther":"Esther","est":"Esther",
    "job":"Job","jb":"Job",
    "psaumes":"Psaumes","psaume":"Psaumes","ps":"Psaumes",
    "proverbes":"Proverbes","prov":"Proverbes","pr":"Proverbes",
    "ecclesiaste":"Ecclésiaste","qohelet":"Ecclésiaste","ecc":"Ecclésiaste",
    "cantique":"Cantique des Cantiques","cantiquedescantiques":"Cantique des Cantiques","ct":"Cantique des Cantiques",
    "esaie":"Ésaïe","esaïe":"Ésaïe","esa":"Ésaïe",
    "jeremie":"Jérémie","jer":"Jérémie",
    "lamentations":"Lamentations","lam":"Lamentations",
    "ezekiel":"Ézéchiel","ezechiel":"Ézéchiel","ez":"Ézéchiel",
    "daniel":"Daniel","dan":"Daniel",
    "osee":"Osée","hos":"Osée",
    "joel":"Joël","joe":"Joël",
    "amos":"Amos","amo":"Amos",
    "abdias":"Abdias","abd":"Abdias",
    "jonas":"Jonas","jon":"Jonas",
    "michee":"Michée","mic":"Michée",
    "nahum":"Nahum","nah":"Nahum",
    "habacuc":"Habacuc","hab":"Habacuc",
    "sophonie":"Sophonie","sop":"Sophonie","zep":"Sophonie",
    "aggee":"Aggée","agg":"Aggée",
    "zacharie":"Zacharie","zac":"Zacharie","zec":"Zacharie",
    "malachie":"Malachie","mal":"Malachie",
    "matthieu":"Matthieu","mt":"Matthieu",
    "marc":"Marc","mc":"Marc",
    "luc":"Luc","lc":"Luc",
    "jean":"Jean","jn":"Jean",
    "actes":"Actes","ac":"Actes",
    "romains":"Romains","rom":"Romains","ro":"Romains",
    "1corinthiens":"1 Corinthiens","1co":"1 Corinthiens",
    "2corinthiens":"2 Corinthiens","2co":"2 Corinthiens",
    "galates":"Galates","ga":"Galates",
    "ephesiens":"Éphésiens","eph":"Éphésiens",
    "philippiens":"Philippiens","php":"Philippiens","ph":"Philippiens",
    "colossiens":"Colossiens","col":"Colossiens",
    "1thessaloniciens":"1 Thessaloniciens","1th":"1 Thessaloniciens",
    "2thessaloniciens":"2 Thessaloniciens","2th":"2 Thessaloniciens",
    "1timothee":"1 Timothée","1ti":"1 Timothée",
    "2timothee":"2 Timothée","2ti":"2 Timothée",
    "tite":"Tite","tit":"Tite",
    "philemon":"Philémon","phm":"Philémon",
    "hebreux":"Hébreux","heb":"Hébreux",
    "jacques":"Jacques","jac":"Jacques","ja":"Jacques",
    "1pierre":"1 Pierre","1pi":"1 Pierre","1pe":"1 Pierre",
    "2pierre":"2 Pierre","2pi":"2 Pierre","2pe":"2 Pierre",
    "1jean":"1 Jean","1jn":"1 Jean",
    "2jean":"2 Jean","2jn":"2 Jean",
    "3jean":"3 Jean","3jn":"3 Jean",
    "jude":"Jude","jud":"Jude",
    "apocalypse":"Apocalypse","apo":"Apocalypse","apoc":"Apocalypse","ap":"Apocalypse"
  };

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
    sections: Array.from({ length: 28 }, (_, i) => ({ id:i+1, title:`Rubrique ${i+1}`, content:'' })),
    current: 1
  };

  /* ====== DOM ====== */
  let listEl, edTitle, edMeta, editor, bookEl, chapEl, verseEl, densEl, genBtn, resetBtn, searchEl, validateBtn, bibleBtn, paletteEl;

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    listEl = $('#list'); edTitle=$('#edTitle'); edMeta=$('#edMeta'); editor=$('#editor');
    bookEl=$('#book'); chapEl=$('#chapter'); verseEl=$('#verse'); densEl=$('#density');
    genBtn=$('#btn-generate'); resetBtn=$('#btn-reset'); searchEl=$('#search');
    validateBtn=$('#btn-validate'); bibleBtn=$('#btn-bible'); paletteEl=$('#palette');

    fillBooks(); fillChapters();

    // Restaure couleur
    const saved = store.get('palette');
    if (saved && typeof saved.h==='number') applyTheme(saved.h, saved.s||'84%', saved.l||'46%');

    /* ---- Listeners ---- */
    searchEl.addEventListener('keydown', (e)=>{ if (e.key==='Enter') { e.preventDefault(); onValidate(); } });
    validateBtn.addEventListener('click', onValidate);
    bibleBtn.addEventListener('click', openYouVersion);

    bookEl.addEventListener('change', ()=>{
      state.book = bookEl.value; state.chapter = 1; state.verse = '';
      fillChapters(); verseEl.value = ''; renderEditorMeta();
    });

    chapEl.addEventListener('change', ()=>{
      const max = CHAPTERS_66[state.book] || 1;
      const n = parseInt(chapEl.value,10);
      state.chapter = Number.isFinite(n) ? clamp(n,1,max) : 1; renderEditorMeta();
    });

    verseEl.addEventListener('input', ()=>{ state.verse = digits(verseEl.value); renderEditorMeta(); });
    densEl.addEventListener('change', ()=>{ const v=parseInt(densEl.value,10); if([500,1500,2500].includes(v)) state.density=v; });

    genBtn.addEventListener('click', onGenerate);
    resetBtn.addEventListener('click', onReset);
    editor.addEventListener('input', ()=>{
      const s = sectionById(state.current); if (!s) return;
      s.content = editor.value; updateDot(state.current);
    });

    // Palette
    paletteEl.querySelectorAll('.swatch').forEach(sw=>{
      sw.addEventListener('click', ()=>{
        paletteEl.querySelectorAll('.swatch').forEach(x=>x.removeAttribute('data-active'));
        sw.setAttribute('data-active','1');
        const h = Number(sw.dataset.h), s = sw.dataset.s || '84%', l = sw.dataset.l || '46%';
        applyTheme(h, s, l);
        store.set('palette', { h, s, l });
      });
    });

    renderList(); renderEditor(); renderEditorMeta();
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
    renderEditorMeta();
  }

  /* ====== YouVersion ====== */
  function openYouVersion(){
    const code = YV_BOOK[state.book] || 'GEN';
    const verId = YV_VERSION_ID['LSG'] || '93';
    const chap = state.chapter || 1;
    const url = `https://www.bible.com/fr/bible/${verId}/${code}.${chap}.LSG${state.verse? ('#v'+state.verse):''}`;
    window.open(url, '_blank', 'noopener');
  }

  /* ====== Sélecteurs Livre/Chapitre ====== */
  function fillBooks(){
    bookEl.innerHTML = '';
    for (const name of Object.keys(CHAPTERS_66)) {
      const o = document.createElement('option');
      o.value = name; o.textContent = name;
      bookEl.appendChild(o);
    }
    bookEl.value = state.book;
  }
  function fillChapters(){
    const max = CHAPTERS_66[state.book] || 1;
    chapEl.innerHTML = '';
    for (let i=1;i<=max;i++){
      const o = document.createElement('option');
      o.value = String(i); o.textContent = String(i);
      chapEl.appendChild(o);
    }
    chapEl.value = String(clamp(state.chapter,1,max));
  }

  /* ====== Liste & éditeur ====== */
  function sectionById(id){ return state.sections.find(s=>s.id===id); }
  function renderList(){
    listEl.innerHTML = '';
    for (const s of state.sections) {
      const row = document.createElement('div'); row.className='item'; row.dataset.id=s.id;
      const idx = document.createElement('div'); idx.className='idx'; idx.textContent=String(s.id);
      const title = document.createElement('div'); title.className='title'; title.textContent=s.title || `Rubrique ${s.id}`;
      const dot = document.createElement('div'); dot.className='dot'+(s.content && s.content.trim() ? ' ok':'');
      row.appendChild(idx); row.appendChild(title); row.appendChild(dot);
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
    $('#edTitle').textContent = s ? (s.title || `Rubrique ${state.current}`) : '—';
    $('#editor').value = s ? (s.content || '') : '';
    renderEditorMeta();
  }
  function renderEditorMeta(){
    $('#edMeta').textContent = `Point ${state.current} / 28 — ${state.book} ${state.chapter}${state.verse? ':'+state.verse:''}`;
  }
  function updateDot(id){
    const row = listEl.querySelector(`.item[data-id="${id}"]`);
    if (!row) return;
    const dot = row.querySelector('.dot');
    const s = sectionById(id);
    if (s && s.content && s.content.trim()) dot.classList.add('ok'); else dot.classList.remove('ok');
  }

  /* ====== API ====== */
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
      state.sections = sections.map((s,i)=>({ id:Number(s.id)||i+1, title:s.title||`Rubrique ${i+1}`, content:String(s.content||'') }));
      renderList(); renderEditor();
      try { localStorage.setItem('Dernière étude', JSON.stringify({ passage, density, ts: new Date().toISOString() })); } catch {}
    } catch (e){
      alert('Erreur : ' + e.message);
    } finally {
      btn.disabled=false; btn.textContent=old;
    }
  }

  function onReset(){
    // diodes → orange, champs remis, “Dernière étude” conservée
    state.sections = state.sections.map(s=>({ ...s, content:'' }));
    document.querySelectorAll('.dot').forEach(d=>d.classList.remove('ok'));

    searchEl.value = '';
    bookEl.value = 'Genèse'; state.book='Genèse';
    fillChapters(); chapEl.value='1'; state.chapter=1;
    verseEl.value=''; state.verse='';
    densEl.value='1500'; state.density=1500;

    state.current=1;
    renderList(); renderEditor();
  }

  /* ====== Thème (palette) ====== */
  function applyTheme(h, s='84%', l='46%'){
    const root = document.documentElement.style;
    root.setProperty('--primary-h', String(h));
    root.setProperty('--primary-s', String(s));
    root.setProperty('--primary-l', String(l));
    // Ajuste les surfaces et bordures selon la teinte
    root.setProperty('--bg', `hsl(${h} 60% 97%)`);
    root.setProperty('--panel-2', `hsl(${h} 55% 96%)`);
    root.setProperty('--border', `hsl(${h} 30% 86%)`);
    root.setProperty('--active', `hsl(${h} 100% 90%)`);
    root.setProperty('--hover', `hsl(${h} 90% 95%)`);
  }
})();

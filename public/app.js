/* public/app.js
 * Client robuste pour lecture Bible + génération Étude 28 points via /api/study-28
 * - Délégation de clics sur la liste (fiable après réinjections)
 * - Pas de sélecteurs CSS exotiques
 * - Sauvegarde/restauration locales
 */
(function () {
  'use strict';

  const LOGP = '[APP]';
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => Array.from(r.querySelectorAll(s));
  const log = (...a) => appendDebug(a.map(String).join(' '));

  const els = {
    searchRef:  $('#searchRef'),
    book:       $('#bookSelect'),
    chapter:    $('#chapterSelect'),
    verse:      $('#verseSelect'),
    version:    $('#versionSelect'),
    theme:      $('#themeSelect'),
    enrich:     $('#enrichToggle'),
    readBtn:    $('#readBtn'),
    validate:   $('#validate'),
    genBtn:     $('#generateBtn'),
    pointsList: $('#pointsList'),
    edTitle:    $('#edTitle'),
    noteArea:   $('#noteArea'),
    noteView:   $('#noteView'),
    linksPanel: $('#linksPanel'),
    linksList:  $('#linksList'),
    prev:       $('#prev'),
    next:       $('#next'),
    metaInfo:   $('#metaInfo'),
    year:       $('#y'),
    dbgBtn:     $('#debugBtn'),
    dbgPanel:   $('#debugPanel'),
    progress:   $('#progressBar')
  };

  const BOOKS = [
    'Genèse','Exode','Lévitique','Nombres','Deutéronome','Josué','Juges','Ruth',
    '1 Samuel','2 Samuel','1 Rois','2 Rois','1 Chroniques','2 Chroniques','Esdras','Néhémie','Esther',
    'Job','Psaumes','Proverbes','Ecclésiaste','Cantique des cantiques','Ésaïe','Jérémie','Lamentations',
    'Ézéchiel','Daniel','Osée','Joël','Amos','Abdias','Jonas','Michée','Nahoum','Habacuc','Sophonie',
    'Aggée','Zacharie','Malachie','Matthieu','Marc','Luc','Jean','Actes','Romains',
    '1 Corinthiens','2 Corinthiens','Galates','Éphésiens','Philippiens','Colossiens',
    '1 Thessaloniciens','2 Thessaloniciens','1 Timothée','2 Timothée','Tite','Philémon','Hébreux','Jacques',
    '1 Pierre','2 Pierre','1 Jean','2 Jean','3 Jean','Jude','Apocalypse'
  ];

  // (facultatif) tes libellés favoris (si la payload ne contient pas déjà un title)
  const CUSTOM_TITLES = [
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
    "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
    "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
    "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
    "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
    "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
    "Application missionnaire","Application pastorale","Application personnelle",
    "Versets à retenir","Prière de fin","Ressources complémentaires"
  ];

  const state = {
    sections: [],
    current: -1,
    autosaveTimer: null,
    meta: null
  };

  // ---------- helpers ----------
  function appendDebug(t){
    const p = els.dbgPanel;
    if(!p) return;
    const time = new Date().toLocaleTimeString();
    p.textContent += '\n['+time+'] '+t;
    p.scrollTop = p.scrollHeight;
  }
  function escapeHtml(s=''){ return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
  function sanitizeHtml(html=''){
    const allowed = new Set(['P','STRONG','EM','UL','OL','LI','A','H3','H4','BR']);
    const div = document.createElement('div'); div.innerHTML = html;
    $$('script,style,iframe', div).forEach(n=>n.remove());
    const walker = document.createTreeWalker(div, NodeFilter.SHOW_ELEMENT, null, false);
    const rm=[];
    while(walker.nextNode()){
      const el=walker.currentNode;
      if(!allowed.has(el.tagName)){
        const parent = el.parentNode; while(el.firstChild) parent.insertBefore(el.firstChild, el); rm.push(el); continue;
      }
      [...el.attributes].forEach(a=>{
        const name=a.name.toLowerCase();
        if(name.startsWith('on')||['style','srcset'].includes(name)) el.removeAttribute(a.name);
        if(el.tagName==='A'&&name==='href'){ try{ new URL(a.value, location.origin);}catch{el.removeAttribute('href');} }
      });
      if(el.tagName==='A'){ el.setAttribute('rel','noopener noreferrer'); el.setAttribute('target','_blank'); }
    }
    rm.forEach(n=>n.remove());
    return div.innerHTML;
  }
  function setBadge(id, state){ const el=$('#'+id); if(!el)return; el.classList.remove('ok','ko'); if(state) el.classList.add(state); }

  // ---------- UI init ----------
  function setChapters(n){ els.chapter.innerHTML = '<option value="">Chapitre</option>'+Array.from({length:n},(_,i)=>`<option>${i+1}</option>`).join(''); }
  function setVerses(n){ els.verse.innerHTML = '<option value="">Verset</option>'+Array.from({length:n},(_,i)=>`<option>${i+1}</option>`).join(''); }

  function delegateListClicks(){
    const list = els.pointsList;
    if(!list || list.__delegated) return;
    list.__delegated = true;
    list.addEventListener('click', (e)=>{
      const item = e.target.closest('.item');
      if(!item || !list.contains(item)) return;
      const i = Number(item.getAttribute('data-i')||'-1');
      if(Number.isInteger(i) && i>=0){
        openSection(i);
        $$('.item', list).forEach(n=>n.classList.remove('active'));
        item.classList.add('active');
        item.scrollIntoView({block:'nearest'});
      }
    });
  }

  function buildGatewayURL({book, chapter, verses, version}){
    const ref = (book||'')+' '+(chapter||'')+(verses?(':'+verses):'');
    return 'https://www.biblegateway.com/passage/?search='+encodeURIComponent(ref)+'&version='+(version||'LSG');
  }
  function buildYouVersionSearch({book, chapter, verses, version}){
    const q = (book+' '+(chapter||'')+(verses?(':'+verses):'')+' '+(version||'LSG')).trim();
    return 'https://www.google.com/search?q='+encodeURIComponent('site:bible.com '+q);
  }

  // ---------- selection ----------
  function escapeReg(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function parseSearch(str){
    if(!str) return null;
    const s=String(str).trim();
    for(const b of BOOKS.slice().sort((a,b)=>b.length-a.length)){
      const re = new RegExp('^\\s*('+escapeReg(b)+')\\s+(\\d{1,3})(?::\\s*([0-9,\\-–;\\s]+))?\\s*$','i');
      const m = s.match(re);
      if(m){ return {book:b, chapter:m[2], verses:(m[3]||'').replace(/\s+/g,'')}; }
    }
    return null;
  }
  function getSelection(){
    let book=els.book.value||'', chapter=els.chapter.value||'', verses='', vSel=els.verse.value||'';
    if(vSel) verses=vSel;
    if(!book || !chapter){
      const p=parseSearch(els.searchRef.value); if(p){ book=p.book; chapter=p.chapter; if(p.verses) verses=p.verses; }
    }
    const version=els.version.value||'LSG';
    return {book, chapter, verses, version};
  }

  // ---------- API ----------
  async function apiBible(params){
    const qs=new URLSearchParams({book:params.book,chapter:params.chapter,verses:params.verses||'',version:params.version||'LSG'});
    const r=await fetch('/api/bible?'+qs.toString());
    if(!r.ok) throw new Error('API Bible — HTTP '+r.status);
    return r.json();
  }
  async function callStudy28(params){
    const usp = new URLSearchParams();
    if(params.book) usp.set('book', params.book);
    if(params.chapter) usp.set('chapter', params.chapter);
    if(params.verses) usp.set('verse', params.verses);
    usp.set('translation', params.version || 'LSG');
    usp.set('mode','full'); usp.set('trace','1');
    const r = await fetch('/api/study-28?'+usp.toString(), { headers:{accept:'application/json'} });
    if(!r.ok){ const t=await r.text(); throw new Error('API Plan — HTTP '+r.status+' '+t); }
    const j = await r.json();
    if(!j || j.ok===false) throw new Error(j?.error?.message || 'Réponse invalide');
    return j;
  }

  // ---------- render ----------
  function installLinksPanel(ctx){
    const list=els.linksList; const g=buildGatewayURL(ctx); const y=buildYouVersionSearch(ctx);
    list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', `<a href="${g}" target="_blank" rel="noopener">BibleGateway (${escapeHtml(ctx.version)})</a>`);
    list.insertAdjacentHTML('beforeend', `<a href="${y}" target="_blank" rel="noopener">YouVersion (recherche)</a>`);
    els.linksPanel.classList.remove('empty');
  }
  function renderBiblePayload(payload, ctx){
    let html=''; const d = payload && payload.data ? payload.data : payload;
    if(d && d.reference){ html+=`<h3>${escapeHtml(d.reference)}</h3>`; }
    if(d && typeof d.html==='string' && d.html.trim()){
      html += d.html;
    }else if(d && Array.isArray(d.items)){
      html += d.items.map(it=>{
        const v = it.v ? `<strong>v.${escapeHtml(String(it.v))}</strong> ` : '';
        const line = it.html ? it.html : escapeHtml(it.text||'');
        return `<p>${v}${line}</p>`;
      }).join('');
    }else if(d && d.text){
      html += `<p>${escapeHtml(d.text)}</p>`;
    }else{
      html += `<p><em>Aucun contenu trouvé.</em></p>`;
    }
    const clean = sanitizeHtml(html);
    if(els.enrich.checked){ els.noteView.innerHTML = clean; }
    else { els.noteArea.value = clean.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,''); }
    installLinksPanel(ctx);
    queueAutosave();
  }

  function normalizeSections(sections=[]){
    return sections.map((s,idx)=>({
      ...s,
      index: idx+1,
      title: (s.title && String(s.title).trim()) || CUSTOM_TITLES[idx] || s.title || `Rubrique ${idx+1}`
    }));
  }

  function populateList(sections){
    els.pointsList.innerHTML = sections.map((s,i)=>`
      <div class="item" data-i="${i}">
        <span class="idx">${escapeHtml(String(s.index ?? (i+1)))}</span>
        <div>
          <div>${escapeHtml(String(s.title || ('Rubrique '+(i+1))))}</div>
          <span class="desc">Rubrique ${i+1}</span>
        </div>
        <span class="dot ok"></span>
      </div>
    `).join('');
    els.metaInfo.textContent = 'Point 1 / '+sections.length;
    setBadge('dot-chat','ok');
  }

  function openSection(i){
    if(i<0 || i>=state.sections.length) return;
    state.current = i;
    const sec=state.sections[i]; els.edTitle.textContent = sec.title || ('Rubrique '+(i+1));
    const safe = sanitizeHtml(sec.content || '');
    if(els.enrich.checked){ els.noteView.innerHTML = safe; }
    else { els.noteArea.value = safe.replace(/<br\s*\/?>/gi,'\n').replace(/<[^>]+>/g,''); }
    els.metaInfo.textContent = 'Point '+(i+1)+' / '+state.sections.length;
    $$('.item', els.pointsList).forEach(n=>n.classList.remove('active'));
    const active = $(`.item[data-i="${i}"]`, els.pointsList); if(active) active.classList.add('active');
    queueAutosave();
  }
  function nav(d){
    if(state.sections.length===0) return;
    const i = state.current<0 ? 0 : state.current + d;
    const to = Math.max(0, Math.min(state.sections.length-1, i));
    openSection(to);
    const el = $(`.item[data-i="${to}"]`, els.pointsList);
    if(el) el.scrollIntoView({block:'nearest'});
  }

  // ---------- actions ----------
  async function onRead(){
    try{
      const sel=getSelection();
      if(!sel.book||!sel.chapter){ alert('Sélectionne un livre et un chapitre, ou tape une référence (ex: Jean 3:16).'); return; }
      log('Lire', JSON.stringify(sel));
      const j=await apiBible(sel);
      if(!j || (j.ok===false && !j.data)) throw new Error(j && j.error ? j.error : 'Réponse invalide');
      renderBiblePayload(j, sel);
    }catch(e){ log('Erreur lecture: '+(e?.message||e)); alert('Erreur: '+(e?.message||e)); }
  }
  async function onGeneratePlan(){
    try{
      const sel=getSelection();
      if(!sel.book||!sel.chapter){ alert('Sélectionne un livre et un chapitre avant de générer le plan.'); return; }
      log('Plan', JSON.stringify(sel));
      const j = await callStudy28(sel);
      const data = j.data || {};
      const raw = Array.isArray(data.sections) ? data.sections : [];
      if(raw.length===0) throw new Error('Aucune section reçue.');
      state.meta = data.meta || null;
      state.sections = normalizeSections(raw);
      populateList(state.sections);
      delegateListClicks();
      openSection(0);
    }catch(e){ setBadge('dot-chat','ko'); log('Erreur plan: '+(e?.message||e)); alert('Erreur: '+(e?.message||e)); }
  }

  // ---------- autosave ----------
  function queueAutosave(){ if(state.autosaveTimer) clearTimeout(state.autosaveTimer); state.autosaveTimer=setTimeout(save,2000); }
  function save(){
    try{
      const payload = {
        enriched: els.enrich.checked,
        html: els.noteView.innerHTML,
        text: els.noteArea.value,
        current: state.current,
        sections: state.sections,
        ts: Date.now()
      };
      localStorage.setItem('meditation.save', JSON.stringify(payload));
      log('Auto-save ok');
    }catch(e){ log('Auto-save ko: '+e.message); }
  }
  function restore(){
    try{
      const raw = localStorage.getItem('meditation.save'); if(!raw) return;
      const p = JSON.parse(raw);
      els.enrich.checked = !!p.enriched; syncMode();
      if(p.enriched && p.html) els.noteView.innerHTML = sanitizeHtml(p.html);
      if(!p.enriched && p.text) els.noteArea.value = p.text;
      if(Array.isArray(p.sections) && p.sections.length){
        state.sections = p.sections;
        populateList(state.sections);
        delegateListClicks();
        const idx = typeof p.current==='number' ? p.current : 0;
        openSection(Math.max(0, Math.min(state.sections.length-1, idx)));
      }
      log('Restauré');
    }catch(e){ log('Restore ko: '+e.message); }
  }

  // ---------- misc ----------
  function syncMode(){
    const enriched = els.enrich.checked;
    els.noteView.style.display = enriched ? 'block' : 'none';
    els.noteArea.style.display = enriched ? 'none'  : 'block';
    if(enriched && els.noteView.innerHTML.trim()==='' && els.noteArea.value.trim()!==''){
      els.noteView.innerHTML = '<p>'+escapeHtml(els.noteArea.value).replace(/\n\n/g,'</p><p>').replace(/\n/g,'<br>')+'</p>';
    }
  }
  async function quickPing(){
    try{ const r1 = await fetch('/api/ping').catch(()=>null); setBadge('dot-ping', r1 && r1.ok ? 'ok' : 'ko'); }catch{ setBadge('dot-ping','ko'); }
    try{ const r2 = await fetch('/api/health').catch(()=>null); setBadge('dot-health', r2 && r2.ok ? 'ok' : 'ko'); }catch{ setBadge('dot-health','ko'); }
  }

  // ---------- init ----------
  function init(){
    try{
      // listes
      els.book.innerHTML = '<option value="">Livre</option>'+BOOKS.map(b=>`<option value="${b}">${b}</option>`).join('');
      setChapters(150); setVerses(176);
      document.body.setAttribute('data-theme', els.theme.value);
      els.theme.addEventListener('change', ()=>document.body.setAttribute('data-theme', els.theme.value));
      els.year.textContent = new Date().getFullYear();
      window.addEventListener('scroll', ()=>{
        const h=document.documentElement; const percent=(h.scrollTop)/(h.scrollHeight-h.clientHeight)*100;
        els.progress.style.width=percent.toFixed(2)+'%';
      });
      els.dbgBtn.addEventListener('click', ()=>{ els.dbgPanel.style.display = (els.dbgPanel.style.display==='none'?'block':'none'); });
      els.enrich.addEventListener('change', syncMode);
      els.noteArea.addEventListener('input', queueAutosave);
      els.noteView.addEventListener('input', queueAutosave);
      els.book.addEventListener('change', ()=>{ setChapters(150); setVerses(176); });
      els.chapter.addEventListener('change', ()=>{ setVerses(176); });
      els.readBtn.addEventListener('click', onRead);
      els.validate.addEventListener('click', ()=>{ // applique liens dans noteView
        if(!els.enrich.checked) syncMode();
        const html=els.noteView.innerHTML;
        const pattern = new RegExp('('+BOOKS.map(b=>b.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')).join('|')+')\\s+(\\d{1,3})(?::([0-9,\\-–;\\s]+))?','g');
        const version = els.version.value || 'LSG';
        const replaced = html.replace(pattern, (m,book,chap,verses)=>{
          const url = buildGatewayURL({book, chapter:chap, verses:(verses||'').replace(/\s+/g,''), version});
          return `<a href="${url}" target="_blank" rel="noopener">${escapeHtml(m)}</a>`;
        });
        els.noteView.innerHTML = sanitizeHtml(replaced); queueAutosave();
      });
      els.genBtn.addEventListener('click', onGeneratePlan);
      els.prev.addEventListener('click', ()=>nav(-1));
      els.next.addEventListener('click', ()=>nav(1));
      els.searchRef.addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ onRead(); } });

      delegateListClicks(); // clé : clics fiables
      quickPing();
      restore();

      console.log(LOGP,'Init OK');
    }catch(e){ console.error(LOGP,'Init error',e); }
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();

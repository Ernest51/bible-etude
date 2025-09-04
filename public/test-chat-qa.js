(function(){
  const $ = (s)=>document.querySelector(s);
  const esc = (s='') => String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
  const set = (id, txt, cls)=>{ const el=$(id); if(!el) return; el.textContent=txt; if(cls) el.className=cls; };
  async function postJSON(url, body){
    const r = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body||{})});
    const t = await r.text(); try{return {ok:r.ok, data:JSON.parse(t), status:r.status}}catch{ return {ok:r.ok, data:t, status:r.status} }
  }

  $('#btn')?.addEventListener('click', async ()=>{
    set('#status','…','mono'); $('#sections').innerHTML=''; set('#raw','…'); set('#ref','—'); set('#src','—'); set('#count','—');

    const payload = {
      book: $('#book')?.value || 'Jean',
      chapter: $('#chapter')?.value || 3,
      verse: $('#verses')?.value || '',
      version: $('#version')?.value || 'LSG',
      directives: { qa: $('#qa')?.checked ? true : false }
    };
    set('#meta', 'POST /api/chat ' + JSON.stringify(payload), 'mono muted');

    try {
      const res = await postJSON('/api/chat', payload);
      $('#raw').textContent = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      if (!(res.data && res.data.ok && res.data.data && Array.isArray(res.data.data.sections))) { set('#status', `ÉCHEC (${res.status})`, 'mono ko'); return; }
      const j = res.data;
      set('#ref', j.data.reference || '—'); set('#src', j.source || '—'); set('#count', String(j.data.sections.length));
      j.data.sections.forEach(s=>{
        const card = document.createElement('div');
        card.className='section';
        card.innerHTML = `<h4>${esc(String(s.id))}. ${esc(s.title||'')}</h4><div class="content">${s.content||''}</div>`;
        $('#sections').appendChild(card);
      });
      set('#status', 'OK', 'mono ok');
    } catch(e) {
      set('#status','ÉCHEC','mono ko'); set('#raw', String(e?.message||e));
    }
  });
})();

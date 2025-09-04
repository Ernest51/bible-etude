(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s = "") =>
    String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function set(id, txt, cls) {
    const el = $(id);
    if (!el) return;
    el.textContent = txt;
    if (cls) el.className = cls;
  }

  async function postJSON(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
    const text = await r.text();
    try { return { ok: r.ok, data: JSON.parse(text), status: r.status }; }
    catch { return { ok: r.ok, data: text, status: r.status }; }
  }

  // Étape 1: probe
  $('#btn-probe')?.addEventListener('click', async () => {
    set('#status-probe', '…', 'mono');
    set('#raw-probe', '…');
    try {
      const res = await postJSON('/api/chat', { probe: true });
      $('#raw-probe').textContent = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);
      if (res.data && res.data.ok) set('#status-probe', 'OK', 'mono ok');
      else set('#status-probe', `ÉCHEC (${res.status})`, 'mono ko');
    } catch (e) {
      set('#status-probe', 'ÉCHEC', 'mono ko');
      $('#raw-probe').textContent = String(e?.message || e);
    }
  });

  // Étape 2: chat
  $('#btn-chat')?.addEventListener('click', async () => {
    set('#status-chat', '…', 'mono');
    set('#raw-chat', '…');
    $('#sections').innerHTML = '';
    set('#ref', '—'); set('#src', '—'); set('#count', '—');

    const payload = {
      book: $('#book')?.value || 'Genèse',
      chapter: $('#chapter')?.value || 1,
      verse: $('#verses')?.value || '',
      version: $('#version')?.value || 'LSG'
    };
    set('#meta', 'POST /api/chat ' + JSON.stringify(payload), 'mono muted');

    try {
      const res = await postJSON('/api/chat', payload);
      $('#raw-chat').textContent = typeof res.data === 'string' ? res.data : JSON.stringify(res.data, null, 2);

      if (!(res.data && res.data.ok && res.data.data && Array.isArray(res.data.data.sections))) {
        set('#status-chat', `ÉCHEC (${res.status})`, 'mono ko');
        return;
      }

      const j = res.data;
      const ref = j.data.reference || '';
      const src = j.source || '';
      const sections = j.data.sections || [];

      set('#ref', ref, 'muted');
      set('#src', src || '(inconnu)', 'muted');
      set('#count', String(sections.length) + (sections.length === 28 ? ' ✅' : ' ❌'), 'muted');

      sections.forEach(s => {
        const card = document.createElement('div');
        card.className = 'section';
        card.innerHTML = `<h4>${esc(String(s.id || ''))}. ${esc(s.title || '')}</h4><div class="content">${s.content || ''}</div>`;
        $('#sections').appendChild(card);
      });

      set('#status-chat', sections.length === 28 ? 'OK' : 'PARTIEL', 'mono ' + (sections.length === 28 ? 'ok' : 'ko'));
    } catch (e) {
      set('#status-chat', 'ÉCHEC', 'mono ko');
      $('#raw-chat').textContent = String(e?.message || e);
    }
  });

  // Petit check visible si JS est bien chargé
  console.log('test-chat.js chargé ✔');
})();

<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Test — Étude verset par verset (Rubrique 0)</title>
  <style>
    body{font-family:Inter,system-ui,Arial,sans-serif;margin:18px}
    h1{font-size:20px;margin:0 0 10px}
    .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
    label{display:flex;gap:6px;align-items:center}
    input,select,button{padding:8px 10px;border:1px solid #d1d5db;border-radius:8px}
    button{cursor:pointer;background:#111827;color:#fff;border-color:#111827}
    pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
    .ok{color:#16a34a;font-weight:700}
    .ko{color:#dc2626;font-weight:700}
    .warn{color:#ca8a04;font-weight:700}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
    a{color:#2563eb}
  </style>
</head>
<body>
  <h1>Test — Étude verset par verset (Rubrique 0)</h1>
  <p>Ce test vérifie l’endpoint <code>/api/verses</code> et la présence d’explications par verset (<code>noteHTML</code>).</p>

  <div class="row">
    <label>Livre :
      <input id="book" value="Genèse"/>
    </label>
    <label>Chapitre :
      <input id="chapter" type="number" min="1" value="1" style="width:90px"/>
    </label>
    <label>Nombre de versets :
      <input id="limit" type="number" min="1" max="200" value="31" style="width:90px"/>
    </label>
    <button id="go">Lancer le test</button>
  </div>

  <div id="out"></div>

  <script>
    const out = document.getElementById('out');

    function render(html){ out.innerHTML = html; }
    function esc(s){ return String(s||'').replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m])); }

    async function safeFetchJson(url){
      const r = await fetch(url);
      const ct = (r.headers.get('content-type')||'').toLowerCase();
      const text = await r.text();
      if (!ct.includes('application/json')) {
        // On renvoie un objet “non-json” pour diagnostic
        return { __nonjson: true, status: r.status, body: text };
      }
      try { return JSON.parse(text); }
      catch(e){ return { __parseerr: true, status: r.status, body: text, error: String(e) }; }
    }

    document.getElementById('go').addEventListener('click', async ()=>{
      const book = document.getElementById('book').value.trim();
      const chapter = parseInt(document.getElementById('chapter').value, 10);
      const limit = parseInt(document.getElementById('limit').value, 10);

      render('<p>⏳ Test en cours…</p>');

      const url = `/api/verses?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}`;
      const data = await safeFetchJson(url);

      if (data.__nonjson || data.__parseerr) {
        render(`
          <p class="ko">❌ Réponse non-JSON (${esc(data.status)})</p>
          <div class="card"><strong>Corps renvoyé :</strong><pre>${esc(data.body.slice(0,4000))}</pre></div>
          <p>Cause probable : fonction serveur en erreur (page HTML Vercel). Vérifie les logs et/ou l’ID de Bible / la clé API.</p>
        `);
        return;
      }

      if (!data || data.ok === false) {
        render(`<p class="ko">❌ KO — ${esc(data?.error || 'Réponse invalide')}</p><pre>${esc(JSON.stringify(data,null,2))}</pre>`);
        return;
      }

      const verses = Array.isArray(data.verses) ? data.verses : [];
      const src = data.source || '—';
      const ver = data.version || '—';

      let html = '';
      html += `<p class="${verses.length? 'ok':'warn'}">${verses.length? '✅ OK':'⚠️'} — ${esc(verses.length)} verset(s) (source: ${esc(src)}, version: ${esc(ver)})</p>`;

      const slice = verses.slice(0, limit);
      if (!slice.length) {
        html += `<p class="warn">⚠️ Aucun verset. Le front affichera un fallback local (lien YouVersion).</p>`;
      }

      for (const v of slice) {
        html += `
          <div class="card">
            <div><strong>${esc(book)} ${esc(chapter)}:${esc(v.v)}</strong></div>
            <div>${esc(v.text || '—')}</div>
            ${v.noteHTML ? `<div style="margin-top:6px">${v.noteHTML}</div>` : `<div style="margin-top:6px" class="warn">⚠️ noteHTML absente</div>`}
          </div>
        `;
      }

      render(html);
    });
  </script>
</body>
</html>

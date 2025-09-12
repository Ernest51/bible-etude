<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Test — Génération Étude 1–28</title>
  <style>
    :root{--b:#111827;--g:#16a34a;--r:#dc2626;--y:#ca8a04}
    body{font-family:Inter,system-ui,Arial,sans-serif;margin:18px}
    h1{font-size:20px;margin:0 0 10px}
    .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:8px 0}
    label{display:flex;gap:6px;align-items:center}
    input,select,button{padding:8px 10px;border:1px solid #d1d5db;border-radius:8px}
    button{cursor:pointer;background:var(--b);color:#fff;border-color:var(--b)}
    pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e5e7eb;border-radius:8px;padding:10px}
    .ok{color:var(--g);font-weight:700}
    .ko{color:var(--r);font-weight:700}
    .warn{color:var(--y);font-weight:700}
    .card{border:1px solid #e5e7eb;border-radius:10px;padding:12px;margin:10px 0}
    .grid{display:grid;grid-template-columns:1fr;gap:10px}
    @media(min-width:900px){.grid{grid-template-columns:1fr 1fr}}
    a{color:#2563eb}
    .meta{font-size:12px;color:#4b5563}
  </style>
</head>
<body>
  <h1>Test — Génération Étude 1–28</h1>
  <p>Vérifie <code>/api/generate-study</code>. Si la réponse n’est pas JSON, le corps HTML d’erreur est affiché pour diagnostic.</p>

  <div class="row">
    <label>Passage :
      <input id="passage" value="Genèse 1" style="min-width:220px"/>
    </label>
    <label>Densité :
      <select id="length">
        <option value="500">500</option>
        <option value="1500" selected>1500</option>
        <option value="2200">2200</option>
        <option value="3000">3000</option>
      </select>
    </label>
    <label>Traduction :
      <select id="translation">
        <option value="LSG" selected>LSG</option>
        <option value="PDV">PDV</option>
        <option value="S21">S21</option>
        <option value="BFC">BFC</option>
        <option value="JND">JND</option>
      </select>
    </label>
    <button id="go">POST /api/generate-study</button>
    <a href="/api/generate-study" target="_blank" rel="noopener">GET /api/generate-study (smoke)</a>
  </div>

  <div id="out"></div>

  <script>
    const out = document.getElementById('out');
    const esc = s => String(s||'').replace(/[&<>]/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;' }[m]));

    async function safePostJson(url, body){
      const r = await fetch(url, {
        method:'POST',
        headers:{'content-type':'application/json'},
        body: JSON.stringify(body)
      });
      const ct = (r.headers.get('content-type')||'').toLowerCase();
      const text = await r.text();
      if (!ct.includes('application/json')) {
        return { __nonjson:true, status:r.status, body:text };
      }
      try { return JSON.parse(text); }
      catch(e){ return { __parseerr:true, status:r.status, body:text, error:String(e) }; }
    }

    function render(html){ out.innerHTML = html; }

    document.getElementById('go').addEventListener('click', async ()=>{
      const passage = document.getElementById('passage').value.trim();
      const length = parseInt(document.getElementById('length').value,10);
      const translation = document.getElementById('translation').value;

      render('<p>⏳ Génération en cours…</p>');

      const data = await safePostJson('/api/generate-study', {
        passage, options:{ length, translation }
      });

      // Cas non-JSON -> on affiche le corps pour diagnostiquer l'erreur Vercel
      if (data.__nonjson || data.__parseerr) {
        render(`
          <p class="ko">❌ Réponse non-JSON (${esc(data.status)})</p>
          <div class="card"><strong>Corps renvoyé :</strong><pre>${esc(data.body.slice(0,4000))}</pre></div>
          <p>Indice : si ça commence par “A server error has occurred…”, la fonction a crashé. Regarde les logs Vercel et les variables d’environnement API_BIBLE_*.</p>
        `);
        return;
      }

      // Validation JSON minimal
      const sections = data?.study?.sections;
      const meta = data?.metadata || {};
      const perf = data?.performance || {};
      if (!Array.isArray(sections)) {
        render('<p class="ko">❌ Réponse JSON mais sans study.sections</p><pre>'+esc(JSON.stringify(data,null,2))+'</pre>');
        return;
      }

      let ok = sections.length === 28;
      let html = '';
      html += `<p class="${ok?'ok':'warn'}">${ok?'✅ OK':'⚠️ PARTIEL'} — ${esc(sections.length)} section(s)</p>`;
      if (meta?.fallbackUsed || meta?.emergency || (meta?.quality && meta.quality.note)) {
        html += `<p class="warn">⚠️ Fallback / qualité réduite : ${esc(JSON.stringify({fallbackUsed:meta.fallbackUsed, emergency:meta.emergency, note:meta?.quality?.note},null,0))}</p>`;
      }

      html += `<div class="meta">Livre: ${esc(meta.book||'-')} — Chapitre: ${esc(meta.chapter||'-')} — Version: ${esc(meta.version||'-')} — Généré: ${esc(meta.generatedAt||'-')}</div>`;

      // Aperçu des 6 premières rubriques
      html += `<div class="grid">`;
      sections.slice(0,6).forEach(s=>{
        const preview = String(s.content||'').replace(/\s+/g,' ').slice(0,220);
        html += `
          <div class="card">
            <div><strong>${esc(s.id)} — ${esc(s.title||'')}</strong></div>
            <div class="meta">${esc(s.description||'')}</div>
            <div style="margin-top:6px"><pre>${esc(preview)}${preview.length>=220?'…':''}</pre></div>
          </div>
        `;
      });
      html += `</div>`;

      // Détails bruts pliables
      html += `
        <details style="margin-top:10px">
          <summary>Voir JSON complet</summary>
          <pre>${esc(JSON.stringify(data,null,2))}</pre>
        </details>
      `;

      render(html);
    });
  </script>
</body>
</html>

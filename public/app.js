// /public/app.js
// Front minimal & robuste pour déclencher l'étude via /api/study-28 et afficher 28 rubriques variées.

(function () {
  const $  = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];

  // Champs attendus si présents dans la page (optionnels)
  const elBook   = $('[name="book"]')    || $('#book');
  const elChap   = $('[name="chapter"]') || $('#chapter');
  const elVerse  = $('[name="verse"]')   || $('#verse');
  const elTrans  = $('[name="translation"]') || $('#translation');
  const elBible  = $('[name="bibleId"]') || $('#bibleId');

  const btnGen   = $('#generateBtn') || $('#generate') || $('button[type="submit"]');
  const out      = $('#out') || createOut();
  const statusEl = $('#status') || createStatus();

  function createOut() {
    const d = document.createElement('div');
    d.id = 'out';
    d.style.border = '1px solid #e5e7eb';
    d.style.borderRadius = '12px';
    d.style.padding = '16px';
    d.style.background = '#fff';
    document.body.appendChild(d);
    return d;
  }
  function createStatus() {
    const d = document.createElement('div');
    d.id = 'status';
    d.style.margin = '12px 0';
    document.body.insertBefore(d, out);
    return d;
  }

  function readVal(el, def="") {
    return (el && el.value != null ? String(el.value) : def).trim();
  }

  async function runStudy(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    statusEl.textContent = "⏳ génération en cours…";
    out.innerHTML = "";

    const book = readVal(elBook, "Genèse");
    const chapter = readVal(elChap, "1");
    const verse = readVal(elVerse, "");
    const translation = readVal(elTrans, "JND");
    const bibleId = readVal(elBible, "");

    const usp = new URLSearchParams({ book, chapter, translation });
    if (verse)   usp.set("verse", verse);
    if (bibleId) usp.set("bibleId", bibleId);
    usp.set("trace", "1"); // utile en cas d'erreur API

    try {
      const r = await fetch("/api/study-28?" + usp.toString(), {
        headers: { "accept":"application/json" },
        cache: "no-store"
      });
      const j = await r.json().catch(()=>null);

      if (!j || !j.ok) {
        const msg = j?.error || `HTTP ${r.status}`;
        statusEl.innerHTML = `<span style="color:#dc2626">⚠️ ${msg}</span>`;
        out.textContent = j ? JSON.stringify(j, null, 2) : "Réponse vide.";
        return;
      }

      const data = j.data || {};
      const meta = data.meta || {};
      const sections = Array.isArray(data.sections) ? data.sections : [];

      statusEl.innerHTML = `<span style="color:#16a34a">✅ Étude de ${meta.reference || (book+" "+chapter)} — ${sections.length} sections</span>
        <div style="color:#64748b; margin-top:4px">OSIS: ${meta.osis || "?"} · Trad: ${meta.translation || translation}</div>`;

      if (!sections.length) {
        out.innerHTML = `<div style="color:#dc2626">⚠️ Aucune section trouvée</div>`;
        return;
      }

      out.innerHTML = sections.map(s => `
        <div class="sec" style="padding:10px 0; border-bottom:1px dashed #e5e7eb">
          <h3 style="margin:0 0 6px">${s.index}. ${escapeHtml(s.title || "")}</h3>
          <p style="margin:0">${escapeHtml(s.content || "")}</p>
          ${Array.isArray(s.verses) && s.verses.length ? `<div style="color:#6366f1; margin-top:6px; font-size:12px">Versets : ${s.verses.map(escapeHtml).join(", ")}</div>` : ""}
        </div>
      `).join("");
    } catch (e) {
      statusEl.innerHTML = `<span style="color:#dc2626">⚠️ Exception: ${e?.message || e}</span>`;
    }
  }

  function escapeHtml(s=""){
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  // Auto-hydrate par querystring si la page est ouverte avec ?book=…&chapter=…
  (function hydrateFromURL(){
    const usp = new URLSearchParams(location.search);
    const set = (name, el) => { if (el && usp.has(name)) el.value = usp.get(name); };
    set("book", elBook); set("chapter", elChap); set("verse", elVerse);
    set("translation", elTrans); set("bibleId", elBible);

    if (usp.size && btnGen == null) runStudy(); // si pas de bouton, lance direct
  })();

  // Bouton (s’il existe)
  if (btnGen) {
    // Si c’est un <form>, on capte submit
    if (btnGen.closest("form")) {
      btnGen.closest("form").addEventListener("submit", runStudy);
    } else {
      btnGen.addEventListener("click", runStudy);
    }
  } else {
    // Pas de bouton dans la page : on crée un petit déclencheur
    const b = document.createElement("button");
    b.textContent = "🧪 Générer l’étude (28 points)";
    b.style.cssText = "background:#111827;color:#fff;border:none;border-radius:10px;padding:10px 14px;cursor:pointer;margin-bottom:10px";
    b.addEventListener("click", runStudy);
    statusEl.parentNode.insertBefore(b, statusEl);
  }
})();

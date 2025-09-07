// public/app.js (ES5 – sans flèches, sans backticks, sans features modernes)
// Affiche un panneau autonome “Étude auto (28)” qui lit Livre/Chapitre/Traduction
// depuis les <select> existants si trouvés, puis appelle /api/study-28.

(function () {
  // ---------- utils ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function text(el) { return (el && (el.textContent || el.innerText) || "").trim(); }

  function escapeHtml(s) {
    s = String(s || "");
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function readSelectHuman(sel, defVal) {
    if (!sel) return defVal || "";
    var idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
    var o = sel.options[idx];
    var v = (o && (o.text || o.value)) || "";
    return String(v || defVal || "").trim();
  }

  // ---------- détection souple des <select> Livre/Chapitre/Traduction ----------
  function findBookSelect() {
    var sels = $all("select");
    for (var i=0; i<sels.length; i++) {
      var s = sels[i];
      var txts = $all("option", s).map(function(o){ return (o.text||"").toLowerCase(); }).join("|");
      if (/(gen[eè]se|genesis|exode|psaumes|matthieu|marc|luc|jean|romains|actes)/.test(txts)) {
        return s;
      }
    }
    return null;
  }

  function findChapterSelect() {
    var sels = $all("select");
    for (var i=0; i<sels.length; i++) {
      var s = sels[i];
      var opts = $all("option", s).slice(0, 15);
      var vals = opts.map(function(o){ return (o.value || o.text || "").trim(); });
      var nums = vals.filter(function(v){ return /^\d+$/.test(v); }).length;
      if (nums >= Math.max(5, Math.floor(vals.length * 0.6))) return s;
    }
    return null;
  }

  function findTranslationSelect() {
    var sels = $all("select");
    for (var i=0; i<sels.length; i++) {
      var s = sels[i];
      var txts = $all("option", s).map(function(o){ return (o.text||"").toLowerCase(); }).join("|");
      if (/(segond|darby|ostervald|parole|pdv|fran[çc]ais courant)/.test(txts)) return s;
    }
    return null;
  }

  function normTranslationLabel(label) {
    var t = String(label || "").toLowerCase();
    if (/darby|jnd/.test(t)) return "JND";
    if (/segond|lsg/.test(t)) return "LSG";
    return "JND";
  }

  // ---------- crée le bouton et le panneau autonome ----------
  var btnGenerate = null;
  var btns = $all("button, [role=button]");
  for (var i=0;i<btns.length;i++) {
    if (text(btns[i]).toLowerCase().indexOf("générer") !== -1) { btnGenerate = btns[i]; break; }
  }

  var studyBtn = document.createElement("button");
  studyBtn.type = "button";
  studyBtn.appendChild(document.createTextNode("Étude auto (28)"));
  studyBtn.style.marginLeft = "10px";
  studyBtn.style.background = "#0f172a";
  studyBtn.style.color = "#fff";
  studyBtn.style.border = "1px solid #1f2937";
  studyBtn.style.borderRadius = "10px";
  studyBtn.style.padding = "8px 12px";
  studyBtn.style.cursor = "pointer";
  studyBtn.style.fontWeight = "600";

  if (btnGenerate && btnGenerate.parentElement) {
    btnGenerate.parentElement.appendChild(studyBtn);
  } else {
    document.body.insertBefore(studyBtn, document.body.firstChild);
  }

  var panel = document.createElement("section");
  panel.id = "study-panel";
  panel.style.margin = "16px 0";
  panel.style.border = "1px solid #e5e7eb";
  panel.style.borderRadius = "12px";
  panel.style.background = "#fff";
  panel.style.overflow = "hidden";

  var header = document.createElement("div");
  header.style.padding = "12px 14px";
  header.style.borderBottom = "1px solid #e5e7eb";
  header.style.display = "flex";
  header.style.gap = "10px";
  header.style.alignItems = "center";
  header.style.flexWrap = "wrap";

  var strong = document.createElement("strong");
  strong.appendChild(document.createTextNode("Étude (autonome)"));
  header.appendChild(strong);

  var statusEl = document.createElement("span");
  statusEl.id = "study-status";
  statusEl.style.color = "#64748b";
  header.appendChild(statusEl);

  var metaEl = document.createElement("span");
  metaEl.id = "study-meta";
  metaEl.style.color = "#64748b";
  header.appendChild(metaEl);

  var printBtn = document.createElement("button");
  printBtn.id = "study-print";
  printBtn.appendChild(document.createTextNode("🖨️ Imprimer / PDF"));
  printBtn.style.marginLeft = "auto";
  printBtn.style.background = "#111827";
  printBtn.style.color = "#fff";
  printBtn.style.border = "none";
  printBtn.style.borderRadius = "8px";
  printBtn.style.padding = "6px 10px";
  printBtn.style.cursor = "pointer";
  header.appendChild(printBtn);

  var bodyWrap = document.createElement("div");
  bodyWrap.style.display = "grid";
  bodyWrap.style.gridTemplateColumns = "320px 1fr";
  bodyWrap.style.minHeight = "420px";

  var listEl = document.createElement("aside");
  listEl.id = "study-list";
  listEl.style.borderRight = "1px solid #e5e7eb";
  listEl.style.overflow = "auto";
  listEl.style.maxHeight = "70vh";
  bodyWrap.appendChild(listEl);

  var contentEl = document.createElement("main");
  contentEl.id = "study-content";
  contentEl.style.padding = "16px";
  contentEl.style.minHeight = "420px";
  contentEl.innerHTML = "<em>Cliquer « Étude auto (28) » pour générer.</em>";
  bodyWrap.appendChild(contentEl);

  panel.appendChild(header);
  panel.appendChild(bodyWrap);

  if (btnGenerate && btnGenerate.closest && btnGenerate.closest("section")) {
    btnGenerate.closest("section").parentElement.appendChild(panel);
  } else {
    document.body.appendChild(panel);
  }

  // ---------- rendu ----------
  function setStatus(msg, ok) {
    statusEl.textContent = msg || "";
    statusEl.style.color = ok === false ? "#dc2626" : "#16a34a";
  }

  function renderSections(data) {
    var meta = data && data.meta || {};
    var sections = data && data.sections || [];
    metaEl.textContent = sections.length ? ("OSIS: " + (meta.osis || "?") + " · Trad: " + (meta.translation || "")) : "";

    // liste à gauche
    listEl.innerHTML = "";
    for (var i=0; i<sections.length; i++) {
      var s = sections[i];
      var b = document.createElement("button");
      b.type = "button";
      b.setAttribute("data-idx", String(s.index));
      b.style.display = "block";
      b.style.width = "100%";
      b.style.textAlign = "left";
      b.style.padding = "10px 12px";
      b.style.border = "none";
      b.style.borderBottom = "1px dashed #e5e7eb";
      b.style.background = "#fff";
      b.style.cursor = "pointer";
      b.appendChild(document.createTextNode(s.index + ". " + (s.title || "")));
      listEl.appendChild(b);
    }

    function show(idx) {
      var s;
      for (var k=0;k<sections.length;k++) if (sections[k].index === idx) { s = sections[k]; break; }
      if (!s) { contentEl.innerHTML = "<em>Aucune section</em>"; return; }

      // titre
      var h = document.createElement("h3");
      h.style.margin = "0 0 8px";
      h.appendChild(document.createTextNode(s.index + ". " + (s.title || "")));

      // contenu (texte brut protégé)
      var p = document.createElement("p");
      p.style.whiteSpace = "pre-wrap";
      p.style.lineHeight = "1.5";
      p.innerHTML = escapeHtml(s.content || "");

      contentEl.innerHTML = "";
      contentEl.appendChild(h);
      contentEl.appendChild(p);

      if (s.verses && s.verses.length) {
        var v = document.createElement("div");
        v.style.color = "#6366f1";
        v.style.marginTop = "8px";
        v.appendChild(document.createTextNode("Versets : " + s.verses.join(", ")));
        contentEl.appendChild(v);
      }

      // highlight
      $all("#study-list button").forEach(function(btn){ btn.style.background = "#fff"; });
      var btn = $('#study-list button[data-idx="'+ idx +'"]');
      if (btn) btn.style.background = "#f1f5f9";
    }

    listEl.onclick = function(e){
      var tgt = e.target;
      if (tgt && tgt.tagName === "BUTTON") {
        var idx = parseInt(tgt.getAttribute("data-idx"), 10) || 1;
        show(idx);
      }
    };

    if (sections.length) show(1);
    else contentEl.innerHTML = "<em>Aucune section</em>";
  }

  // ---------- action ----------
  function runStudy() {
    setStatus("génération…", true);
    contentEl.innerHTML = "<em>Patiente un instant…</em>";
    listEl.innerHTML = "";

    var selBook = findBookSelect();
    var selChapter = findChapterSelect();
    var selTrans = findTranslationSelect();

    var book = readSelectHuman(selBook, "Genèse");
    var chapter = String(readSelectHuman(selChapter, "1")).replace(/\D+/g,"") || "1";
    var translation = normTranslationLabel(readSelectHuman(selTrans, "Darby"));
    // Forcer la Darby (API Bible)
    var bibleId = "a93a92589195411f-01";

    var qs = "book=" + encodeURIComponent(book)
           + "&chapter=" + encodeURIComponent(chapter)
           + "&translation=" + encodeURIComponent(translation)
           + "&bibleId=" + encodeURIComponent(bibleId)
           + "&trace=1";

    fetch("/api/study-28?" + qs, { headers: { "accept": "application/json" }, cache: "no-store" })
      .then(function(r){ return r.json().catch(function(){ return null; }).then(function(j){ return {res:r, json:j}; }); })
      .then(function(pair){
        var r = pair.res, j = pair.json;
        if (!j || !j.ok) {
          setStatus((j && j.error) ? j.error : ("HTTP " + (r ? r.status : "?")), false);
          contentEl.innerHTML = "<pre>" + escapeHtml(JSON.stringify(j || {}, null, 2)) + "</pre>";
          return;
        }
        setStatus("Étude de " + (j.data && j.data.meta && j.data.meta.reference || (book + " " + chapter)), true);
        renderSections(j.data || {});
      })
      .catch(function(e){
        setStatus(e && e.message || String(e), false);
        contentEl.textContent = "Erreur réseau.";
      });
  }

  studyBtn.addEventListener("click", runStudy);
  printBtn.addEventListener("click", function(){ window.print(); });
})();

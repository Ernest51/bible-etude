// public/app.js — ES5 compatible, zéro dépendance
(function () {
  /* =============================
     1) Données Livres + chapitres
     ============================= */
  var BOOKS = [
    ["Genèse", 50],["Exode", 40],["Lévitique", 27],["Nombres", 36],["Deutéronome", 34],
    ["Josué", 24],["Juges", 21],["Ruth", 4],["1 Samuel", 31],["2 Samuel", 24],
    ["1 Rois", 22],["2 Rois", 25],["1 Chroniques", 29],["2 Chroniques", 36],["Esdras", 10],
    ["Néhémie", 13],["Esther", 10],["Job", 42],["Psaumes", 150],["Proverbes", 31],
    ["Ecclésiaste", 12],["Cantique des cantiques", 8],["Ésaïe", 66],["Jérémie", 52],["Lamentations", 5],
    ["Ézéchiel", 48],["Daniel", 12],["Osée", 14],["Joël", 3],["Amos", 9],
    ["Abdias", 1],["Jonas", 4],["Michée", 7],["Nahoum", 3],["Habacuc", 3],
    ["Sophonie", 3],["Aggée", 2],["Zacharie", 14],["Malachie", 4],
    ["Matthieu", 28],["Marc", 16],["Luc", 24],["Jean", 21],["Actes", 28],
    ["Romains", 16],["1 Corinthiens", 16],["2 Corinthiens", 13],["Galates", 6],["Éphésiens", 6],
    ["Philippiens", 4],["Colossiens", 4],["1 Thessaloniciens", 5],["2 Thessaloniciens", 3],["1 Timothée", 6],
    ["2 Timothée", 4],["Tite", 3],["Philémon", 1],["Hébreux", 13],["Jacques", 5],
    ["1 Pierre", 5],["2 Pierre", 3],["1 Jean", 5],["2 Jean", 1],["3 Jean", 1],
    ["Jude", 1],["Apocalypse", 22]
  ];

  /* =============================
     2) Helpers DOM + sélection
     ============================= */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function text(el) { return (el && (el.textContent || el.innerText) || "").trim(); }
  function escapeHtml(s) {
    s = String(s || "");
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  }

  function findByIds(ids) {
    for (var i=0;i<ids.length;i++) {
      var el = $("#"+ids[i]); if (el) return el;
    }
    return null;
  }

  // Heuristiques si pas d’id
  function findBookSelect() {
    var s = findByIds(["bookSelect","livre","book"]);
    if (s) return s;
    var sels = $all("select");
    for (var i=0;i<sels.length;i++) {
      var opts = $all("option", sels[i]).map(function(o){ return (o.text||o.value||"").toLowerCase(); }).join("|");
      if (/(gen[eè]se|exode|psaumes|matthieu|romains|apocalypse)/.test(opts)) return sels[i];
    }
    return null;
  }
  function findChapterSelect() {
    var s = findByIds(["chapterSelect","chapitre","chapter"]);
    if (s) return s;
    var sels = $all("select");
    for (var i=0;i<sels.length;i++) {
      var first = $all("option", sels[i]).slice(0, 12).map(function(o){ return (o.value||o.text||"").trim(); });
      var nums = first.filter(function(v){ return /^\d+$/.test(v); }).length;
      if (nums >= Math.max(5, Math.floor(first.length*0.6))) return sels[i];
    }
    return null;
  }
  function findVerseSelect() {
    return findByIds(["verseSelect","verset","verse"]);
  }
  function findVersionSelect() {
    var s = findByIds(["versionSelect","version"]);
    if (s) return s;
    var sels = $all("select");
    for (var i=0;i<sels.length;i++) {
      var opts = $all("option", sels[i]).map(function(o){ return (o.text||"").toLowerCase(); }).join("|");
      if (/(segond|darby|ostervald|parole|pdv|fran[çc]ais courant)/.test(opts)) return sels[i];
    }
    return null;
  }
  function readSelectText(sel, defVal) {
    if (!sel) return defVal || "";
    var idx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;
    var o = sel.options[idx];
    return String((o && (o.text || o.value)) || defVal || "").trim();
  }

  /* =============================
     3) Remplissage Livre/Chapitre
     ============================= */
  var S_BOOK = findBookSelect();
  var S_CHAP = findChapterSelect();
  var S_VERS = findVerseSelect();
  var S_VERSI = findVersionSelect();

  function renderBooks(select, defaultBook) {
    if (!select) return;
    select.innerHTML = "";
    for (var i=0;i<BOOKS.length;i++) {
      var opt = document.createElement("option");
      opt.value = BOOKS[i][0];
      opt.text = BOOKS[i][0];
      select.appendChild(opt);
    }
    // sélection par défaut si fournie
    if (defaultBook) {
      for (var j=0;j<select.options.length;j++) {
        if (select.options[j].text === defaultBook) { select.selectedIndex = j; break; }
      }
    }
  }
  function renderChapters(select, bookName) {
    if (!select) return;
    var max = 1, i;
    for (i=0;i<BOOKS.length;i++) if (BOOKS[i][0] === bookName) { max = BOOKS[i][1]; break; }
    select.innerHTML = "";
    for (i=1;i<=max;i++) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.text = String(i);
      select.appendChild(opt);
    }
  }
  function renderVerses(select, bookName) {
    if (!select) return;
    var max = (bookName === "Psaumes") ? 200 : 60;
    select.innerHTML = "";
    for (var i=1;i<=max;i++) {
      var opt = document.createElement("option");
      opt.value = String(i);
      opt.text = String(i);
      select.appendChild(opt);
    }
  }

  // Initialisation (avec valeurs par défaut raisonnables)
  var defaultBook = (S_BOOK && readSelectText(S_BOOK)) || "Genèse";
  renderBooks(S_BOOK, defaultBook);
  renderChapters(S_CHAP, readSelectText(S_BOOK, "Genèse"));
  renderVerses(S_VERS, readSelectText(S_BOOK, "Genèse"));

  if (S_BOOK) S_BOOK.addEventListener("change", function(){
    var b = readSelectText(S_BOOK, "Genèse");
    renderChapters(S_CHAP, b);
    renderVerses(S_VERS, b);
  });

  /* =============================
     4) BibleGateway : ouverture
     ============================= */
  function versionToBGW(vlabel) {
    var t = String(vlabel||"").toLowerCase();
    if (/darby|jnd/.test(t)) return "DARBY";
    if (/segond|lsg/.test(t)) return "LSG";
    // valeurs utiles : S21, BDS, NEG1979, PDV-FR…
    return "LSG";
  }
  function buildRef() {
    var b = readSelectText(S_BOOK, "Genèse");
    var c = readSelectText(S_CHAP, "1");
    var v = readSelectText(S_VERS, "");
    var ref = b + " " + c + (v ? ":"+v : "");
    return ref;
  }
  function openBibleGateway() {
    var ref = buildRef();
    var ver = versionToBGW(readSelectText(S_VERSI, "LSG"));
    var url = "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(ref) + "&version=" + encodeURIComponent(ver);
    window.open(url, "_blank", "noopener");
  }

  // Boutons existants (si présents)
  var BTN_READ = findByIds(["readBtn","lire","validateBtn","valider"]);
  var BTN_VALIDATE = $("#validateBtn") || $("#valider");
  if (BTN_READ) BTN_READ.addEventListener("click", openBibleGateway);
  if (BTN_VALIDATE) BTN_VALIDATE.addEventListener("click", openBibleGateway);

  /* =============================
     5) Étude auto (28) + panneau
     ============================= */
  // Ajoute un bouton à coté de “Générer” si présent, sinon en haut de page
  var BTN_GENERATE = $("#generateBtn") || $all("button, [role=button]").filter(function(b){
    return text(b).toLowerCase().indexOf("générer") !== -1;
  })[0];

  var btnStudy = document.createElement("button");
  btnStudy.type = "button";
  btnStudy.appendChild(document.createTextNode("Étude auto (28)"));
  btnStudy.style.marginLeft = "10px";
  btnStudy.style.background = "#0f172a";
  btnStudy.style.color = "#fff";
  btnStudy.style.border = "1px solid #1f2937";
  btnStudy.style.borderRadius = "10px";
  btnStudy.style.padding = "8px 12px";
  btnStudy.style.cursor = "pointer";
  btnStudy.style.fontWeight = "600";

  if (BTN_GENERATE && BTN_GENERATE.parentElement) {
    BTN_GENERATE.parentElement.appendChild(btnStudy);
  } else {
    document.body.insertBefore(btnStudy, document.body.firstChild);
  }

  // Panneau simple (liste à gauche, contenu à droite)
  var panel = document.createElement("section");
  panel.style.margin = "16px 0";
  panel.style.border = "1px solid #e5e7eb";
  panel.style.borderRadius = "12px";
  panel.style.background = "#fff";
  var head = document.createElement("div");
  head.style.padding = "12px 14px";
  head.style.borderBottom = "1px solid #e5e7eb";
  head.style.display = "flex";
  head.style.gap = "10px";
  head.style.alignItems = "center";
  head.style.flexWrap = "wrap";
  var htitle = document.createElement("strong");
  htitle.appendChild(document.createTextNode("Étude (28 points)"));
  head.appendChild(htitle);
  var hmeta = document.createElement("span"); hmeta.style.color = "#64748b"; head.appendChild(hmeta);
  var hstatus = document.createElement("span"); hstatus.style.marginLeft="auto"; head.appendChild(hstatus);
  var body = document.createElement("div");
  body.style.display = "grid";
  body.style.gridTemplateColumns = "320px 1fr";
  var aside = document.createElement("aside");
  aside.style.borderRight = "1px solid #e5e7eb";
  aside.style.maxHeight = "70vh";
  aside.style.overflow = "auto";
  var main = document.createElement("main");
  main.style.padding = "16px";
  main.innerHTML = "<em>Cliquer « Étude auto (28) »</em>";
  body.appendChild(aside); body.appendChild(main);
  panel.appendChild(head); panel.appendChild(body);

  // Placement du panneau
  if (BTN_GENERATE && BTN_GENERATE.closest && BTN_GENERATE.closest("section")) {
    BTN_GENERATE.closest("section").parentElement.appendChild(panel);
  } else {
    document.body.appendChild(panel);
  }

  function setStatus(msg, ok) {
    hstatus.textContent = msg || "";
    hstatus.style.color = ok === false ? "#dc2626" : "#16a34a";
  }

  function renderSections(payload) {
    var meta = payload && payload.meta || {};
    var sections = payload && payload.sections || [];
    hmeta.textContent = sections.length ? ("OSIS: " + (meta.osis||"?") + " · Trad: " + (meta.translation||"")) : "";

    aside.innerHTML = "";
    for (var i=0;i<sections.length;i++) {
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
      aside.appendChild(b);
    }

    function show(idx){
      var s, k;
      for (k=0;k<sections.length;k++) if (sections[k].index === idx) { s = sections[k]; break; }
      if (!s) { main.innerHTML = "<em>Aucune section</em>"; return; }
      var h3 = document.createElement("h3");
      h3.style.margin = "0 0 8px";
      h3.appendChild(document.createTextNode(s.index + ". " + (s.title||"")));
      var p = document.createElement("p");
      p.style.whiteSpace = "pre-wrap";
      p.style.lineHeight = "1.5";
      p.innerHTML = escapeHtml(s.content || "");
      main.innerHTML = ""; main.appendChild(h3); main.appendChild(p);
      if (s.verses && s.verses.length) {
        var v = document.createElement("div");
        v.style.color = "#6366f1"; v.style.marginTop = "8px";
        v.appendChild(document.createTextNode("Versets : " + s.verses.join(", ")));
        main.appendChild(v);
      }
      $all("aside button", panel).forEach(function(btn){ btn.style.background = "#fff"; });
      var cur = aside.querySelector('button[data-idx="'+idx+'"]'); if (cur) cur.style.background = "#f1f5f9";
    }
    aside.onclick = function(e){ if (e.target && e.target.tagName === "BUTTON") show(parseInt(e.target.getAttribute("data-idx"),10)||1); };
    if (sections.length) show(1); else main.innerHTML = "<em>Aucune section</em>";
  }

  function runStudy() {
    setStatus("génération…", true);
    main.innerHTML = "<em>Patiente un instant…</em>";
    aside.innerHTML = "";

    var book = readSelectText(S_BOOK, "Genèse");
    var chapter = readSelectText(S_CHAP, "1");
    var verLbl = readSelectText(S_VERSI, "LSG");
    var translation = (/darby|jnd/i.test(verLbl) ? "JND" : (/segond|lsg/i.test(verLbl) ? "LSG" : "JND"));
    var bibleId = (/JND/.test(translation) ? "a93a92589195411f-01" : ""); // Darby → id api.bible ; LSG → vide (laisser défaut si tu veux)

    var qs = "book=" + encodeURIComponent(book)
           + "&chapter=" + encodeURIComponent(chapter)
           + "&translation=" + encodeURIComponent(translation)
           + (bibleId ? "&bibleId="+encodeURIComponent(bibleId) : "")
           + "&trace=1";

    fetch("/api/study-28?" + qs, { headers: { "accept":"application/json" }, cache:"no-store" })
      .then(function(r){ return r.json().catch(function(){ return null; }).then(function(j){ return {res:r, json:j}; }); })
      .then(function(pair){
        var r = pair.res, j = pair.json;
        if (!j || !j.ok) {
          setStatus((j && j.error) ? j.error : ("HTTP " + (r ? r.status : "?")), false);
          main.innerHTML = "<pre>"+escapeHtml(JSON.stringify(j||{}, null, 2))+"</pre>";
          return;
        }
        var ref = j.data && j.data.meta && j.data.meta.reference || (book+" "+chapter);
        setStatus("Étude de " + ref, true);
        renderSections(j.data || {});
      })
      .catch(function(e){
        setStatus(e && e.message || String(e), false);
        main.textContent = "Erreur réseau.";
      });
  }

  btnStudy.addEventListener("click", runStudy);

  /* =============================
     6) Petite recherche rapide
     ============================= */
  var SEARCH = $("#searchRef") || $("#search");
  if (SEARCH) {
    SEARCH.addEventListener("keydown", function(e){
      if (e.key === "Enter") {
        var m = String(SEARCH.value || "").match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
        if (!m) return;
        var name = (m[1]||"").trim();
        var chap = (m[2]||"1").trim();
        var i, j;
        // pick first book starting with that name (accent-insensitive)
        function norm(s){ return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
        var target = null;
        for (i=0;i<BOOKS.length;i++) if (norm(BOOKS[i][0]).indexOf(norm(name)) === 0) { target = BOOKS[i][0]; break; }
        if (!target) return;
        if (S_BOOK) {
          for (j=0;j<S_BOOK.options.length;j++) if (S_BOOK.options[j].text === target) { S_BOOK.selectedIndex = j; break; }
          renderChapters(S_CHAP, target);
          renderVerses(S_VERS, target);
        }
        if (S_CHAP) {
          for (j=0;j<S_CHAP.options.length;j++) if (S_CHAP.options[j].value === chap) { S_CHAP.selectedIndex = j; break; }
        }
      }
    });
  }

})();

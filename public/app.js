/* public/app.js — version sans :has() / :contains(), avec 2 garde-fous
   - Boutons: #generateBtn, #readBtn, #validate
   - Sélecteurs: #bookSelect, #chapterSelect, #verseSelect, #versionSelect
   - Éditeur: #pointsList, #noteArea, #noteView, #enrichToggle, #metaInfo
   - Barre de progression optionnelle: #progressBar
   - Panneau liens: #linksPanel, #linksList
   - Journal: #debugPanel (facultatif)

   Garde-fou #1: nettoyage/sanitisation des contenus avant injection
   Garde-fou #2: anti-crash réseau (retry + fallback hors-ligne lisible)
*/

(function () {
  // ---------- util DOM ----------
  const $ = (id) => document.getElementById(id);

  // éléments (tous optionnels: le code vérifie leur présence)
  const bookSelect    = $("bookSelect");
  const chapterSelect = $("chapterSelect");
  const verseSelect   = $("verseSelect");
  const versionSelect = $("versionSelect");

  const generateBtn = $("generateBtn");
  const readBtn     = $("readBtn");
  const validateBtn = $("validate");

  const pointsList = $("pointsList");
  const noteArea   = $("noteArea");
  const noteView   = $("noteView");
  const enrichToggle = $("enrichToggle");
  const metaInfo   = $("metaInfo");

  const progressBar = $("progressBar");
  const linksPanel  = $("linksPanel");
  const linksList   = $("linksList");
  const debugPanel  = $("debugPanel");

  const setProgress = (p) => {
    if (!progressBar) return;
    const v = Math.max(0, Math.min(100, Number(p) || 0));
    progressBar.style.width = v + "%";
  };

  const log = (msg) => {
    try {
      const line = `[${new Date().toISOString()}] ${msg}`;
      console.log(line);
      if (debugPanel) {
        debugPanel.style.display = "block";
        debugPanel.textContent += (debugPanel.textContent ? "\n" : "") + line;
      }
    } catch {}
  };

  // ---------- Livre/chapitres ----------
  // (liste officielle FR, comme plus tôt ; utilisée si les <select> existent)
  const BOOKS = [
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
    ["Jude", 1],["Apocalypse", 22],
  ];

  function renderBooks() {
    if (!bookSelect) return;
    bookSelect.innerHTML = "";
    BOOKS.forEach(([n, ch]) => {
      const o = document.createElement("option");
      o.value = n; o.textContent = n; o.dataset.ch = String(ch);
      bookSelect.appendChild(o);
    });
  }
  function renderChapters() {
    if (!bookSelect || !chapterSelect) return;
    chapterSelect.innerHTML = "";
    const ch = bookSelect.selectedOptions[0] ? +bookSelect.selectedOptions[0].dataset.ch : 1;
    const max = Math.max(1, ch);
    for (let i = 1; i <= max; i++) {
      const o = document.createElement("option");
      o.value = String(i); o.textContent = String(i);
      chapterSelect.appendChild(o);
    }
  }
  function renderVerses(maxGuess = 60) {
    if (!verseSelect) return;
    verseSelect.innerHTML = "";
    const m = Math.max(1, Math.min(200, maxGuess));
    for (let i = 1; i <= m; i++) {
      const o = document.createElement("option");
      o.value = String(i); o.textContent = String(i);
      verseSelect.appendChild(o);
    }
  }

  // ---------- Trame 28 rubriques (fixe) ----------
  const FIXED_POINTS = [
    { t: "Prière d’ouverture" },
    { t: "Canon et testament" },
    { t: "Questions du chapitre précédent" },
    { t: "Titre du chapitre" },
    { t: "Contexte historique" },
    { t: "Structure littéraire" },
    { t: "Genre littéraire" },
    { t: "Thème central" },
    { t: "Résumé en une phrase" },
    { t: "Mots-clés" },
    { t: "Termes clés (définis)" },
    { t: "Personnages et lieux" },
    { t: "Problème / Question de départ" },
    { t: "Idées majeures (développement)" },
    { t: "Verset pivot (climax)" },
    { t: "Références croisées (AT)" },
    { t: "Références croisées (NT)" },
    { t: "Parallèles bibliques" },
    { t: "Lien avec l’Évangile (Christocentrique)" },
    { t: "Vérités doctrinales (3–5)" },
    { t: "Promesses et avertissements" },
    { t: "Principes intemporels" },
    { t: "Applications personnelles (3–5)" },
    { t: "Applications communautaires" },
    { t: "Questions pour petits groupes (6)" },
    { t: "Prière guidée" },
    { t: "Méditation courte" },
    { t: "Versets à mémoriser (2–3)" },
    { t: "Difficultés/objections & réponses" },
    { t: "Ressources complémentaires" },
  ];
  const N = 28; // nombre réel à injecter dans l’éditeur (les 28 premiers)

  // ---------- État éditeur ----------
  let current = 0;
  let notes = {}; // index -> texte

  function renderSidebar() {
    if (!pointsList) return;
    pointsList.innerHTML = "";
    FIXED_POINTS.slice(0, N).forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === current ? " active" : "");
      row.dataset.idx = String(i);
      row.innerHTML = `
        <span class="idx">${i + 1}</span>
        <div><div>${escapeHtml(r.t)}</div></div>
        <span class="dot ${notes[i] && notes[i].trim() ? "ok" : ""}"></span>`;
      row.addEventListener("click", () => { if (current !== i) select(i); });
      pointsList.appendChild(row);
    });
  }
  function select(i) {
    if (noteArea && i !== current) notes[current] = noteArea.value;
    saveLocal();
    current = i;
    if (pointsList) {
      pointsList.querySelectorAll(".item").forEach((el) => {
        el.classList.toggle("active", +el.dataset.idx === current);
      });
    }
    if ($("edTitle")) $("edTitle").textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    renderViewFromArea();
    updateLinksPanel();
    if (enrichToggle && enrichToggle.checked) { noteView && noteView.focus(); } else { noteArea && noteArea.focus(); }
  }
  function renderSidebarDots() {
    if (!pointsList) return;
    pointsList.querySelectorAll(".item").forEach((el) => {
      const i = +el.dataset.idx;
      const dot = el.querySelector(".dot");
      if (!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
  }
  function saveLocal() {
    try { localStorage.setItem("be_notes", JSON.stringify(notes)); renderSidebarDots(); } catch {}
  }
  function loadLocal() {
    try { notes = JSON.parse(localStorage.getItem("be_notes") || "{}") || {}; } catch { notes = {}; }
  }

  // ---------- Garde-fou #1 : sanitisation ----------
  function stripDangerousTags(html) {
    if (!html) return "";
    let s = String(html);
    s = s.replace(/<!--[\s\S]*?-->/g, "");
    s = s.replace(/&nbsp;/g, " ");
    // conserver gras/italique simples sous forme markdown léger
    s = s.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    s = s.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    s = s.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    s = s.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    s = s.replace(/<\/p>/gi, '\n\n');
    s = s.replace(/<\/h[1-6]>/gi, '\n\n');
    s = s.replace(/<br\s*\/?>/gi, '\n');
    s = s.replace(/<\/?[^>]+>/g, '');
    s = s.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, '\n\n').trim();
    return s;
  }
  function sanitizeBasic(text){
    return String(text||"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function escapeHtml(s=""){
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  // ---------- Rendu enrichi ----------
  const BOOK_TITLES = BOOKS.map(([n]) => n);
  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const bookAlt = BOOK_TITLES.map(escapeRegExp).join("|");
  const refRe = new RegExp(`\\b(${bookAlt})\\s+(\\d+)(?::(\\d+(?:[–-]\\d+)?))?(?:[–-](\\d+))?`, "gi");

  function bgwUrl(search, version){
    return `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${encodeURIComponent(version||"LSG")}`;
  }
  function makeBGWLink(book, chap, verseOrRange, chapEnd){
    const version = (versionSelect && versionSelect.value) || "LSG";
    if (chapEnd) return bgwUrl(`${book} ${chap}-${chapEnd}`, version);
    if (verseOrRange) return bgwUrl(`${book} ${chap}:${verseOrRange}`, version);
    return bgwUrl(`${book} ${chap}`, version);
  }

  function stripNbsp(raw){ return String(raw||"").replace(/&nbsp;/g, " ").replace(/\s{2,}/g, " "); }
  function stripHtmlComments(raw){ return String(raw||"").replace(/<!--[\s\S]*?-->/g, ""); }

  function mdLite(html){
    return html
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
  }
  function fixAdjacentRefs(htmlEscaped){
    const bookUnion = BOOK_TITLES.map(escapeRegExp).join("|");
    const pattern = new RegExp(`((?:\\d|\\d[–-]\\d))(?:\\s*)(${bookUnion}\\s+\\d)`, "g");
    return htmlEscaped.replace(pattern, (_m, prev, next) => `${prev} · ${next}`);
  }
  function boldBibleRefs(htmlEscaped){
    return htmlEscaped.replace(refRe, (m)=> `**${m}**`);
  }
  function autolinkURLs(html){
    return html.replace(/(\bhttps?:\/\/[^\s<>"'()]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function autolinkBible(html){
    return html.replace(refRe, (m,bk,ch,vr,chEnd)=>{
      const url = makeBGWLink(bk, ch, vr||"", chEnd||"");
      return `<a href="${url}" target="_blank" rel="noopener">${m}</a>`;
    });
  }
  function wrapParagraphs(html){
    const blocks = String(html||"").split(/\n{2,}/);
    return blocks.map(b=>{
      if (!b.trim()) return "";
      return "<p>"+b.replace(/\n/g,"<br>")+"</p>";
    }).join("");
  }
  function renderViewFromArea(){
    if (!noteArea || !noteView) return;
    const raw = noteArea.value || "";
    let html = sanitizeBasic(raw);
    html = fixAdjacentRefs(html);
    html = boldBibleRefs(html);
    html = mdLite(html);
    html = autolinkURLs(html);
    html = autolinkBible(html);
    html = wrapParagraphs(html);
    noteView.innerHTML = html || "<p style='color:#9aa2b1'>Écris ici…</p>";
  }
  function syncAreaFromView(){
    if (!noteArea || !noteView) return;
    let html = noteView.innerHTML || "";
    html = html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
    html = html.replace(/<br\s*\/?>/gi, "\n");
    html = html.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi,"");
    html = html.replace(/<\/?strong>/gi, "**").replace(/<\/?em>/gi, "*");
    html = html.replace(/<!--[\s\S]*?-->/g, "");
    html = html.replace(/&nbsp;/g, " ");
    html = html.replace(/<\/?[^>]+>/g,"");
    html = html.replace(/\n{3,}/g,"\n\n").trim();
    noteArea.value = html;
    notes[current] = noteArea.value;
    saveLocal();
    updateLinksPanel();
  }
  if (noteView) {
    noteView.addEventListener("click", (e)=>{
      const a = e.target.closest && e.target.closest("a");
      if (a && a.href) { e.preventDefault(); window.open(a.href, "_blank", "noopener"); }
    });
    noteView.addEventListener("input", syncAreaFromView);
  }

  // enrich toggle
  function applyEnrichMode(){
    if (!noteArea || !noteView || !enrichToggle) return;
    const on = !!enrichToggle.checked;
    if (on){
      noteArea.style.display = "none";
      noteView.style.display = "block";
      renderViewFromArea();
      noteView.focus();
    } else {
      noteView.style.display = "none";
      noteArea.style.display = "block";
      noteArea.focus();
    }
  }
  if (enrichToggle) enrichToggle.addEventListener("change", applyEnrichMode);

  // liens panel
  function extractLinks(text) {
    const links = [];
    const raw = String(text || "");
    const aTagRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let m; while ((m = aTagRe.exec(raw))) { links.push({ url: m[1], label: m[2] || m[1] }); }
    const urlRe = /https?:\/\/[^\s<>"'()]+/g;
    let n; while ((n = urlRe.exec(raw))) { const url = n[0]; if (!links.find(l => l.url === url)) links.push({ url, label: url }); }
    return links;
  }
  function findBibleRefs(text){
    const out = []; const seen = new Set();
    const raw = String(text || "");
    let m;
    while ((m = refRe.exec(raw))) {
      const book = m[1], chap = m[2], verseOrRange = m[3] || "", chapEnd = m[4] || "";
      let search = chapEnd ? `${book} ${chap}-${chapEnd}` : (verseOrRange ? `${book} ${chap}:${verseOrRange}` : `${book} ${chap}`);
      const url = bgwUrl(search, (versionSelect && versionSelect.value) || "LSG");
      const key = search+"||"+url;
      if (!seen.has(key)) { out.push({ url, label: m[0] }); seen.add(key); }
    }
    return out;
  }
  function updateLinksPanel() {
    if (!linksPanel || !linksList || !noteArea) return;
    const txt = noteArea.value || "";
    const urlLinks = extractLinks(txt);
    const bibleLinks = findBibleRefs(txt);
    const merged = []; const seen = new Set();
    for (const l of [...bibleLinks, ...urlLinks]) { if (seen.has(l.url)) continue; merged.push(l); seen.add(l.url); }
    linksList.innerHTML = "";
    if (!merged.length) { linksPanel.classList.add("empty"); return; }
    linksPanel.classList.remove("empty");
    for (const l of merged) {
      const a = document.createElement("a");
      a.href = l.url; a.target = "_blank"; a.rel = "noopener"; a.textContent = l.label;
      const div = document.createElement("div"); div.appendChild(a); linksList.appendChild(div);
    }
  }

  // ---------- Référence courante ----------
  function buildReference() {
    if (!bookSelect || !chapterSelect) return "";
    const b = bookSelect.value;
    const c = chapterSelect.value;
    const v = (verseSelect && verseSelect.value) || "";
    if (!b || !c) return "";
    return `${b} ${c}${v ? ":"+v : ""}`;
  }
  function bgwLink(book, chap, vers, version) {
    const core = `${book} ${chap}${vers ? ':'+vers : ''}`;
    return bgwUrl(core, version || (versionSelect && versionSelect.value) || "LSG");
  }

  // ---------- Garde-fou #2 : fetch robuste ----------
  async function fetchJSON(url, opts = {}, tries = 2) {
    let last;
    for (let i=0;i<Math.max(1,tries);i++){
      try {
        const r = await fetch(url, { ...opts, headers: { ...(opts.headers||{}), "accept":"application/json", "cache-control":"no-store" } });
        const text = await r.text();
        const ct = r.headers.get("content-type") || "";
        if (!r.ok) throw new Error(text || `HTTP ${r.status}`);
        if (/application\/json/i.test(ct)) {
          return JSON.parse(text);
        }
        // si non-JSON, on essaie quand même
        return { ok:false, raw:text };
      } catch(e){
        last = e;
        await new Promise(res=>setTimeout(res, 350*(i+1)));
      }
    }
    throw last || new Error("fetch failed");
  }

  // ---------- Récup & injection étude ----------
  const Study28 = {
    async callAPI() {
      if (!bookSelect || !chapterSelect) throw new Error("Sélection livre/chapitre indisponible.");
      const book  = bookSelect.value || "Genèse";
      const chap  = chapterSelect.value || "1";
      const verse = ""; // on laisse vide (chapitre entier), ton diag propose 1–199 si besoin
      const trans = (versionSelect && versionSelect.value) || "JND";

      const usp = new URLSearchParams({ book, chapter: chap, translation: trans, trace: "1" });
      if (verse) usp.set("verse", verse);

      const url = "/api/study-28?" + usp.toString();
      log(`[API] GET ${url}`);
      const j = await fetchJSON(url, {}, 2);
      if (!j || j.ok === false) throw new Error(j?.error || "Réponse API invalide");
      return j;
    },

    // map de la réponse API vers les 28 emplacements (on prend index 1..28)
    fillFromAPI(data) {
      const sections = Array.isArray(data?.sections) ? data.sections : [];
      const map = {}; // i->content
      for (const s of sections) {
        const idx = (s.index|0) - 1;
        if (idx >= 0 && idx < N) {
          map[idx] = stripDangerousTags(String(s.content || "").trim());
        }
      }
      // Prière d’ouverture / Prière de fin par défaut si vides
      const ref = data?.meta?.reference || buildReference() || "";
      if (!map[0])  map[0]  = `Père, éclaire notre lecture de **${ref}**. Ouvre nos cœurs par l’Esprit. Amen.`;
      if (!map[25]) map[25] = `Relisons **${ref}**, et rendons grâce pour ta Parole.`;
      // appliquer
      notes = map;
      saveLocal();
      renderSidebar(); select(0); renderSidebarDots();
      log(`[GEN] sections=${sections.length} → étude injectée`);
    },

    async generateAndInject() {
      try {
        setProgress(10);
        const j = await this.callAPI();
        setProgress(60);
        this.fillFromAPI(j.data || {});
        setProgress(100);
        setTimeout(()=>setProgress(0), 400);
      } catch (e) {
        // fallback hors-ligne minimal pour ne pas bloquer l’UI
        console.warn(e);
        alert(`Échec API: ${e?.message || e}. Un contenu minimal sera injecté.`);
        const ref = buildReference() || "Passage";
        const minimal = Array.from({length:N}, (_,i)=>({
          index:i+1, title: FIXED_POINTS[i].t,
          content: `${FIXED_POINTS[i].t} (${ref}).`
        }));
        this.fillFromAPI({ sections: minimal, meta:{ reference:ref }});
      }
    }
  };

  // exposer pour debug (facultatif)
  window.__Study28 = Study28;

  // ---------- câblage boutons (sans :has / :contains) ----------
  function wireButtons() {
    if (generateBtn) {
      generateBtn.addEventListener("click", () => Study28.generateAndInject());
    }
    if (readBtn) {
      readBtn.addEventListener("click", () => {
        const b = bookSelect?.value || "Genèse";
        const c = chapterSelect?.value || "1";
        const v = verseSelect?.value || "";
        const ver = versionSelect?.value || "LSG";
        const url = bgwLink(b, c, v, ver);
        window.open(url, "_blank", "noopener");
      });
    }
    if (validateBtn) {
      validateBtn.addEventListener("click", () => {
        const b = bookSelect?.value || "Genèse";
        const c = chapterSelect?.value || "1";
        const v = verseSelect?.value || "";
        const ver = versionSelect?.value || "LSG";
        const url = bgwLink(b, c, v, ver);
        window.open(url, "_blank", "noopener");
      });
    }
  }

  // ---------- autosave + rendu enrichi ----------
  if (noteArea) {
    noteArea.addEventListener("input", () => {
      notes[current] = noteArea.value;
      saveLocal();
      renderViewFromArea();
      updateLinksPanel();
    });
  }

  // ---------- initialisation ----------
  (function init(){
    loadLocal();
    renderBooks();
    renderChapters();
    renderVerses(bookSelect && bookSelect.value === "Psaumes" ? 200 : 60);
    renderSidebar(); select(0);
    renderSidebarDots();
    applyEnrichMode();
    updateLinksPanel();
    wireButtons();

    // réactions au changement livre/chapitre
    if (bookSelect) {
      bookSelect.addEventListener("change", () => {
        renderChapters();
        renderVerses(bookSelect.value === "Psaumes" ? 200 : 60);
        // auto: ne pas déclencher génération sans clic utilisateur
      });
    }
    if (chapterSelect) chapterSelect.addEventListener("change", () => {/* noop */});
    if (verseSelect)   verseSelect.addEventListener("change", () => {/* noop */});

    // stamp version (facultatif)
    const y = $("y"); if (y) y.textContent = new Date().getFullYear();

    log("app.js initialisé.");
  })();

})();

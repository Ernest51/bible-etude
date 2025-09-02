// public/app.js — FRONT complété et corrigé (liens cliquables + prière forcée + rubrique 3 canevas)
// + HOOKS d'événements pour mise à jour fiable des pastilles & intégrations UI

(function () {
  // ---------- helpers UI ----------
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => { if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => { if (!el) return; el.disabled = !!on; el.classList.toggle("opacity-60", !!on); el.textContent = on ? "Génération..." : el.dataset.label || el.textContent; };
  const dpanel = $("debugPanel"); const dbtn = $("debugBtn"); const dlog = (msg) => { if (!dpanel) return; dpanel.style.display = "block"; dbtn && (dbtn.textContent = "Fermer Debug"); const line = `[${new Date().toISOString()}] ${msg}`; dpanel.textContent += (dpanel.textContent ? "\n" : "") + line; console.log(line); };
  const setMini = (dot, ok) => { if (!dot) return; dot.classList.remove("ok", "ko"); if (ok === true) dot.classList.add("ok"); else if (ok === false) dot.classList.add("ko"); };

  // ---------- HOOK dispatcher ----------
  const HOOK = (name, detail) => {
    try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) { /* no-op */ }
  };

  const searchRef = $("searchRef"), bookSelect = $("bookSelect"), chapterSelect = $("chapterSelect"),
        verseSelect = $("verseSelect"), versionSelect = $("versionSelect"),
        validateBtn = $("validate"), generateBtn = $("generateBtn"),
        pointsList = $("pointsList"), edTitle = $("edTitle"), noteArea = $("noteArea"),
        prevBtn = $("prev"), nextBtn = $("next"),
        metaInfo = $("metaInfo"), themeSelect = $("themeSelect"),
        enrichToggle = $("enrichToggle"),
        dotHealth = $("dot-health"), dotChat = $("dot-chat"), dotPing = $("dot-ping"),
        linksPanel = $("linksPanel"), linksList = $("linksList");

  $("y").textContent = new Date().getFullYear();

  // ---------- livres / chapitres ----------
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
  const NT_START_INDEX = BOOKS.findIndex(([n]) => n === "Matthieu");

  function renderBooks() {
    bookSelect.innerHTML = "";
    BOOKS.forEach(([n, ch]) => {
      const o = document.createElement("option"); o.value = n; o.textContent = n; o.dataset.ch = ch; bookSelect.appendChild(o);
    });
  }
  function renderChapters() {
    chapterSelect.innerHTML = "";
    const ch = bookSelect.selectedOptions[0] ? +bookSelect.selectedOptions[0].dataset.ch : 1;
    for (let i = 1; i <= ch; i++) { const o = document.createElement("option"); o.value = String(i); o.textContent = String(i); chapterSelect.appendChild(o); }
  }
  function renderVerses(max = 60) {
    verseSelect.innerHTML = "";
    const m = Math.max(1, Math.min(200, max));
    for (let i = 1; i <= m; i++) { const o = document.createElement("option"); o.value = String(i); o.textContent = String(i); verseSelect.appendChild(o); }
  }

  // ---------- rubriques ----------
  const FIXED_POINTS = [
    { t: "Prière d’ouverture", d: "Invocation du Saint-Esprit pour éclairer l’étude." },
    { t: "Canon et testament", d: "Identification du livre selon le canon biblique." },
    { t: "Questions du chapitre précédent", d: "(Min. 5) Réponses intégrales, éléments de compréhension exigés." },
    { t: "Titre du chapitre", d: "Résumé doctrinal synthétique du chapitre étudié." },
    { t: "Contexte historique", d: "Période, géopolitique, culture, carte localisée à l’époque." },
    { t: "Structure littéraire", d: "Séquençage narratif et composition interne du chapitre." },
    { t: "Genre littéraire", d: "Type de texte : narratif, poétique, prophétique, etc." },
    { t: "Auteur et généalogie", d: "Présentation de l’auteur et son lien aux patriarches." },
    { t: "Verset-clé doctrinal", d: "Verset central du chapitre avec lien cliquable." },
    { t: "Analyse exégétique", d: "Commentaire mot-à-mot avec références au grec/hébreu." },
    { t: "Analyse lexicale", d: "Analyse des mots-clés originaux et leur sens doctrinal." },
    { t: "Références croisées", d: "Passages parallèles ou complémentaires." },
    { t: "Fondements théologiques", d: "Doctrines majeures du chapitre." },
    { t: "Thème doctrinal", d: "Lien avec les 22 grands thèmes doctrinaux." },
    { t: "Fruits spirituels", d: "Vertus et attitudes inspirées par le chapitre." },
    { t: "Types bibliques", d: "Symboles / figures typologiques." },
    { t: "Appui doctrinal", d: "Autres passages qui renforcent l’enseignement." },
    { t: "Comparaison entre versets", d: "Mise en relief au sein du chapitre." },
    { t: "Comparaison avec Actes 2", d: "Parallèle avec le début de l’Église." },
    { t: "Verset à mémoriser", d: "Verset essentiel à retenir." },
    { t: "Enseignement pour l’Église", d: "Implications collectives / ecclésiales." },
    { t: "Enseignement pour la famille", d: "Valeurs à transmettre dans le foyer." },
    { t: "Enseignement pour enfants", d: "Approche simplifiée, jeux, récits, visuels." },
    { t: "Application missionnaire", d: "Comment le texte guide l’évangélisation." },
    { t: "Application pastorale", d: "Conseils pour ministres / enseignants." },
    { t: "Application personnelle", d: "Examen de conscience et engagement." },
    { t: "Versets à retenir", d: "Incontournables pour prédication pastorale." },
    { t: "Prière de fin", d: "Clôture spirituelle avec reconnaissance." },
  ];
  const N = FIXED_POINTS.length;

  // ---------- état ----------
  let current = 0, notes = {}, autosaveTimer = null, autoTimer = null, inFlight = false;

  function renderSidebar() {
    pointsList.innerHTML = "";
    FIXED_POINTS.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === current ? " active" : "");
      row.dataset.idx = i;
      row.innerHTML = `
        <span class="idx">${i + 1}</span>
        <div><div>${r.t}</div><span class="desc">${r.d || ""}</span></div>
        <span class="dot ${notes[i] && notes[i].trim() ? "ok" : ""}"></span>`;
      row.addEventListener("click", () => { if (current !== i) select(i); });
      pointsList.appendChild(row);
    });
    HOOK('be:sidebar-rendered', {
      current,
      filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k)
    });
  }
  function renderSidebarDots() {
    document.querySelectorAll(".list .item").forEach((el) => {
      const i = +el.dataset.idx, dot = el.querySelector(".dot");
      if (!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
    HOOK('be:sidebar-dots', {
      filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k)
    });
  }

  function select(i) {
    // --- FIX: ne pas écraser la note si on reste sur la même rubrique
    if (noteArea && i !== current) notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document.querySelectorAll(".list .item").forEach((el) => el.classList.toggle("active", +el.dataset.idx === current));
    if (edTitle) edTitle.textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    updateLinksPanel(); // MAJ liens à l'affichage
    if (noteArea) noteArea.focus();
    HOOK('be:point-selected', { index: i, hasContent: !!(notes[i] && notes[i].trim()) });
  }

  function saveStorage() {
    try { localStorage.setItem("be_notes", JSON.stringify(notes)); renderSidebarDots(); } catch {}
  }

  // ---------- util ----------
  const norm = (s) => String(s || "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9: ]+/g, " ")
    .replace(/\s+/g, " ").trim();

  function parseSearch(q) {
    q = (q || "").trim();
    const m = q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
    if (!m) return null;
    const title = norm(m[1]);
    let book = null;
    for (const [name] of BOOKS) { if (norm(name) === title) { book = name; break; } }
    if (!book) { const cand = BOOKS.find(([name]) => norm(name).startsWith(title)); if (cand) book = cand[0]; }
    if (!book) return null;
    return { book, chap: +m[2], vers: m[3] ? +m[3] : null };
  }
  function applySelection(sel) {
    if (!sel) return;
    const idx = BOOKS.findIndex(([n]) => n === sel.book);
    if (idx >= 0) bookSelect.selectedIndex = idx;
    renderChapters();
    const chMax = bookSelect.selectedOptions[0] ? +bookSelect.selectedOptions[0].dataset.ch : 1;
    const chap = Math.max(1, Math.min(chMax, sel.chap || 1));
    chapterSelect.value = String(chap);
    renderVerses(sel.book === "Psaumes" ? 200 : 60);
    if (sel.vers) verseSelect.value = String(sel.vers);
  }
  function buildReference() {
    const typed = (searchRef && searchRef.value || "").trim();
    if (typed) return typed;
    if (!bookSelect || !chapterSelect) return "";
    const b = bookSelect.value, c = chapterSelect.value;
    return c ? `${b} ${c}` : b;
  }

  // ---------- thème ----------
  themeSelect.addEventListener("change", () => {
    document.body.setAttribute("data-theme", themeSelect.value);
  });

  // ---------- garde-fous / gabarits ----------
  const forcePrayerOpen = true;

  function bgwLink(book, chap, vers, version) {
    const ref = encodeURIComponent(`${book} ${chap}${vers ? ':'+vers : ''}`);
    const v = encodeURIComponent(version || "LSG");
    return `https://www.biblegateway.com/passage/?search=${ref}&version=${v}`;
  }

  function defaultPrayerOpen() {
    const book = bookSelect.value, c = chapterSelect.value, v = verseSelect.value;
    const ref = `${book} ${c}${v ? ':'+v : ''}`;
    return `Père saint, nous nous approchons de toi pour méditer **${ref}**. Par ton Esprit, ouvre notre intelligence, purifie nos intentions, et fais naître en nous l’amour de ta volonté. Que ta Parole façonne notre pensée, notre prière et nos décisions. Au nom de Jésus, amen.`;
  }
  function defaultPrayerClose() {
    const book = bookSelect.value, c = chapterSelect.value;
    return `Dieu de grâce, merci pour la lumière reçue dans **${book} ${c}**. Fortifie notre foi, accorde-nous d’obéir avec joie et de servir avec humilité. Garde ton Église dans la paix du Christ. Amen.`;
  }

  // Canevas rempli pour la rubrique 3
  function buildRevisionSection() {
    const book = bookSelect.value, c = chapterSelect.value, v = versionSelect.value || "LSG";
    const url = bgwLink(book, c, null, v);
    return [
      `Révision sur ${book} ${c} — **5 questions**`,
      ``,
      `1) **Observation** — Quels sont les 3 faits majeurs du texte ? Quels mots-clés ou refrains reviennent ?`,
      `2) **Compréhension** — Que révèle ce chapitre sur Dieu (attributs, intentions) et sur l’humain (vocation, limites) ?`,
      `3) **Interprétation** — Quel verset-clef structure le passage, et pourquoi ? Comment relie-t-il ouverture et conclusion ?`,
      `4) **Connexions bibliques** — Citer 1–2 passages parallèles/échos et expliquer le lien (promesse, accomplissement, sagesse, évangile).`,
      `5) **Application** — Décider une mise en pratique concrète (personnelle / famille / église) pour cette semaine.`,
      ``,
      `**Bonus** — Un verset à mémoriser du chapitre et une courte prière de réponse.`,
      ``,
      `➡ Lien de lecture : ${url}`
    ].join("\n");
  }

  // ---------- cache navigateur ----------
  const cacheKey = (ref, ver) => `be_cache:${ref}::${ver || "LSG"}`;
  const loadCache = (ref, ver) => { try { return JSON.parse(localStorage.getItem(cacheKey(ref, ver)) || "null"); } catch { return null; } };
  const saveCacheResp = (ref, ver, data) => { try { localStorage.setItem(cacheKey(ref, ver), JSON.stringify({ at: Date.now(), data })); } catch {} };

  // ---------- fetch /api/chat (POST uniquement) ----------
  async function postJSON(url, payload, tries = 3) {
    let lastErr;
    for (let k = 0; k < tries; k++) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
        if (!r.ok) { const msg = await r.text().catch(() => ""); throw new Error(msg || `HTTP ${r.status}`); }
        return r;
      } catch (e) { lastErr = e; await wait(400 * (k + 1)); }
    }
    throw lastErr;
  }

  async function getStudy() {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const book = bookSelect?.value || "Genèse";
    const chapter = Number(chapterSelect?.value || 1);

    const r = await postJSON("/api/chat", { book, chapter, version: ver }, 3);
    const ct = r.headers.get("Content-Type") || "";
    if (/application\/json/i.test(ct)) {
      const j = await r.json().catch(() => ({}));
      if (!j || (j.ok === false)) throw new Error(j?.error || "Réponse JSON invalide");
      window.__lastChatSource = j.source || "unknown";
      window.__lastChatWarn = j.warn || "";
      return { from: j.source || "api", data: j.data };
    }
    const text = await r.text();
    // fallback minimal : on répartit arbitrairement
    const sections = [{id:2,title:"Canon et testament",content:text}];
    const data = { reference: `${book} ${chapter}`, sections };
    return { from: "api-md", data };
  }

  // ---------- génération ----------
  function dedupeParagraphs(raw) {
    // supprime des répétitions évidentes "Développement :" en rafale
    const lines = String(raw || "").split(/\r?\n/);
    const out = [];
    let last = "";
    for (const ln of lines) {
      const lnTrim = ln.trim();
      if (lnTrim && lnTrim === last) continue;
      out.push(ln);
      last = lnTrim;
    }
    return out.join("\n");
  }

  function ensureLinksLineBreaks(txt) {
    // met une ligne seule pour chaque lien https?://... qui suit du texte
    return String(txt || "").replace(/(\S)(https?:\/\/[^\s)]+)(\S)?/g, (_, a, url, b) => `${a}\n${url}\n${b||""}`);
  }

  async function generateStudy() {
    if (inFlight) return;
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }

    inFlight = true;
    const btn = generateBtn;
    btn && (btn.dataset.label = btn.dataset.label || btn.textContent);
    busy(btn, true);
    try {
      setProgress(15); await wait(60);
      setProgress(55);

      const { data } = await getStudy();
      notes = {}; // reset

      // Remplir selon les sections renvoyées
      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) notes[i] = String(s.content || "").trim();
      });

      // 1) Prière d’ouverture forcée (non vide)
      if (forcePrayerOpen) notes[0] = defaultPrayerOpen();

      // 3) Rubrique révision : toujours un canevas rempli
      if (!notes[2] || !notes[2].trim()) notes[2] = buildRevisionSection();

      // 28) prière de fin par défaut
      notes[27] = defaultPrayerClose();

      // Nettoyage minimum : dédoublonner
      for (const k of Object.keys(notes)) {
        notes[k] = dedupeParagraphs(ensureLinksLineBreaks(notes[k]));
      }

      renderSidebar();
      select(0);            // <-- grâce au FIX, notes[0] n'est plus écrasé ici
      renderSidebarDots();  // s'assurer que l'état visuel colle aux notes

      HOOK('be:study-generated', {
        reference: data.reference || ref,
        filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k),
        notes // attention : structure potentiellement volumineuse
      });

      setProgress(100); setTimeout(() => setProgress(0), 300);
      dlog(`[GEN] source=${window.__lastChatSource} sections=${secs.length} filled=${Object.keys(notes).length} → étude générée`);
    } catch (e) {
      console.error(e);
      alert(String((e && e.message) || e));
    } finally {
      busy(btn, false);
      inFlight = false;
    }
  }

  // ---------- panneau liens cliquables ----------
  function extractLinks(text) {
    const links = [];
    const raw = String(text || "");

    // balises <a href="...">texte</a>
    const aTagRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let m;
    while ((m = aTagRe.exec(raw))) { links.push({ url: m[1], label: m[2] || m[1] }); }

    // urls nues
    const urlRe = /https?:\/\/[^\s<>"'()]+/g;
    let n;
    while ((n = urlRe.exec(raw))) { const url = n[0]; if (!links.find(l => l.url === url)) links.push({ url, label: url }); }

    return links;
  }
  function updateLinksPanel() {
    const txt = noteArea.value || "";
    const links = extractLinks(txt);
    linksList.innerHTML = "";
    if (!links.length) { linksPanel.classList.add("empty"); return; }
    linksPanel.classList.remove("empty");
    for (const l of links) {
      const a = document.createElement("a");
      a.href = l.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = l.label;
      const div = document.createElement("div");
      div.appendChild(a);
      linksList.appendChild(div);
    }
  }

  // ---------- init ----------
  renderBooks(); renderChapters(); renderVerses();
  renderSidebar(); select(0);

  // Recherche intelligente
  if (searchRef) {
    searchRef.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const sel = parseSearch(searchRef.value);
        if (sel) { applySelection(sel); autoGenerate(); }
      }
    });
    searchRef.addEventListener("blur", () => {
      const sel = parseSearch(searchRef.value);
      if (sel) { applySelection(sel); autoGenerate(); }
    });
  }

  // Générer
  generateBtn && generateBtn.addEventListener("click", generateStudy);

  // Valider ⇒ ouvre BibleGateway sur la référence courante
  validateBtn && validateBtn.addEventListener("click", () => {
    const book = bookSelect.value, c = chapterSelect.value, v = verseSelect.value, ver = versionSelect.value;
    const url = bgwLink(book, c, v, ver);
    window.open(url, "_blank", "noopener");
  });

  // Auto-génération si sélection change
  function autoGenerate() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (bookSelect?.value && chapterSelect?.value && !(searchRef?.value || "").trim()) generateStudy();
    }, 250);
  }
  bookSelect.addEventListener("change", () => { renderChapters(); renderVerses(bookSelect.value === "Psaumes" ? 200 : 60); autoGenerate(); });
  chapterSelect.addEventListener("change", autoGenerate);
  verseSelect.addEventListener("change", () => { /* rien */ });

  // autosave + liens live
  noteArea.addEventListener("input", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      notes[current] = noteArea.value; 
      saveStorage(); 
      updateLinksPanel();
      HOOK('be:note-changed', { index: current, value: noteArea.value, hasContent: !!(noteArea.value || '').trim() });
    }, 700);
  });

  // navigation simple
  prevBtn.addEventListener("click", () => { if (current > 0) select(current - 1); });
  nextBtn.addEventListener("click", () => { if (current < N - 1) select(current + 1); });

  // debug panel (health + chat + ping)
  dbtn && dbtn.addEventListener("click", () => {
    const open = dpanel.style.display === "block";
    dpanel.style.display = open ? "none" : "block";
    dbtn.textContent = open ? "Debug" : "Fermer Debug";
    if (!open) {
      dpanel.textContent = "[Debug démarré…]";
      (async () => {
        try { const r1 = await fetch("/api/health", {cache:"no-store"}); setMini(dotHealth, r1.ok); dlog(`health → ${r1.status}`); } catch { setMini(dotHealth, false); }
        try { const r2 = await fetch("/api/chat", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ probe: true }) }); setMini(dotChat, r2.ok); dlog(`chat(POST) → ${r2.status}`); } catch { setMini(dotChat, false); }
        try { const r3 = await fetch("/api/ping", {cache:"no-store"}); setMini(dotPing, r3.ok); dlog(`ping → ${r3.status}`); } catch { setMini(dotPing, false); }
      })();
    }
  });

  // remplir prière d’ouverture par défaut au chargement (point 1 non vide)
  notes[0] = defaultPrayerOpen();
  renderSidebarDots();

  // HOOK init
  HOOK('be:init', {
    current,
    total: N,
    filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k)
  });

})();

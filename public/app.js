// public/app.js — FRONT COMPLET (28 rubriques, JSON ou Markdown)
(function () {
  // ---------- helpers UI ----------
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");

  const setProgress = (p) => {
    if (!progressBar) return;
    progressBar.style.width = Math.max(0, Math.min(100, p)) + "%";
  };

  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => {
    if (!el) return;
    el.disabled = !!on;
    el.classList.toggle("opacity-60", !!on);
    el.textContent = on ? "Génération..." : el.dataset.label || el.textContent;
  };

  const dpanel = $("debugPanel");
  const dbtn = $("debugBtn");
  const dlog = (msg) => {
    if (!dpanel) return;
    dpanel.style.display = "block";
    dbtn && (dbtn.textContent = "Fermer Debug");
    const line = `[${new Date().toISOString()}] ${msg}`;
    dpanel.textContent += (dpanel.textContent ? "\n" : "") + line;
    console.log(line);
  };

  const setMini = (dot, ok) => {
    if (!dot) return;
    dot.classList.remove("ok", "ko");
    if (ok === true) dot.classList.add("ok");
    else if (ok === false) dot.classList.add("ko");
  };

  // ---------- sélecteurs ----------
  const searchRef = $("searchRef"),
    bookSelect = $("bookSelect"),
    chapterSelect = $("chapterSelect"),
    verseSelect = $("verseSelect"),
    versionSelect = $("versionSelect"),
    validateBtn = $("validate"),
    generateBtn = $("generateBtn"),
    readLink = $("readLink"),
    lastStudy = $("lastStudy"),
    pointsList = $("pointsList"),
    edTitle = $("edTitle"),
    noteArea = $("noteArea"),
    prevBtn = $("prev"),
    nextBtn = $("next"),
    metaInfo = $("metaInfo"),
    dotHealth = $("dot-health"),
    dotChat = $("dot-chat"),
    dotPing = $("dot-ping");

  $("y") && ($("y").textContent = new Date().getFullYear());

  // ---------- livres / chapitres ----------
  const BOOKS = [
    ["Genèse", 50], ["Exode", 40], ["Lévitique", 27], ["Nombres", 36], ["Deutéronome", 34],
    ["Josué", 24], ["Juges", 21], ["Ruth", 4], ["1 Samuel", 31], ["2 Samuel", 24],
    ["1 Rois", 22], ["2 Rois", 25], ["1 Chroniques", 29], ["2 Chroniques", 36], ["Esdras", 10],
    ["Néhémie", 13], ["Esther", 10], ["Job", 42], ["Psaumes", 150], ["Proverbes", 31],
    ["Ecclésiaste", 12], ["Cantique des cantiques", 8], ["Ésaïe", 66], ["Jérémie", 52], ["Lamentations", 5],
    ["Ézéchiel", 48], ["Daniel", 12], ["Osée", 14], ["Joël", 3], ["Amos", 9],
    ["Abdias", 1], ["Jonas", 4], ["Michée", 7], ["Nahoum", 3], ["Habacuc", 3],
    ["Sophonie", 3], ["Aggée", 2], ["Zacharie", 14], ["Malachie", 4],
    ["Matthieu", 28], ["Marc", 16], ["Luc", 24], ["Jean", 21], ["Actes", 28],
    ["Romains", 16], ["1 Corinthiens", 16], ["2 Corinthiens", 13], ["Galates", 6], ["Éphésiens", 6],
    ["Philippiens", 4], ["Colossiens", 4], ["1 Thessaloniciens", 5], ["2 Thessaloniciens", 3], ["1 Timothée", 6],
    ["2 Timothée", 4], ["Tite", 3], ["Philémon", 1], ["Hébreux", 13], ["Jacques", 5],
    ["1 Pierre", 5], ["2 Pierre", 3], ["1 Jean", 5], ["2 Jean", 1], ["3 Jean", 1],
    ["Jude", 1], ["Apocalypse", 22],
  ];
  const NT_START_INDEX = BOOKS.findIndex(([n]) => n === "Matthieu"); // 39 (0-based)

  function renderBooks() {
    if (!bookSelect) return;
    bookSelect.innerHTML = "";
    BOOKS.forEach(([n, ch]) => {
      const o = document.createElement("option");
      o.value = n;
      o.textContent = n;
      o.dataset.ch = ch;
      bookSelect.appendChild(o);
    });
  }
  function renderChapters() {
    if (!chapterSelect || !bookSelect) return;
    chapterSelect.innerHTML = "";
    const ch = bookSelect.selectedOptions[0] ? +bookSelect.selectedOptions[0].dataset.ch : 1;
    for (let i = 1; i <= ch; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      chapterSelect.appendChild(o);
    }
  }
  function renderVerses(max = 60) {
    if (!verseSelect) return;
    verseSelect.innerHTML = "";
    const m = Math.max(1, Math.min(200, max));
    for (let i = 1; i <= m; i++) {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = String(i);
      verseSelect.appendChild(o);
    }
  }
  function updateReadLink() {
    if (!readLink || !bookSelect || !chapterSelect || !verseSelect || !versionSelect) return;
    const ref = `${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`;
    const ver = versionSelect.value;
    readLink.href = "https://www.biblegateway.com/passage/?search=" + encodeURIComponent(ref) + "&version=" + encodeURIComponent(ver);
  }

  // ---------- rubriques fixes ----------
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
    if (!pointsList) return;
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
  }
  function renderSidebarDots() {
    document.querySelectorAll(".list .item").forEach((el) => {
      const i = +el.dataset.idx, dot = el.querySelector(".dot");
      if (!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
  }
  function select(i) {
    if (noteArea) notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document.querySelectorAll(".list .item").forEach((el) => el.classList.toggle("active", +el.dataset.idx === current));
    if (edTitle) edTitle.textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    if (noteArea) noteArea.focus();
  }
  function saveStorage() {
    try {
      localStorage.setItem("be_notes", JSON.stringify(notes));
      renderSidebarDots();
    } catch { }
  }

  // ---------- parse saisie ----------
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
    for (const [name] of BOOKS) {
      if (norm(name) === title) { book = name; break; }
    }
    if (!book) {
      const cand = BOOKS.find(([name]) => norm(name).startsWith(title));
      if (cand) book = cand[0];
    }
    if (!book) return null;
    return { book, chap: +m[2], vers: m[3] ? +m[3] : null };
  }
  function applySelection(sel) {
    if (!sel || !bookSelect) return;
    const idx = BOOKS.findIndex(([n]) => n === sel.book);
    if (idx >= 0) bookSelect.selectedIndex = idx;
    renderChapters();
    const chMax = bookSelect.selectedOptions[0] ? +bookSelect.selectedOptions[0].dataset.ch : 1;
    const chap = Math.max(1, Math.min(chMax, sel.chap || 1));
    if (chapterSelect) chapterSelect.value = String(chap);
    renderVerses(sel.book === "Psaumes" ? 200 : 60);
    if (sel.vers && verseSelect) verseSelect.value = String(sel.vers);
    updateReadLink();
  }
  function buildReference() {
    const typed = (searchRef && searchRef.value || "").trim();
    if (typed) return typed;
    if (!bookSelect || !chapterSelect) return "";
    const b = bookSelect.value, c = chapterSelect.value;
    return c ? `${b} ${c}` : b;
  }

  // ---------- cache navigateur ----------
  const cacheKey = (ref, ver) => `be_cache:${ref}::${ver || "LSG"}`;
  const loadCache = (ref, ver) => { try { return JSON.parse(localStorage.getItem(cacheKey(ref, ver)) || "null"); } catch { return null; } };
  const saveCache = (ref, ver, data) => { try { localStorage.setItem(cacheKey(ref, ver), JSON.stringify({ at: Date.now(), data })); } catch { } };

  // ---------- garde-fous ----------
  function defaultPrayerOpen(reference) {
    return `Père céleste, nous venons devant toi pour lire ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`;
  }
  function defaultPrayerClose(reference) {
    return `Seigneur, merci pour la lumière reçue dans ${reference}. Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;
  }
  function ensureKeyVerse(body, reference) {
    const txt = String(body || "");
    const hasRef = /\b\d+:\d+\b/.test(txt) || /[A-Za-zÀ-ÿ]+\s+\d+:\d+/.test(txt);
    if (hasRef) return txt;
    const ref = reference || buildReference();
    const chap = (ref.match(/\b(\d+)\b/) || [])[1] || "1";
    return `Verset-clé proposé : ${ref.split(" ")[0]} ${chap}:1 — ${txt}`.trim();
  }

  // ---------- fetch /api/chat ----------
  async function getStudy(ref) {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const cached = loadCache(ref, ver);
    if (cached?.data) return { from: "local", data: cached.data };

    const url = `/api/chat?q=${encodeURIComponent(ref)}`;
    const r = await fetch(url, { method: "GET" });
    const ct = r.headers.get("Content-Type") || "";
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(txt || `HTTP ${r.status}`);
    }

    // 1) JSON { ok, data:{ sections:[{id,title,content}...] } }
    if (/application\/json/i.test(ct)) {
      const j = await r.json().catch(() => ({}));
      if (!j || (j.ok === false)) throw new Error(j?.error || "Réponse JSON invalide");
      saveCache(ref, ver, j.data);
      return { from: "api", data: j.data };
    }

    // 2) Markdown => on parse en 28 sections
    const text = await r.text();
    const sections = parseMarkdownToSections(text);
    const data = { reference: ref, sections };
    saveCache(ref, ver, data);
    return { from: "api-md", data };
  }

  // ---------- parser Markdown (titres numérotés) ----------
  function parseMarkdownToSections(md) {
    const result = [];
    if (!md || typeof md !== "string") return result;

    // On cherche les lignes commençant par "1."..."28."
    const lines = md.split(/\r?\n/);
    let cur = null;
    const startRe = /^(\d{1,2})\.\s+/;

    for (const line of lines) {
      const m = line.match(startRe);
      if (m) {
        const id = parseInt(m[1], 10);
        if (id >= 1 && id <= 28) {
          if (cur) result.push(cur);
          cur = { id, title: line.replace(startRe, "").trim(), content: "" };
          continue;
        }
      }
      if (cur) {
        cur.content += (cur.content ? "\n" : "") + line;
      }
    }
    if (cur) result.push(cur);

    // Si on n'a pas trouvé 28, on tente un autre découpage (titres "##" ou "###")
    if (result.length < 10) {
      const mdBlocks = md.split(/\n(?=\d{1,2}\.\s)/g);
      const alt = [];
      mdBlocks.forEach((blk) => {
        const m2 = blk.match(/^(\d{1,2})\.\s+(.*?)(?:\n|$)/);
        if (m2) {
          const id = +m2[1];
          let body = blk.slice(m2[0].length);
          alt.push({ id, title: m2[2].trim(), content: body.trim() });
        }
      });
      if (alt.length) return alt;
    }

    return result;
  }

  // ---------- génération ----------
  async function generateStudy() {
    if (inFlight) return;
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }

    inFlight = true;
    const btn = generateBtn;
    btn && (btn.dataset.label = btn.dataset.label || btn.textContent);
    busy(btn, true);
    try {
      setProgress(15); await wait(80);
      setProgress(55);

      const { data } = await getStudy(ref);
      // data.sections attendu : [{id,title,content}, ...]
      notes = {};
      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) notes[i] = String(s.content || "").trim();
      });

      // Garde-fous
      notes[0] = defaultPrayerOpen(data.reference || ref);
      if (!notes[1]) {
        const idx = bookSelect ? bookSelect.selectedIndex : 0;
        const testament = idx < NT_START_INDEX ? "Ancien Testament" : "Nouveau Testament";
        notes[1] = `Le livre de ${bookSelect ? bookSelect.value : "—"} appartient à l’${testament}.`;
      }
      if (!notes[2]) {
        notes[2] = "À compléter par l’animateur : préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
      }
      notes[8] = ensureKeyVerse(notes[8], data.reference || ref);
      notes[27] = defaultPrayerClose(data.reference || ref);

      dlog(`[GEN] sections=${secs.length}, filled=${Object.keys(notes).length}`);

      // Mémoire “dernier”
      try {
        const book = bookSelect?.value, chap = chapterSelect?.value, vers = verseSelect?.value, ver = versionSelect?.value;
        lastStudy && (lastStudy.textContent = `Dernier : ${data.reference || `${book} ${chap}`} (${ver})`);
        localStorage.setItem("be_last", JSON.stringify({ book, chapter: chap, verse: vers, version: ver }));
      } catch { }

      renderSidebar(); select(0);
      setProgress(100); setTimeout(() => setProgress(0), 300);
      dlog("[GEN] OK → étude générée");
    } catch (e) {
      console.error(e);
      alert(String((e && e.message) || e));
    } finally {
      busy(btn, false);
      inFlight = false;
    }
  }

  // ---------- init ----------
  renderBooks(); renderChapters(); renderVerses(); updateReadLink();
  renderSidebar(); select(0);

  // recherche intelligente
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

  // Valider => BibleGateway + mémoire rapide
  validateBtn && validateBtn.addEventListener("click", () => {
    updateReadLink();
    try {
      const book = bookSelect?.value, chap = chapterSelect?.value, vers = verseSelect?.value, ver = versionSelect?.value;
      localStorage.setItem("be_last", JSON.stringify({ book, chapter: chap, verse: vers, version: ver }));
      lastStudy && (lastStudy.textContent = `Dernier : ${book} ${chap || 1} (${ver})`);
    } catch { }
    readLink && window.open(readLink.href, "_blank", "noopener");
  });

  // Générer => /api/chat
  generateBtn && generateBtn.addEventListener("click", generateStudy);

  // auto-génération si pas de texte saisi
  function autoGenerate() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (bookSelect?.value && chapterSelect?.value && !(searchRef?.value || "").trim()) generateStudy();
    }, 250);
  }
  bookSelect && bookSelect.addEventListener("change", () => { renderChapters(); renderVerses(bookSelect.value === "Psaumes" ? 200 : 60); updateReadLink(); autoGenerate(); });
  chapterSelect && chapterSelect.addEventListener("change", () => { updateReadLink(); autoGenerate(); });
  verseSelect && verseSelect.addEventListener("change", () => { updateReadLink(); });

  // autosave
  noteArea && noteArea.addEventListener("input", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => { notes[current] = noteArea.value; saveStorage(); }, 700);
  });

  // navigation simple
  prevBtn && prevBtn.addEventListener("click", () => { if (current > 0) select(current - 1); });
  nextBtn && nextBtn.addEventListener("click", () => { if (current < N - 1) select(current + 1); });

  // bouton debug (optionnel)
  dbtn && dbtn.addEventListener("click", () => {
    const open = dpanel.style.display === "block";
    dpanel.style.display = open ? "none" : "block";
    dbtn.textContent = open ? "Debug" : "Fermer Debug";
    if (!open) {
      dpanel.textContent = "[Debug démarré…]";
      (async () => {
        try { const r1 = await fetch("/api/health"); setMini(dotHealth, r1.ok); dlog(`health → ${r1.status}`); } catch { setMini(dotHealth, false); }
        try { const r2 = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ probe: true }) }); setMini(dotChat, r2.ok); dlog(`chat(POST) → ${r2.status}`); } catch { setMini(dotChat, false); }
        try { const r3 = await fetch("/api/ping"); setMini(dotPing, r3.ok); dlog(`ping → ${r3.status}`); } catch { setMini(dotPing, false); }
      })();
    }
  });
})();

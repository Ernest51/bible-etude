// public/app.js — FRONT-ONLY (no imports / drop-in)
// Version robuste : binding du bouton Générer + traces réseau + 28 rubriques garanties

(function () {
  // ---------- utils / ui ----------
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) =>
    progressBar && (progressBar.style.width = Math.max(0, Math.min(100, p)) + "%");
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fakePrep = async () => {
    setProgress(15);
    await wait(120);
    setProgress(55);
    await wait(120);
    setProgress(100);
    setTimeout(() => setProgress(0), 260);
  };

  const searchRef = $("searchRef"),
    bookSelect = $("bookSelect"),
    chapterSelect = $("chapterSelect"),
    verseSelect = $("verseSelect"),
    versionSelect = $("versionSelect"),
    validateBtn = $("validate"),
    readLink = $("readLink"),
    lastStudy = $("lastStudy"),
    pointsList = $("pointsList"),
    edTitle = $("edTitle"),
    noteArea = $("noteArea"),
    prevBtn = $("prev"),
    nextBtn = $("next"),
    metaInfo = $("metaInfo"),
    btnDbg = $("debugBtn"),
    panel = $("debugPanel"),
    dotHealth = $("dot-health"),
    dotChat = $("dot-chat"),
    dotPing = $("dot-ping");

  $("y") && ($("y").textContent = new Date().getFullYear());
  const setMini = (dot, ok) => {
    if (!dot) return;
    dot.classList.remove("ok", "ko");
    if (ok === true) dot.classList.add("ok");
    else if (ok === false) dot.classList.add("ko");
  };
  const dlog = (msg) => {
    if (!panel) return;
    panel.style.display = "block";
    if (btnDbg) btnDbg.textContent = "Fermer Debug";
    const line = "[" + new Date().toISOString() + "] " + msg;
    panel.textContent += (panel.textContent ? "\n" : "") + line;
    console.log(line);
  };

  // ---------- livres ----------
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
    const ch = bookSelect.selectedOptions[0]
      ? +bookSelect.selectedOptions[0].dataset.ch
      : 1;
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
    if (!readLink || !bookSelect || !chapterSelect || !verseSelect || !versionSelect)
      return;
    const ref = `${bookSelect.value} ${chapterSelect.value}:${verseSelect.value}`;
    const ver = versionSelect.value;
    readLink.href =
      "https://www.biblegateway.com/passage/?search=" +
      encodeURIComponent(ref) +
      "&version=" +
      encodeURIComponent(ver);
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
  let current = 0,
    notes = {},
    autosaveTimer = null,
    autoTimer = null,
    inFlight = false;

  function renderSidebar() {
    if (!pointsList) return;
    pointsList.innerHTML = "";
    FIXED_POINTS.forEach((r, i) => {
      const row = document.createElement("div");
      row.className = "item" + (i === current ? " active" : "");
      row.dataset.idx = i;
      row.innerHTML = `<span class="idx">${i + 1}</span>
      <div><div>${r.t}</div><span class="desc">${r.d || ""}</span></div>
      <span class="dot ${notes[i] && notes[i].trim() ? "ok" : ""}"></span>`;
      row.addEventListener("click", () => {
        if (current !== i) select(i);
      });
      pointsList.appendChild(row);
    });
  }
  function renderSidebarDots() {
    document.querySelectorAll(".list .item").forEach((el) => {
      const i = +el.dataset.idx,
        dot = el.querySelector(".dot");
      if (!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
  }
  function select(i) {
    if (noteArea) notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document
      .querySelectorAll(".list .item")
      .forEach((el) => el.classList.toggle("active", +el.dataset.idx === current));
    if (edTitle) edTitle.textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    if (noteArea) noteArea.focus();
  }
  function saveStorage() {
    try {
      localStorage.setItem("be_notes", JSON.stringify(notes));
      renderSidebarDots();
    } catch {}
  }

  // ---------- saisie / sélection ----------
  const norm = (s) =>
    String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9: ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  function parseSearch(q) {
    q = (q || "").trim();
    const m = q.match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/);
    if (!m) return null;
    const title = norm(m[1]);
    let book = null;
    for (const [name] of BOOKS) {
      if (norm(name) === title) {
        book = name;
        break;
      }
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
    const chMax = bookSelect.selectedOptions[0]
      ? +bookSelect.selectedOptions[0].dataset.ch
      : 1;
    const chap = Math.max(1, Math.min(chMax, sel.chap || 1));
    if (chapterSelect) chapterSelect.value = String(chap);
    renderVerses(sel.book === "Psaumes" ? 200 : 60);
    if (sel.vers && verseSelect) verseSelect.value = String(sel.vers);
    updateReadLink();
  }
  function buildReference() {
    const typed = (searchRef && searchRef.value) || "";
    if (typed.trim()) return typed.trim();
    if (!bookSelect || !chapterSelect) return "";
    const b = bookSelect.value,
      c = chapterSelect.value;
    return c ? `${b} ${c}` : b;
  }

  // ---------- cache navigateur ----------
  function cacheKey(ref, ver) {
    return `be_cache:${ref}::${ver || "LSG"}`;
  }
  function loadCache(ref, ver) {
    try {
      return JSON.parse(localStorage.getItem(cacheKey(ref, ver)) || "null");
    } catch {
      return null;
    }
  }
  function saveCache(ref, ver, data) {
    try {
      localStorage.setItem(
        cacheKey(ref, ver),
        JSON.stringify({ at: Date.now(), data })
      );
    } catch {}
  }

  async function getStudy(ref) {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const cached = loadCache(ref, ver);
    if (cached?.data) return { from: "local", data: cached.data };

    const url = `/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
    console.log("[GEN] Appel API →", url);

    const r = await fetch(url, { method: "GET" });
    const bodyText = await r.text();
    console.log("[GEN] HTTP", r.status, "extrait:", bodyText.slice(0, 200));
    let j = {};
    try {
      j = JSON.parse(bodyText);
    } catch {
      // l’API renvoie parfois du Markdown : on enveloppe
      j = { ok: r.ok, data: { reference: ref, sections: [] }, raw: bodyText };
    }

    if (!r.ok || !j?.ok) {
      // si l’API a renvoyé du MD simple, on le garde brut pour fallback texte
      throw new Error(j?.error || `HTTP ${r.status}`);
    }
    saveCache(ref, ver, j.data);
    return { from: "api", data: j.data };
  }

  // ---------- post-traitements sûrs ----------
  function defaultPrayerOpen(reference) {
    return `Père céleste, nous venons devant toi pour lire ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Au nom de Jésus, amen.`;
  }
  function defaultPrayerClose(reference) {
    return `Seigneur, merci pour la lumière reçue dans ${reference}. Aide-nous à mettre ta Parole en pratique, à l’Église, en famille et personnellement. Garde-nous dans ta paix. Amen.`;
  }
  function ensureKeyVerse(body, reference) {
    const txt = String(body || "");
    const hasRef =
      /\b\d+:\d+\b/.test(txt) || /[A-Za-zÀ-ÿ]+\s+\d+:\d+/.test(txt);
    if (hasRef) return txt;
    const ref = reference || buildReference();
    const chap = (ref.match(/\b(\d+)\b/) || [])[1] || "1";
    return `Verset-clé proposé : ${ref.split(" ")[0]} ${chap}:1 — ${txt}`.trim();
  }

  // ---------- génération ----------
  async function generateStudy() {
    if (inFlight) return;
    inFlight = true;
    try {
      const ref = buildReference();
      if (!ref) {
        alert(
          "Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"
        );
        return;
      }
      await fakePrep();

      const { data } = await getStudy(ref);

      // sections (serveur) -> notes locales
      notes = {};
      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) {
          notes[i] = String(s.content || "").trim();
        }
      });

      // Garde-fous : toujours 28 points ;
      // 1: prière d'ouverture
      notes[0] = defaultPrayerOpen(data.reference || ref);
      // 2: canon & testament si vide
      if (!notes[1]) {
        const idx = bookSelect ? bookSelect.selectedIndex : 0;
        const testament = idx < NT_START_INDEX ? "Ancien Testament" : "Nouveau Testament";
        notes[1] = `Le livre de ${bookSelect ? bookSelect.value : "—"} appartient à l’${testament}.`;
      }
      // 3: questions
      if (!notes[2]) {
        notes[2] =
          "À compléter par l’animateur : préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).";
      }
      // 9: verset-clé — garanti
      notes[8] = ensureKeyVerse(notes[8], data.reference || ref);
      // 28: prière de fin — garanti
      notes[27] = defaultPrayerClose(data.reference || ref);

      dlog(`[GEN] sections=${secs.length}, filled=${Object.keys(notes).length}`);

      // mémoire “dernier”
      try {
        const book = bookSelect?.value,
          chap = chapterSelect?.value,
          vers = verseSelect?.value,
          ver = versionSelect?.value;
        lastStudy &&
          (lastStudy.textContent = `Dernier : ${data.reference || `${book} ${chap}`} (${ver})`);
        localStorage.setItem(
          "be_last",
          JSON.stringify({ book, chapter: chap, verse: vers, version: ver })
        );
      } catch {}

      renderSidebar();
      select(0);
    } catch (e) {
      console.error(e);
      alert(String((e && e.message) || e));
    } finally {
      inFlight = false;
    }
  }

  // ---------- init ----------
  renderBooks();
  renderChapters();
  renderVerses();
  updateReadLink();
  renderSidebar();
  select(0);

  // recherche intelligente
  if (searchRef) {
    searchRef.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const sel = parseSearch(searchRef.value);
        if (sel) {
          applySelection(sel);
          autoGenerate();
        }
      }
    });
    searchRef.addEventListener("blur", () => {
      const sel = parseSearch(searchRef.value);
      if (sel) {
        applySelection(sel);
        autoGenerate();
      }
    });
  }

  // Valider => BibleGateway
  validateBtn &&
    validateBtn.addEventListener("click", () => {
      updateReadLink();
      try {
        const book = bookSelect?.value,
          chap = chapterSelect?.value,
          vers = verseSelect?.value,
          ver = versionSelect?.value;
        localStorage.setItem(
          "be_last",
          JSON.stringify({ book, chapter: chap, verse: vers, version: ver })
        );
        lastStudy &&
          (lastStudy.textContent = `Dernier : ${book} ${chap || 1} (${ver})`);
      } catch {}
      readLink && window.open(readLink.href, "_blank", "noopener");
    });

  // ---------- binding ROBUSTE du bouton Générer ----------
  function bindGenerate() {
    const candidates = [
      document.getElementById("generateBtn"),
      document.getElementById("generate"),
      document.querySelector('button#generateBtn'),
      document.querySelector('button#generate'),
      document.querySelector('button[data-role="generate"]'),
      document.querySelector('button.btn-generate'),
    ].filter(Boolean);

    if (candidates.length === 0) {
      console.warn(
        '[GEN] Aucun bouton "Générer" trouvé. Donne-lui id="generateBtn" ou data-role="generate".'
      );
      return;
    }

    const onClick = async (e) => {
      e.preventDefault();
      console.log("[GEN] click → démarrage generateStudy()");
      try {
        await generateStudy();
        console.log("[GEN] OK → étude générée");
      } catch (err) {
        console.error("[GEN] ERREUR generateStudy():", err);
        alert("La génération a échoué : " + (err?.message || err));
      }
    };

    candidates.forEach((btn) => {
      if (!btn.__genBound) {
        btn.addEventListener("click", onClick);
        btn.__genBound = true;
      }
    });
    console.log(`[GEN] Bouton(s) Générer lié(s) : ${candidates.length}`);
  }
  bindGenerate();

  // auto-génération si pas de texte saisi
  function autoGenerate() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (
        bookSelect?.value &&
        chapterSelect?.value &&
        !(searchRef?.value || "").trim()
      )
        generateStudy();
    }, 300);
  }
  bookSelect &&
    bookSelect.addEventListener("change", () => {
      renderChapters();
      renderVerses(bookSelect.value === "Psaumes" ? 200 : 60);
      updateReadLink();
      autoGenerate();
    });
  chapterSelect &&
    chapterSelect.addEventListener("change", () => {
      updateReadLink();
      autoGenerate();
    });
  verseSelect &&
    verseSelect.addEventListener("change", () => {
      updateReadLink();
    });

  // autosave
  noteArea &&
    noteArea.addEventListener("input", () => {
      clearTimeout(autosaveTimer);
      autosaveTimer = setTimeout(() => {
        notes[current] = noteArea.value;
        saveStorage();
      }, 2000);
    });

  // debug footer
  btnDbg &&
    btnDbg.addEventListener("click", () => {
      const open = panel.style.display === "block";
      panel.style.display = open ? "none" : "block";
      btnDbg.textContent = open ? "Debug" : "Fermer Debug";
      if (!open) {
        panel.textContent = "[Debug démarré…]";
        (async () => {
          try {
            const r1 = await fetch("/api/health");
            setMini(dotHealth, r1.ok);
            dlog(`health → ${r1.status}`);
          } catch {
            setMini(dotHealth, false);
          }
          try {
            const r2 = await fetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ probe: true }),
            });
            setMini(dotChat, r2.ok);
            dlog(`chat(POST) → ${r2.status}`);
          } catch {
            setMini(dotChat, false);
          }
          try {
            const r3 = await fetch("/api/ping");
            setMini(dotPing, r3.ok);
            dlog(`ping → ${r3.status}`);
          } catch {
            setMini(dotPing, false);
          }
        })();
      }
    });
})();

// public/app.js — Etude 28 rubriques avec injection automatique du TEXTE BIBLIQUE
// - Prière d’ouverture préservée (vient de /api/chat), + injection du verset courant via /api/verse
// - Injection de versets pertinentes dans d'autres rubriques (9, 20, 27, etc.)
// - Anti-doublons, limite de volume, sanitation, logs debug.

(function () {
  /* ---------------------- Helpers / DOM ---------------------- */
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => { if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => { if (!el) return; el.disabled = !!on; el.classList.toggle("opacity-60", !!on); el.textContent = on ? "Génération..." : el.dataset.label || el.textContent; };
  const dpanel = $("debugPanel"); const dbtn = $("debugBtn");
  const dlog = (msg) => { if (!dpanel) return; dpanel.style.display = "block"; dbtn && (dbtn.textContent = "Fermer Debug"); const line = `[${new Date().toISOString()}] ${msg}`; dpanel.textContent += (dpanel.textContent ? "\n" : "") + line; console.log(line); };

  const searchRef = $("searchRef"), bookSelect = $("bookSelect"), chapterSelect = $("chapterSelect"),
        verseSelect = $("verseSelect"), versionSelect = $("versionSelect"),
        validateBtn = $("validate"), generateBtn = $("generateBtn"), readBtn = $("readBtn"),
        pointsList = $("pointsList"), edTitle = $("edTitle"),
        noteArea = $("noteArea"), noteView = $("noteView"),
        prevBtn = $("prev"), nextBtn = $("next"),
        metaInfo = $("metaInfo"), themeSelect = $("themeSelect"),
        enrichToggle = $("enrichToggle"),
        linksPanel = $("linksPanel"), linksList = $("linksList");
  $("y").textContent = new Date().getFullYear();

  /* ---------------------- Canon livres ---------------------- */
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

  /* ---------------------- Rubriques (28) ---------------------- */
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

  /* ---------------------- État ---------------------- */
  let current = 0, notes = {}, autosaveTimer = null, autoTimer = null, inFlight = false;

  /* ---------------------- UI: sidebar ---------------------- */
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
    if (noteArea && i !== current) notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document.querySelectorAll(".list .item").forEach((el) => el.classList.toggle("active", +el.dataset.idx === current));
    if (edTitle) edTitle.textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    renderViewFromArea(); updateLinksPanel();
    if (enrichToggle && enrichToggle.checked) { noteView && noteView.focus(); } else { noteArea && noteArea.focus(); }
  }
  function saveStorage() { try { localStorage.setItem("be_notes", JSON.stringify(notes)); renderSidebarDots(); } catch {} }

  /* ---------------------- Util / parsing refs ---------------------- */
  const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const BOOK_TITLES = BOOKS.map(([n]) => n);
  const bookAlt = BOOK_TITLES.map(escapeRegExp).join("|");
  // “Livre Chap:Vers[–Vers]” ou “Livre Chap–Chap”
  const refRe = new RegExp(`\\b(${bookAlt})\\s+(\\d+)(?::(\\d+(?:[–-]\\d+)?))?(?:[–-](\\d+))?`, "gi");

  function norm(s) {
    return String(s || "")
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/[^a-z0-9: ]+/g, " ")
      .replace(/\s+/g, " ").trim();
  }
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

  /* ---------------------- Rendu enrichi (safe) ---------------------- */
  function sanitizeBasic(text){ return String(text||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function mdLite(html){ return html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\*([^*]+)\*/g, "<em>$1</em>"); }
  function autolinkURLs(html){ return html.replace(/(\bhttps?:\/\/[^\s<>"'()]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>'); }
  function autolinkBible(html){
    return html.replace(refRe, (m,bk,ch,vr,chEnd)=>{
      const version = (versionSelect && versionSelect.value) || "LSG";
      const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(chEnd ? `${bk} ${ch}-${chEnd}` : (vr ? `${bk} ${ch}:${vr}` : `${bk} ${ch}`))}&version=${encodeURIComponent(version)}`;
      return `<a href="${url}" target="_blank" rel="noopener">${m}</a>`;
    });
  }
  function wrapParagraphs(html){
    const blocks = String(html||"").split(/\n{2,}/);
    return blocks.map(b=> b.trim() ? "<p>"+b.replace(/\n/g,"<br>")+"</p>" : "").join("");
  }
  function renderViewFromArea(){
    const raw = noteArea.value || "";
    let html = sanitizeBasic(raw);
    html = mdLite(html);
    html = autolinkURLs(html);
    html = autolinkBible(html);
    html = wrapParagraphs(html);
    noteView.innerHTML = html || "<p style='color:#9aa2b1'>Écris ici…</p>";
  }
  function syncAreaFromView(){
    let html = noteView.innerHTML || "";
    html = html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, "$1");
    html = html.replace(/<br\s*\/?>/gi, "\n");
    html = html.replace(/<\/p>/gi, "\n\n").replace(/<p[^>]*>/gi,"");
    html = html.replace(/<\/?strong>/gi, "**").replace(/<\/?em>/gi, "*");
    html = html.replace(/<\/?[^>]+>/g,"");
    html = html.replace(/\n{3,}/g,"\n\n").trim();
    noteArea.value = html; notes[current] = noteArea.value; saveStorage(); updateLinksPanel();
  }
  noteView.addEventListener("click", (e)=>{
    const a = e.target.closest && e.target.closest("a");
    if (a && a.href) { e.preventDefault(); window.open(a.href, "_blank", "noopener"); }
  });

  /* ---------------------- VERROU généré ---------------------- */
  function stripDangerousTags(html) {
    if (!html) return "";
    html = html.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
    html = html.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
    html = html.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
    html = html.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
    html = html.replace(/<\/p>/gi, '\n\n');
    html = html.replace(/<\/h[1-6]>/gi, '\n\n');
    html = html.replace(/<br\s*\/?>/gi, '\n');
    html = html.replace(/<\/?[^>]+>/g, '');
    html = html.replace(/\n{3,}/g, '\n\n').trim();
    return html;
  }
  function cleanGeneratedContent(raw) { return stripDangerousTags(String(raw || "")); }

  /* ---------------------- Liens panel ---------------------- */
  function extractLinks(text) {
    const links = []; const raw = String(text || "");
    const aTagRe = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    let m; while ((m = aTagRe.exec(raw))) { links.push({ url: m[1], label: m[2] || m[1] }); }
    const urlRe = /https?:\/\/[^\s<>"'()]+/g;
    let n; while ((n = urlRe.exec(raw))) { const url = n[0]; if (!links.find(l => l.url === url)) links.push({ url, label: url }); }
    return links;
  }
  function findBibleRefs(text){
    const out = []; const seen = new Set(); const raw = String(text || ""); let m;
    while ((m = refRe.exec(raw))) {
      const book = m[1], chap = m[2], verseOrRange = m[3] || "", chapEnd = m[4] || "";
      const label = m[0];
      // On ne gère ici que le cas simple (un verset simple), on filtrera ranges plus bas
      out.push({ label, book, chap: +chap, verseOrRange, chapEnd });
      seen.add(label);
    }
    return out;
  }
  function updateLinksPanel() {
    const txt = noteArea.value || "";
    const urlLinks = extractLinks(txt);
    const bibleLinks = findBibleRefs(txt).map(r => {
      const version = (versionSelect && versionSelect.value) || "LSG";
      const search = r.chapEnd ? `${r.book} ${r.chap}-${r.chapEnd}` : (r.verseOrRange ? `${r.book} ${r.chap}:${r.verseOrRange}` : `${r.book} ${r.chap}`);
      const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${encodeURIComponent(version)}`;
      return { url, label: r.label };
    });
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

  /* ---------------------- Rendu / Thème ---------------------- */
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
  themeSelect && themeSelect.addEventListener("change", () => { document.body.setAttribute("data-theme", themeSelect.value); });

  /* ---------------------- Fetch JSON util ---------------------- */
  async function postJSON(url, payload, tries = 3) {
    let lastErr;
    for (let k = 0; k < tries; k++) {
      try {
        const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, cache: "no-store", body: JSON.stringify(payload) });
        if (!r.ok) { const msg = await r.text().catch(() => ""); throw new Error(msg || `HTTP ${r.status}`); }
        return r;
      } catch (e) { lastErr = e; await wait(350 * (k + 1)); }
    }
    throw lastErr;
  }

  /* ---------------------- Appels /api/chat ---------------------- */
  async function getStudy() {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const book = bookSelect?.value || "Genèse";
    const chapter = Number(chapterSelect?.value || 1);
    const verse = verseSelect?.value || "";

    const r = await postJSON("/api/chat", { book, chapter, verse, version: ver }, 3);
    const ct = r.headers.get("Content-Type") || "";
    if (/application\/json/i.test(ct)) {
      const j = await r.json().catch(() => ({}));
      if (!j || (j.ok === false)) throw new Error(j?.error || "Réponse JSON invalide");
      window.__lastChatSource = j.source || "unknown";
      window.__lastChatWarn = j.warn || "";
      return { from: j.source || "api", data: j.data };
    }
    const text = await r.text();
    const sections = [{id:2,title:"Canon et testament",content:text}];
    const data = { reference: `${book} ${chapter}`, sections };
    return { from: "api-md", data };
  }

  /* ---------------------- Génération / injection ---------------------- */
  function dedupeParagraphs(raw) {
    const lines = String(raw || "").split(/\r?\n/);
    const out = []; let last = "";
    for (const ln of lines) { const t = ln.trim(); if (t && t === last) continue; out.push(ln); last = t; }
    return out.join("\n");
  }
  function ensureLinksLineBreaks(txt) {
    return String(txt || "").replace(/(\S)(https?:\/\/[^\s)]+)(\S)?/g, (_, a, url, b) => `${a}\n${url}\n${b||""}`);
  }

  // Marqueur anti ré-injection par rubrique
  const injectedMarker = (idx) => `\n\n<!--#injected-verses:${idx}-->`;

  async function fetchVerseOnce({ book, chapter, verse, version }) {
    const r = await postJSON("/api/verse", { book, chapter, verse, version }, 2);
    const ctV = r.headers.get("Content-Type") || "";
    if (!/application\/json/i.test(ctV)) return null;
    const j = await r.json().catch(() => null);
    if (j && j.ok && j.text) return j;
    return null;
  }

  // Résout une référence “Livre Chap:Vers” en {book,chapter,verse}
  function resolveSimpleRef(label) {
    // label vient de refRe => on a (book, chap, verseOrRange, chapEnd) si besoin
    const m = [...label.matchAll(refRe)][0];
    if (!m) return null;
    const book = m[1];
    const chapter = Number(m[2]);
    if (!m[3] || /[–-]/.test(m[3])) return null; // ignore ranges pour /api/verse
    const verse = Number(m[3]);
    if (!Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
    return { book, chapter, verse };
  }

  async function injectVersesIntoSection(idx, policy) {
    // policy = { max: number, pick: "first"|"all", alsoLink?:true }
    let content = notes[idx] || "";
    if (!content.trim()) return;

    // déjà injecté ?
    if (content.includes(injectedMarker(idx))) return;

    // détecter refs
    const refs = findBibleRefs(content); // {label, book, chap, verseOrRange, chapEnd}
    if (!refs.length) return;

    // filtrer versets simples uniquement (Chap:Vers sans range) et dédupliquer par label
    const unique = [];
    const seen = new Set();
    for (const r of refs) {
      if (!r.verseOrRange || /[–-]/.test(r.verseOrRange)) continue; // uniquement verset simple
      const key = `${r.book}|${r.chap}|${r.verseOrRange}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push({ book: r.book, chapter: r.chap, verse: Number(r.verseOrRange) });
    }
    if (!unique.length) return;

    // sélectionner selon policy
    let selected = unique;
    if (policy.pick === "first") selected = unique.slice(0, 1);
    const MAX = Math.max(1, policy.max || 3);
    selected = selected.slice(0, MAX);

    // Appels séquencés (évite tempête)
    const version = (versionSelect && versionSelect.value) || "LSG";
    const outBlocks = [];
    for (const it of selected) {
      try {
        const v = await fetchVerseOnce({ ...it, version });
        if (v) {
          outBlocks.push(`— **Texte biblique** (${v.reference}, ${v.version || "LSG"})\n${v.text}`);
        } else {
          dlog(`[INJECT] échec /api/verse pour ${it.book} ${it.chapter}:${it.verse}`);
        }
      } catch (e) {
        dlog(`[INJECT] erreur /api/verse: ${String(e && e.message || e)}`);
      }
    }
    if (!outBlocks.length) return;

    // Append avec séparation claire + marqueur anti double
    const appended = [content.trim(), "", ...outBlocks].join("\n");
    notes[idx] = dedupeParagraphs(ensureLinksLineBreaks(appended)) + injectedMarker(idx);

    // si on est positionné dessus, on rafraîchit l'UI
    if (current === idx) {
      noteArea.value = notes[idx];
      renderViewFromArea(); updateLinksPanel();
      renderSidebarDots();
    }
  }

  async function generateStudy() {
    if (inFlight) return;
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (ou saisis une référence ex: Marc 5:1-20)"); return; }

    inFlight = true; busy(generateBtn, true);
    try {
      setProgress(15); await wait(60);
      setProgress(55);

      const { data } = await getStudy();
      notes = {}; // reset

      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) {
          notes[i] = cleanGeneratedContent(String(s.content || "").trim());
        }
      });

      // ---- Ne PAS écraser la prière d’ouverture générée ----
      // (on n’injecte par défaut buildRevisionSection/close que si vide)
      if (!notes[2] || !notes[2].trim()) notes[2] = "Révision : …";
      if (!notes[27] || !notes[27].trim()) notes[27] = "Prière de fin : …";

      // ---- Injection du verset courant sous la prière d'ouverture (idx 0)
      try {
        const hasVerse = verseSelect && verseSelect.value && Number(verseSelect.value) > 0;
        if (hasVerse) {
          const req = await postJSON("/api/verse", {
            book: bookSelect.value,
            chapter: Number(chapterSelect.value || 1),
            verse: Number(verseSelect.value),
            version: (versionSelect && versionSelect.value) || "LSG"
          }, 2);
          const ctV = req.headers.get("Content-Type") || "";
          if (/application\/json/i.test(ctV)) {
            const j = await req.json().catch(() => null);
            if (j && j.ok && j.text) {
              const verseBlock = [
                "",
                `➡ Lecture : https://www.biblegateway.com/passage/?search=${encodeURIComponent(j.reference)}&version=${encodeURIComponent(j.version || "LSG")}`,
                "",
                `— **Texte biblique** (${j.reference}, ${j.version || "LSG"})`,
                j.text
              ].join("\n");
              if (!notes[0] || !notes[0].trim()) notes[0] = "…";
              if (!notes[0].includes(injectedMarker(0))) {
                notes[0] = dedupeParagraphs(ensureLinksLineBreaks((notes[0] + "\n\n" + verseBlock).trim())) + injectedMarker(0);
              }
            }
          }
        }
      } catch (e) {
        dlog(`[VERSE] erreur: ${String(e && e.message || e)}`);
      }

      // ---- Filtre anti-phrases génériques (défense en profondeur) sur la prière
      if (notes[0]) {
        const banned = [
          "nous nous approchons de toi pour méditer",
          "ouvre notre intelligence",
          "purifie nos intentions",
          "fais naître en nous l’amour de ta volonté",
          "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
          "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
        ];
        let t = notes[0];
        banned.forEach(ph => { const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"); t = t.replace(re, ""); });
        notes[0] = t.trim().replace(/\n{3,}/g, "\n\n");
      }

      // ---- Injection contextuelle dans d'autres rubriques ----
      // Map par titre -> stratégie
      const titleToIndex = {};
      FIXED_POINTS.forEach((p, i) => titleToIndex[p.t] = i);

      const injectPlan = [
        { t: "Verset-clé doctrinal", pick: "first", max: 1 },
        { t: "Verset à mémoriser", pick: "first", max: 1 },
        { t: "Versets à retenir", pick: "all",   max: 5 },
        { t: "Analyse exégétique", pick: "all",  max: 3 },
        { t: "Références croisées", pick: "all", max: 3 }
      ];

      for (const plan of injectPlan) {
        const idx = titleToIndex[plan.t];
        if (typeof idx === "number" && idx >= 0 && idx < N && notes[idx]) {
          await injectVersesIntoSection(idx, { pick: plan.pick, max: plan.max });
        }
      }

      // ---- Finalisation UI
      renderSidebar(); select(0); renderSidebarDots();
      setProgress(100); setTimeout(() => setProgress(0), 300);
      dlog(`[GEN] source=${window.__lastChatSource} sections=${secs.length} → étude générée + injections OK`);
    } catch (e) {
      console.error(e); alert(String((e && e.message) || e));
    } finally {
      busy(generateBtn, false); inFlight = false;
    }
  }

  /* ---------------------- Init / Events ---------------------- */
  function applyEnrichMode(){ const on = !!(enrichToggle && enrichToggle.checked);
    if (on){ noteArea.style.display = "none"; noteView.style.display = "block"; renderViewFromArea(); noteView.focus();
    } else { noteView.style.display = "none"; noteArea.style.display = "block"; noteArea.focus(); } }
  if (enrichToggle){ enrichToggle.addEventListener("change", applyEnrichMode); }

  function renderBooksChaptersVerses(){ renderBooks(); renderChapters(); renderVerses(); }
  renderBooksChaptersVerses();
  renderSidebar(); select(0); renderSidebarDots(); updateLinksPanel(); applyEnrichMode();

  if (searchRef) {
    searchRef.addEventListener("keydown", (e) => { if (e.key === "Enter") { const sel = parseSearch(searchRef.value); if (sel) { applySelection(sel); autoGenerate(); } }});
    searchRef.addEventListener("blur", () => { const sel = parseSearch(searchRef.value); if (sel) { applySelection(sel); autoGenerate(); }});
  }

  function autoGenerate() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (bookSelect?.value && chapterSelect?.value && !(searchRef?.value || "").trim()) generateStudy();
    }, 250);
  }
  bookSelect.addEventListener("change", () => { renderChapters(); renderVerses(bookSelect.value === "Psaumes" ? 200 : 60); autoGenerate(); });
  chapterSelect.addEventListener("change", autoGenerate);
  verseSelect.addEventListener("change", () => { /* rien */ });

  generateBtn && generateBtn.addEventListener("click", generateStudy);

  readBtn && readBtn.addEventListener("click", () => {
    const b = bookSelect.value, c = chapterSelect.value, v = verseSelect.value, ver = versionSelect.value;
    const search = v ? `${b} ${c}:${v}` : `${b} ${c}`;
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${encodeURIComponent(ver)}`;
    window.open(url, "_blank", "noopener");
  });
  validateBtn && validateBtn.addEventListener("click", () => {
    const b = bookSelect.value, c = chapterSelect.value, v = verseSelect.value, ver = versionSelect.value;
    const search = v ? `${b} ${c}:${v}` : `${b} ${c}`;
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(search)}&version=${encodeURIComponent(ver)}`;
    window.open(url, "_blank", "noopener");
  });

  noteArea.addEventListener("input", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      notes[current] = noteArea.value; saveStorage(); renderViewFromArea(); updateLinksPanel();
    }, 700);
  });
  noteView.addEventListener("input", () => { syncAreaFromView(); });

  prevBtn.addEventListener("click", () => { if (current > 0) select(current - 1); });
  nextBtn.addEventListener("click", () => { if (current < N - 1) select(current + 1); });

  // Debug boutons (optionnels, si présents dans ta page)
  dbtn && dbtn.addEventListener("click", () => {
    const open = dpanel.style.display === "block";
    dpanel.style.display = open ? "none" : "block";
    dbtn.textContent = open ? "Debug" : "Fermer Debug";
  });
})();

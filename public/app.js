// public/app.js — Génération contextuelle (prompt enrichi) + auto-liens sûrs + verrou anti-balises
// Ne casse rien : thèmes, hooks, progression, panneaux, liens cliquables, etc.

(function () {
  // ---------- helpers UI ----------
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => { if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%"; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => { if (!el) return; el.disabled = !!on; el.classList.toggle("opacity-60", !!on); el.textContent = on ? "Génération..." : el.dataset.label || el.textContent; };
  const dpanel = $("debugPanel"); const dbtn = $("debugBtn");
  const dlog = (msg) => { if (!dpanel) return; dpanel.style.display = "block"; dbtn && (dbtn.textContent = "Fermer Debug"); const line = `[${new Date().toISOString()}] ${msg}`; dpanel.textContent += (dpanel.textContent ? "\n" : "") + line; console.log(line); };
  const setMini = (dot, ok) => { if (!dot) return; dot.classList.remove("ok", "ko"); if (ok === true) dot.classList.add("ok"); else if (ok === false) dot.classList.add("ko"); };

  // ---------- HOOK dispatcher ----------
  const HOOK = (name, detail) => { try { window.dispatchEvent(new CustomEvent(name, { detail })); } catch (e) {} };

  const searchRef = $("searchRef"), bookSelect = $("bookSelect"), chapterSelect = $("chapterSelect"),
        verseSelect = $("verseSelect"), versionSelect = $("versionSelect"),
        validateBtn = $("validate"), generateBtn = $("generateBtn"), readBtn = $("readBtn"),
        pointsList = $("pointsList"), edTitle = $("edTitle"),
        noteArea = $("noteArea"), noteView = $("noteView"),
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
    if (noteArea && i !== current) notes[current] = noteArea.value;
    saveStorage();
    current = i;
    document.querySelectorAll(".list .item").forEach((el) => el.classList.toggle("active", +el.dataset.idx === current));
    if (edTitle) edTitle.textContent = `${i + 1}. ${FIXED_POINTS[i].t}`;
    if (noteArea) noteArea.value = notes[i] || "";
    if (metaInfo) metaInfo.textContent = `Point ${i + 1} / ${N}`;
    renderViewFromArea();
    updateLinksPanel();
    if (enrichToggle && enrichToggle.checked) { noteView && noteView.focus(); } else { noteArea && noteArea.focus(); }
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

  // ---------- BibleGateway / réf. ----------
  function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const BOOK_TITLES = BOOKS.map(([n]) => n);
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

  // ---------- rendu enrichi (inline links) ----------
  function sanitizeBasic(text){
    return String(text||"")
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }
  function mdLite(html){
    return html
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
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
    noteArea.value = html;
    notes[current] = noteArea.value;
    saveStorage();
    updateLinksPanel();
    HOOK('be:note-changed', { index: current, value: noteArea.value, hasContent: !!(noteArea.value || '').trim() });
  }
  noteView.addEventListener("click", (e)=>{
    const a = e.target.closest && e.target.closest("a");
    if (a && a.href) { e.preventDefault(); window.open(a.href, "_blank", "noopener"); }
  });

  // ---------- VERROU ANTI-BALISES ----------
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
  function cleanGeneratedContent(raw) {
    return stripDangerousTags(String(raw || ""));
  }

  // ---------- fallback PRIÈRE variée si API muette ----------
  function hashRef(s){ let h=0; for(let i=0;i<s.length;i++){ h=(h*31 + s.charCodeAt(i))|0; } return Math.abs(h); }
  function variedPrayerOpen() {
    const book = bookSelect.value, c = chapterSelect.value, v = verseSelect.value;
    const ref = `${book} ${c}${v ? ':'+v : ''}`;
    const h = hashRef(ref);
    const invoc = ["Dieu créateur", "Père de lumière", "Seigneur de gloire", "Dieu fidèle", "Dieu de paix"];
    const demandes = [
      "éclaire nos pensées et redresse nos voies",
      "ouvre nos cœurs à ta sagesse",
      "rends notre écoute docile et joyeuse",
      "purifie nos intentions et fortifie notre foi",
      "conduis-nous dans toute la vérité"
    ];
    const fruits = [
      "obéir avec confiance", "espérer contre toute crainte",
      "servir avec humilité", "aimer la justice et la vérité",
      "demeurer fermes dans l’épreuve"
    ];
    const fin = [
      "Au nom de Jésus-Christ, amen.",
      "Par Jésus, notre Seigneur, amen.",
      "Par ton Esprit Saint, amen.",
      "Au nom du Seigneur Jésus, amen.",
      "Dans la paix du Christ, amen."
    ];
    const a = invoc[h % invoc.length];
    const b = demandes[(h>>3) % demandes.length];
    const c2 = fruits[(h>>1) % fruits.length];
    const d = fin[(h>>2) % fin.length];
    return `${a}, nous venons à toi pour méditer **${ref}** : ${b}. Que ta Parole façonne notre pensée et nos choix afin de ${c2}. ${d}`;
  }

  // ---------- garde-fous / gabarits ----------
  function bgwLink(book, chap, vers, version) {
    const core = `${book} ${chap}${vers ? ':'+vers : ''}`;
    return bgwUrl(core, version || (versionSelect && versionSelect.value) || "LSG");
  }
  function defaultPrayerClose() {
    const book = bookSelect.value, c = chapterSelect.value;
    return `Dieu de grâce, merci pour la lumière reçue dans **${book} ${c}**. Fortifie notre foi, accorde-nous d’obéir avec joie et de servir avec humilité. Garde ton Église dans la paix du Christ. Amen.`;
  }
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

  // ---------- cache / fetch ----------
  const cacheKey = (ref, ver) => `be_cache:${ref}::${ver || "LSG"}`;
  const loadCache = (ref, ver) => { try { return JSON.parse(localStorage.getItem(cacheKey(ref, ver)) || "null"); } catch { return null; } };
  const saveCacheResp = (ref, ver, data) => { try { localStorage.setItem(cacheKey(ref, ver), JSON.stringify({ at: Date.now(), data })); } catch {} };

  // Corps enrichi envoyé à l'API pour forcer la contextualisation
  function buildChatPayload() {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const book = bookSelect?.value || "Genèse";
    const chapter = Number(chapterSelect?.value || 1);

    const directives = `
Tu écris en français, pour une étude biblique structurée en 28 rubriques.
Exigences IMPORTANTES :
- La PRIÈRE D’OUVERTURE (rubrique 1) doit être contextuelle à ${book} ${chapter} :
  • 80–130 mots, ton pastoral.
  • Cite 2–3 motifs/thèmes spécifiques du chapitre (ex : "lumière/ténèbres", "création/ordre", "alliance", "foi/épreuve", etc. selon le passage).
  • Inclure au moins UNE référence explicite au format Livre Chapitre:Verset (ex: "${book} ${chapter}:1") intégrée au texte.
- Chaque rubrique doit être du texte brut (PAS de HTML), gras/italique en markdown léger uniquement (**gras**, *italique*).
- Toujours citer des références bibliques en clair (ex: "Jean 3:16-18") quand pertinent.
- Pas de balises <p>, <h3>, etc.

Retourne STRICTEMENT au format JSON suivant :
{
  "reference": "${book} ${chapter}",
  "sections": [
    {"id": 1, "title": "Prière d’ouverture", "content": "..."},
    {"id": 2, "title": "Canon et testament", "content": "..."},
    ...
    {"id": 28, "title": "Prière de fin", "content": "..."}
  ]
}`;

    const schema = FIXED_POINTS.map((p, i) => ({ id: i + 1, title: p.t }));
    return {
      book, chapter, version: ver, locale: "fr",
      task: "generate_study_v2",
      directives,
      schema
    };
  }

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
    const payload = buildChatPayload();
    const r = await postJSON("/api/chat", payload, 3);
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
    const data = { reference: payload.book + " " + payload.chapter, sections };
    return { from: "api-md", data };
  }

  // ---------- génération ----------
  function dedupeParagraphs(raw) {
    const lines = String(raw || "").split(/\r?\n/);
    const out = []; let last = "";
    for (const ln of lines) { const t = ln.trim(); if (t && t === last) continue; out.push(ln); last = t; }
    return out.join("\n");
  }
  function ensureLinksLineBreaks(txt) {
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

      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) {
          notes[i] = cleanGeneratedContent(String(s.content || "").trim());
        }
      });

      // ❗ NE PLUS ÉCRASER la prière si l’API l’a fournie
      if (!notes[0] || !notes[0].trim()) {
        notes[0] = variedPrayerOpen(); // fallback varié
      }
      if (!notes[2] || !notes[2].trim()) notes[2] = cleanGeneratedContent(buildRevisionSection());
      if (!notes[27] || !notes[27].trim()) notes[27] = cleanGeneratedContent(defaultPrayerClose());

      for (const k of Object.keys(notes)) {
        notes[k] = dedupeParagraphs(ensureLinksLineBreaks(notes[k]));
      }

      renderSidebar(); select(0); renderSidebarDots();
      HOOK('be:study-generated', {
        reference: data.reference || ref,
        filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k),
        notes
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

  // ---------- panneau liens ----------
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

  // ---------- init ----------
  renderBooks(); renderChapters(); renderVerses();
  renderSidebar(); select(0);
  renderSidebarDots();
  updateLinksPanel();

  function applyEnrichMode(){
    const on = !!(enrichToggle && enrichToggle.checked);
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
  if (enrichToggle){ enrichToggle.addEventListener("change", applyEnrichMode); }
  applyEnrichMode();

  // Recherche intelligente
  if (searchRef) {
    const autoGenerate = () => {
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (bookSelect?.value && chapterSelect?.value && !(searchRef?.value || "").trim()) generateStudy();
      }, 250);
    };
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

    bookSelect.addEventListener("change", () => { renderChapters(); renderVerses(bookSelect.value === "Psaumes" ? 200 : 60); generateStudy(); });
    chapterSelect.addEventListener("change", generateStudy);
  }

  // Boutons
  generateBtn && generateBtn.addEventListener("click", generateStudy);
  readBtn && readBtn.addEventListener("click", () => {
    const b = bookSelect.value, c = chapterSelect.value, v = verseSelect.value, ver = versionSelect.value;
    window.open(bgwLink(b, c, v, ver), "_blank", "noopener");
  });
  validateBtn && validateBtn.addEventListener("click", () => {
    const b = bookSelect.value, c = chapterSelect.value, v = verseSelect.value, ver = versionSelect.value;
    window.open(bgwLink(b, c, v, ver), "_blank", "noopener");
  });

  // autosave + liens live
  let autosaveTimer = null;
  noteArea.addEventListener("input", () => {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      notes[current] = noteArea.value;
      saveStorage();
      renderViewFromArea();
      updateLinksPanel();
      HOOK('be:note-changed', { index: current, value: noteArea.value, hasContent: !!(noteArea.value || '').trim() });
    }, 700);
  });
  noteView.addEventListener("input", () => { syncAreaFromView(); });

  // navigation
  prevBtn.addEventListener("click", () => { if (current > 0) select(current - 1); });
  nextBtn.addEventListener("click", () => { if (current < N - 1) select(current + 1); });

  // debug
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

  HOOK('be:init', {
    current,
    total: N,
    filled: Object.keys(notes).filter(k => (notes[k] || "").trim()).map(k => +k)
  });

})();

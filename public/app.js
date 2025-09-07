/* public/app.js — branche « tout recolle » (UI existante, zéro impact CSS)
   - Remplit les selects Livre/Chapitre depuis /api/bibleBooks & /api/bibleChapters
   - Bouton Générer -> /api/study-28 -> remplit la colonne Rubriques (28) + éditeur
   - Bouton "Lire la Bible" -> BibleGateway (LSG / JND)
*/

(function () {
  // ==== helpers dom ==========================================================
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  function textIncludes(el, needle) {
    return el && (el.textContent || "").toLowerCase().includes(needle.toLowerCase());
  }
  function escapeHtml(s="") {
    return String(s)
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // ==== trouve les éléments existants, sans casser la page ===================
  function findGenerateBtn() {
    // bouton dont le texte contient "Générer"
    return $$("button, a").find(b => textIncludes(b, "générer"));
  }
  function findReadBtn() {
    return $$("button, a").find(b => textIncludes(b, "lire la bible"));
  }
  function findBookSelect() {
    // select déjà présent qui liste des livres (Genèse, Exode…)
    const ids = ["bookSelect","livre","book"];
    for (const id of ids) { const el = $("#"+id); if (el) return el; }
    const sels = $$("select");
    for (const s of sels) {
      const opts = $$("#", s) || [];
      const t = Array.from(s.options || []).map(o => (o.text || o.value || "").toLowerCase()).join("|");
      if (/gen[eè]se|exode|psaumes|matthieu|apocalypse/.test(t)) return s;
    }
    // si rien n’existe, on crée un select discrètement et on le met
    // à la place du premier select vide de la barre
    const firstEmpty = $$("select").find(s => (s.options || []).length < 2);
    if (firstEmpty) return firstEmpty;
    return null;
  }
  function findChapterSelect() {
    const ids = ["chapterSelect","chapitre","chapter"];
    for (const id of ids) { const el = $("#"+id); if (el) return el; }
    // heuristique: select qui contient beaucoup de chiffres (1..50)
    const sels = $$("select");
    for (const s of sels) {
      const first = Array.from(s.options || []).slice(0, 12).map(o => (o.value || o.text || "").trim());
      const nums = first.filter(v => /^\d+$/.test(v)).length;
      if (nums >= 6) return s;
    }
    const empty = $$("select").find(s => (s.options || []).length < 2 && s !== findBookSelect());
    return empty || null;
  }
  function findVersionSelect() {
    const ids = ["versionSelect","version"];
    for (const id of ids) { const el = $("#"+id); if (el) return el; }
    const sels = $$("select");
    for (const s of sels) {
      const t = Array.from(s.options || []).map(o => (o.text || o.value || "").toLowerCase()).join("|");
      if (/segond|louis|darby|ostervald|neg|bds|s21|pdv/.test(t)) return s;
    }
    return null; // pas grave : on assumera LSG
  }
  function findRubriquesColumn() {
    // conteneur sous le titre "Rubriques"
    const candidates = $$("*").filter(n => textIncludes(n, "rubriques"));
    for (const h of candidates) {
      // cherche un conteneur défilant sous ce titre
      if (h.parentElement) return h.parentElement; // on écrira notre liste dedans
    }
    // fallback : crée un conteneur léger dans la première colonne (si deux colonnes)
    const twoCols = $$("main, .container, .columns, .grid, body").find(c => $$(".col, [class*='col-'], [class*='sidebar'], [class*='left']", c).length >= 1);
    return twoCols || document.body;
  }
  function findEditor() {
    // zone d’édition à droite : textarea ou contenteditable
    const ta = $("textarea");
    if (ta) return { el: ta, set: v => (ta.value = v) };
    const ed = $$("[contenteditable='true']").find(Boolean);
    if (ed) return { el: ed, set: v => (ed.innerText = v) };
    // conteneur de fallback : on injecte un <textarea> non stylé
    const box = document.createElement("textarea");
    box.style.width = "100%"; box.style.minHeight = "200px";
    const spot = $("#app") || document.body;
    spot.appendChild(box);
    return { el: box, set: v => (box.value = v) };
  }

  // éléments (trouvés/assumés)
  const BTN_GEN = findGenerateBtn();
  const BTN_READ = findReadBtn();
  const SEL_BOOK = findBookSelect();
  const SEL_CHAP = findChapterSelect();
  const SEL_VERS = findVersionSelect();
  const RUBR_COL = findRubriquesColumn();
  const EDITOR = findEditor();

  // conteneur interne pour notre liste (zéro style imposé)
  let rubriquesList = $("#rubriquesList");
  if (!rubriquesList) {
    rubriquesList = document.createElement("div");
    rubriquesList.id = "rubriquesList";
    RUBR_COL.appendChild(rubriquesList);
  }

  // ==== data mémoire =========================================================
  let lastStudy = null; // { meta, sections[] }
  let currentIndex = 1;

  // ==== API helpers ==========================================================
  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const t = await r.text();
    try { return { ok: r.ok, status: r.status, json: JSON.parse(t) }; }
    catch { return { ok: r.ok, status: r.status, text: t }; }
  }

  // ==== books / chapters =====================================================
  async function ensureBooks() {
    if (!SEL_BOOK) return;
    if ((SEL_BOOK.options || []).length > 2) return; // déjà rempli
    const res = await getJSON("/api/bibleBooks");
    const arr = (res.json && res.json.data) || res.json || [];
    if (!Array.isArray(arr) || !arr.length) return;
    SEL_BOOK.innerHTML = "";
    for (const b of arr) {
      const opt = document.createElement("option");
      opt.value = b.name || b; opt.textContent = b.name || b;
      SEL_BOOK.appendChild(opt);
    }
  }
  async function ensureChapters() {
    if (!SEL_BOOK || !SEL_CHAP) return;
    const book = SEL_BOOK.value || (SEL_BOOK.options[SEL_BOOK.selectedIndex] || {}).text || "Genèse";
    const res = await getJSON("/api/bibleChapters?book=" + encodeURIComponent(book));
    const arr = (res.json && res.json.data) || res.json || [];
    if (!Array.isArray(arr) || !arr.length) return;
    SEL_CHAP.innerHTML = "";
    for (const c of arr) {
      const n = c.number || c; // accepte {number:1} ou 1
      const opt = document.createElement("option");
      opt.value = n; opt.textContent = n;
      SEL_CHAP.appendChild(opt);
    }
  }

  // ==== rendu rubriques + édition ===========================================
  function renderRubriques(sections) {
    rubriquesList.innerHTML = ""; currentIndex = 1;
    const ul = document.createElement("ul");
    ul.style.listStyle = "none"; ul.style.margin = "0"; ul.style.padding = "0";
    for (const s of sections) {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = `${s.index}. ${s.title || ""}`;
      btn.style.display = "block";
      btn.style.width = "100%";
      btn.style.textAlign = "left";
      btn.style.padding = "8px 10px";
      btn.style.border = "none";
      btn.style.background = "transparent";
      btn.style.cursor = "pointer";
      btn.setAttribute("data-idx", s.index);
      btn.addEventListener("click", () => showSection(s.index));
      li.appendChild(btn);
      ul.appendChild(li);
    }
    rubriquesList.appendChild(ul);
  }

  function showSection(idx) {
    if (!lastStudy) return;
    const s = lastStudy.sections.find(x => x.index === idx);
    if (!s) return;
    currentIndex = idx;
    // applique dans la zone d’édition (texte brut)
    EDITOR.set(`${s.index}. ${s.title}\n\n${s.content || ""}`);
    // highlight optionnel (léger)
    $$("[data-idx]", rubriquesList).forEach(b => b.style.background = (Number(b.dataset.idx) === idx) ? "rgba(0,0,0,0.06)" : "transparent");
  }

  // ==== Generate =============================================================
  function normalizeVersion() {
    const v = SEL_VERS ? (SEL_VERS.options[SEL_VERS.selectedIndex] || {}).text || SEL_VERS.value : "LSG";
    const t = String(v||"").toLowerCase();
    if (/darby|jnd/.test(t)) return { translation: "JND", bibleId: "a93a92589195411f-01" };
    return { translation: "LSG", bibleId: "" }; // défaut LSG
  }

  async function generateStudy() {
    const book = SEL_BOOK ? SEL_BOOK.value : "Genèse";
    const chap = SEL_CHAP ? SEL_CHAP.value : "1";
    const { translation, bibleId } = normalizeVersion();
    const qs = new URLSearchParams({
      book, chapter: chap, translation, trace: "1"
    });
    if (bibleId) qs.set("bibleId", bibleId);

    const res = await getJSON("/api/study-28?" + qs.toString());
    if (!res.ok || !res.json || !res.json.ok) {
      alert("Erreur génération étude: " + (res.json?.error || res.status));
      return;
    }
    const data = res.json.data || {};
    lastStudy = data;
    renderRubriques(data.sections || []);
    showSection(1);
  }

  // ==== Lire la Bible (BibleGateway) ========================================
  function bibleGatewayVersion() {
    const v = SEL_VERS ? (SEL_VERS.options[SEL_VERS.selectedIndex] || {}).text || SEL_VERS.value : "LSG";
    const t = String(v||"").toLowerCase();
    // codes BG : LSG = LSG ; Darby FR = DAR
    if (/darby|jnd/.test(t)) return "DAR";
    return "LSG";
  }
  function openBibleGateway() {
    const book = SEL_BOOK ? SEL_BOOK.value : "Genèse";
    const chap = SEL_CHAP ? SEL_CHAP.value : "1";
    const ver = bibleGatewayVersion();
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}%20${encodeURIComponent(chap)}&version=${encodeURIComponent(ver)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ==== wires ================================================================
  async function boot() {
    try {
      await ensureBooks();
      await ensureChapters();
    } catch {}
  }

  // réagit au changement de livre -> recharge chapitres
  if (SEL_BOOK && SEL_CHAP) {
    SEL_BOOK.addEventListener("change", ensureChapters);
  }

  if (BTN_GEN) BTN_GEN.addEventListener("click", (e) => { e.preventDefault(); generateStudy(); });
  if (BTN_READ) BTN_READ.addEventListener("click", (e) => { e.preventDefault(); openBibleGateway(); });

  // fallback : si l’utilisateur presse Alt+E -> générer
  window.addEventListener("keydown", (ev) => {
    if (ev.altKey && (ev.key === "e" || ev.key === "E")) {
      ev.preventDefault(); generateStudy();
    }
  });

  // démarre quand le DOM est prêt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

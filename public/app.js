/* public/app.js — version « offline books/chapters »
   - N’APPELLE PAS /api/bibleBooks ni /api/bibleChapters (supprimés chez toi)
   - Remplit Livre/Chapitre localement (tous les 66 livres + nb chapitres)
   - Bouton Générer -> /api/study-28 (déjà en place côté API)
   - Bouton Lire la Bible -> BibleGateway (LSG ou Darby/JND)
*/

(function () {
  // ---- utils DOM ----
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

  function textIncludes(el, needle) {
    return el && (el.textContent || "").toLowerCase().includes(String(needle).toLowerCase());
  }

  // ---- références UI (on réutilise tes éléments existants) ----
  function findGenerateBtn() { return $$("button, a").find(b => textIncludes(b, "générer")); }
  function findReadBtn()     { return $$("button, a").find(b => textIncludes(b, "lire la bible")); }

  function findBookSelect() {
    const sels = $$("select");
    // s’il y a un select qui contient "Genèse", on le prend
    for (const s of sels) {
      const txt = Array.from(s.options||[]).map(o => (o.text||o.value||"").toLowerCase()).join("|");
      if (/gen[eè]se|exode|psaumes|matthieu|apocalypse/.test(txt)) return s;
    }
    // sinon, le premier select de la barre
    return sels[0] || null;
  }
  function findChapterSelect() {
    const sels = $$("select");
    // un select avec beaucoup de chiffres est souvent « Chapitre »
    for (const s of sels) {
      const nums = Array.from(s.options||[]).slice(0, 12).filter(o => /^\d+$/.test(o.value||o.text||"")).length;
      if (nums >= 6) return s;
    }
    // sinon un deuxième select de la barre
    return sels[1] || null;
  }
  function findVersionSelect() {
    const sels = $$("select");
    for (const s of sels) {
      const txt = Array.from(s.options||[]).map(o => (o.text||o.value||"").toLowerCase()).join("|");
      if (/segond|louis|darby|jnd|ostervald|neg|bds|s21|pdv/.test(txt)) return s;
    }
    return null; // pas bloquant
  }

  function findRubriquesColumn() {
    // On cible le conteneur sous « Rubriques »
    const title = $$("*").find(n => textIncludes(n, "rubriques"));
    return title ? title.parentElement : document.body;
  }

  function findEditor() {
    const ta = $("textarea");
    if (ta) return { set: v => (ta.value = v) };
    const ed = $$("[contenteditable='true']").find(Boolean);
    if (ed) return { set: v => (ed.innerText = v) };
    // fallback ultra simple
    const box = document.createElement("textarea");
    box.style.width = "100%"; box.style.minHeight = "220px";
    (document.body).appendChild(box);
    return { set: v => (box.value = v) };
  }

  const BTN_GEN = findGenerateBtn();
  const BTN_READ = findReadBtn();
  const SEL_BOOK = findBookSelect();
  const SEL_CHAP = findChapterSelect();
  const SEL_VERS = findVersionSelect();
  const RUBR_COL = findRubriquesColumn();
  const EDITOR   = findEditor();

  // ---- Données locales livres+chapitres (FR) ----
  // Format: [Nom affiché, OSIS, nbChap]
  const BOOKS = [
    ["Genèse","GEN",50],["Exode","EXO",40],["Lévitique","LEV",27],["Nombres","NUM",36],["Deutéronome","DEU",34],
    ["Josué","JOS",24],["Juges","JDG",21],["Ruth","RUT",4],
    ["1 Samuel","1SA",31],["2 Samuel","2SA",24],
    ["1 Rois","1KI",22],["2 Rois","2KI",25],
    ["1 Chroniques","1CH",29],["2 Chroniques","2CH",36],
    ["Esdras","EZR",10],["Néhémie","NEH",13],["Esther","EST",10],
    ["Job","JOB",42],["Psaumes","PSA",150],["Proverbes","PRO",31],["Ecclésiaste","ECC",12],["Cantique des cantiques","SNG",8],
    ["Ésaïe","ISA",66],["Jérémie","JER",52],["Lamentations","LAM",5],["Ézéchiel","EZK",48],["Daniel","DAN",12],
    ["Osée","HOS",14],["Joël","JOL",3],["Amos","AMO",9],["Abdias","OBA",1],["Jonas","JON",4],["Michée","MIC",7],["Nahum","NAM",3],["Habacuc","HAB",3],["Sophonie","ZEP",3],["Aggée","HAG",2],["Zacharie","ZEC",14],["Malachie","MAL",4],
    ["Matthieu","MAT",28],["Marc","MRK",16],["Luc","LUK",24],["Jean","JHN",21],["Actes","ACT",28],
    ["Romains","ROM",16],["1 Corinthiens","1CO",16],["2 Corinthiens","2CO",13],["Galates","GAL",6],["Éphésiens","EPH",6],["Philippiens","PHP",4],["Colossiens","COL",4],["1 Thessaloniciens","1TH",5],["2 Thessaloniciens","2TH",3],
    ["1 Timothée","1TI",6],["2 Timothée","2TI",4],["Tite","TIT",3],["Philémon","PHM",1],["Hébreux","HEB",13],
    ["Jacques","JAS",5],["1 Pierre","1PE",5],["2 Pierre","2PE",3],["1 Jean","1JN",5],["2 Jean","2JN",1],["3 Jean","3JN",1],["Jude","JUD",1],["Apocalypse","REV",22]
  ];

  // mapping d’accès rapide
  const BOOK_INDEX = new Map(BOOKS.map(b => [b[0], { osis: b[1], chapters: b[2] }]));

  // ---- Remplit Livre/Chapitre (sans API) ----
  function fillBooks() {
    if (!SEL_BOOK) return;
    // si déjà plein, ne pas dupliquer
    if ((SEL_BOOK.options||[]).length > 10 && Array.from(SEL_BOOK.options).some(o => /gen[eè]se/i.test(o.text))) return;

    SEL_BOOK.innerHTML = "";
    for (const [name] of BOOKS) {
      const opt = document.createElement("option");
      opt.value = name; opt.textContent = name;
      SEL_BOOK.appendChild(opt);
    }
  }

  function fillChapters() {
    if (!SEL_BOOK || !SEL_CHAP) return;
    const selected = SEL_BOOK.value || "Genèse";
    const info = BOOK_INDEX.get(selected) || BOOK_INDEX.get("Genèse");
    const n = info ? info.chapters : 50;
    SEL_CHAP.innerHTML = "";
    for (let i = 1; i <= n; i++) {
      const opt = document.createElement("option");
      opt.value = String(i); opt.textContent = String(i);
      SEL_CHAP.appendChild(opt);
    }
  }

  // ---- Rendu Rubriques + Éditeur ----
  let lastStudy = null;
  let rubriquesList = $("#rubriquesList");
  if (!rubriquesList) {
    rubriquesList = document.createElement("div");
    rubriquesList.id = "rubriquesList";
    RUBR_COL.appendChild(rubriquesList);
  }

  function renderRubriques(sections) {
    rubriquesList.innerHTML = "";
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
      btn.addEventListener("click", () => {
        EDITOR.set(`${s.index}. ${s.title}\n\n${s.content || ""}`);
        // léger highlight
        Array.from(ul.children).forEach(li2 => li2.style.background = "transparent");
        li.style.background = "rgba(0,0,0,.06)";
      });
      li.appendChild(btn);
      ul.appendChild(li);
    }
    rubriquesList.appendChild(ul);
  }

  // ---- API study-28 ----
  async function getJSON(url) {
    const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const t = await r.text();
    try { return { ok: r.ok, status: r.status, json: JSON.parse(t) }; }
    catch { return { ok: r.ok, status: r.status, text: t }; }
  }

  function normalizeVersion() {
    if (!SEL_VERS) return { translation: "LSG", bibleId: "" };
    const label = (SEL_VERS.options[SEL_VERS.selectedIndex] || {}).text || SEL_VERS.value || "";
    const t = String(label).toLowerCase();
    if (/darby|jnd/.test(t)) return { translation: "JND", bibleId: "a93a92589195411f-01" };
    return { translation: "LSG", bibleId: "" };
  }

  async function generateStudy() {
    const book = SEL_BOOK ? SEL_BOOK.value : "Genèse";
    const chapter = SEL_CHAP ? SEL_CHAP.value : "1";
    const { translation, bibleId } = normalizeVersion();

    const qs = new URLSearchParams({ book, chapter, translation });
    if (bibleId) qs.set("bibleId", bibleId);

    const res = await getJSON("/api/study-28?" + qs.toString());
    if (!res.ok || !res.json || !res.json.ok) {
      alert("Erreur /api/study-28: " + (res.json?.error || res.status));
      return;
    }
    lastStudy = res.json.data || {};
    const sections = lastStudy.sections || [];
    renderRubriques(sections);
    if (sections[0]) EDITOR.set(`${sections[0].index}. ${sections[0].title}\n\n${sections[0].content || ""}`);
  }

  // ---- BibleGateway ----
  function bibleGatewayVersion() {
    if (!SEL_VERS) return "LSG";
    const label = (SEL_VERS.options[SEL_VERS.selectedIndex] || {}).text || SEL_VERS.value || "";
    return /darby|jnd/i.test(label) ? "DAR" : "LSG";
  }
  function openBibleGateway() {
    const book = SEL_BOOK ? SEL_BOOK.value : "Genèse";
    const chapter = SEL_CHAP ? SEL_CHAP.value : "1";
    const ver = bibleGatewayVersion();
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(book)}%20${encodeURIComponent(chapter)}&version=${encodeURIComponent(ver)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  // ---- events / boot ----
  function wire() {
    if (SEL_BOOK && SEL_CHAP) SEL_BOOK.addEventListener("change", fillChapters);
    if (BTN_GEN)  BTN_GEN.addEventListener("click", (e) => { e.preventDefault(); generateStudy(); });
    if (BTN_READ) BTN_READ.addEventListener("click", (e) => { e.preventDefault(); openBibleGateway(); });
  }
  function boot() {
    fillBooks();
    fillChapters();
    wire();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();

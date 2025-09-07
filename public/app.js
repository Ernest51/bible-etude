/* public/app.js — version robuste, sans OpenAI, branchée sur /api/study-28
   ──────────────────────────────────────────────────────────────────────────
   ✅ Dropdowns : Livre / Chapitre / (Versets optionnel) / Version (label)
   ✅ Bouton  : Générer → appelle /api/study-28 et remplit 28 rubriques
   ✅ Colonne des 28 rubriques (clic = sélection)
   ✅ Zone d’édition à droite (textarea ou div[contenteditable])
   ✅ Boutons Précédent / Suivant
   ✅ Lien "Lire la Bible" (BibleGateway, FR, version choisie)
   ────────────────────────────────────────────────────────────────────────── */

(() => {
  // ──────────────────────────────────────────────────────────────────────────
  // 1) Sélecteurs tolérants (ajoutez idéalement les id indiqués)
  // ──────────────────────────────────────────────────────────────────────────
  const $ = (s, root=document) => root.querySelector(s);

  const bookSelect    = $('[data-id="book"]')    || $('#book')    || $('select[name="book"]')    || $$altSelect(0);
  const chapterSelect = $('[data-id="chapter"]') || $('#chapter') || $('select[name="chapter"]') || $$altSelect(1);
  const verseInput    = $('[data-id="verse"]')   || $('#verse')   || $('input[name="verse"]')    || null;
  const versionSelect = $('[data-id="version"]') || $('#version') || $('select[name="version"]') || $$altSelect(2);

  const generateBtn   = $('[data-id="generate"]') || $('#generate') || $('button:has(> span),button');
  const sidebarEl     = $('[data-id="sidebar"]')   || $('#sidebar')  || $('aside .rubriques, .rubriques, [data-role="rubriques"]');
  const editorEl      = $('[data-id="editor"]')    || $('#editor')   || $('textarea, [contenteditable="true"], .editor');

  const prevBtn       = $('[data-id="prev"]') || $('#prev') || $('button#prev, button:has(.icon-prev), button:contains("Précédent")');
  const nextBtn       = $('[data-id="next"]') || $('#next') || $('button#next, button:has(.icon-next), button:contains("Suivant")');
  const readBibleBtn  = $('[data-id="readBible"]') || $('#readBible') || $('button:contains("Lire la Bible"), a:contains("Lire la Bible")');

  function $$altSelect(n) {
    // Si votre barre de filtres contient plusieurs <select>, on tente un fallback par rang
    const sels = document.querySelectorAll('header select, .toolbar select, .filters select, main select');
    return sels[n] || null;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 2) Données : Livres FR + nombre de chapitres (pour remplir le chapitre)
  // ──────────────────────────────────────────────────────────────────────────
  const BOOKS = [
    ["Genèse",50],["Exode",40],["Lévitique",27],["Nombres",36],["Deutéronome",34],
    ["Josué",24],["Juges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
    ["1 Rois",22],["2 Rois",25],["1 Chroniques",29],["2 Chroniques",36],
    ["Esdras",10],["Néhémie",13],["Esther",10],["Job",42],["Psaumes",150],
    ["Proverbes",31],["Ecclésiaste",12],["Cantique des cantiques",8],
    ["Ésaïe",66],["Jérémie",52],["Lamentations",5],["Ézéchiel",48],["Daniel",12],
    ["Osée",14],["Joël",3],["Amos",9],["Abdias",1],["Jonas",4],["Michée",7],
    ["Nahoum",3],["Habacuc",3],["Sophonie",3],["Aggée",2],["Zacharie",14],["Malachie",4],
    ["Matthieu",28],["Marc",16],["Luc",24],["Jean",21],["Actes",28],
    ["Romains",16],["1 Corinthiens",16],["2 Corinthiens",13],["Galates",6],["Éphésiens",6],
    ["Philippiens",4],["Colossiens",4],["1 Thessaloniciens",5],["2 Thessaloniciens",3],
    ["1 Timothée",6],["2 Timothée",4],["Tite",3],["Philémon",1],["Hébreux",13],
    ["Jacques",5],["1 Pierre",5],["2 Pierre",3],["1 Jean",5],["2 Jean",1],["3 Jean",1],
    ["Jude",1],["Apocalypse",22]
  ];

  const VERSION_LABELS = [
    "LSG","JND","NEG","Semeur","BDS","PDV","NFC"
  ];

  // 28 titres fixes
  const FIXED_POINTS = [
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
    "Contexte historique","Structure littéraire","Genre littéraire","Thème central","Résumé en une phrase",
    "Mots-clés","Termes clés (définis)","Personnages et lieux","Problème / Question de départ",
    "Idées majeures (développement)","Verset pivot (climax)","Références croisées (AT)","Références croisées (NT)",
    "Parallèles bibliques","Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)",
    "Promesses et avertissements","Principes intemporels","Applications personnelles (3–5)",
    "Applications communautaires","Questions pour petits groupes (6)","Prière guidée","Méditation courte",
    "Versets à mémoriser (2–3)","Difficultés/objections & réponses","Ressources complémentaires"
  ];

  // ──────────────────────────────────────────────────────────────────────────
  // 3) État de l’application
  // ──────────────────────────────────────────────────────────────────────────
  const N = 28;                 // nombre de rubriques
  let notes = {};               // index (0..27) => contenu texte
  let idx = 0;                  // index sélectionné
  let inFlight = false;         // requête en cours

  // ──────────────────────────────────────────────────────────────────────────
  // 4) Helpers UI
  // ──────────────────────────────────────────────────────────────────────────
  function busy(el, on){ try { el.disabled = !!on; el.classList.toggle("is-busy", !!on); } catch{} }

  function getEditorText() {
    if (!editorEl) return "";
    if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT") return editorEl.value || "";
    return editorEl.innerText || editorEl.textContent || "";
  }
  function setEditorText(txt) {
    if (!editorEl) return;
    if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT") editorEl.value = txt || "";
    else { editorEl.innerHTML = ""; editorEl.textContent = txt || ""; }
  }

  function buildReference() {
    const b = bookSelect?.value || "";
    const c = chapterSelect?.value || "";
    if (!b || !c) return "";
    const v = verseInput?.value?.trim() || "";
    return v ? `${b} ${c}:${v}` : `${b} ${c}`;
  }

  function renderSidebar() {
    if (!sidebarEl) return;
    const html = FIXED_POINTS.slice(0, N).map((title, i) => {
      const active = (i === idx) ? ' data-active="1"' : "";
      const done = (notes[i] && notes[i].trim()) ? ' data-done="1"' : "";
      return `<div class="rubrique" data-i="${i}"${active}${done}>
        <span class="num">${i+1}</span>
        <span class="title">${escapeHtml(title)}</span>
        <span class="dot"></span>
      </div>`;
    }).join("");
    sidebarEl.innerHTML = html;
    sidebarEl.querySelectorAll(".rubrique").forEach(div => {
      div.addEventListener("click", () => {
        const i = Number(div.getAttribute("data-i") || "0");
        select(i);
      });
    });
  }

  function renderSidebarDots() {
    if (!sidebarEl) return;
    sidebarEl.querySelectorAll(".rubrique").forEach(div => {
      const i = Number(div.getAttribute("data-i") || "0");
      const dot = div.querySelector(".dot");
      if (!dot) return;
      if (notes[i] && notes[i].trim()) dot.classList.add("ok");
      else dot.classList.remove("ok");
    });
  }

  function select(i) {
    if (i < 0 || i >= N) return;
    // Sauve la note en cours
    const cur = getEditorText();
    if (notes[idx] !== undefined) notes[idx] = cur;

    idx = i;
    const txt = notes[i] || "";
    setEditorText(txt);

    // Marque l’item actif dans la liste
    if (sidebarEl) {
      sidebarEl.querySelectorAll(".rubrique").forEach(div => div.removeAttribute("data-active"));
      const curEl = sidebarEl.querySelector(`.rubrique[data-i="${i}"]`);
      if (curEl) curEl.setAttribute("data-active","1");
    }
  }

  function escapeHtml(s=""){
    return String(s)
      .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
      .replaceAll('"',"&quot;").replaceAll("'","&#39;");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 5) Génération : appelle /api/study-28
  // ──────────────────────────────────────────────────────────────────────────
  async function generateStudy() {
    if (inFlight) return;
    const ref = buildReference();
    if (!ref) { alert("Choisis un Livre + Chapitre (et versets optionnels)."); return; }

    inFlight = true; busy(generateBtn, true);
    try {
      const ver = versionSelect ? versionSelect.value : "LSG";
      const b = bookSelect?.value || "Genèse";
      const c = String(chapterSelect?.value || "1");
      const v = verseInput?.value?.trim() || "";

      const sp = new URLSearchParams({ book:b, chapter:c, translation:ver, mode:"full", trace:"1" });
      if (v) sp.set("verse", v);

      const res = await fetch(`/api/study-28?${sp.toString()}`, {
        headers: { "accept": "application/json" }, cache:"no-store"
      });
      const raw = await res.text();
      let j = null; try { j = JSON.parse(raw); } catch {}

      if (!res.ok || !j || j.ok === false) {
        console.error("study-28 error:", res.status, raw);
        alert(`Échec /api/study-28 — HTTP ${res.status}`);
        return;
      }
      const data = j.data || {};
      const sections = Array.isArray(data.sections) ? data.sections : [];
      notes = {};

      // mini-strip pour éviter tout HTML "sale"
      const strip = (s) => String(s||"").replace(/<\/?[^>]+>/g,"").replace(/\s+\n/g,"\n").trim();

      sections.forEach(s => {
        const i = (s.index | 0) - 1;
        if (i >= 0 && i < N) {
          let txt = strip(s.content || "");
          if (!txt) txt = `(${data.meta?.reference || `${b} ${c}`}) — contenu non disponible.`;
          notes[i] = txt;
        }
      });

      // fallback si certaines cases restent vides
      for (let i=0;i<N;i++){
        if (!notes[i] || !notes[i].trim()){
          notes[i] = `${FIXED_POINTS[i]} — ${data.meta?.reference || `${b} ${c}`}.`;
        }
      }

      renderSidebar(); select(0); renderSidebarDots();
    } catch (e) {
      console.error(e);
      alert(String((e && e.message) || e));
    } finally {
      busy(generateBtn, false); inFlight = false;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6) Lecture BibleGateway (FR) avec la version choisie
  // ──────────────────────────────────────────────────────────────────────────
  function openBibleGateway() {
    const ref = buildReference() || "Jean 3:16";
    const ver = (versionSelect && versionSelect.value) || "LSG";
    // Petite normalisation de versions usuelles
    const map = { "LSG":"LSG", "JND":"DARBY", "NEG":"NEG1979", "Semeur":"S21", "BDS":"BDS", "PDV":"PDV", "NFC":"NFC" };
    const v = map[ver] || "LSG";
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(v)}&language=fr`;
    window.open(url, "_blank", "noopener");
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7) Wiring UI + init
  // ──────────────────────────────────────────────────────────────────────────
  function fillBooks() {
    if (!bookSelect) return;
    if (bookSelect.options && bookSelect.options.length > 2) return; // déjà rempli
    bookSelect.innerHTML = BOOKS.map(([name]) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join("");
  }
  function fillChapters() {
    if (!chapterSelect || !bookSelect) return;
    const name = bookSelect.value;
    const found = BOOKS.find(([n]) => n === name);
    const max = found ? found[1] : 150;
    const cur = Number(chapterSelect.value || 1);
    chapterSelect.innerHTML = "";
    for (let i=1;i<=max;i++){
      const opt = document.createElement("option");
      opt.value = String(i); opt.textContent = String(i);
      if (i === cur) opt.selected = true;
      chapterSelect.appendChild(opt);
    }
  }
  function fillVersions() {
    if (!versionSelect) return;
    if (versionSelect.options && versionSelect.options.length > 2) return;
    versionSelect.innerHTML = VERSION_LABELS.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  }

  function hookEvents() {
    if (bookSelect) bookSelect.addEventListener("change", fillChapters);
    if (generateBtn) generateBtn.addEventListener("click", generateStudy);
    if (readBibleBtn) readBibleBtn.addEventListener("click", openBibleGateway);

    if (editorEl) {
      const save = () => {
        // sauve la rédaction en cours dans notes[idx]
        notes[idx] = getEditorText();
        renderSidebarDots();
      };
      if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT")
        editorEl.addEventListener("input", save);
      else
        editorEl.addEventListener("input", save);
    }

    if (prevBtn) prevBtn.addEventListener("click", () => { if (idx > 0) select(idx-1); });
    if (nextBtn) nextBtn.addEventListener("click", () => { if (idx < N-1) select(idx+1); });
  }

  function init() {
    try {
      fillBooks();
      fillChapters();
      fillVersions();

      // Initialise 28 rubriques vides
      notes = {};
      for (let i=0;i<N;i++) notes[i] = "";
      renderSidebar();
      select(0);
      hookEvents();
    } catch (e) {
      console.error("init app.js error:", e);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();

/* public/app.js
   Étude 28 points — front « tolérant »
   - Appel /api/study-28
   - Injection des 28 rubriques
   - 2 GARDE-FOUS pour ne pas écraser la saisie utilisateur
   - Marquage des points comme « fait »
   - Lien "Lire la Bible" (BibleGateway) basé sur meta.reference
*/

(() => {
  // ---------- Utilitaires ----------
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const now = () => new Date().toISOString();

  function log(...args) {
    // eslint-disable-next-line no-console
    console.log(`[${now()}]`, ...args);
  }

  // Échappement minimal & nettoyage HTML → texte
  const strip = (html = "") =>
    String(html).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  // ---------- Sélecteurs « tolérants » ----------
  // Vous pouvez ajuster ici si vos noms d’éléments changent.
  const SEL = {
    // Contrôles de la barre supérieure
    book: [
      '#book',                      // <input id="book">
      'select[name="book"]',
      'input[placeholder^="Genèse"]',
      'select:has(option[value="Genèse"])',
    ],
    chapter: [
      '#chapter',                   // <input id="chapter">
      'input[name="chapter"]',
      'select[name="chapter"]',
      'input[type="number"]',
    ],
    verse: [
      '#verse',
      'input[name="verse"]',
      'input[placeholder*="1-5"]',
    ],
    translation: [
      '#translation',
      'select[name="translation"]',
      'select:has(option[value="LSG"]), select:has(option[value="JND"])',
    ],

    // Boutons
    btnGenerate: [
      '#btnGenerate',
      'button#generate',
      'button:has(span:contains("Génération"))',
      'button:has(span:contains("Générer"))',
      'button:has(span:contains("Génération..."))',
    ],
    btnReadBible: [
      '#btnLireBible',
      'button#btnLireBible',
      'button:has(span:contains("Lire la Bible"))',
      'button:contains("Lire la Bible")',
    ],

    // Zones de saisie par rubrique (n = 1..28)
    // On tente d’abord data-note-index, puis id=note-n, puis un fallback plus permissif
    noteByIndex: (n) => [
      `[data-note-index="${n}"] textarea`,
      `#note-${n}`,
      `.note[data-index="${n}"] textarea`,
      `.rubric[data-index="${n}"] textarea`,
      `.rubrique[data-index="${n}"] textarea`,
    ],
    // Pastille/dot « fait »
    dotByIndex: (n) => [
      `[data-note-index="${n}"] .dot`,
      `[data-index="${n}"] .dot`,
      `#dot-${n}`,
    ],
  };

  // Essayez chaque sélecteur jusqu’à trouver le premier élément existant
  function pickFirst(selectors, root = document) {
    for (const s of selectors) {
      try {
        const el = $(s, root);
        if (el) return el;
      } catch {}
    }
    return null;
  }

  // ---------- Garde-fous (NE PAS ÉCRASER la saisie) ----------
  /**
   * 1) Ne jamais écraser un texte déjà saisi par l'utilisateur :
   *    - Si textarea.value existe & n’a PAS été marqué comme autoFill → on ne touche pas.
   * 2) Quand on remplit, on marque dataset.autoFill = "1" pour savoir que ça vient de l'injection.
   */
  function setIfEmpty(textarea, value) {
    if (!textarea) return;
    const hasUserText = textarea.value && !textarea.dataset.autoFill;
    if (hasUserText) return; // Garde-fou n°1
    textarea.value = value || "";
    textarea.dataset.autoFill = "1"; // Garde-fou n°2
  }

  // Marque la pastille verte si présente
  function markDone(n) {
    const dot = pickFirst(SEL.dotByIndex(n));
    if (dot) {
      dot.classList.add("done", "ok", "active");
      // si vous utilisez une autre classe, adaptez ici
    }
  }

  // ---------- Lecture des paramètres UI ----------
  function readControl(selectors, fallback = "") {
    const el = pickFirst(selectors);
    if (!el) return fallback;
    const val = (el.value ?? el.textContent ?? "").trim();
    return val || fallback;
  }

  function getParams() {
    const book = readControl(SEL.book, "Genèse");
    const chapter = readControl(SEL.chapter, "1");
    const verse = readControl(SEL.verse, "");
    const translation = readControl(SEL.translation, "LSG");
    return { book, chapter, verse, translation };
  }

  // ---------- Appel de l’API ----------
  async function callStudy28({ book, chapter, verse, translation, mode = "full" } = {}) {
    const sp = new URLSearchParams({ book, chapter, translation, mode, trace: "1" });
    if (verse) sp.set("verse", verse);

    const url = `/api/study-28?${sp.toString()}`;
    log("[GEN] fetch", url);

    const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const text = await r.text();
    let j = null;
    try {
      j = JSON.parse(text);
    } catch {
      throw new Error(`Réponse invalide (${r.status}) : ${text.slice(0, 180)}…`);
    }
    if (!r.ok || !j || j.ok === false) {
      throw new Error(j?.error || `HTTP ${r.status}`);
    }
    return j;
  }

  // ---------- Injection dans l’UI ----------
  function injectSections(sections) {
    if (!Array.isArray(sections) || !sections.length) return 0;

    let injected = 0;

    for (const s of sections) {
      const idx = Number(s.index || 0);
      if (!idx || idx < 1 || idx > 28) continue;

      const selectors = SEL.noteByIndex(idx);
      const ta = pickFirst(selectors);
      if (!ta) continue;

      const clean = strip(s.content || "");
      setIfEmpty(ta, clean);
      markDone(idx);
      injected++;
    }

    return injected;
  }

  // ---------- Lire la Bible ----------
  function openBibleGateway(ref, trad = "LSG") {
    const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${encodeURIComponent(trad)}`;
    window.open(url, "_blank", "noopener");
  }

  // ---------- Workflow principal ----------
  async function generateAndInject() {
    try {
      const { book, chapter, verse, translation } = getParams();
      const metaRef = `${book} ${chapter}${verse ? ":" + verse : ""}`;

      const payload = await callStudy28({ book, chapter, verse, translation, mode: "full" });
      const data = payload?.data || {};
      const meta = data?.meta || {};
      const sections = data?.sections || [];

      const n = injectSections(sections);

      log(
        `[GEN] source=study-28/api.bible sections=${sections.length} ` +
          `→ étude générée + injections OK (injecté=${n}) ref="${meta.reference || metaRef}"`
      );
    } catch (err) {
      log("[GEN] ERREUR", err?.message || err);
      alert(`Erreur génération: ${err?.message || err}`);
    }
  }

  // ---------- Wiring des boutons ----------
  function wireButtons() {
    // Générer
    const btnGen =
      pickFirst(SEL.btnGenerate) ||
      // petits fallbacks courants
      $('button:has(span:contains("Génération"))') ||
      $('button:has(span:contains("Générer"))');

    if (btnGen) {
      btnGen.addEventListener("click", (e) => {
        e.preventDefault();
        generateAndInject();
      });
    }

    // Lire la Bible
    const btnBible = pickFirst(SEL.btnReadBible);
    if (btnBible) {
      btnBible.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          const { book, chapter, verse, translation } = getParams();
          // On tente d'utiliser la dernière meta de /api/study-28 si elle est présente en cache
          // Sinon, on tombe sur une référence simple « livre chapitre[:versets] »
          let ref = `${book} ${chapter}${verse ? ":" + verse : ""}`;
          try {
            // petit « ping » rapide pour récupérer meta.reference mis à jour sans ré-injecter
            const ping = await callStudy28({ book, chapter, verse, translation, mode: "mini" });
            ref = ping?.data?.meta?.reference || ref;
          } catch {}
          openBibleGateway(ref, translation || "LSG");
        } catch (err) {
          openBibleGateway("Genèse 1", "LSG");
        }
      });
    }
  }

  // ---------- Auto-init ----------
  document.addEventListener("DOMContentLoaded", () => {
    wireButtons();
    // Option : auto-générer au chargement si vous le souhaitez
    // generateAndInject();
  });

  // ---------- Expose (debug) ----------
  window.__Study28 = {
    getParams,
    callStudy28,
    injectSections,
    generateAndInject,
  };
})();

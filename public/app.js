/* public/app.js
 * Client minimal robuste pour générer et injecter l'étude 28 points
 * depuis /api/study-28 sans casser la page existante.
 * Pas de sélecteurs CSS “exotiques” ; tout est tolérant et défensif.
 */

(function () {
  const LOG_PREFIX = "[APP]";
  const state = {
    sections: [],
    index: 0,
    meta: null,
  };

  // ---------- Helpers DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byTextButton = (text) =>
    $$(".btn,button,input[type=button],input[type=submit]").find(
      (el) => (el.value || el.textContent || "").trim() === text
    ) || null;

  // ---------- Zones connues (si présentes) ----------
  function refs() {
    return {
      // toolbar / boutons
      genBtn:
        byTextButton("Générer") ||
        $("[data-generate]") ||
        null,

      prevBtn:
        $("#prev") ||
        byTextButton("◀ Précédent") ||
        byTextButton("Précédent") ||
        $("[data-prev]") ||
        null,

      nextBtn:
        $("#next") ||
        byTextButton("Suivant ▶") ||
        byTextButton("Suivant") ||
        $("[data-next]") ||
        null,

      // sélecteurs priorité: tes ids -> anciens -> heuristique
      book:
        $("#bookSelect") ||
        $("#book") ||
        $("[name=book]") ||
        $("[data-book]") ||
        null,

      chapter:
        $("#chapterSelect") ||
        $("#chapter") ||
        $("[name=chapter]") ||
        $("[data-chapter]") ||
        null,

      verse:
        $("#verseSelect") ||
        $("#verse") ||
        $("[name=verse]") ||
        $("[data-verse]") ||
        null,

      translation:
        $("#versionSelect") ||
        $("#translation") ||
        $("[name=translation]") ||
        $("[data-translation]") ||
        null,

      bibleId:
        $("#bibleId") ||
        $("[name=bibleId]") ||
        $("[data-bibleid]") ||
        null,

      // conteneurs UI
      rubriquesList: $("#pointsList") || null,
      editorArea: $("#noteArea") || null,
      editorView: $("#noteView") || null,
      titleNode: $("#edTitle") || null,
    };
  }

  // ---------- Fallbacks tolérants ----------
  function findToolbar() {
    const genBtn = byTextButton("Générer");
    return genBtn ? (genBtn.closest("form,div,section,header,main") || document) : document;
  }

  function getSelectCandidates() {
    const tb = findToolbar();
    // visiblement affichés
    return $$("select", tb).filter((el) => el.offsetParent !== null);
  }

  function ensureSelectFallbacks(r) {
    // Si un des champs livre/chapitre/verset/trad n’est pas trouvé,
    // on complète à partir des selects visibles dans la barre.
    const sels = getSelectCandidates();
    if (!r.book && sels[0]) r.book = sels[0];
    if (!r.chapter && sels[1]) r.chapter = sels[1];
    if (!r.verse && sels[2]) r.verse = sels[2];

    if (!r.translation) {
      const guess = sels.find((s) => {
        const txt = (s.options[s.selectedIndex]?.text || "").toLowerCase();
        return /segond|darby|jnd|neg|ost|kjv|niv|lsg|ostervald|king|louis|version|traduction/.test(txt);
      });
      if (guess) r.translation = guess;
    }
    return r;
  }

  // ---------- Lecture des paramètres ----------
  function readValueFromField(el) {
    if (!el) return "";
    const tag = (el.tagName || "").toUpperCase();

    if (tag === "SELECT") {
      const opt = el.options[el.selectedIndex];
      return opt ? (opt.value || opt.text || "").trim() : "";
    }
    if (tag === "INPUT" || tag === "TEXTAREA") {
      return (el.value || "").trim();
    }
    // data-*
    if (el.dataset) {
      return (
        el.dataset.book ||
        el.dataset.chapter ||
        el.dataset.verse ||
        el.dataset.translation ||
        el.dataset.bibleid ||
        ""
      ).trim();
    }
    return "";
  }

  function readParams() {
    let {
      book, chapter, verse, translation, bibleId,
    } = refs();

    // fallback: compléter avec les selects visibles si manquants
    ({ book, chapter, verse, translation } = ensureSelectFallbacks({ book, chapter, verse, translation }));

    const params = {
      book: readValueFromField(book),
      chapter: readValueFromField(chapter),
      verse: readValueFromField(verse),
      translation: readValueFromField(translation) || "JND",
      bibleId: readValueFromField(bibleId),
    };

    params.book = (params.book || "").trim();
    params.chapter = String(params.chapter || "1").trim();
    params.verse = String(params.verse || "").trim();

    console.log(LOG_PREFIX, "Params", params);
    return params;
  }

  // ---------- Ciblage UI sûr ----------
  function findRubriquesContainer() {
    // 1) ta zone prioritaire
    const r = refs();
    if (r.rubriquesList) return r.rubriquesList;

    // 2) fallback: bloc “Rubriques”
    const headings = $$("h1,h2,h3,div,span,b,strong").filter((n) =>
      /rubriques/i.test((n.textContent || "").trim())
    );
    if (headings.length) {
      const sib = headings[0].parentElement?.nextElementSibling || headings[0].nextElementSibling;
      // on encapsule notre propre sous-conteneur
      let holder = (sib && sib.querySelector("[data-rubriques]")) || null;
      if (!holder && sib) {
        holder = document.createElement("div");
        holder.setAttribute("data-rubriques", "1");
        sib.appendChild(holder);
      }
      return holder || sib || headings[0];
    }

    // 3) fallback minimal
    return null;
  }

  function findEditor() {
    const r = refs();
    // priorité: #noteArea / #noteView
    if (r.editorArea) return r.editorArea;
    if (r.editorView) return r.editorView;

    // autre gros textarea
    const textareas = $$("textarea").sort((a, b) => b.clientHeight - a.clientHeight);
    if (textareas[0]) return textareas[0];

    const editables = $$("[contenteditable=true]").sort((a, b) => b.clientHeight - a.clientHeight);
    if (editables[0]) return editables[0];

    return null;
  }

  function findPrevNext() {
    const r = refs();
    return { prev: r.prevBtn, next: r.nextBtn };
  }

  // ---------- Rendu ----------
  function renderRubriques() {
    const host = findRubriquesContainer();
    if (!host) return;

    // Si c’est #pointsList, on le rempli avec tes cards ; sinon, liste simple
    const isNativeList = host.id === "pointsList";

    if (!isNativeList) {
      host.innerHTML = ""; // nettoie un conteneur de secours
    }

    state.sections.forEach((s, i) => {
      if (isNativeList) {
        // Maquette simple lisible dans ton CSS existant
        const item = document.createElement("div");
        item.className = "item";
        item.setAttribute("data-i", String(i));
        item.innerHTML = `
          <span class="idx">${s.index}</span>
          <div>
            <div>${escapeHtml(s.title || ("Rubrique " + s.index))}</div>
            <span class="desc">Rubrique ${s.index}</span>
          </div>
          <span class="dot ok"></span>
        `;
        item.addEventListener("click", () => {
          state.index = i;
          renderEditor();
          highlightActive(host);
          // scroll doux
          try { item.scrollIntoView({ block: "nearest" }); } catch {}
        });
        host.appendChild(item);
      } else {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = `${s.index}. ${s.title || ""}`;
        btn.style.display = "block";
        btn.style.width = "100%";
        btn.style.textAlign = "left";
        btn.style.padding = "10px 12px";
        btn.style.border = "0";
        btn.style.background = "transparent";
        btn.style.cursor = "pointer";
        btn.addEventListener("click", () => {
          state.index = i;
          renderEditor();
          highlightActive(host);
        });
        host.appendChild(btn);
      }
    });

    highlightActive(host);
  }

  function highlightActive(listRoot) {
    if (!listRoot) return;
    const idx = state.index;

    if (listRoot.id === "pointsList") {
      $$(".item", listRoot).forEach((n, i) => {
        n.classList.toggle("active", i === idx);
      });
      return;
    }

    const buttons = $$("button", listRoot);
    buttons.forEach((b, i) => {
      b.style.background = i === idx ? "rgba(100, 116, 139, .12)" : "transparent";
      b.style.fontWeight = i === idx ? "700" : "400";
    });
  }

  function renderEditor() {
    const ed = findEditor();
    const sec = state.sections[state.index];
    if (!ed || !sec) return;

    const text = (sec.content || "").trim() || (state.meta ? `(${state.meta.reference})` : "");

    const tag = (ed.tagName || "").toUpperCase();
    if (tag === "TEXTAREA" || tag === "INPUT") {
      ed.value = text;
    } else if (ed.isContentEditable) {
      ed.innerText = text;
    } else {
      ed.textContent = text;
    }

    const r = refs();
    if (r.titleNode) {
      r.titleNode.textContent = `${sec.index}. ${sec.title || ""}`;
    }
  }

  function wirePrevNext() {
    const { prev, next } = findPrevNext();
    if (prev && !prev.__wired) {
      prev.__wired = true;
      prev.addEventListener("click", (e) => {
        e.preventDefault();
        if (!state.sections.length) return;
        state.index = (state.index - 1 + state.sections.length) % state.sections.length;
        renderEditor();
        renderRubriques();
      });
    }
    if (next && !next.__wired) {
      next.__wired = true;
      next.addEventListener("click", (e) => {
        e.preventDefault();
        if (!state.sections.length) return;
        state.index = (state.index + 1) % state.sections.length;
        renderEditor();
        renderRubriques();
      });
    }
  }

  // ---------- Appels API ----------
  async function callStudy28(p) {
    const usp = new URLSearchParams();
    if (p.book) usp.set("book", p.book);
    if (p.chapter) usp.set("chapter", p.chapter);
    if (p.verse) usp.set("verse", p.verse);
    if (p.translation) usp.set("translation", p.translation);
    if (p.bibleId) usp.set("bibleId", p.bibleId);
    usp.set("mode", "full"); // 28 sections
    usp.set("trace", "1");

    const url = `/api/study-28?${usp.toString()}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });

    if (!r.ok) {
      // 404 explicite : route manquante côté serveur
      if (r.status === 404) {
        throw new Error("API study-28 introuvable (HTTP 404). Vérifie que /api/study-28 est bien déployée.");
      }
      const t = await r.text().catch(() => "");
      throw new Error(`API study-28 — HTTP ${r.status}${t ? " · " + t : ""}`);
    }

    const j = await r.json().catch(() => null);
    if (!j || !j.ok) throw new Error(j?.error || "Réponse invalide de /api/study-28");
    return j;
  }

  async function generate() {
    try {
      const params = readParams();
      if (!params.book || !params.chapter) {
        alert("Sélectionne un livre et un chapitre avant de générer l’étude.");
        return;
      }

      const res = await callStudy28(params);
      const meta = res.data?.meta || {};
      const sections = Array.isArray(res.data?.sections) ? res.data.sections : [];

      if (!sections.length) {
        alert("Aucune section générée (API OK mais sections vides).");
        console.warn(LOG_PREFIX, "Payload vide", res);
        return;
      }

      state.meta = meta;
      state.sections = sections;
      state.index = 0;

      renderRubriques();
      renderEditor();
      wirePrevNext();

      console.log(
        LOG_PREFIX,
        "Génération OK",
        `${meta.reference || (params.book + " " + params.chapter)} — ${sections.length} sections`
      );
    } catch (e) {
      console.error(LOG_PREFIX, "Erreur pendant la génération:", e);
      alert(`Erreur pendant la génération : ${e?.message || e}`);
    }
  }

  function wireGenerateButton() {
    const r = refs();
    const btn = r.genBtn;
    if (!btn) {
      console.warn(LOG_PREFIX, "Bouton Générer introuvable — la page restera passive.");
      return;
    }
    if (btn.__wired) return;
    btn.__wired = true;
    btn.addEventListener("click", (ev) => {
      ev.preventDefault();
      generate();
    });
  }

  // ---------- Utils ----------
  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }

  // ---------- Init ----------
  function init() {
    try {
      wireGenerateButton();
      wirePrevNext();
      console.log(LOG_PREFIX, "Init OK");
    } catch (e) {
      console.error(LOG_PREFIX, "Init error", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();

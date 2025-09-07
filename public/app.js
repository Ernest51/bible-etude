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

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const byTextButton = (text) =>
    $$(".btn,button,input[type=button],input[type=submit]").find(
      (el) => (el.value || el.textContent || "").trim() === text
    ) || null;

  // ---------- Trouve les éléments de la page de manière tolérante ----------
  function findToolbar() {
    // On repère la barre d’outils en cherchant le bouton “Générer” et on remonte.
    const genBtn = byTextButton("Générer");
    return genBtn ? genBtn.closest("form,div,section,header,main") || document : document;
  }

  function getSelectCandidates() {
    // On récupère tous les <select> visibles de la barre.
    const tb = findToolbar();
    const all = $$("select", tb).filter((el) => el.offsetParent !== null);
    return all;
  }

  function readParams() {
    const params = {
      book: "",
      chapter: "",
      verse: "",
      translation: "",
      bibleId: "",
    };

    // 1) Essais directs par name/id (les plus fiables s'ils existent)
    const direct = {
      book:
        $("#book") ||
        $("[name=book]") ||
        $("[data-book]"),
      chapter:
        $("#chapter") ||
        $("[name=chapter]") ||
        $("[data-chapter]"),
      verse:
        $("#verse") ||
        $("[name=verse]") ||
        $("[data-verse]"),
      translation:
        $("#translation") ||
        $("[name=translation]") ||
        $("[data-translation]"),
      bibleId:
        $("#bibleId") ||
        $("[name=bibleId]") ||
        $("[data-bibleid]"),
    };

    // 2) Si pas trouvés : on regarde les <select> de la barre d’outils
    const selects = getSelectCandidates();

    // Heuristique : ordre le plus fréquent (Livre, Chapitre, Verset ?)
    // On n’écrase PAS ce qui a été trouvé en 1).
    if (!direct.book && selects[0]) direct.book = selects[0];
    if (!direct.chapter && selects[1]) direct.chapter = selects[1];
    if (!direct.verse && selects[2]) direct.verse = selects[2];

    // Traduction : on essaye de repérer un select dont l’option courante ressemble à une traduction
    if (!direct.translation) {
      const guess = selects.find((s) => {
        const txt = (s.options[s.selectedIndex]?.text || "").toLowerCase();
        return /segond|darby|jnd|neg|ost|kjv|niv|lsg|ls|ostervald|king|louis/.test(txt);
      });
      if (guess) direct.translation = guess;
    }

    // Lecture des valeurs (en protégeant)
    params.book = readValueFromField(direct.book);
    params.chapter = readValueFromField(direct.chapter);
    params.verse = readValueFromField(direct.verse);
    params.translation = readValueFromField(direct.translation) || "JND";
    params.bibleId = readValueFromField(direct.bibleId);

    // Normalisations minimales
    params.book = (params.book || "").trim();
    params.chapter = String(params.chapter || "1").trim();
    params.verse = String(params.verse || "").trim();

    // Debug doux
    console.log(LOG_PREFIX, "Params", params);
    return params;
  }

  function readValueFromField(el) {
    if (!el) return "";
    if (el.tagName === "SELECT") {
      const opt = el.options[el.selectedIndex];
      return opt ? (opt.value || opt.text || "").trim() : "";
    }
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
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

  // ---------- Zones d’injection UI ----------
  function findRubriquesContainer() {
    // On cherche le bloc “Rubriques” puis son conteneur (prochain sibling).
    const headings = $$("h1,h2,h3,div,span,b,strong").filter((n) =>
      /rubriques/i.test((n.textContent || "").trim())
    );
    if (headings.length) {
      // nextElementSibling : probable conteneur de la liste
      const sib = headings[0].parentElement?.nextElementSibling || headings[0].nextElementSibling;
      return sib || headings[0].parentElement || headings[0];
    }
    // fallback : première colonne scrollable de gauche
    const cols = $$("aside,nav,section,div").filter(
      (n) =>
        n.offsetWidth < window.innerWidth / 2 &&
        n.offsetHeight > 200 &&
        getComputedStyle(n).overflowY !== "visible"
    );
    return cols[0] || document.body;
  }

  function findEditor() {
    // on vise le grand bloc d’édition de droite (le plus grand <textarea> ou <div contenteditable>)
    const textareas = $$("textarea").sort((a, b) => b.clientHeight - a.clientHeight);
    if (textareas[0]) return textareas[0];

    const editables = $$("[contenteditable=true]").sort((a, b) => b.clientHeight - a.clientHeight);
    if (editables[0]) return editables[0];

    // fallback : un gros <div> au centre
    const bigDiv = $$("main div,section div,article div")
      .filter((d) => d.clientHeight > 200 && d.clientWidth > 300)
      .sort((a, b) => b.clientHeight - a.clientHeight)[0];
    return bigDiv || document.body;
  }

  function findPrevNext() {
    // Boutons navigation Précédent / Suivant (par texte exact)
    const prev =
      byTextButton("◄ Précédent") ||
      byTextButton("Précédent") ||
      $("[data-prev]");

    const next =
      byTextButton("Suivant ►") ||
      byTextButton("Suivant") ||
      $("[data-next]");

    return { prev, next };
  }

  // ---------- Rendu ----------
  function renderRubriques() {
    const host = findRubriquesContainer();
    if (!host) return;

    // Nettoie uniquement le contenu de la liste, pas l’entête
    // On crée (ou réutilise) un conteneur interne
    let list = host.querySelector("[data-rubriques]");
    if (!list) {
      list = document.createElement("div");
      list.setAttribute("data-rubriques", "1");
      list.style.display = "block";
      host.appendChild(list);
    }
    list.innerHTML = "";

    state.sections.forEach((s) => {
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
        state.index = s.index - 1;
        renderEditor();
        highlightActive(list);
      });

      list.appendChild(btn);
    });

    highlightActive(list);
  }

  function highlightActive(listRoot) {
    const idx = state.index;
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

    const text =
      (sec.content || "").trim() ||
      (state.meta ? `(${state.meta.reference})` : "");

    if (ed.tagName === "TEXTAREA" || ed.tagName === "INPUT") {
      ed.value = text;
    } else if (ed.isContentEditable) {
      ed.innerText = text;
    } else {
      ed.textContent = text;
    }

    // Met à jour le titre courant (petite ligne sous “Méditation” si trouvée)
    const titleNodes = $$("h2,h3,div,strong").filter((n) =>
      /^(\d+\. |— )/.test((n.textContent || "").trim())
    );
    if (!titleNodes.length) {
      // on tente de trouver la zone centrale immédiate à injecter
      const host = ed.parentElement || ed;
      let header = host.querySelector("[data-current-section]");
      if (!header) {
        header = document.createElement("div");
        header.setAttribute("data-current-section", "1");
        header.style.fontWeight = "700";
        header.style.margin = "10px 0";
        host.insertBefore(header, host.firstChild);
      }
      header.textContent = `${sec.index}. ${sec.title || ""}`;
    }
  }

  function wirePrevNext() {
    const { prev, next } = findPrevNext();
    if (prev && !prev.__wired) {
      prev.__wired = true;
      prev.addEventListener("click", () => {
        if (!state.sections.length) return;
        state.index = (state.index - 1 + state.sections.length) % state.sections.length;
        renderEditor();
        renderRubriques();
      });
    }
    if (next && !next.__wired) {
      next.__wired = true;
      next.addEventListener("click", () => {
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
    usp.set("mode", "full");      // 28 sections
    usp.set("trace", "1");        // utile pour debug
    // pas de dry-run ici

    const url = `/api/study-28?${usp.toString()}`;
    const r = await fetch(url, { headers: { accept: "application/json" } });
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`HTTP ${r.status} ${t}`);
    }
    const j = await r.json();
    if (!j || !j.ok) throw new Error(j?.error || "Réponse invalide");
    return j;
  }

  async function generate() {
    try {
      const params = readParams();
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
    const btn =
      byTextButton("Générer") ||
      $("[data-generate]");

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

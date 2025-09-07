/* public/app.js — version “vanilla-safe”
 * - AUCUN sélecteur CSS expérimental (pas de :has, :contains…)
 * - Injection déterministe des 28 rubriques (index → fallback titre)
 * - Ne touche pas au reste de ta page (pas d’override agressif)
 */

(function () {
  "use strict";

  // --------- Petits utilitaires ---------
  const log = (...a) => console.log("[APP]", ...a);
  const warn = (...a) => console.warn("[APP]", ...a);
  const err = (...a) => console.error("[APP]", ...a);

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function normTitle(s = "") {
    return s
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/\s+/g, " ")
      .trim();
  }

  // L’ordre canonique de la colonne (doit rester aligné avec l’API)
  const CANON_TITLES = [
    "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
    "Contexte historique","Structure littéraire","Genre littéraire","Thème central","Résumé en une phrase",
    "Mots-clés","Termes clés (définis)","Personnages et lieux","Problème / Question de départ",
    "Idées majeures (développement)","Verset pivot (climax)","Références croisées (AT)","Références croisées (NT)",
    "Parallèles bibliques","Lien avec l’Évangile (Christocentrique)","Vérités doctrinales (3–5)","Promesses et avertissements",
    "Principes intemporels","Applications personnelles (3–5)","Applications communautaires","Questions pour petits groupes (6)",
    "Prière guidée","Méditation courte","Versets à mémoriser (2–3)"
  ];
  const CANON = CANON_TITLES.map(normTitle);
  const CANON_MAP = new Map(CANON.map((t, i) => [t, i + 1])); // titre → index(1..28)

  // --------- Sélection des éléments de la page (robuste) ---------
  // Bouton "Générer"
  function findGenerateButton() {
    // 1) bouton avec texte "Générer"
    const candidates = $$("button, .btn, input[type=button], input[type=submit]");
    for (const el of candidates) {
      const txt = (el.innerText || el.value || "").trim().toLowerCase();
      if (txt === "générer" || txt === "generation..." || txt.includes("génér")) {
        return el;
      }
    }
    // 2) fallback : premier bouton dans la zone d’action à gauche
    return $("button");
  }

  // Selects pour livre/chapitre/verset/traduction (récupère les 4 premiers <select>)
  function findSelects() {
    // On prend les 4 premiers selects après la barre de recherche
    const selects = $$("select");
    // Essaie d’identifier par heuristique
    let bookSel    = selects.find(s => /gen[eè]se|matthieu|genesis|book/i.test(s.textContent || "")) || selects[0];
    let chapSel    = selects.find(s => s !== bookSel && /^\s*\d+\s*$/.test(s.value || s.selectedOptions?.[0]?.text || "")) || selects[1];
    let verseSel   = selects.find(s => s !== bookSel && s !== chapSel && /^\s*\d+\s*$/.test(s.value || s.selectedOptions?.[0]?.text || "")) || selects[2];
    let transSel   = selects.find(s => /segond|darby|traduction|version|louis|jnd|lsg/i.test(s.textContent || s.value || "")) || selects[3];

    return { bookSel, chapSel, verseSel, transSel };
  }

  // Récupère la liste d’items “rubriques” dans la colonne gauche
  function getRubriqueItems() {
    // Essaie quelques patterns connus ; s’il n’y a pas d’attributs dédiés, on prend les lignes de la <ul>/<div> des rubriques
    let items = $$('[data-rubrique]');
    if (items.length) return items;

    items = $$(".rubriques li, .rubriques .row, .rubriques .item");
    if (items.length) return items;

    // fallback : beaucoup d’implémentations utilisent un conteneur avec un titre “Rubriques”, puis une liste juste après
    const header = $$("*").find(el => /rubriques/i.test(el.textContent || "") && /h\d|strong|b/.test(el.tagName.toLowerCase()));
    if (header) {
      const container = header.parentElement?.nextElementSibling || header.closest("section,div");
      if (container) {
        const rows = $$("li, .row, [role='button'], button", container).filter(r => (r.innerText || "").trim().length > 0);
        if (rows.length) return rows;
      }
    }

    // dernier recours : on tente une liste d’items cliquables avec numéro
    const generic = $$("li, .row, .list-group-item").filter(el => /\b\d+\b/.test(el.textContent || ""));
    return generic;
  }

  // Sélectionne la i-ème rubrique (1..N)
  function selectRubrique(index1) {
    const items = getRubriqueItems();
    const el = items[index1 - 1];
    if (!el) return false;
    // essaie un clic sur l’item ; sinon clique sur un bouton interne
    const clickTarget =
      el.querySelector("button, [role='button'], a") || el;
    clickTarget.scrollIntoView?.({ block: "nearest" });
    clickTarget.click?.();
    return true;
  }

  // Zone d’édition (pane de droite)
  function findEditorArea() {
    // textarea classique
    let el = $("textarea");
    if (el) return el;
    // éditeur contenteditable
    el = $('[contenteditable="true"]');
    if (el) return el;
    // certains templates : .editor textarea
    el = $(".editor textarea");
    if (el) return el;
    return null;
  }

  function setEditorContent(text) {
    const area = findEditorArea();
    if (!area) return false;
    if ("value" in area) {
      area.value = text;
      area.dispatchEvent(new Event("input", { bubbles: true }));
      area.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      area.innerHTML = text;
      area.dispatchEvent(new Event("input", { bubbles: true }));
    }
    return true;
  }

  // --------- Appel API / injection ---------
  async function fetchStudy({ book, chapter, verse = "", translation = "JND", bibleId = "" }) {
    const usp = new URLSearchParams({
      book: book || "Genèse",
      chapter: String(chapter || "1"),
      translation: translation || "JND",
      mode: "full",
    });
    if (verse) usp.set("verse", verse);
    if (bibleId) usp.set("bibleId", bibleId);
    // active la trace en dev : usp.set("trace","1");

    const url = `/api/study-28?${usp.toString()}`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${t.slice(0, 180)}`);
    }
    return res.json();
  }

  // Injection : d’abord par index (1..28), fallback par titre normalisé
  function injectStudySections(sections) {
    try {
      if (!Array.isArray(sections)) return;
      const items = getRubriqueItems();
      if (!items.length) {
        warn("Aucune rubrique détectée dans la colonne gauche — injection annulée.");
        return;
      }

      // 1) Injection par index (le plus fiable)
      let injected = 0;
      const safe = sections.slice(0, 28);
      if (safe.every(s => Number.isInteger(s.index))) {
        for (const s of safe) {
          const idx = Math.min(Math.max(1, s.index), items.length);
          if (selectRubrique(idx)) {
            setEditorContent(s.content || "");
            injected++;
          }
        }
      }

      // 2) Fallback par titre normalisé
      if (!injected) {
        for (const s of safe) {
          const key = CANON_MAP.get(normTitle(s.title || ""));
          if (key && selectRubrique(key)) {
            setEditorContent(s.content || "");
            injected++;
          }
        }
      }

      log(`Injection effectuée : ${injected}/${safe.length}`);
    } catch (e) {
      err("Injection error:", e);
    }
  }

  // --------- Lecture des paramètres depuis l’UI ---------
  function readUIParams() {
    const { bookSel, chapSel, verseSel, transSel } = findSelects();

    const getVal = (sel, fallback) => {
      if (!sel) return fallback;
      const val = (sel.value || sel.selectedOptions?.[0]?.text || "").trim();
      return val || fallback;
    };

    const book = getVal(bookSel, "Genèse");
    const chapter = getVal(chapSel, "1");
    const verse = getVal(verseSel, ""); // laisser vide → chapitre entier
    const trans = getVal(transSel, "JND");

    return { book, chapter, verse, translation: trans };
  }

  // --------- Wiring des boutons ---------
  function wireGenerate() {
    const btn = findGenerateButton();
    if (!btn) {
      warn("Bouton 'Générer' introuvable — wiring ignoré.");
      return;
    }

    btn.addEventListener("click", async (ev) => {
      try {
        ev.preventDefault?.();
      } catch {}

      try {
        const params = readUIParams();
        log("GEN start →", params);
        const json = await fetchStudy(params);

        if (!json?.ok) {
          throw new Error(json?.error || "Réponse API invalide");
        }

        const secs = json?.data?.sections || [];
        injectStudySections(secs);

        log(`[${new Date().toISOString()}] [GEN] source=study-28/api.bible sections=${secs.length} → étude générée + injection OK`);
      } catch (e) {
        err("GEN fail:", e?.message || e);
        alert("Erreur pendant la génération : " + (e?.message || e));
      }
    }, { passive: false });
  }

  // Lien “Lire la Bible” : on laisse l’existant ; si besoin, on peut ici ouvrir un lecteur externe
  function wireReadBible() {
    const btns = $$("a, button").filter(el => /lire la bible/i.test(el.innerText || ""));
    // si tu souhaites forcer un target _blank:
    for (const b of btns) {
      if (b.tagName.toLowerCase() === "a") b.setAttribute("target", "_blank");
    }
  }

  // --------- Boot ---------
  function boot() {
    try {
      wireGenerate();
      wireReadBible();
      log("Init OK");
    } catch (e) {
      err("Init error:", e);
    }
  }

  // Expose pour debug
  window.BibleEtude = {
    fetchStudy,
    injectStudySections,
    readUIParams,
    _debug: { getRubriqueItems, selectRubrique, setEditorContent }
  };

  // Démarrage
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

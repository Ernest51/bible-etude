/* public/app.js — robuste + pré-check API
   - Aucun sélecteur CSS exotique (:has, :contains)
   - Pré-check /api/health avant /api/study-28
   - Journalisation claire des erreurs réseau
   - Injection déterministe des 28 rubriques
*/

(function () {
  "use strict";

  // ---------- utils ----------
  const log = (...a) => console.log("[APP]", ...a);
  const warn = (...a) => console.warn("[APP]", ...a);
  const err = (...a) => console.error("[APP]", ...a);
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  function normTitle(s = "") {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }

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
  const CANON_MAP = new Map(CANON.map((t, i) => [t, i + 1]));

  // fetch JSON avec timeout et messages clairs
  async function fetchJSON(url, opts = {}, timeoutMs = 15000) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...opts, signal: ctrl.signal });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} ${res.statusText} — ${text.slice(0, 200)}`);
      }
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  // ---------- éléments UI ----------
  function findGenerateButton() {
    const candidates = $$("button, .btn, input[type=button], input[type=submit]");
    for (const el of candidates) {
      const txt = (el.innerText || el.value || "").trim().toLowerCase();
      if (txt === "générer" || txt.includes("génér")) return el;
    }
    return null;
  }

  function findSelects() {
    const selects = $$("select");
    let bookSel = selects.find(s => /gen[eè]se|matthieu|marc|luc|jean|romains|psaumes|genesis|book/i.test(s.textContent||"")) || selects[0];
    let chapSel = selects.find(s => s !== bookSel && /^\s*\d+\s*$/.test(s.value || s.selectedOptions?.[0]?.text || "")) || selects[1];
    let verseSel = selects.find(s => s !== bookSel && s !== chapSel && /^\s*\d+\s*$/.test(s.value || s.selectedOptions?.[0]?.text || "")) || selects[2];
    let transSel = selects.find(s => /segond|darby|traduction|version|louis|jnd|lsg/i.test(s.textContent || s.value || "")) || selects[3];
    return { bookSel, chapSel, verseSel, transSel };
  }

  function getRubriqueItems() {
    let items = $$('[data-rubrique]');
    if (items.length) return items;

    items = $$(".rubriques li, .rubriques .row, .rubriques .item");
    if (items.length) return items;

    const blocks = $$("li, .row, .list-group-item").filter(el => /\b\d+\b/.test(el.textContent || ""));
    return blocks;
  }

  function selectRubrique(index1) {
    const items = getRubriqueItems();
    const el = items[index1 - 1];
    if (!el) return false;
    (el.querySelector("button, [role='button'], a") || el).click?.();
    el.scrollIntoView?.({ block: "nearest" });
    return true;
  }

  function findEditorArea() {
    return $("textarea") || $('[contenteditable="true"]') || $(".editor textarea") || null;
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

  // ---------- API ----------
  async function healthCheck() {
    const url = `/api/health`;
    log("Health check →", url);
    try {
      const j = await fetchJSON(url, { headers: { accept: "application/json" } }, 7000);
      return { ok: !!j?.ok, data: j };
    } catch (e) {
      return { ok: false, error: e.message || String(e) };
    }
  }

  async function fetchStudy(params) {
    const usp = new URLSearchParams({
      book: params.book || "Genèse",
      chapter: String(params.chapter || "1"),
      translation: params.translation || "JND",
      mode: "full"
    });
    if (params.verse) usp.set("verse", params.verse);
    if (params.bibleId) usp.set("bibleId", params.bibleId);

    const url = `/api/study-28?${usp.toString()}`;
    log("Fetch étude →", url);
    return await fetchJSON(url, { headers: { accept: "application/json" } });
  }

  function injectStudySections(sections = []) {
    const items = getRubriqueItems();
    if (!items.length) {
      warn("Aucune rubrique détectée — injection annulée.");
      return;
    }
    const list = sections.slice(0, 28);

    let injected = 0;
    const allHaveIndex = list.every(s => Number.isInteger(s.index));

    if (allHaveIndex) {
      for (const s of list) {
        const idx = Math.min(Math.max(1, s.index), items.length);
        if (selectRubrique(idx)) {
          setEditorContent(s.content || "");
          injected++;
        }
      }
    } else {
      for (const s of list) {
        const key = CANON_MAP.get(normTitle(s.title || ""));
        if (key && selectRubrique(key)) {
          setEditorContent(s.content || "");
          injected++;
        }
      }
    }

    log(`Injection : ${injected}/${list.length}`);
  }

  function readUIParams() {
    const { bookSel, chapSel, verseSel, transSel } = findSelects();
    const val = (sel, fb) => sel ? ((sel.value || sel.selectedOptions?.[0]?.text || "").trim() || fb) : fb;
    return {
      book: val(bookSel, "Genèse"),
      chapter: val(chapSel, "1"),
      verse: val(verseSel, ""),
      translation: val(transSel, "JND")
    };
  }

  // ---------- wiring ----------
  function wireGenerate() {
    const btn = findGenerateButton();
    if (!btn) {
      warn("Bouton Générer introuvable.");
      return;
    }

    btn.addEventListener("click", async (e) => {
      e.preventDefault?.();

      // 0) Pré-check API
      const h = await healthCheck();
      if (!h.ok) {
        err("API indisponible — health:", h.error || h.data);
        alert("API indisponible (health check). Vérifie /api/health dans le navigateur.\n" +
              "Détail: " + (h.error || JSON.stringify(h.data)));
        return;
      }

      // 1) Récupération & fetch
      try {
        const params = readUIParams();
        const j = await fetchStudy(params);
        if (!j?.ok) throw new Error(j?.error || "Réponse API invalide");

        // 2) Injection
        injectStudySections(j?.data?.sections || []);
        log(`[${new Date().toISOString()}] étude OK → ${j?.data?.meta?.reference || ""}`);
      } catch (ex) {
        // "Failed to fetch" / abort / CORS / 404 function
        err("Échec étude:", ex);
        alert("Erreur pendant la génération : " + (ex?.message || ex));
      }
    });
  }

  function wireReadBible() {
    const btns = $$("a, button").filter(el => /lire la bible/i.test(el.innerText || ""));
    for (const b of btns) if (b.tagName.toLowerCase() === "a") b.setAttribute("target", "_blank");
  }

  // ---------- boot ----------
  function boot() {
    try {
      wireGenerate();
      wireReadBible();
      log("Init OK");
    } catch (e) {
      err("Init error:", e);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }

  // Expose debug
  window.BibleEtude = {
    healthCheck, fetchStudy, injectStudySections, readUIParams
  };
})();

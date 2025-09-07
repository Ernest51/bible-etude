// public/app.js
// Ajoute un panneau "Étude auto (28)" sous les contrôles.
// Ne modifie PAS ton UI existante : rendu autonome (liste + contenu).

(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // 1) Détection souple des champs (sans casser la page)
  function guessSelectByOptions(matchFn) {
    const sels = $$("select");
    for (const s of sels) {
      const txt = [...s.options].map(o => (o.text || "").toLowerCase());
      if (matchFn(txt, s)) return s;
    }
    return null;
  }

  // livre: un <select> qui contient des entrées type "Genèse"
  const selBook = guessSelectByOptions(txts =>
    txts.some(t => /gen[eè]se|genesis|exode|psaumes|matthieu|jean/.test(t))
  );

  // chapitre: un <select> majoritairement numérique
  const selChapter = $$("select").find(s => {
    const vals = [...s.options].slice(0, 15).map(o => o.value || o.textContent);
    const nums = vals.filter(v => /^\d+$/.test(String(v).trim()));
    return nums.length >= Math.max(5, Math.floor(vals.length * 0.6));
  });

  // traduction: un <select> qui contient "Segond"/"Darby" ou proche
  const selTrans = guessSelectByOptions(txts =>
    txts.some(t => /(segond|louis|darby|ostervald|pdv|français courant|parole)/.test(t))
  );

  // 2) Création d’un bouton “Étude auto (28)”
  //    On essaie de l’insérer à côté du bouton "Générer" si présent
  const btnGenerate =
    [...$$("button, [role=button]")].find(
      b => (b.textContent || "").trim().toLowerCase().includes("générer")
    ) || null;

  const bridgeBtn = document.createElement("button");
  bridgeBtn.type = "button";
  bridgeBtn.textContent = "Étude auto (28)";
  bridgeBtn.style.cssText =
    "margin-left:10px;background:#0f172a;color:#fff;border:1px solid #1f2937;border-radius:10px;padding:8px 12px;cursor:pointer;font-weight:600;";

  if (btnGenerate && btnGenerate.parentElement) {
    btnGenerate.parentElement.appendChild(bridgeBtn);
  } else {
    // fallback : tout en haut
    const host = $("#top-controls") || document.body;
    host.insertBefore(bridgeBtn, host.firstChild);
  }

  // 3) Panneau autonome (2 colonnes)
  const wrap = document.createElement("section");
  wrap.id = "study-panel";
  wrap.style.cssText =
    "margin:16px 0;padding:0; border:1px solid #e5e7eb; border-radius:12px; background:#fff;";

  wrap.innerHTML = `
    <div style="padding:12px 14px;border-bottom:1px solid #e5e7eb;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <strong>Étude (autonome)</strong>
      <span id="study-status" style="color:#64748b"></span>
      <span id="study-meta" style="color:#64748b"></span>
      <button id="study-print" style="margin-left:auto;background:#111827;color:#fff;border:none;border-radius:8px;padding:6px 10px;cursor:pointer">🖨️ Imprimer / PDF</button>
    </div>
    <div style="display:grid; grid-template-columns: 320px 1fr; gap:0; min-height:420px;">
      <aside id="study-list" style="border-right:1px solid #e5e7eb; overflow:auto; max-height:70vh"></aside>
      <main id="study-content" style="padding:16px;min-height:420px;">
        <em>Cliquer « Étude auto (28) » pour générer.</em>
      </main>
    </div>
  `;
  // Insère le panneau juste sous la barre des contrôles
  const anchor = btnGenerate ? btnGenerate.closest("section") || btnGenerate.parentElement : null;
  (anchor?.parentElement || document.body).appendChild(wrap);

  const statusEl = $("#study-status", wrap);
  const metaEl = $("#study-meta", wrap);
  const listEl = $("#study-list", wrap);
  const contentEl = $("#study-content", wrap);

  $("#study-print", wrap).addEventListener("click", () => window.print());

  function readSelect(sel, def = "") {
    if (!sel) return def;
    const o = sel.options[sel.selectedIndex] || sel.options[0];
    return (o?.text || o?.value || def).trim();
  }

  function mapTranslationLabel(label) {
    const t = (label || "").toLowerCase();
    if (/darby|jnd/.test(t)) return "JND";
    if (/segond|lsg/.test(t)) return "LSG";
    return "JND"; // valeur sûre tant que ton API Bible est sur Darby
  }

  function setStatus(msg, ok = true) {
    statusEl.textContent = msg || "";
    statusEl.style.color = ok ? "#16a34a" : "#dc2626";
  }

  function renderStudy(data) {
    const { meta = {}, sections = [] } = data || {};
    metaEl.textContent = sections.length
      ? `OSIS: ${meta.osis || "?"} · Trad: ${meta.translation || ""}`
      : "";

    // Liste gauche
    listEl.innerHTML = sections
      .map(
        s => `
      <button class="study-item"
              data-idx="${s.index}"
              style="display:block;width:100%;text-align:left;padding:10px 12px;border:none;border-bottom:1px dashed #e5e7eb;background:#fff;cursor:pointer">
        ${s.index}. ${escapeHtml(s.title || "")}
      </button>`
      )
      .join("");

    // Contenu
    function show(i) {
      const s = sections[i - 1];
      if (!s) return;
      contentEl.innerHTML = `
        <h3 style="margin:0 0 8px">${s.index}. ${escapeHtml(s.title || "")}</h3>
        <p style="white-space:pre-wrap;line-height:1.5">${escapeHtml(s.content || "")}</p>
        ${
          s.verses?.length
            ? `<div style="color:#6366f1;margin-top:8px">Versets : ${s.verses.map(escapeHtml).join(", ")}</div>`
            : ""
        }
      `;
      // highlight
      $$(".study-item", listEl).forEach(b => (b.style.background = "#fff"));
      const btn = $(`.study-item[data-idx="${i}"]`, listEl);
      if (btn) btn.style.background = "#f1f5f9";
    }

    listEl.addEventListener("click", e => {
      const b = e.target.closest(".study-item");
      if (!b) return;
      const idx = Number(b.dataset.idx || "1");
      show(idx);
    });

    if (sections.length) show(1);
    else contentEl.innerHTML = `<em>Aucune section</em>`;
  }

  function escapeHtml(s = "") {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  async function run() {
    setStatus("génération…", true);
    contentEl.innerHTML = `<em>Patiente un instant…</em>`;
    listEl.innerHTML = "";

    const book = readSelect(selBook, "Genèse");
    const chapter = (readSelect(selChapter, "1") || "1").replace(/\D+/g, "") || "1";
    const translation = mapTranslationLabel(readSelect(selTrans, "Darby"));

    // Si tu veux forcer la Darby API Bible :
    const bibleId = "a93a92589195411f-01";

    const usp = new URLSearchParams({
      book,
      chapter,
      translation,
      bibleId
    });
    usp.set("trace", "1"); // aide au debug

    try {
      const r = await fetch("/api/study-28?" + usp.toString(), {
        headers: { accept: "application/json" },
        cache: "no-store"
      });
      const j = await r.json().catch(() => null);
      if (!j || !j.ok) {
        setStatus(j?.error || `HTTP ${r.status}`, false);
        contentEl.innerHTML = `<pre style="white-space:pre-wrap;background:#0b1020;color:#e2e8f0;padding:10px;border-radius:8px">${escapeHtml(
          JSON.stringify(j || {}, null, 2)
        )}</pre>`;
        return;
      }
      setStatus(`Étude de ${j.data?.meta?.reference || `${book} ${chapter}`}`, true);
      renderStudy(j.data);
    } catch (e) {
      setStatus(e?.message || String(e), false);
      contentEl.textContent = "Erreur réseau.";
    }
  }

  bridgeBtn.addEventListener("click", run);
})();

// public/app.js — robuste, GET only, sans POST, avec rendu simple
(function () {
  // 0) Désactiver toute soumission automatique au cas où
  Array.from(document.querySelectorAll("form")).forEach(f => {
    f.addEventListener("submit", e => { e.preventDefault(); e.stopPropagation(); }, true);
  });

  // 1) Trouver le bouton "Valider"
  const btn =
    document.querySelector("#valideBtn, #validerBtn, button[data-action='valider'], button[data-action='valide']") ||
    Array.from(document.querySelectorAll("button,[role='button'],.btn")).find(el => (el.textContent || "").trim().toLowerCase() === "valider");

  if (btn && btn.tagName === "BUTTON") btn.type = "button";
  if (!btn) {
    console.warn("[app] Bouton Valider introuvable.");
    return;
  }

  // 2) Zone d’affichage de secours (n’interfère pas avec ton éditeur)
  let resultBox = document.querySelector("#etudeResult");
  if (!resultBox) {
    resultBox = document.createElement("div");
    resultBox.id = "etudeResult";
    resultBox.style.cssText = "margin-top:12px";
    const host = document.querySelector("#studyContainer") || document.querySelector("main") || document.body;
    host.appendChild(resultBox);
  }

  // 3) Lecture de la référence depuis l’UI
  function readReference() {
    // a) champ libre (barre de recherche)
    const free =
      document.querySelector("#searchRef, #refInput, input[type='search'], input[name='reference']")?.value?.trim();
    if (free) return free;

    // b) listes (Livre / Chapitre / Verset) — on prend les 3 premiers <select> visibles
    const sels = Array.from(document.querySelectorAll("select")).filter(s => s.offsetParent !== null);
    const vals = sels.slice(0, 3).map(s => (s.value || "").trim()).filter(Boolean);
    if (vals.length >= 3) return `${vals[0]} ${vals[1]}:${vals[2]}`;
    if (vals.length >= 2) return `${vals[0]} ${vals[1]}`;
    return "";
  }

  // 4) Utilitaires UI
  function setLoading(on) {
    if (!btn) return;
    btn.disabled = !!on;
    btn.textContent = on ? "Génération…" : "Valider";
  }
  function showError(msg, details) {
    resultBox.innerHTML =
      `<div style="background:#fee2e2;border:1px solid #fecaca;color:#7f1d1d;padding:10px;border-radius:8px">
         ${escapeHtml(msg)}
       </div>` + (details ? `<pre style="white-space:pre-wrap">${escapeHtml(details)}</pre>` : "");
  }
  function escapeHtml(s) { return String(s || "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c])); }

  // 5) Rendu simple (n’écrase pas ton éditeur, juste un listing)
  function renderStudy(data, fallbackRef) {
    const ref = data?.reference || fallbackRef || "";
    const sections = data?.sections || [];
    const header = `<h3 style="margin:6px 0">Étude — ${escapeHtml(ref)}</h3>`;
    const items = sections.map(s => `
      <li style="border:1px solid #eee;border-radius:10px;padding:8px 10px">
        <strong>${s.id}. ${escapeHtml(s.title || "")}</strong><br>
        <div>${escapeHtml(s.content || "")}</div>
        <small>${(s.verses || []).join(" · ")}</small>
      </li>`).join("");
    resultBox.innerHTML = header + `<ol style="list-style:decimal inside;display:flex;flex-direction:column;gap:8px;padding:0;margin:8px 0">${items}</ol>`;
  }

  // 6) Clic → GET /api/chat?q=…
  btn.addEventListener("click", async (e) => {
    e.preventDefault(); e.stopPropagation();
    const ref = readReference();
    if (!ref) {
      alert("Choisis un livre + chapitre (et éventuellement verset) ou tape ex: Marc 5:1-20");
      return;
    }

    setLoading(true);
    resultBox.innerHTML = `<div style="color:#6b7280">⏳ Génération pour: ${escapeHtml(ref)}</div>`;

    try {
      const url = `/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
      const resp = await fetch(url, { method: "GET" });

      let payload = null;
      try { payload = await resp.json(); }
      catch { payload = { ok: false, error: "Réponse non JSON" }; }

      if (!resp.ok || !payload?.ok) {
        showError(payload?.error || `Erreur HTTP ${resp.status}`, JSON.stringify(payload, null, 2));
        return;
      }

      // deux formats possibles : { ok, data:{reference, sections} } ou { ok, reference, sections }
      const data = payload.data || payload;
      renderStudy(data, ref);
    } catch (err) {
      showError("Erreur réseau /api/chat", String(err?.message || err));
    } finally {
      setLoading(false);
    }
  });

  console.log("[app] prêt : clic ‘Valider’ → GET /api/chat");
})();

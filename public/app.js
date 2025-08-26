// public/app.js
(function () {
  const input =
    document.querySelector("#searchRef") ||
    document.querySelector("#refInput") ||
    document.querySelector("input[type='search']") ||
    document.querySelector("input[data-role='reference']") ||
    createSearchInput();

  let valideBtn =
    document.querySelector("#valideBtn") ||
    document.querySelector("button[data-action='valide']") ||
    createValideButton();

  const container =
    document.querySelector("#studyContainer") || createStudyContainer();

  const logArea =
    document.querySelector("#debugLog") || createDebugLog(container);

  ping();

  valideBtn.addEventListener("click", async () => {
    const value = (input.value || "").trim();
    if (!value) {
      toast("Entre une référence (ex: Marc 5:1-20)");
      input.focus();
      return;
    }
    await generateStudy(value);
  });

  async function generateStudy(reference) {
    setLoading(true);
    clear(container);
    append(container, h("div", { class: "status" }, `Génération pour: ${reference}`));

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: reference, templateId: "v28-standard" })
      });

      let payload = null;
      try {
        // On tente de lire le JSON même si resp.ok == false (pour afficher les détails)
        payload = await resp.json();
      } catch {
        const txt = await resp.text().catch(() => "");
        payload = { ok: false, error: `HTTP ${resp.status}`, raw: txt };
      }

      if (!resp.ok || !payload?.ok) {
        const msg = payload?.error
          ? `${payload.error}`
          : `Erreur ${resp.status}`;
        safeLog(`[${resp.status}] /api/chat → ${JSON.stringify(payload)}`);
        showError(container, msg);
        // Affiche aussi un panneau "détails" pour dbg
        append(container, h("pre", { class: "error-details" }, JSON.stringify(payload, null, 2)));
        return;
      }

      renderStudy(payload.data);
      toast("Étude générée.");
    } catch (e) {
      safeLog("Exception fetch /api/chat: " + (e?.message || e));
      showError(container, "Erreur réseau /api/chat");
    } finally {
      setLoading(false);
    }
  }

  function renderStudy(data) {
    clear(container);

    const header = h("div", { class: "study-header" },
      h("h2", {}, `Étude (28 points) — ${data.reference || "Référence inconnue"}`),
      h("div", { class: "template" }, `Modèle: ${data.templateId}`)
    );

    const list = h("ol", { class: "study-list" });
    (data.sections || []).forEach((sec) => {
      const li = h("li", { class: "study-item" },
        h("h3", { class: "title" }, `${sec.id}. ${sec.title}`),
        h("p", { class: "content" }, sec.content),
        h("div", { class: "verses" },
          h("span", { class: "tag" }, (sec.verses || []).join(" · "))
        )
      );
      list.appendChild(li);
    });

    append(container, header, list);
  }

  function setLoading(isLoading) {
    valideBtn.disabled = !!isLoading;
    valideBtn.textContent = isLoading ? "Génération…" : "Valide";
  }

  function showError(parent, message) {
    append(parent, h("div", { class: "error" }, message));
  }

  function toast(msg) {
    let t = document.querySelector("#toast");
    if (!t) {
      t = h("div", { id: "toast", style: toastStyle() });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(() => (t.style.opacity = "0"), 1800);
  }

  function safeLog(msg) {
    console.log(msg);
    append(logArea, h("div", {}, `[${new Date().toLocaleTimeString()}] ${msg}`));
  }

  async function ping() {
    try {
      const ok = await fetch("/api/ping").then(r => r.ok);
      safeLog(ok ? "Ping OK" : "Ping KO");
    } catch {
      safeLog("Ping exception");
    }
  }

  // DOM helpers + styles
  function createSearchInput() {
    const wrap = document.querySelector("#searchZone") || createTopBar();
    const inp = h("input", {
      id: "searchRef",
      placeholder: "Livre Chapitre:Versets (ex: Marc 5:1-20)",
      class: "search-input"
    });
    wrap.appendChild(inp);
    return inp;
  }

  function createValideButton() {
    const wrap = document.querySelector("#searchZone") || createTopBar();
    const btn = h("button", {
      id: "valideBtn",
      class: "valide-btn",
      style:
        "background:#16a34a;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;"
    }, "Valide");
    wrap.appendChild(btn);
    return btn;
  }

  function createStudyContainer() {
    const c = h("div", { id: "studyContainer", class: "study-container" });
    document.body.appendChild(c);
    injectBaseStyles();
    return c;
  }

  function createDebugLog(parent) {
    const d = h("div", { id: "debugLog", class: "debug-log" });
    append(parent, h("h4", {}, "Debug"), d);
    return d;
  }

  function createTopBar() {
    const bar = h("div", { id: "searchZone", class: "topbar" });
    document.body.prepend(bar);
    injectBaseStyles();
    return bar;
  }

  function injectBaseStyles() {
    if (document.getElementById("studyBaseStyles")) return;
    const css = `
      .topbar{display:flex;gap:8px;align-items:center;padding:12px;position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;z-index:10}
      .search-input{flex:1;min-width:240px;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:14px}
      .study-container{max-width:980px;margin:20px auto;padding:0 16px}
      .study-header{display:flex;justify-content:space-between;align-items:center;margin:12px 0}
      .study-list{list-style:decimal inside;display:flex;flex-direction:column;gap:12px;padding:0}
      .study-item{border:1px solid #eee;border-radius:12px;padding:12px 14px}
      .study-item .title{margin:0 0 6px 0;font-size:16px}
      .study-item .content{margin:0 0 8px 0;line-height:1.45}
      .study-item .verses .tag{display:inline-block;font-size:12px;border:1px solid #ddd;border-radius:999px;padding:3px 8px;background:#f9fafb}
      .error{background:#fee2e2;border:1px solid #fecaca;color:#7f1d1d;padding:10px;border-radius:8px;margin:10px 0}
      .error-details{white-space:pre-wrap;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;margin-top:8px;font-size:12px}
      .debug-log{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;font-size:12px;color:#374151;background:#f8fafc;border:1px dashed #cbd5e1;border-radius:8px;padding:8px;max-height:160px;overflow:auto}
    `;
    const style = h("style", { id: "studyBaseStyles" }, css);
    document.head.appendChild(style);
  }

  function toastStyle() {
    return [
      "position:fixed","bottom:20px","right:20px","background:#111827","color:#fff",
      "padding:10px 14px","border-radius:8px","opacity:0","transition:opacity .25s","z-index:9999"
    ].join(";");
  }

  function h(tag, attrs = {}, ...children) {
    const el = document.createElement(tag);
    for (const k of Object.keys(attrs || {})) {
      if (k === "class") el.className = attrs[k];
      else if (k === "style") el.setAttribute("style", attrs[k]);
      else el.setAttribute(k, attrs[k]);
    }
    for (const c of children) {
      if (c == null) continue;
      if (typeof c === "string") el.appendChild(document.createTextNode(c));
      else el.appendChild(c);
    }
    return el;
  }
  function append(parent, ...kids) { kids.forEach(k => parent.appendChild(k)); }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
})();

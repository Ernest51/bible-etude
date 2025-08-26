// public/app.js  — Option A (GET only + normalisation côté front)
(function () {
  // ---- Sélecteurs (créés si absents) ----
  const input = document.querySelector("#searchRef") || createSearchInput();
  const btn   = document.querySelector("#valideBtn") || createValideButton();
  const box   = document.querySelector("#studyContainer") || createStudyContainer();

  btn.addEventListener("click", async () => {
    const ref = (input.value || "").trim();
    if (!ref) { toast("Entre une référence (ex: Marc 5:1-20)"); input.focus(); return; }
    await generate(ref);
  });

  async function generate(reference) {
    setLoading(true);
    clear(box);
    append(box, h("div", { class: "status" }, `Génération pour : ${reference}`));

    try {
      const url = `/api/chat?q=${encodeURIComponent(reference)}&templateId=v28-standard`;
      const resp = await fetch(url, { method: "GET" });

      let payload;
      try { payload = await resp.json(); }
      catch { payload = { ok: false, error: "Réponse non JSON" }; }

      if (!resp.ok || !payload?.ok) {
        showError(box, payload?.error || `Erreur ${resp.status}`);
        append(box, h("pre", { class: "error-details" }, JSON.stringify(payload, null, 2)));
        return;
      }

      // 🔧 Normalise tous les formats possibles (data.sections, sections, raw FR…)
      const normalized = normalizeStudyPayload(payload);
      renderStudy(normalized);
      toast("Étude générée.");
    } catch (e) {
      showError(box, "Erreur réseau /api/chat");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Normalisation FRONT ----------
  function normalizeStudyPayload(p) {
    // 1) Format backend déjà normalisé
    if (p?.data?.sections && Array.isArray(p.data.sections)) {
      return {
        reference: p.data.reference || "",
        templateId: p.data.templateId || "v28-standard",
        sections: ensure28(p.data.sections, p.data.reference)
      };
    }
    // 2) Ancien format simple
    if (p?.sections && Array.isArray(p.sections)) {
      return {
        reference: p.reference || "",
        templateId: p.templateId || "v28-standard",
        sections: ensure28(p.sections, p.reference)
      };
    }
    // 3) Format avec `raw` (code fences + clés FR)
    if (typeof p?.raw === "string") {
      const coerced = coerceFromRaw(p.raw);
      if (coerced?.sections?.length) return coerced;
    }
    // 4) Fallback vide
    return { reference: p.reference || "", templateId: p.templateId || "v28-standard", sections: [] };
  }

  function coerceFromRaw(raw) {
    // retire ```...``` s’ils existent
    const unfenced = (raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || raw).trim();
    // extrait premier objet JSON
    const i = unfenced.indexOf("{"), j = unfenced.lastIndexOf("}");
    if (i === -1 || j === -1 || j <= i) return null;
    let root; try { root = JSON.parse(unfenced.slice(i, j + 1)); } catch { return null; }

    const eb = root["étude_biblique"] || root.etude_biblique || null;
    const points = Array.isArray(eb?.points) ? eb.points
                : Array.isArray(root?.points) ? root.points
                : null;
    if (!points) return null;

    const ref = (eb?.référence || eb?.reference || root?.reference || "").toString();

    const sections = points.slice(0, 28).map((it, idx) => {
      const id  = Number(it?.id ?? it?.numéro ?? it?.numero ?? idx + 1);
      const ttl = String(it?.title ?? it?.titre ?? `Point ${id}`).slice(0, 90);
      const txt = String(it?.content ?? it?.description ?? "").slice(0, 700);
      const verses = [ref].filter(Boolean);
      return { id, title: ttl, content: txt, verses };
    });

    return { reference: ref || "", templateId: "v28-standard", sections: ensure28(sections, ref) };
  }

  function ensure28(arr, fallbackRef) {
    // nettoie / tronque / remplit à 28, et reindexe 1..28
    const out = (arr || []).slice(0, 28).map((s, i) => ({
      id: Number(s?.id ?? i + 1),
      title: String(s?.title || `Point ${i + 1}`).slice(0, 90),
      content: String(s?.content || "").slice(0, 700),
      verses: Array.isArray(s?.verses) && s.verses.length ? s.verses.map(String).slice(0, 6)
             : (fallbackRef ? [String(fallbackRef)] : [])
    }));
    for (let k = out.length; k < 28; k++) {
      out.push({ id: k + 1, title: `Point ${k + 1}`, content: "", verses: fallbackRef ? [String(fallbackRef)] : [] });
    }
    return out.map((s, i) => ({ ...s, id: i + 1 }));
  }

  // ---------- Rendu ----------
  function renderStudy(data) {
    clear(box);
    const header = h("div", { class: "study-header" },
      h("h2", {}, `Étude (28 points) — ${data.reference || "Référence inconnue"}`),
      h("div", { class: "template" }, `Modèle: ${data.templateId || "v28-standard"}`)
    );
    const list = h("ol", { class: "study-list" });
    (data.sections || []).forEach((sec) => {
      const li = h("li", { class: "study-item" },
        h("h3", { class: "title" }, `${sec.id}. ${sec.title}`),
        h("p", { class: "content" }, sec.content),
        h("div", { class: "verses" }, (sec.verses || []).join(" · "))
      );
      list.appendChild(li);
    });
    append(box, header, list);
  }

  // ---------- UI helpers ----------
  function setLoading(loading) {
    btn.disabled = !!loading;
    btn.textContent = loading ? "Génération…" : "Valide";
  }
  function showError(parent, message) {
    append(parent, h("div", { class: "error" }, message));
  }
  function toast(msg) {
    let t = document.querySelector("#toast");
    if (!t) {
      t = h("div", { id: "toast", style: [
        "position:fixed","bottom:20px","right:20px","background:#111827","color:#fff",
        "padding:10px 14px","border-radius:8px","opacity:0","transition:opacity .25s","z-index:9999"
      ].join(";") });
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(() => (t.style.opacity = "0"), 1800);
  }

  // ---------- DOM utils + styles ----------
  function createSearchInput() {
    const wrap = document.querySelector("#searchZone") || createTopBar();
    const inp = h("input", { id: "searchRef", placeholder: "Livre Chapitre:Versets (ex: Marc 5:1-20)", class: "search-input" });
    wrap.appendChild(inp);
    return inp;
  }
  function createValideButton() {
    const wrap = document.querySelector("#searchZone") || createTopBar();
    const btn = h("button", { id: "valideBtn", class: "valide-btn",
      style: "background:#16a34a;color:#fff;border:none;padding:10px 16px;border-radius:8px;font-weight:600;cursor:pointer;" }, "Valide");
    wrap.appendChild(btn);
    return btn;
  }
  function createStudyContainer() {
    const c = h("div", { id: "studyContainer", class: "study-container" });
    document.body.appendChild(c);
    injectBaseStyles();
    return c;
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
      .study-item .verses{font-size:12px;color:#374151}
      .error{background:#fee2e2;border:1px solid #fecaca;color:#7f1d1d;padding:10px;border-radius:8px;margin:10px 0}
      .error-details{white-space:pre-wrap;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px;margin-top:8px;font-size:12px}
    `;
    const style = h("style", { id: "studyBaseStyles" }, css);
    document.head.appendChild(style);
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

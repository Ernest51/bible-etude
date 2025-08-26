// ---- BRANCHEUR UNIVERSEL "VALIDER" ----
(function attachValider() {
  const log = (...a) => console.log("[Valider]", ...a);

  // 1) Trouve le bouton "Valider" (id, data-attr, ou texte)
  let btn =
    document.querySelector("#valideBtn, #validerBtn, button[data-action='valider'], button[data-action='valide']")
    || Array.from(document.querySelectorAll("button, a, .btn")).find(el => (el.textContent || "").trim().toLowerCase() === "valider");

  if (!btn) {
    log("Bouton ‘Valider’ introuvable → création d’un bouton de secours");
    btn = document.createElement("button");
    btn.id = "valideBtn";
    btn.textContent = "Valider";
    btn.style.cssText = "background:#111827;color:#fff;border:none;border-radius:8px;padding:8px 12px;margin-left:8px;cursor:pointer";
    const targetBar = document.querySelector("#searchZone") || document.querySelector("form") || document.body;
    targetBar.appendChild(btn);
  }

  // 2) Ajoute un conteneur résultat de secours si besoin
  let resultBox = document.querySelector("#etudeResult");
  if (!resultBox) {
    resultBox = document.createElement("div");
    resultBox.id = "etudeResult";
    resultBox.style.cssText = "margin-top:12px";
    const main = document.querySelector("#studyContainer") || document.querySelector("main") || document.body;
    main.appendChild(resultBox);
  }

  // 3) Loader minimal
  const showLoader = (on) => {
    btn.disabled = !!on;
    btn.textContent = on ? "Génération…" : "Valider";
    if (on) {
      if (!document.getElementById("miniLoader")) {
        const l = document.createElement("div");
        l.id = "miniLoader";
        l.textContent = "⏳ génération en cours…";
        l.style.cssText = "margin:8px 0;color:#6b7280;font-size:14px";
        resultBox.prepend(l);
      }
    } else {
      const l = document.getElementById("miniLoader");
      if (l) l.remove();
    }
  };

  // 4) Lecture de la référence depuis l’UI
  function getReferenceFromUI() {
    // a) champ libre (ex: “marc 5:1-20”)
    const free =
      document.querySelector("#searchRef, #refInput, input[type='search'], input[name='reference']")?.value?.trim();
    if (free) return free;

    // b) listes déroulantes Livre / Chapitre / Verset
    const book = (
      document.querySelector("[data-role='book'], #book, select[name='book']") ||
      Array.from(document.querySelectorAll("select")).find(s => /livre|book/i.test(s.id+s.name || ""))
    )?.value;

    const chap = (
      document.querySelector("[data-role='chapter'], #chapter, select[name='chapter']") ||
      Array.from(document.querySelectorAll("select")).find(s => /chap|chapter/i.test(s.id+s.name || ""))
    )?.value;

    const verse = (
      document.querySelector("[data-role='verse'], #verse, select[name='verse']") ||
      Array.from(document.querySelectorAll("select")).find(s => /vers|verse/i.test(s.id+s.name || ""))
    )?.value;

    const normalize = s => (s || "").toString().trim();
    const b = normalize(book), c = normalize(chap), v = normalize(verse);

    if (b && c && v) return `${b} ${c}:${v}`;
    if (b && c)     return `${b} ${c}`;
    return "";
  }

  // 5) Normalisation de la payload (au cas où l’API renverrait encore "raw")
  function normalizeStudyPayload(p) {
    if (p?.data?.sections) {
      return { reference: p.data.reference, templateId: p.data.templateId || "v28-standard", sections: p.data.sections };
    }
    if (p?.sections) {
      return { reference: p.reference || "", templateId: p.templateId || "v28-standard", sections: p.sections };
    }
    if (typeof p?.raw === "string") {
      const unfenced = (p.raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] || p.raw).trim();
      const i = unfenced.indexOf("{"), j = unfenced.lastIndexOf("}");
      if (i !== -1 && j !== -1 && j > i) {
        try {
          const root = JSON.parse(unfenced.slice(i, j + 1));
          const eb = root["étude_biblique"] || root.etude_biblique || null;
          const points = Array.isArray(eb?.points) ? eb.points
                        : Array.isArray(root?.points) ? root.points
                        : null;
          const ref = (eb?.référence || eb?.reference || root?.reference || "").toString();
          if (points) {
            const sections = points.slice(0, 28).map((it, idx) => ({
              id: Number(it?.id ?? it?.numéro ?? it?.numero ?? idx + 1),
              title: String(it?.title ?? it?.titre ?? `Point ${idx + 1}`).slice(0, 90),
              content: String(it?.content ?? it?.description ?? "").slice(0, 700),
              verses: [ref].filter(Boolean)
            }));
            for (let k = sections.length; k < 28; k++)
              sections.push({ id: k + 1, title: `Point ${k + 1}`, content: "", verses: [ref].filter(Boolean) });
            return { reference: ref, templateId: "v28-standard", sections: sections.map((s, i) => ({ ...s, id: i + 1 })) };
          }
        } catch {}
      }
    }
    return { reference: p?.reference || "", templateId: p?.templateId || "v28-standard", sections: [] };
  }

  // 6) Rendu minimal (si tu as déjà un rendu custom, remplace-le ici)
  function renderStudy(data) {
    resultBox.innerHTML = "";
    const head = document.createElement("div");
    head.innerHTML = `<h3 style="margin:6px 0">Étude — ${data.reference || ""}</h3>`;
    const list = document.createElement("ol");
    list.style.cssText = "padding:0;list-style:decimal inside;display:flex;flex-direction:column;gap:8px";
    (data.sections || []).forEach(s => {
      const li = document.createElement("li");
      li.style.cssText = "border:1px solid #eee;border-radius:10px;padding:8px 10px";
      li.innerHTML = `<strong>${s.id}. ${escapeHtml(s.title)}</strong><br><span>${escapeHtml(s.content)}</span><br><small>${(s.verses||[]).join(" · ")}</small>`;
      list.appendChild(li);
    });
    resultBox.append(head, list);
  }
  const escapeHtml = s => String(s || "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // 7) Action au clic
  btn.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const ref = getReferenceFromUI();
    if (!ref) {
      alert("Choisis un livre + chapitre (et éventuellement verset) — ex: Marc 5:1-20");
      return;
    }
    showLoader(true);
    resultBox.innerHTML = "";
    try {
      const url = `/api/chat?q=${encodeURIComponent(ref)}&templateId=v28-standard`;
      log("GET", url);
      const resp = await fetch(url);
      let data;
      try { data = await resp.json(); }
      catch { data = { ok:false, error:"Réponse non JSON" }; }

      if (!resp.ok || !data?.ok) {
        resultBox.innerHTML = `<div style="background:#fee2e2;border:1px solid #fecaca;color:#7f1d1d;padding:8px;border-radius:8px">Erreur API: ${escapeHtml(data?.error || ("HTTP "+resp.status))}</div>`;
        log("KO", data);
        return;
      }
      const normalized = normalizeStudyPayload(data);
      renderStudy(normalized);
      log("OK", normalized);
    } catch (e) {
      resultBox.innerHTML = `<div style="background:#fee2e2;border:1px solid #fecaca;color:#7f1d1d;padding:8px;border-radius:8px">Erreur réseau: ${escapeHtml(e?.message || e)}</div>`;
      log("Exception", e);
    } finally {
      showLoader(false);
    }
  });

  log("Brancheur OK sur", btn);
})();

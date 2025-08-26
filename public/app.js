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

  const spinner =
    document.querySelector("#spinner") || createSpinner();

  const progressBar =
    document.querySelector("#progressBar") || createProgressBar();

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

    simulateProgress(28); // progression fictive de 1 → 28

    try {
      const url = `/api/chat?q=${encodeURIComponent(reference)}&templateId=v28-standard`;
      const resp = await fetch(url, { method: "GET" });

      let payload = null;
      try { payload = await resp.json(); }
      catch {
        const txt = await resp.text().catch(() => "");
        payload = { ok: false, error: `HTTP ${resp.status}`, raw: txt };
      }

      if (!resp.ok || !payload?.ok) {
        const msg = payload?.error ? `${payload.error}` : `Erreur ${resp.status}`;
        safeLog(`[${resp.status}] /api/chat → ${JSON.stringify(payload)}`);
        showError(container, msg);
        append(container, h("pre", { class: "error-details" }, JSON.stringify(payload, null, 2)));
        return;
      }

      renderStudy(payload.data || payload);
      toast("Étude générée.");
    } catch (e) {
      safeLog("Exception fetch /api/chat: " + (e?.message || e));
      showError(container, "Erreur réseau /api/chat");
    } finally {
      setLoading(false);
      hideProgress();

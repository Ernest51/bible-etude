// public/app.js
(function () {
  const input =
    document.querySelector("#searchRef") ||
    createSearchInput();

  const valideBtn =
    document.querySelector("#valideBtn") ||
    createValideButton();

  const container =
    document.querySelector("#studyContainer") ||
    createStudyContainer();

  const progressBar =
    document.querySelector("#progressBar") ||
    createProgressBar();

  valideBtn.addEventListener("click", () => {
    const value = (input.value || "").trim();
    if (!value) {
      toast("Entre une référence (ex: Marc 5:1-20)");
      input.focus();
      return;
    }
    generateStudyStream(value);
  });

  // --- Streaming (point par point)
  function generateStudyStream(reference) {
    clear(container);
    append(container, h("div", { class: "status" }, `Streaming pour: ${reference}`));

    setLoading(true);

    let pointsReçus = 0;
    const total = 28;

    const list = h("ol", { class: "stream-list" });
    container.appendChild(list);

    const es = new EventSource(`/api/chat-stream?q=${encodeURIComponent(reference)}`);

    es.onmessage = (e) => {
      try {
        const { chunk } = JSON.parse(e.data);
        if (!chunk) return;

        // Chaque "chunk" est un fragment → on accumule jusqu’à obtenir un JSON complet
        const lines = chunk.split("\n").filter(l => l.trim().startsWith("{"));
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            pointsReçus++;
            updateProgress(pointsReçus, total);
            renderPoint(list, obj);
          } catch {
            // ignore les fragments incomplets
          }
        }
      } catch (err) {
        console.log("Parse error:", err);
      }
    };

    es.addEventListener("end", () => {
      setLoading(false);
      es.close();
    });

    es.onerror = (err) => {
      console.error("Erreur EventSource", err);
      setLoading(false);
      es.close();
    };
  }

  // --- Rendering
  function renderPoint(list, obj) {
    const li = h("li", { class: "study-item" },
      h("h3", { class: "title" }, `${obj.id}. ${obj.title || ""}`),
      h("p", { class: "content" }, obj.content || ""),
      h("div", { class: "verses"

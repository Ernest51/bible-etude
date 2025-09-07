// public/app.js
(function () {
  console.log("[APP] Init OK");

  // --- helpers DOM sûrs (pas de :has / :contains) ---
  function findButtonByText(txt) {
    const t = (txt || "").toLowerCase().trim();
    const btns = Array.from(document.querySelectorAll("button, [role=button]"));
    return btns.find(b => (b.textContent || "").toLowerCase().includes(t)) || null;
  }
  function bySelAny(arr) {
    for (const s of arr) {
      const el = document.querySelector(s);
      if (el) return el;
    }
    return null;
  }
  function val(el) {
    return (el && "value" in el) ? String(el.value || "").trim() : "";
  }

  // --- Ancrages possibles (multi-essais pour ne pas casser l’app existante) ---
  const btnGenerate = findButtonByText("générer") || bySelAny(["#btnGenerate", "[data-gen]"]);
  const selBook     = bySelAny(["select[name=book]", "#book", "select[data-book]", "select:nth-of-type(1)"]);
  const selChapter  = bySelAny(["select[name=chapter]", "#chapter", "select[data-chapter]", "select:nth-of-type(2)"]);
  const selVerse    = bySelAny(["input[name=verse]", "#verse", "input[data-verse]"]);
  const selTrad     = bySelAny(["select[name=translation]", "#translation", "select[data-translation]"]);
  const selBibleId  = bySelAny(["input[name=bibleId]", "#bibleId", "input[data-bible-id]"]);

  // conteneurs d’injection (si présents)
  const listContainer   = bySelAny(["#rubriques-list", "[data-rubriques]"]);
  const contentContainer= bySelAny(["#rubrique-content", "[data-editor]"]);

  function renderStudy(data) {
    if (!data || !data.sections) return;

    // Liste à gauche (si conteneur fourni)
    if (listContainer) {
      listContainer.innerHTML = "";
      data.sections.forEach(s => {
        const li = document.createElement("div");
        li.className = "rubrique-item";
        li.textContent = `${s.index}. ${s.title}`;
        li.style.cursor = "pointer";
        li.onclick = () => {
          if (contentContainer) {
            contentContainer.innerHTML = "";
            const h = document.createElement("h3");
            h.textContent = `${s.index}. ${s.title}`;
            const p = document.createElement("p");
            p.textContent = s.content;
            contentContainer.appendChild(h);
            contentContainer.appendChild(p);
          }
        };
        listContainer.appendChild(li);
      });
    }

    // Éditeur à droite (si conteneur fourni) — on affiche la 1ère section
    if (contentContainer && data.sections.length) {
      const s = data.sections[0];
      contentContainer.innerHTML = "";
      const h = document.createElement("h3");
      h.textContent = `${s.index}. ${s.title}`;
      const p = document.createElement("p");
      p.textContent = s.content;
      contentContainer.appendChild(h);
      contentContainer.appendChild(p);
    }

    // Toujours logguer pour debug (sans casser l’UI existante)
    console.info("[GEN] Étude générée:", data.meta, data.sections);
  }

  async function generate() {
    try {
      const book = val(selBook) || "Genèse";
      const chapter = val(selChapter) || "1";
      const verse = val(selVerse) || "";
      const translation = val(selTrad) || "JND";
      const bibleId = val(selBibleId) || "";

      const usp = new URLSearchParams({ book, chapter, translation, trace: "1" });
      if (verse) usp.set("verse", verse);
      if (bibleId) usp.set("bibleId", bibleId);

      const url = `/api/study-28?${usp.toString()}`;
      const r = await fetch(url, { headers: { accept: "application/json" } });
      const j = await r.json().catch(() => null);

      if (!j || !j.ok) {
        const msg = j?.error?.message || `HTTP ${r.status}`;
        alert("Erreur pendant la génération : " + msg);
        console.error("[GEN][ERR]", j || r.status);
        return;
      }

      console.log("[GEN] source=study-28/api.bible sections=%d → étude générée OK", (j.data?.sections || []).length);
      renderStudy(j.data);
    } catch (e) {
      alert("Erreur pendant la génération : " + (e?.message || e));
      console.error(e);
    }
  }

  if (btnGenerate) {
    btnGenerate.addEventListener("click", generate);
  } else {
    console.warn("[APP] Bouton 'Générer' introuvable — wiring ignoré (aucune casse).");
  }
})();

// --- NOUVEAU (POST, no-store + retries) ---
async function postJSON(url, payload, tries = 2) {
  let lastErr;
  for (let k = 0; k < tries; k++) {
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",                  // navigateur
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const msg = await r.text().catch(() => "");
        throw new Error(msg || `HTTP ${r.status}`);
      }
      return r;
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 400 * (k + 1))); // petit backoff
    }
  }
  throw lastErr;
}

async function getStudy(ref) {
  const ver = versionSelect ? versionSelect.value : "LSG";

  // Déduire livre/chapitre => POST canonique, pas de GET avec ?q
  let book = bookSelect?.value || "Genèse";
  let chapter = Number(chapterSelect?.value || 1);

  const r = await postJSON(
    "/api/chat",
    { book, chapter, version: ver },  // on envoie la version ici
    3
  );

  const ct = r.headers.get("Content-Type") || "";

  if (/application\/json/i.test(ct)) {
    const j = await r.json().catch(() => ({}));
    if (!j || (j.ok === false)) throw new Error(j?.error || "Réponse JSON invalide");

    // IMPORTANT: on garde le "source" pour debug
    window.__lastChatSource = j.source || "unknown";
    window.__lastChatWarn = j.warn || "";

    return { from: j.source || "api", data: j.data };
  }

  // Rare, mais au cas où, fallback en texte/markdown (peu probable en POST)
  const text = await r.text();
  const sections = parseMarkdownToSections(text);
  const data = { reference: ref, sections };
  return { from: "api-md", data };
}

// public/app-loader.js — charge /app.js avec une version pour casser le cache
(function () {
  // ⚠️ Incrémente ce numéro à chaque déploiement (ex: 2025-09-01-3)
  const APP_VERSION = "2025-09-01-2";

  // Stamp visible par l'app et pour affichage dans le footer/debug
  window.APP_BUILD = "loader:" + APP_VERSION;

  // Affiche la version dans le footer si l'élément existe
  function paintStamp() {
    try {
      const el = document.getElementById("buildStamp");
      if (el) el.textContent = window.APP_BUILD;
      const dbg = document.getElementById("debugPanel");
      if (dbg) dbg.textContent += `\n[loader] build=${window.APP_BUILD}`;
    } catch {}
  }
  paintStamp();

  // Injecte /app.js avec cache-buster
  const s = document.createElement("script");
  s.src = "/app.js?v=" + encodeURIComponent(APP_VERSION);
  s.defer = true;
  s.onload = () => {
    console.log("[app-loader] app.js chargé avec version =", APP_VERSION);
    paintStamp();
  };
  s.onerror = (e) => {
    console.error("[app-loader] échec de chargement app.js", e);
    const dbg = document.getElementById("debugPanel");
    if (dbg) dbg.textContent += `\n[loader] ERREUR: app.js introuvable`;
  };
  document.head.appendChild(s);
})();

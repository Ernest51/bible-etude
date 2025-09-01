// public/app-loader.js — injecte /app.js avec version
(function(){
  // ⚠️ Incrémente cette version à chaque déploiement
  const APP_VERSION = "2025-09-01-2"; 

  // Stamp visible par le diagnostic
  window.APP_BUILD = "loader:" + APP_VERSION;

  const s = document.createElement("script");
  s.src = "/app.js?v=" + encodeURIComponent(APP_VERSION);
  s.defer = true;

  s.onload = () => {
    console.log("[app-loader] app.js chargé avec version =", APP_VERSION);
  };

  s.onerror = (e) => {
    console.error("[app-loader] échec de chargement app.js", e);
  };

  document.head.appendChild(s);
})();

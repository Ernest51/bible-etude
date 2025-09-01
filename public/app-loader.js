// public/app-loader.js
(function(){
  const APP_VERSION = "2025-09-01-2"; // incrémente à chaque déploiement
  window.APP_BUILD = "loader:" + APP_VERSION;

  const s = document.createElement("script");
  s.src = "/app.js?v=" + encodeURIComponent(APP_VERSION);
  s.defer = true;

  s.onload = () => console.log("[app-loader] app.js chargé", APP_VERSION);
  s.onerror = e => console.error("[app-loader] échec app.js", e);

  document.head.appendChild(s);
})();

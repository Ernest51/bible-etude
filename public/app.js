// /public/app.js — v10 (clean + debug vert + toasts)
(function () {
  'use strict';

  // ---------- Utilitaire: toast ----------
  function showToast(msg) {
    // supprime l'ancien toast
    var old = document.querySelector('.toast');
    if (old) old.remove();

    // crée le toast
    var t = document.createElement('div');
    t.className = 'toast';
    // styles de secours si la classe .toast n'existe pas dans le CSS
    t.style.position = 'fixed';
    t.style.right = '16px';
    t.style.bottom = '16px';
    t.style.background = '#0f172a';
    t.style.color = '#fff';
    t.style.padding = '10px 14px';
    t.style.borderRadius = '12px';
    t.style.boxShadow = '0 10px 20px rgba(0,0,0,.15)';
    t.style.fontSize = '14px';
    t.style.zIndex = '99998';
    t.textContent = msg;
    document.body.appendChild(t);

    setTimeout(function () { t.remove(); }, 2500);
  }

  // ---------- Bannière "JS chargé" ----------
  function setBanner() {
    var banner = document.getElementById('banner');
    if (!banner) return;
    banner.textContent = 'JS chargé ✅';
    banner.className = 'block w-full bg-emerald-100 text-emerald-900 px-4 py-2 text-sm rounded-md';
  }

  // ---------- Wiring des boutons de test (si présents) ----------
  function wireTestButtons() {
    var solid = document.querySelector('.btn.btn-solid');
    var outline = document.querySelector('.btn.btn-outline');
    var ghost = document.querySelector('.btn.btn-ghost');
    if (solid)  solid.addEventListener('click',  function () { showToast('Clique: bouton solide');  });
    if (outline) outline.addEventListener('click', function () { showToast('Clique: bouton contour'); });
    if (ghost)  ghost.addEventListener('click',  function () { showToast('Clique: bouton ghost');   });
  }

  // ---------- Rapport Debug ----------
  function buildDebugReport() {
    // stylesheets (avec garde CORS)
    var styles = Array.prototype.slice.call(document.styleSheets).map(function (ss, idx) {
      var href = '';
      var rulesCount = null;
      try { href = ss.href || '(inline)'; } catch (e) { href = '(inaccessible)'; }
      try { rulesCount = ss.cssRules ? ss.cssRules.length : null; } catch (e2) { rulesCount = '(CORS)'; }
      return { idx: idx, href: href, rulesCount: rulesCount };
    });

    // scripts
    var scripts = Array.prototype.slice.call(document.querySelectorAll('script')).map(function (s) {
      return {
        src: s.getAttribute('src') || '(inline)',
        defer: !!s.defer,
        async: !!s.async,
        type: s.type || 'text/javascript'
      };
    });

    // liens CSS
    var links = Array.prototype.slice.call(document.querySelectorAll('link[rel="stylesheet"]')).map(function (l) {
      return { href: l.getAttribute('href'), media: l.getAttribute('media') || 'all' };
    });

    var hasOutputCss = links.some(function (l) { return (l.href || '').indexOf('/dist/output.css') !== -1; });

    var report = {
      meta: {
        ts: new Date().toISOString(),
        url: location.href,
        ua: navigator.userAgent,
        lang: document.documentElement.lang || '(none)'
      },
      css: {
        links: links,
        stylesheets: styles,
        hasOutputCss: hasOutputCss
      },
      js: { scripts: scripts },
      dom: {
        hasToastsDiv: !!document.getElementById('toasts'),
        contentArea: !!document.getElementById('contentArea'),
        sectionsHost: !!document.getElementById('sectionsHost'),
        pointsNav: !!document.getElementById('pointsNav')
      },
      note: 'Copiez-collez ce JSON et envoyez-le ici.'
    };

    return JSON.stringify(report, null, 2);
  }

  // ---------- Panneau Debug (bouton vert) ----------
  function createDebugPanel() {
    // bouton vert flottant
    var btn = document.createElement('button');
    btn.textContent = 'DEBUG';
    btn.setAttribute('type', 'button');
    btn.style.position = 'fixed';
    btn.style.right = '16px';
    btn.style.bottom = '100px';
    btn.style.zIndex = '99999';
    btn.style.padding = '12px 18px';
    btn.style.borderRadius = '14px';
    btn.style.border = '2px solid #065f46';
    btn.style.background = '#10b981';
    btn.style.color = '#fff';
    btn.style.fontWeight = '900';
    btn.style.fontSize = '14px';
    btn.style.boxShadow = '0 8px 16px rgba(0,0,0,.25)';
    btn.style.cursor = 'pointer';
    document.body.appendChild(btn);

    // overlay + panneau
    var overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,.35)';
    overlay.style.backdropFilter = 'blur(2px)';
    overlay.style.zIndex = '100000';
    overlay.style.display = 'none';

    var panel = document.createElement('div');
    panel.style.position = 'fixed';
    panel.style.left = '50%';
    panel.style.top = '50%';
    panel.style.transform = 'translate(-50%, -50%)';
    panel.style.width = 'min(900px, 90vw)';
    panel.style.maxHeight = '80vh';
    panel.style.background = '#fff';
    panel.style.border = '1px solid #e5e7eb';
    panel.style.borderRadius = '16px';
    panel.style.boxShadow = '0 20px 40px rgba(0,0,0,.3)';
    panel.style.display = 'grid';
    panel.style.gridTemplateRows = 'auto 1fr auto';

    var header = document.createElement('div');
    header.textContent = 'Rapport Debug — client';
    header.style.padding = '12px 16px';
    header.style.borderBottom = '1px solid #ddd';
    header.style.fontWeight = '800';

    var textarea = document.createElement('textarea');
    textarea.readOnly = true;
    textarea.style.width = '100%';
    textarea.style.height = '100%';
    textarea.style.border = 'none';
    textarea.style.padding = '12px';
    textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
    textarea.style.fontSize = '12px';
    textarea.style.background = '#f9fafb';
    textarea.style.resize = 'none';
    textarea.value = buildDebugReport();

    var footer = document.createElement('div');
    footer.style.padding = '12px 16px';
    footer.style.borderTop = '1px solid #ddd';
    footer.style.display = 'flex';
    footer.style.gap = '8px';
    footer.style.justifyContent = 'flex-end';

    function styleBtn(b) {
      b.style.padding = '6px 12px';
      b.style.borderRadius = '8px';
      b.style.border = '1px solid #ccc';
      b.style.background = '#f9fafb';
      b.style.fontWeight = '600';
      b.style.cursor = 'pointer';
    }

    var copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copier';
    copyBtn.type = 'button';
    styleBtn(copyBtn);
    copyBtn.onclick = function () {
      try {
        navigator.clipboard.writeText(textarea.value);
        showToast('Rapport copié ✅');
      } catch (e) {
        textarea.select();
        document.execCommand('copy');
        showToast('Copie (fallback) OK');
      }
    };

    var refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Rafraîchir';
    refreshBtn.type = 'button';
    styleBtn(refreshBtn);
    refreshBtn.onclick = function () {
      textarea.value = buildDebugReport();
      showToast('Rapport régénéré 🔄');
    };

    var closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fermer';
    closeBtn.type = 'button';
    styleBtn(closeBtn);
    closeBtn.onclick = function () { overlay.style.display = 'none'; };

    footer.appendChild(copyBtn);
    footer.appendChild(refreshBtn);
    footer.appendChild(closeBtn);

    panel.appendChild(header);
    panel.appendChild(textarea);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    btn.onclick = function () {
      textarea.value = buildDebugReport();
      overlay.style.display = 'block';
    };
  }

  // ---------- Init ----------
  function init() {
    setBanner();
    wireTestButtons();
    createDebugPanel();
    console.log('app.js v10 chargé');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // capter les erreurs JS pour les afficher à l'écran
  window.addEventListener('error', function (e) {
    showToast('Erreur JS: ' + (e.message || 'inconnue'));
    console.error('Erreur JS capturée:', e);
  });
})();

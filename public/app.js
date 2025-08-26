// /public/app.js — v8 (toast + debug panel)

// ---------- Bannière "JS chargé" ----------
const banner = document.getElementById('banner');
if (banner) {
  banner.textContent = 'JS chargé ✅';
  banner.className = 'block w-full bg-emerald-100 text-emerald-900 px-4 py-2 text-sm rounded-md';
}

// ---------- Toast util ----------
function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2500);
}

// ---------- Wiring des boutons de test (s’ils existent) ----------
function wireButtons() {
  const solid = document.querySelector('.btn.btn-solid');
  const outline = document.querySelector('.btn.btn-outline');
  const ghost = document.querySelector('.btn.btn-ghost');
  solid && solid.addEventListener('click', () => showToast('Clique: bouton solide'));
  outline && outline.addEventListener('click', () => showToast('Clique: bouton contour'));
  ghost && ghost.addEventListener('click', () => showToast('Clique: bouton ghost'));
}

// ---------- Debug Panel ----------
function buildDebugReport() {
  // Stylesheets
  const styles = Array.from(document.styleSheets).map((ss, idx) => {
    let href = '';
    try { href = ss.href || '(inline)'; } catch { href = '(inaccessible)'; }
    let rulesCount = null;
    try { rulesCount = ss.cssRules ? ss.cssRules.length : null; } catch { rulesCount = '(blocked by CORS)'; }
    return { idx, href, rulesCount };
  });

  // Scripts
  const scripts = Array.from(document.querySelectorAll('script')).map(s => ({
    src: s.getAttribute('src') || '(inline)',
    defer: s.defer || false,
    async: s.async || false,
    type: s.type || 'text/javascript'
  }));

  // Balises link rel=stylesheet
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => ({
    href: l.getAttribute('href'),
    media: l.getAttribute('media') || 'all'
  }));

  // Vérifs ciblées
  const hasOutputCssLink = links.some(l => (l.href || '').includes('/dist/output.css'));
  const outputCssSheet = styles.find(s => (s.href || '').includes('/dist/output.css'));
  const hasToastClassInDOM = !!document.querySelector('.toast'); // juste une présence éventuelle
  const htmlLang = document.documentElement.lang || '(none)';

  // Quelques éléments clés existants ?
  const keys = {
    toastsContainer: !!document.getElementById('toasts'),
    contentArea: !!document.getElementById('contentArea'),
    sectionsHost: !!document.getElementById('sectionsHost'),
    pointsNav: !!document.getElementById('pointsNav'),
    lastStudyPill: !!document.getElementById('lastStudyPill'),
  };

  const report = {
    meta: {
      ts: new Date().toISOString(),
      location: window.location.href,
      pathname: window.location.pathname,
      userAgent: navigator.userAgent,
      htmlLang
    },
    css: {
      linkTags: links,
      styleSheets: styles,
      hasOutputCssLink,
      outputCssSheet
    },
    js: {
      scripts
    },
    domChecks: {
      hasToastClassInDOM,
      keys
    },
    note: "Copiez-collez ce JSON et envoyez-le."
  };

  return JSON.stringify(report, null, 2);
}

function createDebugPanel() {
  // Bouton flottant
  const btn = document.createElement('button');
  btn.textContent = 'Debug';
  btn.style.position = 'fixed';
  btn.style.right = '16px';
  btn.style.bottom = '84px';
  btn.style.zIndex = '9999';
  btn.style.padding = '10px 14px';
  btn.style.borderRadius = '12px';
  btn.style.border = '1px solid #c7d2fe';
  btn.style.background = '#4f46e5';
  btn.style.color = '#fff';
  btn.style.fontWeight = '800';
  btn.style.boxShadow = '0 8px 16px rgba(0,0,0,.15)';
  btn.style.cursor = 'pointer';
  document.body.appendChild(btn);

  // Overlay + panneau
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = 'rgba(15,23,42,.35)';
  overlay.style.backdropFilter = 'blur(2px)';
  overlay.style.zIndex = '10000';
  overlay.style.display = 'none';

  const panel = document.createElement('div');
  panel.style.position = 'fixed';
  panel.style.left = '50%';
  panel.style.top = '50%';
  panel.style.transform = 'translate(-50%, -50%)';
  panel.style.width = 'min(900px, 92vw)';
  panel.style.maxHeight = '80vh';
  panel.style.background = '#fff';
  panel.style.border = '1px solid #e5e7eb';
  panel.style.borderRadius = '16px';
  panel.style.boxShadow = '0 20px 40px rgba(0,0,0,.2)';
  panel.style.display = 'grid';
  panel.style.gridTemplateRows = 'auto 1fr auto';

  const header = document.createElement('div');
  header.style.padding = '12px 16px';
  header.style.borderBottom = '1px solid #eef2ff';
  header.style.fontWeight = '800';
  header.textContent = 'Rapport Debug — client';

  const textarea = document.createElement('textarea');
  textarea.readOnly = true;
  textarea.style.width = '100%';
  textarea.style.height = '100%';
  textarea.style.border = 'none';
  textarea.style.padding = '12px 16px';
  textarea.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
  textarea.style.fontSize = '12px';
  textarea.style.background = '#f8fafc';
  textarea.style.outline = 'none';
  textarea.value = buildDebugReport();

  const footer = document.createElement('div');
  footer.style.padding = '12px 16px';
  footer.style.borderTop = '1px solid #eef2ff';
  footer.style.display = 'flex';
  footer.style.gap = '8px';
  footer.style.justifyContent = 'flex-end';

  const copyBtn = document.createElement('button');
  copyBtn.textContent = 'Copier';
  copyBtn.style.padding = '8px 12px';
  copyBtn.style.borderRadius = '10px';
  copyBtn.style.border = '1px solid #c7d2fe';
  copyBtn.style.background = '#fff';
  copyBtn.style.fontWeight = '700';
  copyBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(textarea.value);
      showToast('Rapport copié dans le presse-papiers');
    } catch {
      textarea.select();
      document.execCommand('copy');
      showToast('Copie (fallback) effectuée');
    }
  };

  const refreshBtn = document.createElement('button');
  refreshBtn.textContent = 'Rafraîchir';
  refreshBtn.style.padding = '8px 12px';
  refreshBtn.style.borderRadius = '10px';
  refreshBtn.style.border = '1px solid #c7d2fe';
  refreshBtn.style.background = '#fff';
  refreshBtn.style.fontWeight = '700';
  refreshBtn.onclick = () => {
    textarea.value = buildDebugReport();
    showToast('Rapport régénéré');
  };

  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Fermer';
  closeBtn.style.padding = '8px 12px';
  closeBtn.style.borderRadius = '10px';
  closeBtn.style.background = '#4f46e5';
  closeBtn.style.border = '1px solid #4338ca';
  closeBtn.style.color = '#fff';
  closeBtn.style.fontWeight = '800';
  closeBtn.onclick = () => {
    overlay.style.display = 'none';
  };

  footer.appendChild(copyBtn);
  footer.appendChild(refreshBtn);
  footer.appendChild(closeBtn);

  panel.appendChild(header);
  panel.appendChild(textarea);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  btn.addEventListener('click', () => {
    textarea.value = buildDebugReport();
    overlay.style.display = 'block';
  });
}

// ---------- Init ----------
function init() {
  wireButtons();
  createDebugPanel();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

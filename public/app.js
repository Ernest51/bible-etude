// /public/app.js — v9 (toast + debug panel vert)

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

// ---------- Wiring boutons test ----------
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
  const styles = Array.from(document.styleSheets).map((ss, idx) => {
    let href = ''; let rulesCount = null;
    try { href = ss.href || '(inline)'; } catch { href = '(inaccessible)'; }
    try { rulesCount = ss.cssRules ? ss.cssRules.length : null; } catch { rulesCount = '(CORS)'; }
    return { idx, href, rulesCount };
  });

  const scripts = Array.from(document.querySelectorAll('script')).map(s => ({
    src: s.getAttribute('src') || '(inline)', defer: s.defer || false
  }));

  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l => ({
    href: l.getAttribute('href'), media: l.getAttribute('media') || 'all'
  }));

  const hasOutputCss = links.some(l => (l.href || '').includes('/dist/output.css'));
  const htmlLang = document.documentElement.lang || '(none)';

  const keys = {
    contentArea: !!document.getElementById('contentArea'),
    sectionsHost: !!document.getElementById('sectionsHost'),
    pointsNav: !!document.getElementById('pointsNav')
  };

  return JSON.stringify({
    meta: { ts: new Date().toISOString(), url: location.href, ua: navigator.userAgent, htmlLang },
    css: { links, styles, hasOutputCss },
    js: { scripts },
    dom: { keys }
  }, null, 2);
}

function createDebugPanel() {
  // bouton flottant vert
  const btn = document.createElement('button');
  btn.textContent = 'DEBUG';
  Object.assign(btn.style, {
    position: 'fixed',
    right: '16px',
    bottom: '100px',
    zIndex: '99999',
    padding: '12px 18px',
    borderRadius: '14px',
    border: '2px solid #065f46',
    background: '#10b981',
    color: '#fff',
    fontWeight: '900',
    fontSize: '14px',
    boxShadow: '0 8px 16px rgba(0,0,0,.25)',
    cursor: 'pointer'
  });
  document.body.appendChild(btn);

  // overlay + panneau
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.35);backdrop-filter:blur(2px);z-index:100000;display:none';
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(900px,90vw);max-height:80vh;background:#fff;border:1px solid #e5e7eb;border-radius:16px;box-shadow:0 20px 40px rgba(0,0,0,.3);display:grid;grid-template-rows:auto 1fr auto';
  
  const header = document.createElement('div');
  header.textContent = 'Rapport Debug — client';
  header.style.cssText = 'padding:12px 16px;border-bottom:1px solid #ddd;font-weight:800';

  const textarea = document.createElement('textarea');
  textarea.readOnly = true;
  textarea.style.cssText = 'width:100%;height:100%;border:none;padding:12px;font-family:monospace;font-size:12px;background:#f9fafb;resize:none';
  textarea.value = buildDebugReport();

  const footer = document.createElement('div');

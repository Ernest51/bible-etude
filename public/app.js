// app.js — v3 (debug toast + fallback inline)

// 1) Bannière "JS chargé"
const banner = document.getElementById('banner');
if (banner) {
  banner.textContent = 'JS chargé ✅';
  banner.className = 'block w-full bg-emerald-100 text-emerald-900 px-4 py-2 text-sm rounded-md';
}

// 2) Log console (trace de version)
console.log('OK: app.js chargé  ✅  v3');

function showToast(msg) {
  console.log('[toast] creating:', msg);

  // supprime un toast existant s’il y en a un
  const old = document.querySelector('.toast');
  if (old) {
    console.log('[toast] removed previous toast');
    old.remove();
  }

  // crée le toast
  const t = document.createElement('div');

  // applique une classe utilitaire (si le CSS Tailwind custom est bien chargé)
  t.className = 'toast';

  // Fallback inline (au cas où la classe .toast n’existerait pas dans le CSS)
  // Cela garantit que le toast est VISIBLE quoi qu’il arrive.
  t.style.position = 'fixed';
  t.style.right = '1rem';
  t.style.bottom = '1rem';
  t.style.background = '#0f172a'; // slate-900
  t.style.color = 'white';
  t.style.padding = '0.5rem 1rem';
  t.style.borderRadius = '0.75rem';
  t.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,.1), 0 4px 6px -4px rgba(0,0,0,.1)';
  t.style.fontSize = '.875rem';
  t.style.zIndex = '9999';

  t.textContent = msg;
  document.body.appendChild(t);
  console.log('[toast] appended to body');

  // auto-hide après 2.5s
  setTimeout(() => {
    t.remove();
    console.log('[toast] removed after timeout');
  }, 2500);
}

function wireButtons() {
  const solid = document.querySelector('.btn.btn-solid');
  const outline = document.querySelector('.btn.btn-outline');
  const ghost = document.querySelector('.btn.btn-ghost');

  console.log('[wire] buttons:', { solid: !!solid, outline: !!outline, ghost: !!ghost });

  solid && solid.addEventListener('click', () => showToast('Clique: bouton solide'));
  outline && outline.addEventListener('click', () => showToast('Clique: bouton contour'));
  ghost && ghost.addEventListener('click', () => showToast('Clique: bouton ghost'));
}

// lance le wiring une fois le DOM prêt (au cas où)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireButtons);
} else {
  wireButtons();
}

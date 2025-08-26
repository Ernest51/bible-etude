// app.js — v2

// 1) Bannière "JS chargé"
const banner = document.getElementById('banner');
if (banner) {
  banner.textContent = 'JS chargé ✅';
  banner.className = 'block w-full bg-emerald-100 text-emerald-900 px-4 py-2 text-sm rounded-md';
}

// 2) Log console (trace de version)
console.log('OK: app.js chargé  ✅  v2');

// 3) Petit test d’interaction : clic sur les boutons -> toast
function showToast(msg) {
  // supprime un toast existant s’il y en a un
  const old = document.querySelector('.toast');
  if (old) old.remove();

  // crée et affiche le toast
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);

  // auto-hide après 2.5s
  setTimeout(() => t.remove(), 2500);
}

function wireButtons() {
  const solid = document.querySelector('.btn.btn-solid');
  const outline = document.querySelector('.btn.btn-outline');
  const ghost = document.querySelector('.btn.btn-ghost');

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

// /public/app.js — v4 (clean)

// 1) Bannière "JS chargé"
const banner = document.getElementById('banner');
if (banner) {
  banner.textContent = 'JS chargé ✅';
  banner.className = 'block w-full bg-emerald-100 text-emerald-900 px-4 py-2 text-sm rounded-md';
}

// 2) Toast basé uniquement sur la classe CSS .toast
function showToast(msg) {
  const old = document.querySelector('.toast');
  if (old) old.remove();

  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);

  setTimeout(() => t.remove(), 2500);
}

// 3) Wiring des boutons
function wireButtons() {
  const solid = document.querySelector('.btn.btn-solid');
  const outline = document.querySelector('.btn.btn-outline');
  const ghost = document.querySelector('.btn.btn-ghost');

  solid && solid.addEventListener('click', () => showToast('Clique: bouton solide'));
  outline && outline.addEventListener('click', () => showToast('Clique: bouton contour'));
  ghost && ghost.addEventListener('click', () => showToast('Clique: bouton ghost'));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', wireButtons);
} else {
  wireButtons();
}

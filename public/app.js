// src/app.js
const API_URL_CHAT = "/api/chat";
const POINTS = [
  "Prière d’ouverture — Invocation du Saint-Esprit pour éclairer mon étude.",
  "Canon et testament — Identifier le livre dans le canon.",
  "Questions du chapitre précédent — Minimum 5 questions et réponses intégrales.",
  "Titre du chapitre — Résumé doctrinal.",
  "Contexte historique — Carte, frise.",
  "Structure littéraire.",
  "Genre littéraire.",
  "Auteur et généalogie.",
  "Verset-clé doctrinal.",
  "Analyse exégétique.",
  "Analyse lexicale.",
  "Références croisées.",
  "Fondements théologiques.",
  "Thème doctrinal.",
  "Fruits spirituels.",
  "Types bibliques.",
  "Appui doctrinal.",
  "Comparaison entre versets.",
  "Comparaison avec Actes 2.",
  "Verset à mémoriser.",
  "Enseignement pour l’Église.",
  "Enseignement pour la famille.",
  "Enseignement pour enfants.",
  "Application missionnaire.",
  "Application pastorale.",
  "Application personnelle.",
  "Versets à retenir.",
  "Prière de fin."
];

const $ = (s) => document.querySelector(s);

function toast(msg) {
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = msg;
  $("#toasts").appendChild(d);
  setTimeout(() => d.remove(), 4000);
}

function startProgress() {
  $("#progressContainer").style.display = "block";
  $("#progressBar").style.width = "0%";
  let width = 0;
  const interval = setInterval(() => {
    width += 3;
    if (width >= 90) clearInterval(interval);
    $("#progressBar").style.width = width + "%";
  }, 200);
  return interval;
}

function finishProgress() {
  $("#progressBar").style.width = "100%";
  setTimeout(() => {
    $("#progressContainer").style.display = "none";
    $("#progressBar").style.width = "0%";
  }, 800);
}

function renderSections() {
  const nav = $("#pointsNav"), host = $("#sectionsHost");
  nav.innerHTML = ""; host.innerHTML = "";
  for (let i = 1; i <= 28; i++) {
    const btn = document.createElement("button");
    btn.className = "sidebar-item w-full text-left";
    btn.dataset.section = "p" + i;
    btn.innerHTML = `<span class="badge">${i}</span><span>${POINTS[i - 1]}</span>`;
    btn.addEventListener("click", () => {
      document.querySelectorAll(".sidebar-item").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".content-section").forEach((s) => s.classList.remove("active"));
      btn.classList.add("active");
      $("#p" + i).classList.add("active");
    });
    nav.appendChild(btn);

    const sec = document.createElement("div");
    sec.id = "p" + i;
    sec.className = "content-section";
    sec.innerHTML = `<h3 class="text-xl font-bold mb-2">${i}. ${POINTS[i - 1]}</h3><article class="prose" id="view-p${i}">—</article>`;
    host.appendChild(sec);
  }
}

async function generateAll() {
  const livre = $("#livreInput").value.trim();
  const chap = $("#chapInput").value.trim();
  if (!livre || !chap) return toast("Choisis un livre et un chapitre.");

  $("#busy").classList.remove("hidden");
  const progressInterval = startProgress();

  try {
    const res = await fetch(API_URL_CHAT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ livre, chapitre: parseInt(chap, 10), points: 28 })
    });

    let data;
    try { data = await res.json(); } catch { throw new Error("Réponse non JSON de l'API."); }
    if (!res.ok) throw new Error(data?.error || "Erreur API");

    for (let i = 1; i <= 28; i++) {
      $("#view-p" + i).innerHTML = data[String(i)] || "—";
    }
    document.querySelector("#pointsNav .sidebar-item")?.click();
    toast("Étude générée !");
  } catch (e) {
    toast("Erreur : " + (e?.message || e));
  } finally {
    clearInterval(progressInterval);
    finishProgress();
    $("#busy").classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderSections();
  $("#validerBtn").addEventListener("click", generateAll);
  $("#reinitBtn").addEventListener("click", () => { $("#livreInput").value = ""; $("#chapInput").value = ""; });
});

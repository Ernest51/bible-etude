// public/app.js

// --- Variables globales ---
let study = null;
let currentIdx = 0;

// --- Éléments DOM ---
const pointsList = document.getElementById("pointsList");
const edTitle = document.getElementById("edTitle");
const noteArea = document.getElementById("noteArea");
const metaInfo = document.getElementById("metaInfo");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const generateBtn = document.getElementById("generateBtn");
const densitySelect = document.getElementById("densitySelect");
const searchRef = document.getElementById("searchRef");
const debugPanel = document.getElementById("debugPanel");

// --- Utils ---
function logDebug(msg, data) {
  const time = new Date().toLocaleTimeString();
  debugPanel.textContent += `\n[${time}] ${msg} ${data ? JSON.stringify(data) : ""}`;
  debugPanel.scrollTop = debugPanel.scrollHeight;
}

function makeVerseLinks(text) {
  if (!text) return "";
  return text.replace(
    /\b([1-3]?\s?[A-Za-zéûîôÉÈÀa-z]+)\s(\d+):(\d+(-\d+)?)/g,
    (match, book, chap, verse) => {
      const ref = `${book} ${chap}:${verse}`;
      const urlBook = book.replace(/\s+/g, "").toUpperCase().substring(0, 3);
      return `<a href="https://www.bible.com/fr/bible/93/${urlBook}.${chap}.${verse
        .split("-")[0]
        }.LSG" target="_blank" style="color:#2563eb;text-decoration:underline">${ref}</a>`;
    }
  );
}

// --- Navigation ---
function showPoint(idx) {
  if (!study || !study.sections[idx]) return;
  const point = study.sections[idx];
  currentIdx = idx;

  // Titre
  edTitle.textContent = `${point.id}. ${point.title}`;

  // Contenu enrichi
  const html = `
    <div style="font-family:Spectral,serif;line-height:1.7;padding:14px;background:#fff;border-radius:12px;border:1px solid #e5e7eb">
      <h2 style="text-align:center;font-weight:700;margin-top:0">${point.title}</h2>
      <div>${makeVerseLinks(point.content)}</div>
    </div>
  `;
  noteArea.value = "";
  noteArea.style.display = "none";
  const container = document.querySelector(".ed-body");
  container.innerHTML = html;

  // Info bas
  metaInfo.textContent = `Point ${point.id} / ${study.sections.length}`;
}

function nextPoint() {
  if (currentIdx < study.sections.length - 1) {
    showPoint(currentIdx + 1);
  }
}

function prevPoint() {
  if (currentIdx > 0) {
    showPoint(currentIdx - 1);
  }
}

// --- Rendu liste ---
function renderList() {
  pointsList.innerHTML = "";
  study.sections.forEach((s, i) => {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <span class="idx">${s.id}</span>
      <div>
        <b>${s.title}</b>
        <span class="desc">${s.description || ""}</span>
      </div>
    `;
    item.onclick = () => showPoint(i);
    pointsList.appendChild(item);
  });
}

// --- Génération ---
async function onGenerate() {
  const passage = searchRef.value.trim() || "Genèse 1";
  const density = parseInt(densitySelect.value, 10);

  logDebug("Génération demandée", { passage, density });

  try {
    const res = await fetch("/api/generate-study", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passage, options: { length: density } })
    });

    if (!res.ok) {
      throw new Error("Échec API");
    }

    const data = await res.json();
    study = data.study;

    if (!study || !study.sections) throw new Error("Format invalide");

    renderList();
    showPoint(0);
    logDebug("Génération réussie", { sections: study.sections.length });
  } catch (err) {
    logDebug("Erreur", { message: err.message });
    alert("La génération a échoué. Un gabarit a été inséré.");
  }
}

// --- Événements ---
generateBtn.addEventListener("click", onGenerate);
nextBtn.addEventListener("click", nextPoint);
prevBtn.addEventListener("click", prevPoint);

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  const y = document.getElementById("y");
  if (y) y.textContent = new Date().getFullYear();
  logDebug("App.js initialisé");
});

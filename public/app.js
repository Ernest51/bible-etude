// public/app.js — Version complète avec intégration de /api/verse
// Génération d’étude + injection du texte biblique dans la prière d’ouverture

(function () {
  const $ = (id) => document.getElementById(id);
  const progressBar = $("progressBar");
  const setProgress = (p) => {
    if (progressBar) progressBar.style.width = Math.max(0, Math.min(100, p)) + "%";
  };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const busy = (el, on) => {
    if (!el) return;
    el.disabled = !!on;
    el.classList.toggle("opacity-60", !!on);
    el.textContent = on ? "Génération..." : el.dataset.label || el.textContent;
  };
  const dpanel = $("debugPanel");
  const dbtn = $("debugBtn");
  const dlog = (msg) => {
    if (!dpanel) return;
    dpanel.style.display = "block";
    dbtn && (dbtn.textContent = "Fermer Debug");
    const line = `[${new Date().toISOString()}] ${msg}`;
    dpanel.textContent += (dpanel.textContent ? "\n" : "") + line;
    console.log(line);
  };

  const searchRef = $("searchRef"),
    bookSelect = $("bookSelect"),
    chapterSelect = $("chapterSelect"),
    verseSelect = $("verseSelect"),
    versionSelect = $("versionSelect"),
    generateBtn = $("generateBtn"),
    readBtn = $("readBtn"),
    validateBtn = $("validate"),
    pointsList = $("pointsList"),
    edTitle = $("edTitle"),
    noteArea = $("noteArea"),
    noteView = $("noteView"),
    prevBtn = $("prev"),
    nextBtn = $("next"),
    metaInfo = $("metaInfo"),
    themeSelect = $("themeSelect"),
    enrichToggle = $("enrichToggle"),
    linksPanel = $("linksPanel"),
    linksList = $("linksList");

  $("y").textContent = new Date().getFullYear();

  const BOOKS = [
    ["Genèse", 50],
    ["Exode", 40],
    ["Lévitique", 27],
    ["Nombres", 36],
    ["Deutéronome", 34],
    ["Josué", 24],
    ["Juges", 21],
    ["Ruth", 4],
    ["1 Samuel", 31],
    ["2 Samuel", 24],
    ["1 Rois", 22],
    ["2 Rois", 25],
    ["1 Chroniques", 29],
    ["2 Chroniques", 36],
    ["Esdras", 10],
    ["Néhémie", 13],
    ["Esther", 10],
    ["Job", 42],
    ["Psaumes", 150],
    ["Proverbes", 31],
    ["Ecclésiaste", 12],
    ["Cantique des cantiques", 8],
    ["Ésaïe", 66],
    ["Jérémie", 52],
    ["Lamentations", 5],
    ["Ézéchiel", 48],
    ["Daniel", 12],
    ["Osée", 14],
    ["Joël", 3],
    ["Amos", 9],
    ["Abdias", 1],
    ["Jonas", 4],
    ["Michée", 7],
    ["Nahoum", 3],
    ["Habacuc", 3],
    ["Sophonie", 3],
    ["Aggée", 2],
    ["Zacharie", 14],
    ["Malachie", 4],
    ["Matthieu", 28],
    ["Marc", 16],
    ["Luc", 24],
    ["Jean", 21],
    ["Actes", 28],
    ["Romains", 16],
    ["1 Corinthiens", 16],
    ["2 Corinthiens", 13],
    ["Galates", 6],
    ["Éphésiens", 6],
    ["Philippiens", 4],
    ["Colossiens", 4],
    ["1 Thessaloniciens", 5],
    ["2 Thessaloniciens", 3],
    ["1 Timothée", 6],
    ["2 Timothée", 4],
    ["Tite", 3],
    ["Philémon", 1],
    ["Hébreux", 13],
    ["Jacques", 5],
    ["1 Pierre", 5],
    ["2 Pierre", 3],
    ["1 Jean", 5],
    ["2 Jean", 1],
    ["3 Jean", 1],
    ["Jude", 1],
    ["Apocalypse", 22],
  ];

  const FIXED_POINTS = [
    { t: "Prière d’ouverture", d: "Invocation du Saint-Esprit pour éclairer l’étude." },
    { t: "Canon et testament", d: "Identification du livre selon le canon biblique." },
    { t: "Questions du chapitre précédent", d: "(Min. 5) Réponses intégrales, éléments de compréhension exigés." },
    { t: "Titre du chapitre", d: "Résumé doctrinal synthétique du chapitre étudié." },
    { t: "Contexte historique", d: "Période, géopolitique, culture, carte localisée à l’époque." },
    { t: "Structure littéraire", d: "Séquençage narratif et composition interne du chapitre." },
    { t: "Genre littéraire", d: "Type de texte : narratif, poétique, prophétique, etc." },
    { t: "Auteur et généalogie", d: "Présentation de l’auteur et son lien aux patriarches." },
    { t: "Verset-clé doctrinal", d: "Verset central du chapitre avec lien cliquable." },
    { t: "Analyse exégétique", d: "Commentaire mot-à-mot avec références au grec/hébreu." },
    { t: "Analyse lexicale", d: "Analyse des mots-clés originaux et leur sens doctrinal." },
    { t: "Références croisées", d: "Passages parallèles ou complémentaires." },
    { t: "Fondements théologiques", d: "Doctrines majeures du chapitre." },
    { t: "Thème doctrinal", d: "Lien avec les 22 grands thèmes doctrinaux." },
    { t: "Fruits spirituels", d: "Vertus et attitudes inspirées par le chapitre." },
    { t: "Types bibliques", d: "Symboles / figures typologiques." },
    { t: "Appui doctrinal", d: "Autres passages qui renforcent l’enseignement." },
    { t: "Comparaison entre versets", d: "Mise en relief au sein du chapitre." },
    { t: "Comparaison avec Actes 2", d: "Parallèle avec le début de l’Église." },
    { t: "Verset à mémoriser", d: "Verset essentiel à retenir." },
    { t: "Enseignement pour l’Église", d: "Implications collectives / ecclésiales." },
    { t: "Enseignement pour la famille", d: "Valeurs à transmettre dans le foyer." },
    { t: "Enseignement pour enfants", d: "Approche simplifiée, jeux, récits, visuels." },
    { t: "Application missionnaire", d: "Comment le texte guide l’évangélisation." },
    { t: "Application pastorale", d: "Conseils pour ministres / enseignants." },
    { t: "Application personnelle", d: "Examen de conscience et engagement." },
    { t: "Versets à retenir", d: "Incontournables pour prédication pastorale." },
    { t: "Prière de fin", d: "Clôture spirituelle avec reconnaissance." },
  ];
  const N = FIXED_POINTS.length;

  let current = 0,
    notes = {},
    autosaveTimer = null,
    autoTimer = null,
    inFlight = false;

  function dedupeParagraphs(raw) {
    const lines = String(raw || "").split(/\r?\n/);
    const out = [];
    let last = "";
    for (const ln of lines) {
      const t = ln.trim();
      if (t && t === last) continue;
      out.push(ln);
      last = t;
    }
    return out.join("\n");
  }
  function ensureLinksLineBreaks(txt) {
    return String(txt || "").replace(
      /(\S)(https?:\/\/[^\s)]+)(\S)?/g,
      (_, a, url, b) => `${a}\n${url}\n${b || ""}`
    );
  }

  async function postJSON(url, payload, tries = 3) {
    let lastErr;
    for (let k = 0; k < tries; k++) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const msg = await r.text().catch(() => "");
          throw new Error(msg || `HTTP ${r.status}`);
        }
        return r;
      } catch (e) {
        lastErr = e;
        await wait(400 * (k + 1));
      }
    }
    throw lastErr;
  }

  async function getStudy() {
    const ver = versionSelect ? versionSelect.value : "LSG";
    const book = bookSelect?.value || "Genèse";
    const chapter = Number(chapterSelect?.value || 1);
    const verse = verseSelect?.value || "";

    const r = await postJSON("/api/chat", { book, chapter, verse, version: ver }, 3);
    const ct = r.headers.get("Content-Type") || "";
    if (/application\/json/i.test(ct)) {
      const j = await r.json().catch(() => ({}));
      if (!j || j.ok === false) throw new Error(j?.error || "Réponse JSON invalide");
      return { from: j.source || "api", data: j.data };
    }
    const text = await r.text();
    return { from: "api-md", data: { reference: `${book} ${chapter}`, sections: [] } };
  }

  async function generateStudy() {
    if (inFlight) return;
    inFlight = true;
    busy(generateBtn, true);

    try {
      const { data } = await getStudy();
      notes = {};
      const secs = Array.isArray(data.sections) ? data.sections : [];
      secs.forEach((s) => {
        const i = (s.id | 0) - 1;
        if (i >= 0 && i < N) {
          notes[i] = (String(s.content || "").trim());
        }
      });

      // ---- Injection du texte biblique sous la prière
      try {
        const hasVerse = verseSelect && verseSelect.value && Number(verseSelect.value) > 0;
        if (hasVerse) {
          const req = await postJSON("/api/verse", {
            book: bookSelect.value,
            chapter: Number(chapterSelect.value || 1),
            verse: Number(verseSelect.value),
            version: (versionSelect && versionSelect.value) || "LSG"
          }, 2);
          const ctV = req.headers.get("Content-Type") || "";
          if (/application\/json/i.test(ctV)) {
            const j = await req.json().catch(() => null);
            if (j && j.ok && j.text) {
              const verseBlock = [
                "",
                `➡ Lecture : https://www.biblegateway.com/passage/?search=${encodeURIComponent(j.reference)}&version=${encodeURIComponent(j.version || "LSG")}`,
                "",
                `— **Texte biblique** (${j.reference}, ${j.version || "LSG"})`,
                j.text
              ].join("\n");
              if (!notes[0] || !notes[0].trim()) notes[0] = "…";
              notes[0] = dedupeParagraphs(
                ensureLinksLineBreaks((notes[0] + "\n\n" + verseBlock).trim())
              );
            }
          }
        }
      } catch (e) {
        dlog(`[VERSE] erreur: ${String(e && e.message || e)}`);
      }

      // ---- Defaults (sans écraser prière générée)
      if (!notes[2] || !notes[2].trim()) notes[2] = "Révision: …";
      if (!notes[27] || !notes[27].trim()) notes[27] = "Prière de fin: …";

      // ---- Filtre anti-phrases génériques
      if (notes[0]) {
        const banned = [
          "nous nous approchons de toi pour méditer",
          "ouvre notre intelligence",
          "purifie nos intentions",
          "fais naître en nous l’amour de ta volonté",
          "Que ta Parole façonne notre pensée, notre prière et nos décisions.",
          "Que ton Esprit ouvre nos yeux, oriente notre volonté et établisse en nous une obéissance joyeuse."
        ];
        let t = notes[0];
        banned.forEach(ph => {
          const re = new RegExp(ph.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
          t = t.replace(re, "");
        });
        notes[0] = t.trim().replace(/\n{3,}/g, "\n\n");
      }

      // rendu simple
      select(0);
      dlog("[GEN] étude générée");
    } catch (e) {
      console.error(e);
      alert(String(e.message || e));
    } finally {
      busy(generateBtn, false);
      inFlight = false;
    }
  }

  // init
  generateBtn && generateBtn.addEventListener("click", generateStudy);
})();

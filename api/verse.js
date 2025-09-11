<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Étude verset par verset</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap" rel="stylesheet"/>
  <style>
    :root{ --border:#e5e7eb; --link:#2563eb; }
    body{font-family:Inter,system-ui,Segoe UI,Roboto,Arial,sans-serif;margin:0;background:#f6f8fb;color:#0f172a}
    header{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--border);padding:14px}
    h1{margin:0;font-size:20px;font-weight:800;text-align:center}
    .topnav{display:flex;gap:10px;justify-content:center;margin-top:8px}
    .topnav a{color:var(--link);text-decoration:underline}
    main{max-width:900px;margin:20px auto;padding:0 12px}
    .controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px}
    label{display:flex;gap:8px;align-items:center;background:#fff;border:1px solid var(--border);border-radius:12px;padding:8px 10px}
    input,button,a.btn{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:#fff}
    button{cursor:pointer}
    a.btn{display:inline-flex;align-items:center;gap:6px;text-decoration:none;color:#0f172a}
    .pv-grid{display:grid;grid-template-columns:1fr;gap:10px}
    .pv-item{padding:10px;border:1px solid var(--border);border-radius:10px;background:#fff}
    .vhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .vtitle{font-weight:700}
    .verse-link{color:var(--link);text-decoration:underline}
  </style>
</head>
<body>
  <header>
    <h1>Étude verset par verset (Rubrique 0)</h1>
    <div class="topnav">
      <a href="/index.html">← Revenir à l’étude 1–28</a>
    </div>
  </header>

  <main>
    <div class="controls">
      <label>Livre <input id="book" value="Genèse" style="width:160px"/></label>
      <label>Chapitre <input id="chapter" value="1" type="number" min="1" style="width:90px"/></label>
      <label>Nombre de versets <input id="count" value="31" type="number" min="1" max="200" style="width:100px"/></label>
      <button id="go">Charger</button>
      <a id="open-yv" class="btn" target="_blank" rel="noopener">YouVersion</a>
    </div>

    <div id="pv-grid" class="pv-grid"></div>
  </main>

  <script src="/js/app-verse.js" defer></script>
</body>
</html>

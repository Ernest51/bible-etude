<!DOCTYPE html>
<html lang="fr" class="h-full">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
  <title>Étude Biblique — 28 points</title>

  <!-- Ton CSS (facultatif si tu utilises Tailwind) -->
  <link rel="stylesheet" href="/dist/output.css" />

  <style>
    :root{
      --c50:#eef2ff;--c100:#e0e7ff;--c200:#c7d2fe;--c600:#4f46e5;--c700:#4338ca;--ink:#0f172a;
      --ok:#10b981;--err:#ef4444;
    }
    html,body{height:100%}
    body{margin:0;background:#f7f8ff;color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto}
    .wrap{max-width:1200px;margin:0 auto;padding:16px}
    .toolbar{display:flex;gap:8px;align-items:end;margin-bottom:12px}
    .field{display:flex;flex-direction:column;gap:6px}
    .label{font-size:.85rem;color:#334}
    .input{border:1px solid #e5e7eb;border-radius:.7rem;padding:.55rem .75rem;background:#fff;min-width:180px}
    .btn{display:inline-flex;align-items:center;gap:.5rem;padding:.6rem .9rem;border-radius:.8rem;background:var(--c600);color:#fff;font-weight:600;border:0;cursor:pointer}
    .btn.sec{background:#fff;color:var(--c700);border:1px solid #e5e7eb}
    .layout{display:grid;grid-template-columns:280px 1fr;gap:14px;min-height:70vh}
    .sidebar{background:#fff;border:1px solid #eef2ff;border-radius:12px;padding:8px;overflow:auto}
    .sidebar-item{display:flex;align-items:center;gap:.6rem;padding:.55rem .6rem;border-radius:.6rem;border:1px solid transparent;cursor:pointer;background:transparent}
    .sidebar-item:hover{background:#f8f9ff}
    .sidebar-item.active{background:#fff;border-color:#c7d2fe;box-shadow:0 6px 20px rgba(67,56,202,.08)}
    .badge{display:inline-grid;place-items:center;min-width:22px;height:22px;border-radius:999px;background:var(--c700);color:#fff;font-size:.75rem}
    .content{background:#fff;border:1px solid #eef2ff;border-radius:12px;padding:14px}
    .content-section{display:none}
    .content-section.active{display:block}
    .prose{white-space:pre-wrap;line-height:1.6}
    .hidden{display:none !important}

    /* Progress */
    #progressContainer{display:none;position:fixed;left:0;right:0;top:0;height:4px;background:#eef2ff;z-index:50}
    #progressBar{height:100%;width:0;background:var(--c700);transition:width .2s ease}

    /* Toasts */
    #toasts{position:fixed;right:1rem;bottom:1rem;display:flex;flex-direction:column;gap:.5rem;z-index:60}
    .toast{background:#111827;color:#fff;padding:.6rem .8rem;border-radius:.7rem;box-shadow:0 6px 20px rgba(0,0,0,.2)}

    /* Loader badge */
    #busy{display:inline-flex;align-items:center;gap:.5rem;font-size:.9rem;color:#

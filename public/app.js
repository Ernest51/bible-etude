// public/app.js
(() => {
  const state = {
    bootTime: new Date(),
    logs: [],
  };

  const log = (label, value) => {
    const line = `[${new Date().toISOString()}] ${label}: ${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`;
    state.logs.push(line);
    const panel = document.getElementById('debugPanel');
    if (panel) {
      panel.textContent = state.logs.join('\n');
    }
    // Garde une trace console aussi
    // eslint-disable-next-line no-console
    console.log(line);
  };

  const byId = (id) => document.getElementById(id);

  const safeFetch = async (url, options = {}, timeoutMs = 3000) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);
      return { ok: res.ok, status: res.status, url, text: await res.text() };
    } catch (err) {
      clearTimeout(t);
      return { ok: false, status: 0, url, error: String(err) };
    }
  };

  const runDiagnostics = async () => {
    log('Diagnostic', '--- DÉBUT ---');

    // 1) Infos basiques
    log('UserAgent', navigator.userAgent);
    log('Location', window.location.href);

    // 2) Vérifier que ce fichier est bien chargé
    log('JS Loaded', 'public/app.js chargé ✅');

    // 3) Vérifier quelques chemins courants (selon tes usages)
    // Si tu as une API serverless sur Vercel, elle serait exposée sous /api/xxx
    const candidates = [
      '/api/health',
      '/api/chat',
      '/api/ping'
    ];

    for (const path of candidates) {
      const res = await safeFetch(path, { method: 'GET' }, 2500);
      if (res.ok) {
        log('Endpoint OK', { path, status: res.status });
      } else {
        log('Endpoint KO', { path, status: res.status, error: res.error || res.text || 'inconnu' });
      }
    }

    // 4) Vérifier la présence de l’élément principal
    const header = document.querySelector('header');
    log('Header présent', Boolean(header));

    // 5) Résumé
    log('Diagnostic', '--- FIN ---');
  };

  const initUI = () => {
    const btn = byId('debugBtn');
    const panel = byI

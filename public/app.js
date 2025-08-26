// public/app.js — version robuste avec traces visibles
(() => {
  const state = {
    bootTime: new Date(),
    logs: [],
    ranOnce: false,
  };

  const byId = (id) => document.getElementById(id);

  const append = (text) => {
    const line = `[${new Date().toISOString()}] ${text}`;
    state.logs.push(line);
    const panel = byId('debugPanel');
    if (panel) panel.textContent = state.logs.join('\n');
    // Garde une trace console
    // eslint-disable-next-line no-console
    console.log(line);
  };

  const safeFetch = async (url, options = {}, timeoutMs = 3000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      const text = await res.text().catch(() => '');
      return { ok: res.ok, status: res.status, url,

/* app.js — UI conforme au runbook (diodes, Reset, POST /api/generate-study) */
(function () {
  // State
  const state = {
    book: 'Genèse',
    chapter: '1',
    density: 1500,
    sections: Array.from({ length: 28 }, (_, i) => ({
      id: i + 1, title: `Rubrique ${i + 1}`, content: ''
    })),
    current: 1
  };

  // DOM
  const $ = (s) => document.querySelector(s);
  const listEl   = $('#list');
  const edTitle  = $('#edTitle');
  const edMeta   = $('#edMeta');
  const editor   = $('#editor');
  const bookEl   = $('#book');
  const chapEl   = $('#chapter');
  const densEl   = $('#density');
  const genBtn   = $('#btn-generate');
  const resetBtn = $('#btn-reset');

  // Init
  document.addEventListener('DOMContentLoaded', () => {
    attachEvents();
    renderList();
    renderEditor();
  });

  function attachEvents() {
    bookEl.addEventListener('input', () => { state.book = bookEl.value || 'Genèse'; });
    chapEl.addEventListener('input', () => { state.chapter = chapEl.value || '1'; });
    densEl.addEventListener('change', () => { state.density = Number(densEl.value); });

    genBtn.addEventListener('click', onGenerate);
    resetBtn.addEventListener('click', onReset);
    editor.addEventListener('input', () => {
      const s = sectionById(state.current);
      if (!s) return;
      s.content = editor.value;
      updateDot(state.current);
    });
  }

  // Helpers
  function sectionById(id) { return state.sections.find(s => s.id === id); }

  function renderList() {
    listEl.innerHTML = '';
    for (const s of state.sections) {
      const row = document.createElement('div');
      row.className = 'item';
      row.dataset.id = s.id;

      const idx = document.createElement('div');
      idx.className = 'idx';
      idx.textContent = String(s.id);

      const title = document.createElement('div');
      title.className = 'title';
      title.textContent = s.title || `Rubrique ${s.id}`;

      const dot = document.createElement('div');
      dot.className = 'dot' + (s.content && s.content.trim() ? ' ok' : '');

      row.appendChild(idx);
      row.appendChild(title);
      row.appendChild(dot);

      row.addEventListener('click', () => {
        state.current = s.id;
        renderEditor();
        highlightActive();
      });

      listEl.appendChild(row);
    }
    highlightActive();
  }

  function highlightActive() {
    document.querySelectorAll('.item').forEach(el => {
      el.classList.toggle('active', Number(el.dataset.id) === state.current);
    });
  }

  function renderEditor() {
    const s = sectionById(state.current);
    edTitle.textContent = s ? (s.title || `Rubrique ${state.current}`) : '—';
    edMeta.textContent = `Point ${state.current} / 28`;
    editor.value = s ? (s.content || '') : '';
  }

  function updateDot(id) {
    const row = listEl.querySelector(`.item[data-id="${id}"]`);
    if (!row) return;
    const dot = row.querySelector('.dot');
    const s = sectionById(id);
    if (s && s.content && s.content.trim()) dot.classList.add('ok');
    else dot.classList.remove('ok');
  }

  async function onGenerate() {
    const passage = `${state.book.trim() || 'Genèse'} ${state.chapter.trim() || '1'}`;
    const density = state.density; // 500 / 1500 / 2500
    genBtn.disabled = true;
    const old = genBtn.textContent;
    genBtn.textContent = 'Génération…';

    try {
      const r = await fetch('/api/generate-study', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passage, options: { length: density } })
      });
      const data = await r.json();
      const sections = data?.study?.sections;
      if (!Array.isArray(sections) || sections.length !== 28) {
        throw new Error('Réponse invalide (sections.length != 28)');
      }
      // Injecte titres + contenus
      state.sections = sections.map((s, i) => ({
        id: Number(s.id) || (i + 1),
        title: s.title || `Rubrique ${i + 1}`,
        content: String(s.content || '')
      }));
      // Met à jour la liste + l’éditeur
      renderList();
      renderEditor();
      // Mémorise la dernière étude (non effacée par Reset)
      try {
        localStorage.setItem('Dernière étude', JSON.stringify({ passage, density, ts: new Date().toISOString() }));
      } catch {}
    } catch (e) {
      alert('Erreur: ' + e.message);
    } finally {
      genBtn.disabled = false;
      genBtn.textContent = old;
    }
  }

  function onReset() {
    // Orange partout, champs vidés, “Dernière étude” conservée
    state.sections = state.sections.map(s => ({ ...s, content: '' }));
    document.querySelectorAll('.dot').forEach(d => d.classList.remove('ok'));

    // Champs
    bookEl.value = 'Genèse';
    chapEl.value = '1';
    densEl.value = '1500';
    state.book = 'Genèse';
    state.chapter = '1';
    state.density = 1500;

    // Vue
    state.current = 1;
    renderList();
    renderEditor();
  }
})();

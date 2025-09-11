/* app-verse.js — Étude verset par verset (utilise /api/verses?book=&chapter=&count=) */
(function(){
  const $ = s => document.querySelector(s);

  function buildYVHref(book, c, v){
    const map={"Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT","1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH","Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC","Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN","Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB","Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN","Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH","Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI","2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE","1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"};
    const code = map[book] || 'GEN';
    return `https://www.bible.com/fr/bible/93/${code}.${c}.LSG${v?('#v'+v):''}`;
  }

  async function loadPV(){
    const book = $('#book').value.trim() || 'Genèse';
    const chapter = parseInt($('#chapter').value,10) || 1;
    const count = Math.max(1, Math.min(parseInt($('#count').value,10)||31, 200));
    $('#open-yv').href = buildYVHref(book, chapter, '');

    const grid = $('#pv-grid');
    grid.innerHTML = '<div class="pv-item">Chargement…</div>';

    try{
      const url = `/api/verses?book=${encodeURIComponent(book)}&chapter=${encodeURIComponent(chapter)}&count=${encodeURIComponent(count)}`;
      const r = await fetch(url);
      const ct = (r.headers.get('content-type')||'').toLowerCase();
      const text = await r.text();
      if (!ct.includes('application/json')) throw new Error('Réponse non-JSON: ' + text.slice(0,120));
      const data = JSON.parse(text);

      const verses = Array.isArray(data.verses) ? data.verses : [];
      grid.innerHTML = '';
      verses.slice(0, count).forEach(({v,text,noteHTML})=>{
        const item = document.createElement('div'); item.className='pv-item';
        item.innerHTML = `
          <div class="vhead">
            <div class="vtitle">${book} ${chapter}:${v}</div>
            <a class="verse-link" href="${buildYVHref(book, chapter, v)}" target="_blank" rel="noopener">YouVersion</a>
          </div>
          <div style="font-weight:600">${text || '— (texte indisponible ici, voir YouVersion)'}</div>
          <div style="margin-top:6px">${noteHTML || '<em style="color:#64748b">noteHTML manquante (fallback côté front)</em>'}</div>
        `;
        grid.appendChild(item);
      });

      if (!verses.length) {
        grid.innerHTML = '<div class="pv-item" style="color:#b91c1c">Aucun verset disponible (vérifie API_BIBLE_KEY / API_BIBLE_ID ou utilise le fallback avec ?count=…)</div>';
      }

    } catch(e){
      grid.innerHTML = `<div class="pv-item" style="color:#b91c1c">Erreur: ${e.message}</div>`;
    }
  }

  document.addEventListener('DOMContentLoaded', ()=>{
    $('#go').addEventListener('click', loadPV);
    loadPV();
  });
})();

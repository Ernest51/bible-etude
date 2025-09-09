/* app.js — Mode “sûr” : rend les 28 rubriques + descriptions dès le chargement, avec panneau Debug. */

(function () {
  // ---------- Debug léger ----------
  function addDebug() {
    if (document.getElementById('debugMini')) return;
    const box = document.createElement('pre');
    box.id = 'debugMini';
    box.style.cssText = 'position:fixed;bottom:8px;left:8px;right:8px;max-height:30vh;overflow:auto;background:#0b1020;color:#cbd5e1;padding:8px 10px;border-radius:8px;font-size:12px;z-index:9999;opacity:.9';
    box.textContent = 'Debug: init…\n';
    document.body.appendChild(box);
  }
  function log(...a){ try{ const b=document.getElementById('debugMini'); if(b){ b.textContent += a.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ')+'\n'; b.scrollTop=b.scrollHeight; } }catch{} }

  const TITLES_DEFAULT = {
    1:"Prière d’ouverture",2:"Canon et testament",3:"Questions du chapitre précédent",4:"Titre du chapitre",
    5:"Contexte historique",6:"Structure littéraire",7:"Genre littéraire",8:"Auteur et généalogie",
    9:"Verset-clé doctrinal",10:"Analyse exégétique",11:"Analyse lexicale",12:"Références croisées",
    13:"Fondements théologiques",14:"Thème doctrinal",15:"Fruits spirituels",16:"Types bibliques",
    17:"Appui doctrinal",18:"Comparaison entre versets",19:"Comparaison avec Actes 2",20:"Verset à mémoriser",
    21:"Enseignement pour l’Église",22:"Enseignement pour la famille",23:"Enseignement pour enfants",
    24:"Application missionnaire",25:"Application pastorale",26:"Application personnelle",
    27:"Versets à retenir",28:"Prière de fin"
  };
  const DESCS_DEFAULT = {
    1:"Invocation du Saint-Esprit pour éclairer l’étude.",
    2:"Appartenance au canon (AT/NT).",
    3:"Questions à reprendre de l’étude précédente.",
    4:"Résumé doctrinal synthétique du chapitre.",
    5:"Période, géopolitique, culture, carte.",
    6:"Séquençage narratif et composition.",
    7:"Type de texte : narratif, poétique, prophétique…",
    8:"Auteur et lien aux patriarches (généalogie).",
    9:"Verset central du chapitre.",
    10:"Commentaire exégétique (original si utile).",
    11:"Mots-clés et portée doctrinale.",
    12:"Passages parallèles et complémentaires.",
    13:"Doctrines qui émergent du chapitre.",
    14:"Correspondance avec les grands thèmes doctrinaux.",
    15:"Vertus / attitudes visées.",
    16:"Figures typologiques et symboles.",
    17:"Passages d’appui concordants.",
    18:"Comparaison interne des versets.",
    19:"Parallèle avec Actes 2.",
    20:"Verset à mémoriser.",
    21:"Implications pour l’Église.",
    22:"Applications familiales.",
    23:"Pédagogie enfants (jeux, récits, symboles).",
    24:"Applications mission/évangélisation.",
    25:"Applications pastorales/enseignement.",
    26:"Application personnelle engagée.",
    27:"Versets utiles à retenir.",
    28:"Prière de clôture."
  };

  // Style pour forcer l’affichage des descriptions
  const style = document.createElement('style');
  style.textContent = `
    #pointsList .item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid var(--border,#e5e7eb);cursor:pointer}
    #pointsList .item.active{background:rgba(2,132,199,.08)}
    #pointsList .idx{width:26px;height:26px;border-radius:8px;background:var(--chip,#eef2ff);display:flex;align-items:center;justify-content:center;font-weight:600;color:#334155}
    #pointsList .txt{flex:1;min-width:0}
    #pointsList .txt>div{font-weight:600;color:#0f172a}
    #pointsList .txt .desc{display:block;margin-top:4px;font-size:12.5px;line-height:1.3;color:#64748b;white-space:normal}
    #pointsList .dot{width:8px;height:8px;border-radius:999px;background:#f59e0b;opacity:.9}
    #pointsList .dot.ok{background:#10b981}
  `;
  document.head.appendChild(style);

  // Rendu minimal (aucune dépendance à l’API)
  function renderStatic(){
    const pointsList = document.querySelector('#pointsList');
    const edTitle    = document.querySelector('#edTitle');
    const noteView   = document.querySelector('#noteView');
    const prevBtn    = document.querySelector('#prev');
    const nextBtn    = document.querySelector('#next');

    const missing = [];
    if (!pointsList) missing.push('#pointsList');
    if (!edTitle)    missing.push('#edTitle');
    if (!noteView)   missing.push('#noteView');
    if (missing.length){
      log('❌ Éléments manquants dans le HTML :', missing.join(', '));
      log('➡️ Vérifie les IDs dans ton index.html / layout (sidebar = #pointsList, titre = #edTitle, contenu = #noteView).');
      return;
    }

    // état local très simple
    const state = { idx: 0, book: 'Genèse', chapter: 1 };

    function getTitle(n){ return TITLES_DEFAULT[n] || `Point ${n}`; }
    function getDesc(n){ return DESCS_DEFAULT[n] || ''; }

    function renderList(){
      pointsList.innerHTML = '';
      // Rubrique 0 (panorama)
      pointsList.appendChild(makeItem(0, 'Rubrique 0 — Panorama des versets du chapitre', 'Aperçu du chapitre verset par verset'));
      // 1..28
      for (let i=1;i<=28;i++){
        pointsList.appendChild(makeItem(i, getTitle(i), getDesc(i)));
      }
      highlight();
    }
    function makeItem(idx, title, desc){
      const li = document.createElement('div'); li.className='item'; li.dataset.idx=String(idx);
      const sIdx = document.createElement('div'); sIdx.className='idx'; sIdx.textContent=String(idx);
      const txt  = document.createElement('div'); txt.className='txt';
      txt.innerHTML = `<div>${escapeHtml(title)}</div>${desc?`<span class="desc">${escapeHtml(desc)}</span>`:''}`;
      const dot  = document.createElement('div'); dot.className='dot'+(idx? '':' ok');
      li.appendChild(sIdx); li.appendChild(txt); li.appendChild(dot);
      li.addEventListener('click', ()=>goTo(idx));
      return li;
    }
    function highlight(){
      document.querySelectorAll('#pointsList .item').forEach(el=>{
        el.classList.toggle('active', Number(el.dataset.idx)===state.idx);
      });
    }
    function goTo(idx){
      if (idx<0) idx=0; if (idx>28) idx=28; state.idx=idx;
      updateHeader(); renderNote(); highlight();
    }
    function updateHeader(){
      const title = state.idx===0 ? 'Rubrique 0 — Panorama des versets du chapitre' : getTitle(state.idx);
      edTitle.textContent = title;
    }
    function renderNote(){
      if (state.idx===0){
        noteView.innerHTML = `
          <h3>Rubrique 0 — Panorama des versets du chapitre</h3>
          <p><em>Référence :</em> ${state.book} ${state.chapter}</p>
          <p>Clique sur <strong>Générer</strong> pour charger les versets avec explications.</p>
        `;
      } else {
        noteView.innerHTML = `
          <h3>${escapeHtml(getTitle(state.idx))}</h3>
          <p><em>Référence :</em> ${state.book} ${state.chapter}</p>
          <p>Contenu à générer…</p>
        `;
      }
    }

    // boutons nav s’ils existent
    if (prevBtn) prevBtn.onclick = ()=>goTo(state.idx-1);
    if (nextBtn) nextBtn.onclick = ()=>goTo(state.idx+1);

    renderList(); updateHeader(); renderNote();
    log('✅ Rendu statique OK (28 rubriques + descriptions).');
  }

  function escapeHtml(s){return String(s).replace(/[&<>"']/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));}

  // Lancement
  document.addEventListener('DOMContentLoaded', () => {
    try{
      addDebug();
      renderStatic();
    }catch(e){
      addDebug(); 
      log('💥 Exception au init:', String(e && e.message || e));
    }
  });
})();

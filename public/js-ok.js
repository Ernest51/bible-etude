(function(){
  const s = document.getElementById('js-status');
  const e = document.getElementById('err');
  function setOK(msg){ s.textContent = msg; s.className = 'mono ok'; }
  function setKO(msg){ s.textContent = msg; s.className = 'mono ko'; }
  window.addEventListener('error', ev=>{
    setKO('Erreur JS: ' + (ev?.message || 'inconnue'));
    e.textContent = (ev?.filename||'') + ':' + (ev?.lineno||'') + ' — ' + (ev?.message||'');
  });
  try{
    setOK('JS chargé ✔ (' + new Date().toISOString() + ')');
    console.log('js-ok.js: chargé');
  }catch(err){ setKO(String(err)); }
})();

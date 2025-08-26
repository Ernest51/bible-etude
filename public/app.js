// public/app.js — même debug, mais externe
(function(){
  const btn = document.getElementById('debugBtn');
  const panel = document.getElementById('debugPanel');

  function log(msg){
    const line = '['+new Date().toISOString()+'] '+msg;
    panel.textContent += (panel.textContent ? '\n' : '') + line;
    console.log(line);
  }

  async function ping(path, options, label){
    try{
      const c = new AbortController();
      const t = setTimeout(()=>c.abort(),2500);
      const r = await fetch(path,{...(options||{}), signal:c.signal});
      clearTimeout(t);
      const txt = await r.text().catch(()=> '');
      log((r.ok?'OK ':'KO ') + (label||path) + ' → ' + r.status + (txt ? ' | body: ' + txt.slice(0,120) : ''));
    }catch(e){
      log('KO ' + (label||path) + ' → ' + String(e));
    }
  }

  function toggle(){
    const open = panel.style.display==='block';
    if(open){
      panel.style.display='none';
      btn.setAttribute('aria-expanded','false');
      btn.textContent='✅ Ouvrir le Debug';
    }else{
      panel.style.display='block';
      btn.setAttribute('aria-expanded','true');
      btn.textContent='Fermer le Debug';
      if(panel.textContent==='[init]'){ panel.textContent='[Debug démarré…]'; }
      log('--- DÉBUT DIAGNOSTIC ---');
      log('JS chargé depuis public/app.js ✅');
      log('Location: ' + window.location.href);
      log('UA: ' + navigator.userAgent);
      ping('/api/health');
      ping('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({test:true,ts:Date.now()})},'/api/chat (POST)');
      ping('/api/ping');
      log('Header présent: ' + Boolean(document.querySelector('header')));
      log('--- FIN DIAGNOSTIC ---');
    }
  }

  if(!btn || !panel){
    console.error('Éléments debug introuvables'); return;
  }
  panel.style.display='none';
  btn.setAttribute('aria-expanded','false');
  btn.addEventListener('click', toggle);
  console.log('🟢 app.js prêt');
})();

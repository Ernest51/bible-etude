// public/app.js — Version "zéro impact": FAB + tiroir en Shadow DOM (aucune modif de ta mise en page)
(function () {
  /* ---------- utils ---------- */
  function $(s, r){return (r||document).querySelector(s);}
  function readSel(sel, def){
    if(!sel) return def||""; var i=sel.selectedIndex>=0?sel.selectedIndex:0; var o=sel.options[i];
    return String((o&&(o.text||o.value))||(def||"")).trim();
  }
  function escapeHtml(s){s=String(s||"");return s.replace(/&/g,"&amp;").replace(/</g,"&lt;")
    .replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}

  /* ---------- trouve les selects existants (lecture uniquement) ---------- */
  function findBookSelect(){
    var ids=["bookSelect","livre","book"]; for(var i=0;i<ids.length;i++){var el=$("#"+ids[i]); if(el) return el;}
    var sels=document.querySelectorAll("select");
    for(var j=0;j<sels.length;j++){
      var t=[].slice.call(sels[j].options).map(o=>(o.text||o.value||"").toLowerCase()).join("|");
      if(/gen[eè]se|psaumes|matthieu|apocalypse/.test(t)) return sels[j];
    }
    return null;
  }
  function findChapterSelect(){
    var ids=["chapterSelect","chapitre","chapter"]; for(var i=0;i<ids.length;i++){var el=$("#"+ids[i]); if(el) return el;}
    var sels=document.querySelectorAll("select");
    for(var j=0;j<sels.length;j++){
      var first=[].slice.call(sels[j].options).slice(0,10).map(o=>(o.value||o.text||"").trim());
      var nums=first.filter(v=>/^\d+$/.test(v)).length;
      if(nums>=6) return sels[j];
    }
    return null;
  }
  function findVersionSelect(){
    var ids=["versionSelect","version"]; for(var i=0;i<ids.length;i++){var el=$("#"+ids[i]); if(el) return el;}
    var sels=document.querySelectorAll("select");
    for(var j=0;j<sels.length;j++){
      var t=[].slice.call(sels[j].options).map(o=>(o.text||"").toLowerCase()).join("|");
      if(/segond|darby|ostervald|neg|bds|s21|pdv/.test(t)) return sels[j];
    }
    return null;
  }
  var S_BOOK = findBookSelect();
  var S_CHAP = findChapterSelect();
  var S_VERSI = findVersionSelect();

  function versionToApiLabel(v){
    var t=String(v||"").toLowerCase();
    if(/darby|jnd/.test(t)) return {translation:"JND", bibleId:"a93a92589195411f-01"};
    if(/segond|lsg/.test(t)) return {translation:"LSG", bibleId:""};
    return {translation:"JND", bibleId:"a93a92589195411f-01"};
  }

  /* ---------- Shadow host commun ---------- */
  var host=document.createElement("div");
  host.id="study28-shadow-host";
  document.body.appendChild(host);
  var root=host.attachShadow({mode:"open"});

  /* ---------- styles (scopés) ---------- */
  var css=document.createElement("style");
  css.textContent = `
    :host{all:initial}
    .fab{position:fixed;right:20px;bottom:20px;z-index:2147483636;
      width:56px;height:56px;border-radius:999px;
      background:#0b1220;color:#fff;border:1px solid #1f2937;display:flex;
      align-items:center;justify-content:center;font-weight:800;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.35)}
    .fab:hover{filter:brightness(1.1)}
    .overlay{position:fixed;inset:0;background:rgba(2,6,23,.55);opacity:0;pointer-events:none;transition:.2s;z-index:2147483637}
    .drawer{position:fixed;top:0;right:-720px;width:min(720px,92vw);height:100vh;background:#0b1220;color:#e2e8f0;
      box-shadow:-10px 0 28px rgba(0,0,0,.4);transition:right .25s ease;z-index:2147483638;display:flex;flex-direction:column}
    .open .overlay{opacity:1;pointer-events:auto}
    .open .drawer{right:0}
    .head{padding:12px 16px;border-bottom:1px solid #1f2937;display:flex;gap:10px;align-items:center}
    .title{font-weight:800}
    .meta{color:#93a3b8}
    .status{margin-left:auto;font-weight:700}
    .btn{appearance:none;background:#60a5fa;border:none;color:#031225;padding:8px 12px;border-radius:10px;font-weight:700;cursor:pointer}
    .ghost{background:#0f172a;color:#cbd5e1;border:1px solid #1f2937}
    .body{flex:1;min-height:0;display:grid;grid-template-columns:280px 1fr}
    .list{border-right:1px solid #1f2937;overflow:auto}
    .item{display:block;width:100%;text-align:left;padding:10px 12px;background:transparent;border:none;color:#e2e8f0;cursor:pointer;border-bottom:1px dashed #1f2937}
    .item.active{background:#0f172a}
    .main{padding:16px;overflow:auto}
    .main h3{margin:0 0 8px;font-size:18px}
  `;
  root.appendChild(css);

  /* ---------- FAB ---------- */
  var fab=document.createElement("button");
  fab.className="fab";
  fab.title="Étude auto (28)";
  fab.textContent="28";
  root.appendChild(fab);

  /* ---------- overlay + drawer ---------- */
  var overlay=document.createElement("div"); overlay.className="overlay";
  var drawer=document.createElement("div"); drawer.className="drawer";
  var head=document.createElement("div"); head.className="head";
  var title=document.createElement("span"); title.className="title"; title.textContent="Étude (28 points)";
  var meta=document.createElement("span"); meta.className="meta"; meta.textContent="";
  var status=document.createElement("span"); status.className="status"; status.textContent="";
  var close=document.createElement("button"); close.className="btn ghost"; close.textContent="Fermer";
  head.appendChild(title); head.appendChild(meta); head.appendChild(status); head.appendChild(close);

  var body=document.createElement("div"); body.className="body";
  var list=document.createElement("div"); list.className="list";
  var main=document.createElement("div"); main.className="main"; main.innerHTML="<em>Clique le bouton 28 pour générer.</em>";
  body.appendChild(list); body.appendChild(main);
  drawer.appendChild(head); drawer.appendChild(body);
  root.appendChild(overlay); root.appendChild(drawer);

  function openDrawer(){ host.classList.add("open"); }
  function closeDrawer(){ host.classList.remove("open"); }
  overlay.addEventListener("click", closeDrawer);
  close.addEventListener("click", closeDrawer);

  function setStatus(msg, ok){ status.textContent=msg||""; status.style.color = ok===false ? "#ef4444" : "#22c55e"; }
  function setMeta(text){ meta.textContent=text||""; }

  function renderSections(payload){
    var metaObj=(payload&&payload.meta)||{};
    var sections=(payload&&payload.sections)||[];
    setMeta(sections.length?("OSIS: "+(metaObj.osis||"?")+" · Trad: "+(metaObj.translation||"")):"");
    list.innerHTML="";
    function show(idx){
      var s=null,i; for(i=0;i<sections.length;i++){ if(sections[i].index===idx){ s=sections[i]; break; } }
      if(!s){ main.innerHTML="<em>Aucune section</em>"; return; }
      main.innerHTML="<h3>"+escapeHtml(s.index+". "+(s.title||""))+"</h3><p style='white-space:pre-wrap;line-height:1.5'>"+escapeHtml(s.content||"")+"</p>"+
        (s.verses&&s.verses.length?("<div style='color:#a5b4fc;margin-top:6px'>Versets : "+s.verses.map(escapeHtml).join(", ")+"</div>"):"");
      var btns=list.querySelectorAll(".item"); for(i=0;i<btns.length;i++){ btns[i].classList.remove("active"); }
      var cur=list.querySelector('.item[data-idx="'+idx+'"]'); if(cur) cur.classList.add("active");
    }
    for(var k=0;k<sections.length;k++){
      var b=document.createElement("button"); b.className="item"; b.setAttribute("data-idx", String(sections[k].index));
      b.textContent=sections[k].index+". "+(sections[k].title||"");
      b.addEventListener("click",(function(n){return function(){show(n);};})(sections[k].index));
      list.appendChild(b);
    }
    if(sections.length) show(1); else main.innerHTML="<em>Aucune section</em>";
  }

  function runStudy(){
    openDrawer(); setStatus("génération…", true); setMeta("");
    var book = S_BOOK ? readSel(S_BOOK,"Genèse") : "Genèse";
    var chapter = S_CHAP ? readSel(S_CHAP,"1") : "1";
    var verInfo = versionToApiLabel(S_VERSI ? readSel(S_VERSI,"LSG") : "LSG");
    var qs = "book="+encodeURIComponent(book)+"&chapter="+encodeURIComponent(chapter)+
             "&translation="+encodeURIComponent(verInfo.translation)+
             (verInfo.bibleId ? "&bibleId="+encodeURIComponent(verInfo.bibleId) : "")+
             "&trace=1";
    fetch("/api/study-28?"+qs, {headers:{accept:"application/json"}, cache:"no-store"})
      .then(r=>r.json().catch(()=>null).then(j=>({r,j})))
      .then(p=>{
        if(!p.j || !p.j.ok){ setStatus(p.j&&p.j.error ? p.j.error : ("HTTP "+(p.r?p.r.status:"?")), false); return; }
        var ref=(p.j.data && p.j.data.meta && p.j.data.meta.reference) || (book+" "+chapter);
        setStatus("Étude de "+ref, true);
        renderSections(p.j.data||{});
      })
      .catch(e=>setStatus(e&&e.message||String(e), false));
  }

  fab.addEventListener("click", runStudy);

  /* BONUS: raccourci clavier Alt+E pour ouvrir sans FAB */
  window.addEventListener("keydown", function(ev){
    if(ev.altKey && (ev.key==="e" || ev.key==="E")){ runStudy(); }
  });
})();

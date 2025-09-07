// public/app.js — ES5, tiroir latéral isolé (Shadow DOM) pour l'étude 28 pts
(function () {
  /* ========= 0) utilitaires ========= */
  function $(s, r){return (r||document).querySelector(s);}
  function $all(s, r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
  function txt(n){return (n && (n.textContent||n.innerText)||"").trim();}
  function escapeHtml(s){s=String(s||"");return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
  function readSel(sel, def){if(!sel) return def||""; var i=sel.selectedIndex>=0?sel.selectedIndex:0; var o=sel.options[i]; return String((o&&(o.text||o.value))||def||"").trim();}

  /* ========= 1) données livres ========= */
  var BOOKS=[["Genèse",50],["Exode",40],["Lévitique",27],["Nombres",36],["Deutéronome",34],["Josué",24],["Juges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],["1 Rois",22],["2 Rois",25],["1 Chroniques",29],["2 Chroniques",36],["Esdras",10],["Néhémie",13],["Esther",10],["Job",42],["Psaumes",150],["Proverbes",31],["Ecclésiaste",12],["Cantique des cantiques",8],["Ésaïe",66],["Jérémie",52],["Lamentations",5],["Ézéchiel",48],["Daniel",12],["Osée",14],["Joël",3],["Amos",9],["Abdias",1],["Jonas",4],["Michée",7],["Nahoum",3],["Habacuc",3],["Sophonie",3],["Aggée",2],["Zacharie",14],["Malachie",4],["Matthieu",28],["Marc",16],["Luc",24],["Jean",21],["Actes",28],["Romains",16],["1 Corinthiens",16],["2 Corinthiens",13],["Galates",6],["Éphésiens",6],["Philippiens",4],["Colossiens",4],["1 Thessaloniciens",5],["2 Thessaloniciens",3],["1 Timothée",6],["2 Timothée",4],["Tite",3],["Philémon",1],["Hébreux",13],["Jacques",5],["1 Pierre",5],["2 Pierre",3],["1 Jean",5],["2 Jean",1],["3 Jean",1],["Jude",1],["Apocalypse",22]];

  /* ========= 2) trouve les <select> existants ========= */
  function byIds(ids){for(var i=0;i<ids.length;i++){var el=$("#"+ids[i]);if(el) return el;}return null;}
  function norm(s){return String(s||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();}
  function findBookSelect(){
    var s=byIds(["bookSelect","livre","book"]); if(s) return s;
    var sels=$all("select");
    for(var i=0;i<sels.length;i++){
      var opts=$all("option",sels[i]).map(function(o){return (o.text||o.value||"").toLowerCase();}).join("|");
      if(/gen[eè]se|psaumes|matthieu|romains|apocalypse/.test(opts)) return sels[i];
    } return null;
  }
  function findChapterSelect(){
    var s=byIds(["chapterSelect","chapitre","chapter"]); if(s) return s;
    var sels=$all("select");
    for(var i=0;i<sels.length;i++){
      var first=$all("option",sels[i]).slice(0,12).map(function(o){return (o.value||o.text||"").trim();});
      var nums=first.filter(function(v){return /^\d+$/.test(v);}).length;
      if(nums>=Math.max(5,Math.floor(first.length*0.6))) return sels[i];
    } return null;
  }
  function findVerseSelect(){return byIds(["verseSelect","verset","verse"]);}
  function findVersionSelect(){
    var s=byIds(["versionSelect","version"]); if(s) return s;
    var sels=$all("select");
    for(var i=0;i<sels.length;i++){
      var opts=$all("option",sels[i]).map(function(o){return (o.text||"").toLowerCase();}).join("|");
      if(/segond|darby|ostervald|neg|pdv|s21|bds/.test(opts)) return sels[i];
    } return null;
  }

  var S_BOOK=findBookSelect();
  var S_CHAP=findChapterSelect();
  var S_VERS=findVerseSelect();
  var S_VERSI=findVersionSelect();

  function renderBooks(sel,def){
    if(!sel) return;
    sel.innerHTML=""; for(var i=0;i<BOOKS.length;i++){ var o=document.createElement("option"); o.value=o.text=BOOKS[i][0]; sel.appendChild(o); }
    if(def){ for(var j=0;j<sel.options.length;j++){ if(sel.options[j].text===def){ sel.selectedIndex=j; break; } } }
  }
  function renderChapters(sel,book){
    if(!sel) return;
    var max=50; for(var i=0;i<BOOKS.length;i++){ if(BOOKS[i][0]===book){max=BOOKS[i][1];break;} }
    sel.innerHTML=""; for(var k=1;k<=max;k++){ var o=document.createElement("option"); o.value=o.text=String(k); sel.appendChild(o); }
  }
  function renderVerses(sel,book){
    if(!sel) return;
    var max=(book==="Psaumes")?200:60; sel.innerHTML="";
    for(var k=1;k<=max;k++){ var o=document.createElement("option"); o.value=o.text=String(k); sel.appendChild(o); }
  }
  var defBook=(S_BOOK&&readSel(S_BOOK))||"Genèse";
  renderBooks(S_BOOK,defBook);
  renderChapters(S_CHAP, readSel(S_BOOK,"Genèse"));
  renderVerses(S_VERS, readSel(S_BOOK,"Genèse"));
  if(S_BOOK) S_BOOK.addEventListener("change", function(){ var b=readSel(S_BOOK,"Genèse"); renderChapters(S_CHAP,b); renderVerses(S_VERS,b); });

  /* ========= 3) BibleGateway ========= */
  function versionToBGW(v){
    var t=String(v||"").toLowerCase();
    if(/darby|jnd/.test(t)) return "DARBY";
    if(/segond|lsg/.test(t)) return "LSG";
    if(/neg/.test(t)) return "NEG1979";
    if(/bds/.test(t)) return "BDS";
    if(/s21/.test(t)) return "S21";
    if(/pdv/.test(t)) return "PDV-FR";
    return "LSG";
  }
  function refString(){
    var b=readSel(S_BOOK,"Genèse"), c=readSel(S_CHAP,"1"), v=readSel(S_VERS,"");
    return b+" "+c+(v?":"+v:"");
  }
  function openBG(){
    var ref=refString();
    var ver=versionToBGW(readSel(S_VERSI,"LSG"));
    var url="https://www.biblegateway.com/passage/?search="+encodeURIComponent(ref)+"&version="+encodeURIComponent(ver);
    window.open(url,"_blank","noopener");
  }
  var BTN_READ=byIds(["readBtn","lire","validateBtn","valider"]);
  if(BTN_READ) BTN_READ.addEventListener("click", openBG);

  /* ========= 4) Tiroir latéral Shadow DOM pour l'étude ========= */
  function makeDrawer(){
    var host=document.createElement("div");
    host.setAttribute("id","study28-drawer-host");
    document.body.appendChild(host);
    var root=host.attachShadow({mode:"open"});

    var style=document.createElement("style");
    style.textContent=
      ":host{all:initial}" +
      ".overlay{position:fixed;inset:0;background:rgba(2,6,23,.5);opacity:0;pointer-events:none;transition:.2s;z-index:2147483637}" +
      ".drawer{position:fixed;top:0;right:-720px;width:min(720px,92vw);height:100vh;background:#0b1220;color:#e2e8f0;" +
      "box-shadow:-8px 0 24px rgba(0,0,0,.35);transition:right .25s ease;z-index:2147483638;display:flex;flex-direction:column;}" +
      ".head{padding:12px 16px;border-bottom:1px solid #1f2937;display:flex;gap:10px;align-items:center}" +
      ".title{font-weight:800}.meta{color:#93a3b8}.status{margin-left:auto;font-weight:700}" +
      ".body{flex:1;min-height:0;display:grid;grid-template-columns:280px 1fr}" +
      ".list{border-right:1px solid #1f2937;overflow:auto}" +
      ".item{display:block;width:100%;text-align:left;padding:10px 12px;background:transparent;border:none;color:#e2e8f0;cursor:pointer;border-bottom:1px dashed #1f2937}" +
      ".item.active{background:#0f172a}" +
      ".main{padding:16px;overflow:auto}" +
      ".main h3{margin:0 0 8px;font-size:18px}" +
      ".btn{appearance:none;background:#60a5fa;border:none;color:#031225;padding:8px 12px;border-radius:10px;font-weight:700;cursor:pointer}" +
      ".ghost{background:#0f172a;color:#cbd5e1;border:1px solid #1f2937}" +
      ".close{margin-left:8px}" +
      ".open .overlay{opacity:1;pointer-events:auto}" +
      ".open .drawer{right:0}";
    var overlay=document.createElement("div"); overlay.className="overlay";
    var drawer=document.createElement("div"); drawer.className="drawer";

    var head=document.createElement("div"); head.className="head";
    var ttl=document.createElement("span"); ttl.className="title"; ttl.textContent="Étude (28 points)";
    var meta=document.createElement("span"); meta.className="meta"; meta.textContent="";
    var status=document.createElement("span"); status.className="status"; status.textContent="";
    var close=document.createElement("button"); close.className="btn ghost close"; close.textContent="Fermer";
    head.appendChild(ttl); head.appendChild(meta); head.appendChild(status); head.appendChild(close);

    var body=document.createElement("div"); body.className="body";
    var list=document.createElement("div"); list.className="list";
    var main=document.createElement("div"); main.className="main"; main.innerHTML="<em>Cliquer « Étude auto (28) »</em>";
    body.appendChild(list); body.appendChild(main);

    drawer.appendChild(head); drawer.appendChild(body);
    root.appendChild(style); root.appendChild(overlay); root.appendChild(drawer);

    function setStatus(msg, ok){ status.textContent=msg||""; status.style.color= ok===false ? "#ef4444" : "#22c55e"; }
    function setMeta(text){ meta.textContent=text||""; }
    function open(){ host.classList.add("open"); }
    function closeFn(){ host.classList.remove("open"); }
    overlay.addEventListener("click", closeFn); close.addEventListener("click", closeFn);

    function renderSections(payload){
      var metaObj=(payload&&payload.meta)||{};
      var sections=(payload&&payload.sections)||[];
      setMeta(sections.length?("OSIS: "+(metaObj.osis||"?")+" · Trad: "+(metaObj.translation||"")):"");
      list.innerHTML="";
      function show(idx){
        var s=null, i; for(i=0;i<sections.length;i++){ if(sections[i].index===idx){ s=sections[i]; break; } }
        if(!s){ main.innerHTML="<em>Aucune section</em>"; return; }
        main.innerHTML="<h3>"+escapeHtml(s.index+". "+(s.title||""))+"</h3><p style='white-space:pre-wrap;line-height:1.5'>"+escapeHtml(s.content||"")+"</p>"+(s.verses&&s.verses.length?("<div style='color:#a5b4fc;margin-top:6px'>Versets : "+s.verses.map(escapeHtml).join(", ")+"</div>"):"");
        var btns=$all(".item", list); for(i=0;i<btns.length;i++){ btns[i].classList.remove("active"); }
        var cur=$(".item[data-idx='"+idx+"']", list); if(cur) cur.classList.add("active");
      }
      for(var i=0;i<sections.length;i++){
        var b=document.createElement("button"); b.className="item"; b.setAttribute("data-idx", String(sections[i].index));
        b.textContent=sections[i].index+". "+(sections[i].title||"");
        b.addEventListener("click", (function(n){return function(){show(n);};})(sections[i].index));
        list.appendChild(b);
      }
      if(sections.length) show(1); else main.innerHTML="<em>Aucune section</em>";
    }

    return { open:open, close:closeFn, setStatus:setStatus, setMeta:setMeta, render:renderSections };
  }

  var drawer = makeDrawer();

  /* ========= 5) Bouton Étude auto (28) ========= */
  // essaie de le mettre à côté de “Générer”
  var BTN_GEN = $("#generateBtn") || $all("button,[role=button]").filter(function(b){ return /g[ée]n[ée]rer/i.test(txt(b)); })[0];
  var btnStudy=document.createElement("button");
  btnStudy.type="button"; btnStudy.className="btn-study28";
  btnStudy.textContent="Étude auto (28)";
  btnStudy.style.marginLeft="10px"; btnStudy.style.background="#0f172a"; btnStudy.style.color="#fff";
  btnStudy.style.border="1px solid #1f2937"; btnStudy.style.borderRadius="10px"; btnStudy.style.padding="8px 12px"; btnStudy.style.fontWeight="700"; btnStudy.style.cursor="pointer";
  if(BTN_GEN && BTN_GEN.parentElement){ BTN_GEN.parentElement.appendChild(btnStudy); }
  else { document.body.insertBefore(btnStudy, document.body.firstChild); }

  /* ========= 6) Appel /api/study-28 ========= */
  function runStudy(){
    drawer.open(); drawer.setStatus("génération…", true); drawer.setMeta(""); 
    var book=readSel(S_BOOK,"Genèse"), chapter=readSel(S_CHAP,"1"), verLbl=readSel(S_VERSI,"LSG");
    var translation=(/darby|jnd/i.test(verLbl)?"JND":(/segond|lsg/i.test(verLbl)?"LSG":"JND"));
    var bibleId=(translation==="JND"?"a93a92589195411f-01":""); // JND ⇒ Darby api.bible
    var qs="book="+encodeURIComponent(book)+"&chapter="+encodeURIComponent(chapter)+"&translation="+encodeURIComponent(translation)+(bibleId?"&bibleId="+encodeURIComponent(bibleId):"")+"&trace=1";
    fetch("/api/study-28?"+qs,{headers:{"accept":"application/json"},cache:"no-store"})
      .then(function(r){return r.json().catch(function(){return null;}).then(function(j){return {res:r,json:j};});})
      .then(function(p){
        var r=p.res, j=p.json;
        if(!j||!j.ok){ drawer.setStatus((j&&j.error)?j.error:("HTTP "+(r?r.status:"?")), false); return; }
        var ref=(j.data&&j.data.meta&&j.data.meta.reference)||(book+" "+chapter);
        drawer.setStatus("Étude de "+ref, true);
        drawer.render(j.data||{});
      })
      .catch(function(e){ drawer.setStatus(e&&e.message||String(e), false); });
  }
  btnStudy.addEventListener("click", runStudy);

  /* ========= 7) Petite recherche (facultatif) ========= */
  var SEARCH=$("#searchRef")||$("#search");
  if(SEARCH){
    SEARCH.addEventListener("keydown", function(e){
      if(e.key==="Enter"){
        var m=String(SEARCH.value||"").match(/^([\d]?\s*[A-Za-zÀ-ÿ'’\.\s]+)\s+(\d+)(?::(\d+))?/); if(!m) return;
        var name=(m[1]||"").trim(), chap=(m[2]||"1").trim();
        var target=null,i,j; for(i=0;i<BOOKS.length;i++){ if(norm(BOOKS[i][0]).indexOf(norm(name))===0){ target=BOOKS[i][0]; break; } }
        if(!target) return;
        if(S_BOOK){ for(j=0;j<S_BOOK.options.length;j++){ if(S_BOOK.options[j].text===target){ S_BOOK.selectedIndex=j; break; } } renderChapters(S_CHAP,target); renderVerses(S_VERS,target); }
        if(S_CHAP){ for(j=0;j<S_CHAP.options.length;j++){ if(S_CHAP.options[j].value===chap){ S_CHAP.selectedIndex=j; break; } } }
      }
    });
  }
})();

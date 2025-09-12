async function fetchChapter(book, chap){
  if (!KEY || !BIBLE_ID || !USFM[book]) throw new Error('API_BIBLE_KEY/ID manquants ou livre non mappé');
  const headers = { accept:'application/json', 'api-key': KEY };
  const chapterId = `${USFM[book]}.${chap}`;

  // utilitaire pour temporiser un peu
  const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));

  // A) essayer d’obtenir le chapitre au format texte (rapide)
  let content = '';
  try {
    const jChap = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}?contentType=text&includeVerseNumbers=true&includeTitles=false&includeNotes=false`,
      { headers, timeout: 14000, retries: 1 }
    );
    content = CLEAN(jChap?.data?.content || jChap?.data?.text || '');
  } catch {}

  // B) récupérer la liste des versets (ids + refs)
  let items = [];
  try {
    const jVerses = await fetchJson(
      `${API_ROOT}/bibles/${BIBLE_ID}/chapters/${chapterId}/verses`,
      { headers, timeout: 12000, retries: 1 }
    );
    items = Array.isArray(jVerses?.data) ? jVerses.data : [];
  } catch {}

  // C) extraction rapide depuis content si possible
  let verses = [];
  if (content){
    const split1 = content.split(/\s(?=\d{1,3}\s)/g).map(s=>s.trim());
    verses = split1.map(s => { 
      const m=s.match(/^(\d{1,3})\s+(.*)$/); 
      return m?{v:+m[1], text:CLEAN(m[2])}:null; 
    }).filter(Boolean);

    if (verses.length < Math.max(2, Math.floor((items.length||0)/3))) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while ((m = re.exec(content))) arr.push({ v:+m[1], text:CLEAN(m[2]) });
      if (arr.length) verses = arr;
    }
  }

  // D) **Plan B robuste** : si on n'a pas de texte exploitable, on va chercher chaque verset
  if ((!content || verses.length === 0) && items.length) {
    // batch simple (limite la pression réseau)
    const batchSize = 12;
    const collected = [];
    for (let i=0; i<items.length; i+=batchSize){
      const chunk = items.slice(i, i+batchSize);
      const part = await Promise.all(chunk.map(async (it) => {
        try {
          const jv = await fetchJson(
            `${API_ROOT}/bibles/${BIBLE_ID}/verses/${it.id}?contentType=text&includeTitles=false&includeNotes=false&includeVerseNumbers=false`,
            { headers, timeout: 9000, retries: 1 }
          );
          const raw = CLEAN(jv?.data?.text || jv?.data?.content || it?.reference || '');
          // déduit le numéro de verset
          const m1 = raw.match(/^\s*(\d{1,3})\s+(.*)$/);
          if (m1) return { v: +m1[1], text: (m1[2]||'').trim() };
          const m2 = String(it?.reference||'').match(/:(\d{1,3})$/);
          return { v: m2 ? +m2[1] : undefined, text: raw };
        } catch {
          // verset indisponible : on garde au moins le numéro
          const m2 = String(it?.reference||'').match(/:(\d{1,3})$/);
          return { v: m2 ? +m2[1] : undefined, text: '' };
        }
      }));
      collected.push(...part);
      // micro pause pour éviter un éventuel rate limit strict
      await sleep(60);
    }
    const clean = collected.filter(x=>Number.isFinite(x.v)).sort((a,b)=>a.v-b.v);
    verses = clean;
    // reconstitue un "content" minimal pour l’analyse sémantique
    content = clean.map(v => `${v.v} ${v.text}`).join(' ');
  }

  // E) Dernier fallback : au moins des numéros
  if (!verses.length && items.length){
    verses = items.map(v => {
      const ref = String(v?.reference||'');
      const m = ref.match(/:(\d+)(?:\D+)?$/);
      return { v: m ? +m[1] : null, text: '' };
    }).filter(x=>x.v);
  }

  return { ok: !!content || verses.length>0, content, verses, verseCount: items.length || verses.length || 0 };
}

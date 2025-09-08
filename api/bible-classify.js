// api/bible-classify.js
// Classement des 66 livres : nb de chapitres (local, immédiat) et nb de versets (via api.bible).
//
// Appels possibles :
//   /api/bible-classify?all=1
//   /api/bible-classify?all=1&includeVerses=1
//   /api/bible-classify?book=Genèse
//   /api/bible-classify?book=Luc&includeVerses=1
//   /api/bible-classify?all=1&includeVerses=1&sortBy=verses&order=desc
//
// Params :
//  - all=1                 -> Tous les livres (sinon utilise ?book=...)
//  - book=NomDuLivre       -> Un seul livre (tolère accents/espaces/majuscules)
//  - includeVerses=1       -> Calcule versets/chapitre via api.bible + total par livre
//  - sortBy=chapters|verses (def=chapters) -> champ de tri
//  - order=asc|desc        (def=desc)      -> ordre de tri
//
// Variables d’environnement requises (pour includeVerses=1) :
//  - API_BIBLE_KEY
//  - DARBY_BIBLE_ID   (ID de la Bible Darby FR dans api.bible)
//
// Réponse JSON :
// {
//   scope: "all" | "one",
//   includeVerses: boolean,
//   items: [{
//     book: "Genèse",
//     chaptersCount: 50,
//     versesTotal: 1533,                 // null si includeVerses=0
//     chapters: [{ number:1, verses:31}, ...] // vide si includeVerses=0
//   }, ...]
// }

export default async function handler(req, res) {
  try {
    const { all, book, includeVerses, sortBy = 'chapters', order = 'desc' } = req.query || {};
    const wantsAll = String(all || '') === '1';
    const wantsVerses = String(includeVerses || '') === '1';

    if (!wantsAll && !book) {
      return res.status(400).json({ error: 'Spécifie ?all=1 ou ?book=NomDuLivre' });
    }

    // Canon (66) + nb de chapitres
    const ORDER_66 = [
      "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth",
      "1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras","Néhémie","Esther",
      "Job","Psaumes","Proverbes","Ecclésiaste","Cantique des Cantiques","Ésaïe","Jérémie","Lamentations",
      "Ézéchiel","Daniel","Osée","Joël","Amos","Abdias","Jonas","Michée","Nahum","Habacuc","Sophonie",
      "Aggée","Zacharie","Malachie","Matthieu","Marc","Luc","Jean","Actes","Romains","1 Corinthiens",
      "2 Corinthiens","Galates","Éphésiens","Philippiens","Colossiens","1 Thessaloniciens","2 Thessaloniciens",
      "1 Timothée","2 Timothée","Tite","Philémon","Hébreux","Jacques","1 Pierre","2 Pierre",
      "1 Jean","2 Jean","3 Jean","Jude","Apocalypse"
    ];
    const CHAPTERS_66 = {
      "Genèse":50,"Exode":40,"Lévitique":27,"Nombres":36,"Deutéronome":34,"Josué":24,"Juges":21,"Ruth":4,
      "1 Samuel":31,"2 Samuel":24,"1 Rois":22,"2 Rois":25,"1 Chroniques":29,"2 Chroniques":36,"Esdras":10,
      "Néhémie":13,"Esther":10,"Job":42,"Psaumes":150,"Proverbes":31,"Ecclésiaste":12,"Cantique des Cantiques":8,
      "Ésaïe":66,"Jérémie":52,"Lamentations":5,"Ézéchiel":48,"Daniel":12,"Osée":14,"Joël":3,"Amos":9,"Abdias":1,
      "Jonas":4,"Michée":7,"Nahum":3,"Habacuc":3,"Sophonie":3,"Aggée":2,"Zacharie":14,"Malachie":4,"Matthieu":28,
      "Marc":16,"Luc":24,"Jean":21,"Actes":28,"Romains":16,"1 Corinthiens":16,"2 Corinthiens":13,"Galates":6,
      "Éphésiens":6,"Philippiens":4,"Colossiens":4,"1 Thessaloniciens":5,"2 Thessaloniciens":3,"1 Timothée":6,
      "2 Timothée":4,"Tite":3,"Philémon":1,"Hébreux":13,"Jacques":5,"1 Pierre":5,"2 Pierre":3,"1 Jean":5,
      "2 Jean":1,"3 Jean":1,"Jude":1,"Apocalypse":22
    };

    // Normalisation douce
    const norm = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'').replace(/\./g,'');
    const mapOrder = new Map(ORDER_66.map(n => [norm(n), n]));

    // Cible
    let targetBooks = [];
    if (wantsAll) {
      targetBooks = ORDER_66.slice();
    } else {
      const key = norm(book);
      const exact = mapOrder.get(key);
      if (exact) {
        targetBooks = [exact];
      } else {
        const guess = ORDER_66.find(n => norm(n).startsWith(key));
        if (!guess) return res.status(404).json({ error: `Livre introuvable: ${book}` });
        targetBooks = [guess];
      }
    }

    // Base : immédiat (chapitres)
    const base = targetBooks.map(name => ({
      book: name,
      chaptersCount: CHAPTERS_66[name] || 0,
      versesTotal: null,
      chapters: [] // { number, verses }
    }));

    // Si pas besoin des versets détaillés → tri simple et retour
    if (!wantsVerses) {
      const sorted = sortBooks(base, sortBy, order);
      return res.status(200).json({ scope: wantsAll ? 'all' : 'one', includeVerses: false, items: sorted });
    }

    // Besoin des versets → api.bible
    const API_KEY = process.env.API_BIBLE_KEY || '';
    const BIBLE_ID = process.env.DARBY_BIBLE_ID || '';
    if (!API_KEY || !BIBLE_ID) {
      return res.status(500).json({ error: 'API_BIBLE_KEY / DARBY_BIBLE_ID manquants (variables d’environnement).' });
    }

    // 1) Récupère la liste des livres de la version (pour obtenir leurs IDs)
    const booksFromApi = await fetchBooks(BIBLE_ID, API_KEY); // [{id, name}, ...]
    const booksIdMap = buildBooksIdMap(booksFromApi, ORDER_66);

    // 2) Pour chaque livre cible → lister chapitres → compter les versets de chaque chapitre
    for (const item of base) {
      const bookApiId = booksIdMap.get(item.book);
      if (!bookApiId) {
        // Si l’API n’a pas fait correspondre le nom, on garde les chapitres only
        continue;
      }

      const chapters = await fetchChapters(BIBLE_ID, API_KEY, bookApiId); // [{id, number}, ...]
      let totalVerses = 0;
      const chOut = [];

      // Pour éviter les explosions de requêtes, on itère proprement
      for (const ch of chapters) {
        const verses = await fetchVerses(BIBLE_ID, API_KEY, ch.id); // data: []
        const count = Array.isArray(verses) ? verses.length : 0;
        totalVerses += count;
        chOut.push({ number: toInt(ch.number) || chOut.length+1, verses: count });
      }

      // Tri et assignation
      item.chapters = chOut.sort((a,b)=>a.number-b.number);
      item.versesTotal = totalVerses;

      // Ajuste le chaptersCount si l’API en rapporte un autre nombre
      if (item.chapters.length > item.chaptersCount) {
        item.chaptersCount = item.chapters.length;
      }
    }

    const sorted = sortBooks(base, sortBy, order);
    return res.status(200).json({ scope: wantsAll ? 'all' : 'one', includeVerses: true, items: sorted });

  } catch (e) {
    console.error('[bible-classify] error', e);
    return res.status(500).json({ error: 'Erreur interne' });
  }
}

/* ============ Helpers ============ */

function sortBooks(arr, sortBy, order) {
  const key = (a) => {
    if (sortBy === 'verses') return a.versesTotal ?? -1;
    return a.chaptersCount || 0;
  };
  const out = arr.slice().sort((a,b)=> key(a)-key(b));
  if (String(order||'desc') === 'desc') out.reverse();
  return out;
}

function toInt(x){ const n = parseInt(x,10); return Number.isFinite(n) ? n : null; }

async function fetchJSON(url, headers) {
  const r = await fetch(url, { headers });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  return await r.json();
}

async function fetchBooks(bibleId, apiKey) {
  const j = await fetchJSON(
    `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/books`,
    { 'api-key': apiKey }
  );
  return j?.data || [];
}

function buildBooksIdMap(apiBooks, order66) {
  // Associe les noms de l’API (FR Darby) à nos 66 libellés
  const norm = (s) => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,'').replace(/\./g,'');
  const orderNorm = order66.map(n => [n, norm(n)]);
  const map = new Map(); // "Genèse" -> "BOOK-ID"

  for (const b of apiBooks) {
    const apiName = b.name || '';
    const apiN = norm(apiName);
    // 1) égalité stricte
    let found = orderNorm.find(([label, n]) => n === apiN);
    // 2) ou préfixe (au cas où l’API tronque)
    if (!found) found = orderNorm.find(([label, n]) => n.startsWith(apiN) || apiN.startsWith(n));
    if (found) {
      map.set(found[0], b.id);
    }
  }
  return map;
}

async function fetchChapters(bibleId, apiKey, bookId) {
  const j = await fetchJSON(
    `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/chapters?bookId=${encodeURIComponent(bookId)}`,
    { 'api-key': apiKey }
  );
  return j?.data?.map(c => ({ id:c.id, number:c.number })) || [];
}

async function fetchVerses(bibleId, apiKey, chapterId) {
  const j = await fetchJSON(
    `https://api.scripture.api.bible/v1/bibles/${encodeURIComponent(bibleId)}/chapters/${encodeURIComponent(chapterId)}/verses`,
    { 'api-key': apiKey }
  );
  return j?.data || [];
}

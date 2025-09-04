// /pages/api/chat.js  (ou /api/chat.js sur Vercel Edge Functions compatibles pages API)
export default async function handler(req, res) {
  // 0) Probe & method
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    return;
  }
  try {
    const body = req.body || {};
    if (body && body.probe) {
      res.status(200).json({ ok: true, source: 'probe', warn: '' });
      return;
    }

    // 1) Parse & guard
    const book = (body.book || '').toString().trim();
    const chapter = body.chapter !== undefined && body.chapter !== null
      ? body.chapter.toString().trim()
      : '';
    const verse = (body.verse ?? '').toString().trim();
    const version = (body.version || 'LSG').toString().trim();
    const directives = body.directives || {};

    if (!book || !chapter) {
      res.status(400).json({ ok: false, error: 'Missing book or chapter' });
      return;
    }

    // Helpers
    const reference = verse ? `${book} ${chapter}:${verse}` : `${book} ${chapter}`;

    function guessThemes(b, c, v) {
      const bLow = (b || '').toLowerCase();
      if (bLow.startsWith('gen') && (c === '1' || c === 1)) {
        return ['lumière et ténèbres', 'Parole qui ordonne'];
      }
      if ((bLow.startsWith('jean') || bLow.startsWith('john')) && (c === '3' || c === 3) && (v === '16')) {
        return ['amour de Dieu', 'foi'];
      }
      return ['alliance', 'grâce'];
    }

    const themes = guessThemes(book, chapter, verse);

    // 2) Section builders
    function escapeHtml(s) {
      return (s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function craftPrayer(reference, directives, themes) {
      // If a directive is provided, follow it: short, centered on love/faith if implied, closing respects 'Amen.' if present
      const d = (directives && directives.priere_ouverture) ? directives.priere_ouverture.toLowerCase() : '';
      const wantsAmenDot = d.includes('amen.');
      const wantsLove = d.includes('amour');
      const wantsFaith = d.includes('foi');

      if (d) {
        const bits = [];
        bits.push(`<p><strong>Dieu d'amour</strong>, nous venons à toi devant <strong>${escapeHtml(reference)}</strong>.</p>`);
        const middleParts = [];
        if (wantsLove) middleParts.push("ton amour");
        if (wantsFaith) middleParts.push("la foi");
        if (middleParts.length) {
          bits.push(`<p>Apprends-nous à accueillir ${escapeHtml(middleParts.join(' et '))} et à vivre selon ta Parole.</p>`);
        } else {
          // Generic short focus
          bits.push(`<p>Apprends-nous à recevoir ta grâce et à croire.</p>`);
        }
        bits.push(`<p>${wantsAmenDot ? 'Amen.' : 'Amen'}</p>`);
        return bits.join('\n');
      }
      // Default canonical prayer (no directive)
      return `<p><strong>Dieu trois fois saint</strong>, nous venons à toi devant <strong>${escapeHtml(reference)}</strong>. ` +
             `Éclaire-nous par ta Parole et conduis-nous dans la vérité. Amen.</p>`;
    }

    function section(id, title, html) {
      return { id, title, content: html };
    }

    const S = []; // sections

    // 1) Prière d'ouverture
    S.push(section(1, 'Prière d’ouverture', craftPrayer(reference, directives, themes)));

    // 2) Canon et testament
    const ot = ['genèse','exode','lévitique','nombres','deutéronome','josué','juges','ruth','1 samuel','2 samuel','1 rois','2 rois','1 chroniques','2 chroniques','esdras','néhémie','esther','job','psaumes','proverbes','ecclésiaste','cantique','esaïe','jérémie','lamentations','ézéchiel','daniel','osée','joël','amos','abdias','jonas','miquée','nahum','habacuc','sophonie','aggée','zacharie','malachie'];
    const isOT = ot.includes(book.toLowerCase());
    const canonLine = isOT ? 'Premier Testament' : 'Nouveau Testament';
    S.push(section(2, 'Canon et testament', [
      `<p>${escapeHtml(book)} appartient au ${canonLine}; genre: narratif.</p>`,
      `<p>${escapeHtml(reference)} s’éclaire par ${escapeHtml(themes.join(', '))}.</p>`,
      `<p>Repères canoniques: <span class="refs-inline">${verse ? `<a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(reference)}&version=${encodeURIComponent(version)}" target="_blank" rel="noopener">${escapeHtml(reference)}</a>` : `<a href="https://www.biblegateway.com/passage/?search=${encodeURIComponent(book + ' ' + chapter + ':1-5')}&version=${encodeURIComponent(version)}" target="_blank" rel="noopener">${escapeHtml(book + ' ' + chapter + ':1-5')}</a>`}</span>.</p>`
    ].join('\n')));

    // Titles for the remaining 26 sections
    const TITLES = [
      'Questions du chapitre précédent',
      'Titre du chapitre',
      'Contexte historique',
      'Structure littéraire',
      'Genre littéraire',
      'Auteur et généalogie',
      'Verset-clé doctrinal',
      'Analyse exégétique',
      'Analyse lexicale',
      'Références croisées',
      'Fondements théologiques',
      'Thème doctrinal',
      'Fruits spirituels',
      'Types bibliques',
      'Appui doctrinal',
      'Comparaison entre versets',
      'Comparaison avec Actes 2',
      'Verset à mémoriser',
      'Enseignement pour l’Église',
      'Enseignement pour la famille',
      'Enseignement pour enfants',
      'Application missionnaire',
      'Application pastorale',
      'Application personnelle',
      'Versets à retenir',
      'Prière de fin'
    ];

    // Simple canned content generator
    function p(html) { return `<p>${html}</p>`; }

    // 3) to 27)
    let idCounter = 3;
    for (const t of TITLES.slice(0, 25)) {
      const lines = [];
      switch (t) {
        case 'Titre du chapitre':
          lines.push(p(`${escapeHtml(reference)} — <strong>Orientation</strong>: lire à la lumière de ${escapeHtml(themes.join(', '))}.`));
          lines.push(p(`Appuis: <span class="refs-inline"><a href="https://www.biblegateway.com/passage/?search=Psaumes%2019%3A8-10&version=${encodeURIComponent(version)}" target="_blank" rel="noopener">Psaumes 19:8-10</a><span class="sep">·</span><a href="https://www.biblegateway.com/passage/?search=Psaumes%20119%3A105&version=${encodeURIComponent(version)}" target="_blank" rel="noopener">Psaumes 119:105</a></span>.`));
          break;
        case 'Prière de fin':
          // handled later as final 28th
          break;
        default:
          lines.push(p(`Indications pour ${escapeHtml(reference)} — thème(s): ${escapeHtml(themes.join(', '))}.`));
          break;
      }
      S.push(section(idCounter, t, lines.join('\n')));
      idCounter++;
    }

    // 28) Prière de fin
    S.push(section(28, 'Prière de fin', `<p>Que la Parole reçue en ${escapeHtml(reference)} devienne en nous foi, prière et obéissance. Amen.</p>`));

    const payload = {
      ok: true,
      source: 'canonical',
      warn: '',
      data: {
        reference,
        version,
        sections: S
      }
    };
    res.status(200).json(payload);
  } catch (e) {
    console.error('api/chat error', e);
    res.status(500).json({ ok: false, error: 'FUNCTION_INVOCATION_FAILED' });
  }
}

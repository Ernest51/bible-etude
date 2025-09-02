/* bible-buttons.js
   Rôle : faire fonctionner "Valider" et "Lire la Bible" immédiatement,
   ouvrir BibleGateway (LSG) selon le livre + chapitre choisis,
   et garder la compatibilité avec un ancien code qui utilisait #readLink.
*/

(function () {
  function $(sel) { return document.querySelector(sel); }

  // Essaie de trouver les champs livre/chapitre de manière robuste
  function getBookNode() {
    return (
      $('#book') ||
      $('#bookSelect') ||
      document.querySelector('select[name="book"], select[name="livre"]') ||
      document.querySelector('#livre, #livreSelect')
    );
  }

  function getChapterNode() {
    return (
      $('#chapter') ||
      $('#chapterInput') ||
      document.querySelector('input[name="chapter"], input[name="chapitre"]') ||
      document.querySelector('#chapitre, #chapterSelect')
    );
  }

  function normRef() {
    const bookEl = getBookNode();
    const chapEl = getChapterNode();
    const book = (bookEl && (bookEl.value || bookEl.textContent || '')).trim() || 'Genèse';
    const chapRaw = (chapEl && chapEl.value) ? String(chapEl.value).trim() : '1';
    const chap = /^\d+$/.test(chapRaw) && parseInt(chapRaw, 10) > 0 ? chapRaw : '1';
    return { book, chap };
  }

  function makeBibleGatewayUrl(book, chap) {
    // Exemple : https://www.biblegateway.com/passage/?search=Gen%C3%A8se+1&version=LSG
    const q = encodeURIComponent(`${book} ${chap}`);
    return `https://www.biblegateway.com/passage/?search=${q}&version=LSG`;
  }

  function openBibleGateway() {
    const { book, chap } = normRef();
    const url = makeBibleGatewayUrl(book, chap);

    // Compatibilité : s'il existe un #readLink (ancien comportement), mets à jour et clique.
    const a = $('#readLink');
    if (a) {
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
      return;
    }

    // Sinon, ouvre directement
    window.open(url, '_blank', 'noopener');
  }

  function bindButtons() {
    const validateBtn = $('#validateBtn');
    const readBtn = $('#readBtn');

    if (validateBtn) {
      validateBtn.addEventListener('click', openBibleGateway);
    }
    if (readBtn) {
      readBtn.addEventListener('click', openBibleGateway);
    }
  }

  // Dès que le DOM est prêt (defer suffit, mais on sécurise)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButtons);
  } else {
    bindButtons();
  }
})();

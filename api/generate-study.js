// api/generate-study.js
// Version stable : génère 1..28 rubriques (Rubrique 0 = placeholder statique).
// Pas d’appel à api.bible pour l’instant.

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

const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const padTo = (txt, target) => {
  if (!target) return txt;
  if (txt.length >= target) return txt;
  const filler = " La Parole de Dieu demeure la lumière de nos pas, appelant à la foi et à l’obéissance.";
  let out = txt;
  while (out.length < target) out += filler;
  return out;
};

function prayerOpening(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Père saint, je viens devant toi pour recevoir ta Parole en ${book} ${ch}. Que ton Esprit ouvre mon intelligence et purifie mon cœur. Je veux comprendre ce que tu dis, croire ce que tu promets et pratiquer ce que tu commandes.`,
    `Je t’offre mes pensées et mes sentiments: là où tu éclaires, rends-moi docile; là où tu avertis, rends-moi vigilant; là où tu consoles, rends-moi reconnaissant. Que cette lecture devienne prière, que la prière devienne obéissance, et que l’obéissance devienne joie. Amen.`
  ].join('\n\n');
  return padTo(`### 1. Prière d’ouverture\n\n${p}`, target);
}

function contextAndNarrative(book, ch, L=1500){
  const body = [
    `*Référence :* ${book} ${ch}`,
    `Ce chapitre s’inscrit dans un mouvement narratif où Dieu agit et révèle sa fidélité. Le texte met en évidence des personnages et des lieux qui servent de cadre à l’enseignement divin. Chaque détail historique ou littéraire n’est pas accessoire: il devient support de doctrine et d’espérance.`,
    `L’ensemble manifeste l’unité de l’Écriture: ce qui fut promis ailleurs s’accomplit ici; ce qui est esquissé maintenant trouvera son plein déploiement plus loin.`
  ].join('\n\n');
  return padTo(`### 2. Contexte et fil narratif\n\n${body}`, L);
}

function prevChapterQA(book, ch, L=1200){
  const prev = ch>1 ? `${book} ${ch-1}` : `—`;
  const body = [
    `*Référence :* ${book} ${ch}`,
    `<strong>1. Quel fil narratif conduit vers la suite ?</strong> → Le chapitre précédent (${prev}) préparait la compréhension en posant les thèmes majeurs.`,
    `<strong>2. Quels personnages ou lieux réapparaissent ?</strong> → Ils gagnent en précision, montrant comment Dieu conduit l’histoire.`,
    `<strong>3. Qu’a révélé ${prev !== '—' ? prev : 'le début du livre'} sur Dieu ?</strong> → Sa sainteté, sa miséricorde et sa fidélité.`,
    `<strong>4. Quelles tensions restaient ouvertes ?</strong> → Limites humaines, promesses en attente, conflits non résolus.`,
    `<strong>5. Quelle attente la clôture de ${prev !== '—' ? prev : 'l’introduction'} suscitait-elle ?</strong> → Un approfondissement qui s’ouvre maintenant.`
  ].join('\n\n');
  return padTo(`### 3. Questions du chapitre précédent\n\n${body}`, L);
}

function doctrinalBlock(title, book, ch, focus, L=1500){
  const body = [
    `*Référence :* ${book} ${ch}`,
    `Ce passage éclaire ${focus}. Dieu se révèle non pour satisfaire la curiosité mais pour fortifier la foi. La doctrine reçue n’est pas une théorie: elle devient chemin de vie, réponse confiante et adoration sincère.`
  ].join('\n\n');
  return padTo(`### ${title}\n\n${body}`, L);
}

function closingPrayer(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Seigneur, merci pour ta Parole en ${book} ${ch}. Que cette lecture produise en moi la foi active, la charité fraternelle et l’espérance persévérante. Là où tu m’as repris, donne-moi la droiture; là où tu m’as réconforté, donne-moi la paix; là où tu m’as engagé, donne-moi la persévérance. Amen.`
  ].join('\n\n');
  return padTo(`### 28. Prière de clôture\n\n${p}`, target);
}

function buildAllSections(book, ch, dens){
  const L = dens||1500;
  const out = [];

  // Rubrique 0 (placeholder provisoire)
  out.push({ n:0, content:
`### Rubrique 0 — Panorama des versets du chapitre

*Référence :* ${book} ${ch}

Lecture du chapitre. Utilise **Lire la Bible** pour lire l’intégralité du texte.` });

  // 1
  out.push({ n:1, content: prayerOpening(book, ch, 1300) });
  // 2
  out.push({ n:2, content: contextAndNarrative(book, ch, L) });
  // 3
  out.push({ n:3, content: prevChapterQA(book, ch, L) });
  // 4..27
  out.push({ n:4, content: doctrinalBlock('4. Canonicité et cohérence', book, ch, 'la cohérence de la Révélation', L) });
  out.push({ n:5, content: doctrinalBlock('5. Ancien/Nouveau Testament', book, ch, 'le lien entre l’ancienne et la nouvelle alliance', L) });
  // … idem jusqu’à 27
  for (let i=6;i<=27;i++){
    out.push({ n:i, content: doctrinalBlock(`${i}. Rubrique doctrinale`, book, ch, 'un aspect théologique', L) });
  }
  // 28
  out.push({ n:28, content: closingPrayer(book, ch, 1300) });

  return out;
}

module.exports = async (req, res) => {
  try{
    const { book, chapter, length } = req.query || {};
    const b = (book && CHAPTERS_66[book]) ? book : 'Genèse';
    const max = CHAPTERS_66[b] || 1;
    const ch = clamp(parseInt(chapter||'1',10)||1, 1, max);
    const dens = [500,1500,2500].includes(parseInt(length,10)) ? parseInt(length,10) : 1500;

    const sections = buildAllSections(b, ch, dens);
    res.status(200).json({ ok:true, book:b, chapter:ch, sections });
  }catch(err){
    console.error('generate-study error', err);
    res.status(200).json({ ok:true, book:'Genèse', chapter:1, sections: buildAllSections('Genèse',1,1500), warning:'fallback' });
  }
};

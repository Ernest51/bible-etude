// api/generate-study.js
// Génère 0..28 rubriques. La Rubrique 0 est branchée sur api.bible via bibleProvider.

const { getChapterOverview } = require('./bibleProvider');

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
  const filler = " Dans une lecture fidèle et réfléchie, le texte oriente l’intelligence et façonne l’obéissance: doctrine, réconfort, appel et discernement se répondent. ";
  let out = txt;
  while (out.length < target) out += filler;
  return out;
};

const H = (s)=>s.replace(/\s+/g,' ').trim();

function prayerOpening(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Père saint, je viens devant toi en humilité pour recevoir ta Parole en ${book} ${ch}. Que ta lumière éclaire mon intelligence afin que je lise sans illusion ni dureté de cœur. Donne-moi une attention docile: que je ne sélectionne pas ce qui m’arrange, mais que je me laisse corriger, consoler et conduire.`,
    `Je te demande la grâce de l’unité entre la connaissance et la vie: que la doctrine reçue devienne adoration, que l’adoration devienne obéissance, et que l’obéissance devienne joie. S’il y a des nœuds de souffrance, d’incompréhension ou de péché, fais-en un lieu d’enseignement. Par l’Esprit, rends-moi attentif aux liens du chapitre avec toute l’Écriture, depuis la promesse initiale jusqu’à l’accomplissement en ton Fils. Que ma lecture aujourd’hui serve ta gloire, le bien de l’Église et la guérison de mon prochain. Amen.`
  ].join('\n\n');
  return padTo(`### 1. Prière d’ouverture\n\n${p}`, target);
}

function contextAndNarrative(book, ch, L=1500){
  const core = [
    `*Référence :* ${book} ${ch}`,
    `Pour situer l’ensemble, repérons le fil narratif qui conduit jusqu’à ce chapitre puis s’en échappe. Le texte articule une progression: rappel d’une œuvre divine antérieure, mise à l’épreuve d’un personnage ou d’un peuple, et ouverture vers une promesse que Dieu portera. Cette dynamique assure la cohérence biblique: Dieu parle, appelle, juge, relève et conduit.`,
    `Le chapitre met en scène un espace théologique: le temps (souvenir et attente), le lieu (désert, ville, maison, sanctuaire), et les acteurs (Dieu, son envoyé, le peuple, l’adversaire). Chacun reçoit une fonction au service du propos: révéler qui est Dieu et comment l’homme est restauré dans l’alliance.`,
    `La mémoire des chapitres précédents règle la lecture présente: ce que Dieu a déjà fait éclaire ce qu’Il fait ici; ce qu’Il promet ouvre une espérance qui réoriente l’action. L’issue du chapitre n’épuise pas la promesse; elle l’alimente et la précise.`
  ].join('\n\n');
  return padTo(`### 2. Contexte et fil narratif\n\n${core}`, L);
}

function prevChapterQA(book, ch, L=1200){
  const prev = ch>1 ? `${book} ${ch-1}` : `—`;
  const base = [
    `*Référence :* ${book} ${ch}${ch>1?` (questions en regard de ${prev})`:''}`,
    `<strong>1. Quel fil narratif conduit vers la suite ?</strong> → Le passage précédent a posé un cadre (origine, alliance, loi ou promesse) qui ouvre logiquement la progression ici: ce qui était annoncé devient enjeu vécu.`,
    `<strong>2. Quels personnages ou lieux réapparaissent et que gagnent-ils en précision ?</strong> → Les acteurs déjà introduits reviennent avec des responsabilités clarifiées (mission, épreuve, témoignage). Le décor n’est pas neutre: il sert la pédagogie divine.`,
    `<strong>3. Qu’a révélé ${ch>1?prev:`le début du livre`} sur Dieu et comment cela règle la lecture actuelle ?</strong> → Sa sainteté interdit l’autojustification; sa miséricorde interdit le désespoir; sa fidélité rend l’obéissance possible.`,
    `<strong>4. Quelles tensions restaient ouvertes et commencent à se résoudre ?</strong> → Limites humaines, attente d’une promesse, conflit latent: la suite reprend ces fils, dresse un diagnostic vrai et propose un chemin de vie.`,
    `<strong>5. Quelle attente la clôture de ${ch>1?prev:`l’introduction`} suscitait-elle ?</strong> → Un approfondissement doctrinal ou un déplacement narratif, que cette section honore en orientant vers la fidélité concrète.`
  ].join('\n\n');
  return padTo(`### 3. Questions du chapitre précédent\n\n${base}`, L);
}

function doctrinalBlock(title, book, ch, focus, L=1500){
  const body = [
    `*Référence :* ${book} ${ch}`,
    `Ce passage met en ordre ${focus}. L’enseignement n’est pas abstrait: la vérité reçue façonne l’existence, corrige l’erreur et rend Dieu adorable. L’Écriture se commente elle-même; ce chapitre s’inscrit donc dans la grande ligne de l’histoire du salut et éclaire l’espérance chrétienne.`,
    `La portée pastorale est nette: doctrine, consolation, appel et discernement se répondent. La vérité reçue devient prière, la prière devient obéissance, l’obéissance devient joie.`
  ].join('\n\n');
  return padTo(`### ${title}\n\n${body}`, L);
}

function closingPrayer(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Seigneur, je te rends grâce pour ta Parole reçue aujourd’hui. Que ce que j’ai compris ne reste pas dehors, mais pénètre mes choix, mes paroles et mes relations. Là où tu m’as repris, donne-moi la droiture; là où tu m’as réconforté, garde mon cœur en paix; là où tu m’as engagé, accorde la persévérance.`,
    `Je confie à ta bonté les points encore obscurs: que l’Esprit poursuive son œuvre et m’enseigne tout ce qui convient au temps opportun. Fais de moi un témoin paisible et vrai, ferme dans la vérité, doux dans la charité. Que cette lecture de ${book} ${ch} fructifie pour l’Église et serve ta gloire. Amen.`
  ].join('\n\n');
  return padTo(`### 28. Prière de clôture\n\n${p}`, target);
}

function buildAllSections(book, ch, dens, rubric0){
  const L = dens||1500;
  const out = [];

  // Rubrique 0
  if (rubric0 && rubric0.ok && rubric0.verses && rubric0.verses.length){
    const lines = [];
    lines.push(`### Rubrique 0 — Panorama des versets du chapitre`);
    lines.push('');
    lines.push(`*Référence :* ${rubric0.book} ${rubric0.chapter}`);
    lines.push('');
    for (const v of rubric0.verses){
      const verseLabel = v.ref || `${rubric0.book} ${rubric0.chapter}:${v.n}`;
      const text = (v.text||'').replace(/\s+/g,' ').trim();
      const note = v.note || '';
      lines.push(`- <strong>${verseLabel}</strong> — ${text}`);
      if (note) lines.push(`  - ${note}`);
    }
    out.push({ n:0, content: lines.join('\n') });
  } else {
    out.push({ n:0, content:
`### Rubrique 0 — Panorama des versets du chapitre

*Référence :* ${book} ${ch}

Lecture du chapitre et relevé: ouverture, pivot, résolution. Utilise **Lire la Bible** pour lire l’intégralité du texte, puis observe comment chaque verset s’ordonne (parole de Dieu, réponse humaine, issue).` });
  }

  // 1
  out.push({ n:1, content: prayerOpening(book, ch, 1300) });

  // 2
  out.push({ n:2, content: contextAndNarrative(book, ch, L) });

  // 3
  out.push({ n:3, content: prevChapterQA(book, ch, L) });

  // 4..27
  out.push({ n:4,  content: doctrinalBlock('4. Canonicité et cohérence', book, ch, 'la cohérence canonique: loi, promesse, accomplissement, unité de la Révélation', L) });
  out.push({ n:5,  content: doctrinalBlock('5. Ancien/Nouveau Testament', book, ch, 'la continuité et la nouveauté de l’économie du salut', L) });
  out.push({ n:6,  content: doctrinalBlock('6. Promesses', book, ch, 'les promesses divines et leur finalité d’alliance', L) });
  out.push({ n:7,  content: doctrinalBlock('7. Péché et grâce', book, ch, 'le diagnostic du cœur et la gratuité du pardon', L) });
  out.push({ n:8,  content: doctrinalBlock('8. Christologie', book, ch, 'le témoignage rendu au Fils', L) });
  out.push({ n:9,  content: doctrinalBlock('9. Esprit Saint', book, ch, 'la présence et l’œuvre sanctifiante de l’Esprit', L) });
  out.push({ n:10, content: doctrinalBlock('10. Alliance', book, ch, 'les engagements de Dieu et la réponse du peuple', L) });
  out.push({ n:11, content: doctrinalBlock('11. Église', book, ch, 'la communauté appelée, instruite et envoyée', L) });
  out.push({ n:12, content: doctrinalBlock('12. Discipulat', book, ch, 'l’apprentissage de la foi: écoute, imitation, service', L) });
  out.push({ n:13, content: doctrinalBlock('13. Éthique', book, ch, 'les exigences de la vérité vécue dans la charité', L) });
  out.push({ n:14, content: doctrinalBlock('14. Prière', book, ch, 'la prière façonnée par l’Écriture', L) });
  out.push({ n:15, content: doctrinalBlock('15. Mission', book, ch, 'le témoignage vers l’extérieur, humble et vrai', L) });
  out.push({ n:16, content: doctrinalBlock('16. Espérance', book, ch, 'l’attente vivante qui soutient la persévérance', L) });
  out.push({ n:17, content: doctrinalBlock('17. Exhortation', book, ch, 'les appels concrets à marcher selon la lumière reçue', L) });
  out.push({ n:18, content: doctrinalBlock('18. Application personnelle', book, ch, 'le cœur, la pensée et la volonté', L) });
  out.push({ n:19, content: doctrinalBlock('19. Application communautaire', book, ch, 'la vie d’Église, la diaconie et la communion', L) });
  out.push({ n:20, content: doctrinalBlock('20. Liturgie', book, ch, 'la réponse cultuelle: écoute, confession, louange, envoi', L) });
  out.push({ n:21, content: doctrinalBlock('21. Méditation', book, ch, 'l’assimilation priante de la Parole', L) });
  out.push({ n:22, content: doctrinalBlock('22. Verset-clé', book, ch, 'un verset gouvernant qui condense le message', L) });
  out.push({ n:23, content: doctrinalBlock('23. Typologie', book, ch, 'les figures et préfigurations', L) });
  out.push({ n:24, content: doctrinalBlock('24. Théologie systématique', book, ch, 'l’articulation des doctrines sans les séparer de la vie', L) });
  out.push({ n:25, content: doctrinalBlock('25. Histoire du salut', book, ch, 'création, chute, promesse, accomplissement, espérance', L) });
  out.push({ n:26, content: doctrinalBlock('26. Thèmes secondaires', book, ch, 'les motifs complémentaires du passage', L) });
  out.push({ n:27, content: doctrinalBlock('27. Doutes/objections', book, ch, 'les questions honnêtes et leurs réponses scripturaires', L) });

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

    // Rubrique 0 via API (non bloquant pour le reste)
    let rub0 = null;
    try { rub0 = await getChapterOverview(b, ch); }
    catch(e) { rub0 = { ok:false, note:String(e.message||e) }; }

    const sections = buildAllSections(b, ch, dens, rub0);
    res.status(200).json({ ok:true, book:b, chapter:ch, sections, source0: rub0 && rub0.ok ? 'api.bible' : 'fallback' });
  }catch(err){
    console.error('generate-study error', err);
    const b='Genèse', ch=1, dens=1500;
    const sections = buildAllSections(b, ch, dens, null);
    res.status(200).json({ ok:true, book:b, chapter:ch, sections, warning:'fallback' });
  }
};

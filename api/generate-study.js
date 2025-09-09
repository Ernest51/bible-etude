// api/generate-study.js (ESM)
// Handler pour Vercel Serverless Functions (export default).
// Génère les rubriques 0..28 (0 = placeholder). Aucun appel externe.

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

// ---------- utils ----------
function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
function padTo(txt, target){
  if (!target) return txt;
  if (txt.length >= target) return txt;
  const filler = " La Parole de Dieu demeure la lumière de nos pas, appelant à la foi et à l'obéissance. ";
  let out = txt;
  while (out.length < target) out += filler;
  return out;
}
function norm(s){
  return String(s||"")
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[’']/g,"'")
    .replace(/\s+/g," ")
    .trim()
    .toLowerCase();
}
function resolveBookName(input){
  if (!input) return null;
  const target = norm(input);
  const index = {};
  Object.keys(CHAPTERS_66).forEach(k => { index[norm(k)] = k; });
  if (index[target]) return index[target];
  const cand = Object.keys(index).find(n => n.startsWith(target) || target.startsWith(n));
  return cand ? index[cand] : null;
}

// ---------- générateurs ----------
function prayerOpening(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Père saint, je viens devant toi pour recevoir ta Parole en ${book} ${ch}. Que ton Esprit ouvre mon intelligence et purifie mon cœur. Je veux comprendre ce que tu dis, croire ce que tu promets et pratiquer ce que tu commandes.`,
    `Je t’offre mes pensées et mes affections: là où tu éclaires, rends-moi docile; là où tu avertis, rends-moi vigilant; là où tu consoles, rends-moi reconnaissant. Que cette lecture devienne prière, que la prière devienne obéissance, et que l’obéissance devienne joie. Amen.`
  ].join("\n\n");
  return padTo(`### 1. Prière d’ouverture\n\n${p}`, target);
}
function contextAndNarrative(book, ch, L=1500){
  const body = [
    `*Référence :* ${book} ${ch}`,
    `Ce chapitre s’inscrit dans un mouvement narratif où Dieu agit et révèle sa fidélité. Le texte met en évidence des personnages et des lieux qui servent de cadre à l’enseignement divin. Chaque détail historique ou littéraire devient support de doctrine et d’espérance.`,
    `L’ensemble manifeste l’unité de l’Écriture: ce qui fut promis ailleurs s’accomplit ici; ce qui est esquissé maintenant trouvera son plein déploiement plus loin.`
  ].join("\n\n");
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
  ].join("\n\n");
  return padTo(`### 3. Questions du chapitre précédent\n\n${body}`, L);
}
function doctrinalBlock(title, book, ch, focus, L=1500){
  const body = [
    `*Référence :* ${book} ${ch}`,
    `Ce passage éclaire ${focus}. Dieu se révèle non pour satisfaire la curiosité mais pour fortifier la foi. La doctrine reçue n’est pas une théorie: elle devient chemin de vie, réponse confiante et adoration sincère.`
  ].join("\n\n");
  return padTo(`### ${title}\n\n${body}`, L);
}
function closingPrayer(book, ch, target=1300){
  const p = [
    `*Référence :* ${book} ${ch}`,
    `Seigneur, merci pour ta Parole en ${book} ${ch}. Que cette lecture produise en moi la foi active, la charité fraternelle et l’espérance persévérante. Là où tu m’as repris, donne-moi la droiture; là où tu m’as réconforté, donne-moi la paix; là où tu m’as engagé, donne-moi la persévérance. Amen.`
  ].join("\n\n");
  return padTo(`### 28. Prière de clôture\n\n${p}`, target);
}
function buildAllSections(book, ch, dens){
  const L = dens||1500;
  const out = [];
  out.push({ n:0, content:
`### Rubrique 0 — Panorama des versets du chapitre

*Référence :* ${book} ${ch}

Lecture du chapitre. Utilise **Lire la Bible** pour lire l’intégralité du texte.` });
  out.push({ n:1, content: prayerOpening(book, ch, 1300) });
  out.push({ n:2, content: contextAndNarrative(book, ch, L) });
  out.push({ n:3, content: prevChapterQA(book, ch, L) });
  out.push({ n:4,  content: doctrinalBlock('4. Canonicité et cohérence', book, ch, 'la cohérence de la Révélation', L) });
  out.push({ n:5,  content: doctrinalBlock('5. Ancien/Nouveau Testament', book, ch, 'le lien entre ancienne et nouvelle alliance', L) });
  out.push({ n:6,  content: doctrinalBlock('6. Promesses', book, ch, 'les promesses divines et leur finalité', L) });
  out.push({ n:7,  content: doctrinalBlock('7. Péché et grâce', book, ch, 'le diagnostic du cœur et la gratuité du pardon', L) });
  out.push({ n:8,  content: doctrinalBlock('8. Christologie', book, ch, 'le témoignage rendu au Fils', L) });
  out.push({ n:9,  content: doctrinalBlock('9. Esprit Saint', book, ch, 'la présence et l’œuvre de l’Esprit', L) });
  out.push({ n:10, content: doctrinalBlock('10. Alliance', book, ch, 'les engagements de Dieu et la réponse du peuple', L) });
  out.push({ n:11, content: doctrinalBlock('11. Église', book, ch, 'la communauté appelée, instruite et envoyée', L) });
  out.push({ n:12, content: doctrinalBlock('12. Discipulat', book, ch, 'l’apprentissage de la foi: écoute, imitation, service', L) });
  out.push({ n:13, content: doctrinalBlock('13. Éthique', book, ch, 'la vérité vécue dans la charité', L) });
  out.push({ n:14, content: doctrinalBlock('14. Prière', book, ch, 'la prière façonnée par l’Écriture', L) });
  out.push({ n:15, content: doctrinalBlock('15. Mission', book, ch, 'le témoignage humble et vrai', L) });
  out.push({ n:16, content: doctrinalBlock('16. Espérance', book, ch, 'l’attente vivante qui soutient la persévérance', L) });
  out.push({ n:17, content: doctrinalBlock('17. Exhortation', book, ch, 'les appels concrets à marcher dans la lumière', L) });
  out.push({ n:18, content: doctrinalBlock('18. Application personnelle', book, ch, 'le cœur, la pensée et la volonté', L) });
  out.push({ n:19, content: doctrinalBlock('19. Application communautaire', book, ch, 'la vie d’Église, la diaconie et la communion', L) });
  out.push({ n:20, content: doctrinalBlock('20. Liturgie', book, ch, 'écoute, confession, louange, envoi', L) });
  out.push({ n:21, content: doctrinalBlock('21. Méditation', book, ch, 'l’assimilation priante de la Parole', L) });
  out.push({ n:22, content: doctrinalBlock('22. Verset-clé', book, ch, 'un verset gouvernant qui condense le message', L) });
  out.push({ n:23, content: doctrinalBlock('23. Typologie', book, ch, 'figures et préfigurations', L) });
  out.push({ n:24, content: doctrinalBlock('24. Théologie systématique', book, ch, 'l’articulation des doctrines', L) });
  out.push({ n:25, content: doctrinalBlock('25. Histoire du salut', book, ch, 'création, chute, promesse, accomplissement, espérance', L) });
  out.push({ n:26, content: doctrinalBlock('26. Thèmes secondaires', book, ch, 'motifs complémentaires du passage', L) });
  out.push({ n:27, content: doctrinalBlock('27. Doutes/objections', book, ch, 'questions honnêtes et réponses scripturaires', L) });
  out.push({ n:28, content: closingPrayer(book, ch, 1300) });
  return out;
}

// ---------- handler ESM ----------
export default async function handler(req, res) {
  try {
    const q = req.query || {};
    const rawBook   = q.book || "Genèse";
    const rawChap   = q.chapter || "1";
    const rawLength = q.length || "1500";

    const bookCanon = resolveBookName(rawBook) || "Genèse";
    const maxChap   = CHAPTERS_66[bookCanon] || 1;
    const chap      = clamp(parseInt(rawChap,10)||1, 1, maxChap);
    const densNum   = parseInt(rawLength,10);
    const dens      = [500,1500,2500].includes(densNum) ? densNum : 1500;

    const sections = buildAllSections(bookCanon, chap, dens);
    res.status(200).json({ ok:true, book:bookCanon, chapter:chap, sections });
  } catch (err) {
    try {
      const sections = buildAllSections("Genèse", 1, 1500);
      res.status(200).json({ ok:true, book:"Genèse", chapter:1, sections, warning:String(err && err.message || err) });
    } catch {
      res.status(200).json({ ok:true, book:"Genèse", chapter:1, sections:[
        { n:0, content:"### Rubrique 0 — Panorama des versets du chapitre\n\n*Référence :* Genèse 1" },
        { n:1, content:"### 1. Prière d’ouverture\n\n—" }
      ], warning:"hard-fallback" });
    }
  }
}

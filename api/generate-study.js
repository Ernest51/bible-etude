// generate-study.js — version "texte complet & densité stricte"
const SECTIONS = 28;
const ALLOWED_DENSITIES = new Set([500, 1500, 2500]);

// Petit générateur de phrases variées, stable par passage + index
function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    // LCG simple
    s = (1103515245 * s + 12345) % 0x100000000;
    return s / 0x100000000;
  };
}

const banks = {
  obs: [
    "Observation du texte: la structure met en avant l’initiative de Dieu et l’ordre du récit.",
    "Observation: le vocabulaire récurrent souligne l’intention, la séparation et la bénédiction.",
    "Observation: le rythme du passage guide la compréhension en étapes nettes."
  ],
  ctx: [
    "Contexte: le passage s’inscrit dans une ouverture canonique qui oriente tout le reste de l’Écriture.",
    "Contexte: la situation des premiers auditeurs éclaire les thèmes de création et d’alliance.",
    "Contexte: la forme littéraire aide à distinguer message théologique et détails narratifs."
  ],
  doc: [
    "Doctrine: Dieu est la source, le souverain et le but de toute chose.",
    "Doctrine: la Parole efficace crée, ordonne et donne la vie.",
    "Doctrine: la bonté de la création fonde la dignité et la responsabilité humaines."
  ],
  app: [
    "Application: cultiver l’émerveillement mène à une adoration ancrée et sobre.",
    "Application: recevoir l’ordre divin encourage une éthique du travail et du repos.",
    "Application: discerner le bien créé nourrit la gratitude et la tempérance."
  ],
  li: [
    "Lien canonique: création, chute, rédemption, restauration constituent le fil directeur.",
    "Lien canonique: le thème de la lumière anticipe la révélation et la nouvelle création.",
    "Lien canonique: l’image de Dieu prépare l’économie de l’alliance et la mission."
  ]
};

function pick(rand, arr) { return arr[Math.floor(rand() * arr.length)]; }

function makeText(passage, idx, targetChars, rand) {
  // Fabrique des phrases jusqu’à dépasser targetChars, puis coupe proprement à la fin d’une phrase.
  const lines = [];
  while (lines.join(' ').length < targetChars) {
    const chunk = [
      `${passage} — rubrique ${idx}.`,
      pick(rand, banks.obs),
      pick(rand, banks.ctx),
      pick(rand, banks.doc),
      pick(rand, banks.li),
      pick(rand, banks.app)
    ].join(' ');
    lines.push(chunk);
  }
  let out = lines.join(' ');
  // Couper proprement à la fin de phrase la plus proche <= targetChars+120 (tolérance)
  const max = Math.min(out.length, targetChars + 120);
  const candidate = out.slice(0, max);
  const lastDot = Math.max(candidate.lastIndexOf('. '), candidate.lastIndexOf('。'), candidate.lastIndexOf('! '), candidate.lastIndexOf('? '), candidate.lastIndexOf('.'));
  if (lastDot > 0) out = candidate.slice(0, lastDot + 1);
  // Sécurité: jamais vide, jamais coupé en plein mot
  out = out.replace(/\s+/g, ' ').trim();
  if (!out.endsWith('.') && out.length > 0) out += '.';
  return out;
}

function buildSections(passage, totalLength) {
  // Répartition stricte sur 28 rubriques avec lissage (toutes ~égales, somme ≈ totalLength)
  const base = Math.floor(totalLength / SECTIONS);
  let remainder = totalLength - base * SECTIONS; // distribué +1 par rubrique au besoin
  const rand = seededRandom(`${passage}::${totalLength}`);

  const sections = [];
  for (let i = 1; i <= SECTIONS; i++) {
    const target = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;

    const title = `Rubrique ${i}`;
    const description = `Résumé de la rubrique ${i} pour ${passage}.`;
    const content = makeText(passage, i, target, rand);

    sections.push({ id: i, title, description, content });
  }
  return sections;
}

export default async function handler(req, res) {
  try {
    const method = req.method || 'GET';

    if (method === 'GET') {
      res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({
        ok: true,
        route: '/api/generate-study',
        hint: 'POST JSON { "passage":"Genèse 1", "options":{"length":500|1500|2500} } → 28 rubriques.'
      });
    }

    if (method === 'POST') {
      let body = req.body;
      if (!body || typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch { body = {}; }
      }

      const passage = (body.passage ? String(body.passage) : 'Genèse 1').trim() || 'Genèse 1';
      let length = (body.options && Number(body.options.length)) ? Number(body.options.length) : 1500;
      if (!ALLOWED_DENSITIES.has(length)) length = 1500; // densité immuable

      const study = { sections: buildSections(passage, length) };

      res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ study });
    }

    // Autres méthodes: renvoyer un hint GET-like
    res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      route: '/api/generate-study',
      hint: 'Utilise GET pour smoke-test, POST pour générer { passage, options.length ∈ {500,1500,2500} }.'
    });
  } catch (err) {
    // Contrat: toujours 200, mode secours
    res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: false,
      route: '/api/generate-study',
      emergency: true,
      error: String(err),
      study: { sections: [] }
    });
  }
}

function buildSections(passage, totalLength) {
  const SECTIONS = 28;
  const perSectionLen = Math.max(60, Math.ceil((Number(totalLength) || 1500) / SECTIONS)); // mini contenu
  const titles = Array.from({ length: SECTIONS }, (_, i) => `Rubrique ${i + 1}`);
  const descriptions = Array.from({ length: SECTIONS }, (_, i) => `Résumé de la rubrique ${i + 1} pour ${passage}.`);

  const makeText = (n, idx) => {
    const base = [
      `${passage} — rubrique ${idx}.`,
      `Point clé: observation, contexte, application.`,
      `Lien doctrinal: création, chute, rédemption, restauration (selon le passage).`
    ].join(' ');
    let out = base;
    while (out.length < n) {
      out += ` ${passage} — détail ${idx}.${Math.floor(Math.random()*9) + 1}.`;
    }
    return out.slice(0, n);
  };

  return Array.from({ length: SECTIONS }, (_, i) => ({
    id: i + 1,
    title: titles[i],
    description: descriptions[i],
    content: makeText(perSectionLen, i + 1)
  }));
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
        hint: 'POST JSON { "passage":"Genèse 1", "options":{"length":1500} } pour générer 28 rubriques.'
      });
    }

    if (method === 'POST') {
      let body = req.body;
      if (!body || typeof body === 'string') {
        try { body = JSON.parse(body || '{}'); } catch {}
      }
      const passage = (body && body.passage) ? String(body.passage).trim() : 'Genèse 1';
      const length = body && body.options && Number(body.options.length) ? Number(body.options.length) : 1500;

      const study = { sections: buildSections(passage, length) };

      res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      return res.json({ study });
    }

    // Méthodes autres que GET/POST : retour GET-like
    res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    return res.json({
      ok: true,
      route: '/api/generate-study',
      hint: 'Utilise GET pour smoke-test, POST pour générer { passage, options.length ∈ {500,1500,2500} }.'
    });
  } catch (err) {
    // Contrat: toujours 200, emergency:true en dernier recours
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

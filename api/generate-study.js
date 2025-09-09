// api/generate-study.js
// ESM — Vercel Functions (Node 20)
// But :
// - GET  => ping/infos
// - POST => renvoie un squelette d'étude (28 rubriques) OU mode écho si demandé

export default function handler(req, res) {
  const allowed = ["GET", "POST"];
  if (!allowed.includes(req.method)) {
    res.setHeader("Allow", allowed);
    return res.status(405).json({ error: "Method Not Allowed", allowed });
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      endpoint: "/api/generate-study",
      mode: "info",
      hint: "POST JSON { passage: 'Genèse 1', mode?: 'echo' }",
      timestamp: new Date().toISOString(),
    });
  }

  // POST
  try {
    const body = req.body ?? {};
    const {
      passage = "",
      mode = "skeleton", // 'skeleton' | 'echo'
      rubriques = 28,
      options = {},
    } = body;

    if (mode === "echo") {
      return res.status(200).json({
        ok: true,
        endpoint: "/api/generate-study",
        mode: "echo",
        echo: body,
        timestamp: new Date().toISOString(),
      });
    }

    // Sécurise le nombre de rubriques (par défaut 28)
    const n = Number.isFinite(rubriques) ? Math.max(1, Math.min(28, rubriques)) : 28;

    // Squelette minimal 28 rubriques (titres génériques pour l’instant)
    const sections = Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      title: `Rubrique ${i + 1}`,
      content: "", // à remplir par la logique IA plus tard
    }));

    const payload = {
      ok: true,
      endpoint: "/api/generate-study",
      mode: "skeleton",
      meta: {
        passage,
        rubriques: n,
        options,
        generatedAt: new Date().toISOString(),
      },
      study: {
        passage,
        sections,
      },
    };

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: "Invalid JSON body",
      details: err?.message ?? String(err),
    });
  }
}

// /api/bibles.js — Liste les Bibles disponibles via api.bible
// Env requis : API_BIBLE_KEY
// Filtres : ?lang=fra  (code langue)  |  ?q=Segond  (recherche texte)
// Pagination pass-through (optionnel) : ?page=1&limit=50 (si l’API l’expose)

export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  try {
    const API_KEY = process.env.API_BIBLE_KEY || "";
    if (!API_KEY) {
      return res.status(500).json({ ok: false, error: "API_BIBLE_KEY missing" });
    }

    const u = new URL(req.url, `http://${req.headers.host}`);
    const lang  = u.searchParams.get("lang");   // ex: "fra"
    const q     = u.searchParams.get("q");      // ex: "Segond"
    const page  = u.searchParams.get("page");   // pass-through
    const limit = u.searchParams.get("limit");  // pass-through

    const apiUrl = new URL("https://api.scripture.api.bible/v1/bibles");
    if (lang)  apiUrl.searchParams.set("language", lang);
    if (page)  apiUrl.searchParams.set("page", page);
    if (limit) apiUrl.searchParams.set("limit", limit);

    const r = await fetch(apiUrl, {
      headers: { "api-key": API_KEY, accept: "application/json" }
    });

    const text = await r.text();
    let j; try { j = text ? JSON.parse(text) : {}; } catch { j = { raw: text }; }

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: j?.error?.message || `api.bible ${r.status}`,
        detail: j
      });
    }

    let list = Array.isArray(j?.data) ? j.data : [];
    if (q) {
      const norm = s => String(s || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
      const needle = norm(q);
      list = list.filter(b =>
        norm(b.name).includes(needle) ||
        norm(b.abbreviation || "").includes(needle) ||
        norm(b.abbreviationLocal || "").includes(needle) ||
        norm(b.language?.name || "").includes(needle)
      );
    }

    res.status(200).json({
      ok: true,
      count: list.length,
      // on renvoie les champs utiles en premier
      data: list.map(b => ({
        id: b.id,
        name: b.name,
        abbreviation: b.abbreviation,
        abbreviationLocal: b.abbreviationLocal,
        language: b.language,
        dblId: b.dblId,          // parfois utile pour d’autres endpoints
        copyright: b.copyright,  // si présent
      })),
      // meta complète brute si besoin de debug
      meta: { originalCount: Array.isArray(j?.data) ? j.data.length : 0, page, limit }
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

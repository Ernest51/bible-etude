// /api/verse-bulk.js
// Ajoute / met à jour plusieurs versets d'un coup dans le cache local.
// ⚠️ Pour test/démo uniquement — en prod, utiliser un vrai stockage partagé (DB/Redis).

import { config as verseConfig, LSG as LSG_CACHE } from "./verse.js";

export const config = verseConfig;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { entries = [] } = req.body || {};
    let added = 0;

    if (Array.isArray(entries)) {
      entries.forEach(e => {
        const { book, chapter, verse, text } = e || {};
        if (book && chapter && verse && typeof text === "string" && text.trim()) {
          const B = String(book).trim();
          const key = `${B}/${chapter}/${verse}`;
          LSG_CACHE[key] = text.trim();
          added++;
        }
      });
    }

    res.status(200).json({
      ok: true,
      added,
      total: Object.keys(LSG_CACHE).length
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

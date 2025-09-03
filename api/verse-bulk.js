// pages/api/verse-bulk.js
// Ajoute / met à jour plusieurs versets d'un coup dans le cache local.
// ⚠️ Pour test/démo uniquement — en prod tu brancheras une vraie DB ou API externe.

import { config as verseConfig } from "./verse";

export const config = verseConfig;

// ⚠️ Ici on importe le cache local depuis verse.js
// Dans un vrai projet il faudrait un stockage partagé (DB, Redis…)
import * as verseModule from "./verse";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { entries = [] } = req.body || {};
    let added = 0;

    if (Array.isArray(entries)) {
      entries.forEach(e => {
        const { book, chapter, verse, text } = e;
        if (book && chapter && verse && text) {
          const B = book.trim();
          const key = `${B}/${chapter}/${verse}`;
          verseModule.LSG[key] = text;
          added++;
        }
      });
    }

    res.status(200).json({
      ok: true,
      added,
      total: Object.keys(verseModule.LSG).length
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
}

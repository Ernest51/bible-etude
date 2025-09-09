'use strict';

// api/generate-study.js — PING MINIMAL DE DIAGNOSTIC
// Objectif : confirmer que l'environnement exécute bien une Serverless Function Node.
// Aucun accent, aucun gros objet, aucune utilitaire : juste un JSON court.

module.exports = async function (req, res) {
  try {
    const q = (req && req.query) ? req.query : {};
    const now = new Date().toISOString();

    // simple echo + guard
    const book = (q.book && String(q.book)) || 'Genesis';
    const chapter = parseInt(q.chapter, 10) || 1;

    // build minimal payload
    const payload = {
      ok: true,
      route: "/api/generate-study",
      echo: { book, chapter },
      now
    };

    res.status(200).json(payload);
  } catch (err) {
    // even the error handler is minimal
    res.status(200).json({ ok: false, error: String(err && err.message || err) });
  }
};

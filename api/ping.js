'use strict';

// /api/ping.js — test minimal Serverless Vercel (CommonJS)
module.exports = async function (req, res) {
  try {
    res.status(200).json({
      ok: true,
      route: '/api/ping',
      node: process.version,
      now: new Date().toISOString()
    });
  } catch (e) {
    res.status(200).json({ ok: false, error: String(e?.message || e) });
  }
};

// api/ok.cjs
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({
    ok: true,
    route: '/api/ok',
    method: req.method || 'GET',
    ts: new Date().toISOString()
  }));
};

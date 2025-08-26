// api/echo.js
export const config = { runtime: 'nodejs20.x' };

export default async function handler(req, res) {
  const base = `http://${req.headers.host || 'localhost'}`;
  const u = new URL(req.url, base);
  const headers = Object.fromEntries(
    Object.entries(req.headers || {}).slice(0, 50)
  );

  const info = {
    ok: true,
    method: req.method,
    url: req.url,
    pathname: u.pathname,
    query: Object.fromEntries(u.searchParams.entries()),
    node: process.versions?.node,
    env: {
      OPENAI_API_KEY_present: !!process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL || null
    },
    headers_preview: {
      'content-type': headers['content-type'] || null,
      'content-length': headers['content-length'] || null,
      'x-vercel-id': headers['x-vercel-id'] || null,
      'x-forwarded-proto': headers['x-forwarded-proto'] || null
    }
  };

  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(info, null, 2));
}

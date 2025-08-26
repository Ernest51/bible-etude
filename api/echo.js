// api/echo.js
export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const info = {
    ok: true,
    message: "Echo fonctionnel ✅",
    method: req.method,
    url: req.url,
    node: process.versions?.node,
    env: {
      OPENAI_API_KEY_present: !!process.env.OPENAI_API_KEY
    }
  };
  res.status(200).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(info, null, 2));
}

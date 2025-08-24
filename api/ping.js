export default function handler(req, res) {
  res.status(200).json({ ok: true, pong: true, env: !!process.env.OPENAI_API_KEY });
}

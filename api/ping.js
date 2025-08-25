// /api/ping.js
export const config = { runtime: 'nodejs18.x' };

export default function handler(req, res) {
  res.status(200).json({ pong: true, time: new Date().toISOString() });
}

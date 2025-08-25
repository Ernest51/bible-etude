// /api/ping.js
export const config = { runtime: "nodejs" };

// Petit log au chargement
if (typeof global !== "undefined" && !global._ping_health) {
  global._ping_health = true;
  console.log("[api/ping] endpoint chargé");
}

export default function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({
    pong: true,
    time: new Date().toISOString()
  });
}

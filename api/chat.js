// /api/chat.js — Proxy vers /api/study-28 (LLM-free, api.bible)
export const config = { runtime: "nodejs" };

async function readJsonBody(req) {
  if (req && req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { resolve({ __parse_error: e.message, __raw: data }); } });
    req.on("error", (err) => resolve({ __stream_error: err?.message || String(err) }));
  });
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ ok:false, error:"Use POST" });
    const body = await readJsonBody(req);
    if (body && body.probe) return res.status(200).json({ ok:true, source:"study-28-proxy", probe:true });

    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers["host"];
    const base  = `${proto}://${host}`;

    // on passe les paramètres en query pour /api/study-28
    const sp = new URLSearchParams();
    for (const [k,v] of Object.entries(body || {})) if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));

    const r = await fetch(`${base}/api/study-28?${sp.toString()}`, { headers:{accept:"application/json"} });
    const txt = await r.text().catch(()=> "");
    let j; try { j = txt ? JSON.parse(txt) : {}; } catch { j = { raw: txt }; }

    // 🔴 important : renvoyer j.data (et pas j entier), car le front attend data.sections directement
    return res.status(r.status).json({
      ok: r.ok && j?.ok !== false,
      source: "study-28-proxy",
      data: j?.data ?? {}
    });
  } catch (e) {
    return res.status(500).json({ ok:false, error:"proxy_failed", detail: String(e?.message || e) });
  }
}

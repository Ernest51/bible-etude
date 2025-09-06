// /api/oai-quick.js
export const config = { runtime: "edge" };
export const maxDuration = 20;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export default async function handler(req) {
  try {
    if (!OPENAI_API_KEY) return json({ ok:false, error:"OPENAI_API_KEY manquante" }, 500);

    const t0 = Date.now();
    const body = {
      model: OPENAI_MODEL,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Réponds uniquement avec du JSON." },
        { role: "user", content: "Rends {\"pong\":true}" }
      ],
      max_tokens: 20
    };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body)
    });

    const dt = Date.now() - t0;
    const txt = await r.text();
    if (!r.ok) return json({ ok:false, step:"openai", status:r.status, body:txt, latencyMs: dt }, 500);

    let data;
    try { data = JSON.parse(txt); } catch { return json({ ok:false, parse:true, body:txt, latencyMs:dt }, 500); }

    const content = data?.choices?.[0]?.message?.content || "";
    let out;
    try { out = JSON.parse(content); } catch { out = { raw: content }; }

    return json({ ok:true, latencyMs: dt, model: data?.model, out });
  } catch (e) {
    return json({ ok:false, error: String(e) }, 500);
  }
}

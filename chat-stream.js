// api/chat-stream.js
export const config = { runtime: "nodejs" };

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const ref = searchParams.get("q") || "Marc 5:1-20";

  if (!process.env.OPENAI_API_KEY) {
    res.write(`data: ${JSON.stringify({ error: "OPENAI_API_KEY manquant" })}\n\n`);
    res.end();
    return;
  }

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.2,
        stream: true,
        messages: [
          {
            role: "system",
            content: `
Tu génères une étude biblique en 28 points, chaque point en JSON comme ceci :
{ "id": 1, "title": "...", "content": "...", "verses": ["Marc 5:1-5"] }

⚠️ Un seul objet par ligne.
⚠️ Pas de texte hors JSON.
⚠️ 28 objets, id de 1 à 28.
`.trim()
          },
          { role: "user", content: `Référence demandée : ${ref}` }
        ]
      })
    });

    if (!resp.ok) {
      const errorText = await resp.text();
      res.write(`data: ${JSON.stringify({ error: "OpenAI API error", body: errorText })}\n\n`);
      res.end();
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");

    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.replace("data: ", "").trim();
          if (data === "[DONE]") {
            res.write(`event: end\ndata: {}\n\n`);
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              // chaque fragment peut être concaténé → on envoie brut
              res.write(`data: ${JSON.stringify({ chunk: content })}\n\n`);
            }
          } catch {
            // ignore si pas JSON
          }
        }
      }
    }
  } catch (e) {
    res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    res.end();
  }
}

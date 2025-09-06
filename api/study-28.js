// /api/study-28.js — Next.js (pages/api) — renvoie toujours du JSON

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

/* ========= Schéma JSON (full 28) ========= */
const schemaFull = {
  name: "study_28",
  schema: {
    type: "object",
    properties: {
      meta: {
        type: "object",
        properties: {
          book: { type: "string" },
          chapter: { type: "string" },
          verse: { type: "string" },
          translation: { type: "string" },
          reference: { type: "string" },
          osis: { type: "string" }
        },
        required: ["book", "chapter", "translation", "reference", "osis"]
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          properties: {
            index: { type: "integer" },
            title: { type: "string" },
            content: { type: "string" },
            verses: { type: "array", items: { type: "string" } }
          },
          required: ["index", "title", "content"]
        }
      }
    },
    required: ["meta", "sections"]
  },
  strict: true
};

/* ========= helpers ========= */
function jOk(res, data)  { res.status(200).json({ ok: true, data }); }
function jErr(res, error){ res.status(200).json({ ok: false, error: String(error) }); }

function getBaseUrl(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}`;
  } catch {}
  return "http://localhost:3000";
}

function mkAbort(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, ms || 30000));
  return { ctrl, t };
}

/* ========= OpenAI (mini) ========= */
async function oaiMini({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, t } = mkAbort(timeoutMs);
  const body = {
    model,
    temperature: 0.15,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 700,
    // ⬇️ CORRECTION : text.format est un objet avec { type: "json_object" }
    text: { format: { type: "json_object" } },
    input: prompt
  };

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(t);
    return { error: `OpenAI fetch error: ${e?.message || e}`, _req: debug ? body : undefined };
  }
  clearTimeout(t);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `OpenAI ${res.status}: ${txt}`, _req: debug ? body : undefined, _raw: debug ? txt : undefined };
  }

  const out = await res.json().catch(() => null);
  if (debug && out) out._req = body;

  if (out?.output_parsed) return { data: out.output_parsed, _raw: debug ? out : undefined };

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return { data: JSON.parse(out.output_text), _raw: debug ? out : undefined }; }
    catch { return { error: "Sortie OpenAI non-JSON (mini).", _raw: debug ? out : undefined }; }
  }

  const maybe = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybe === "string" && maybe.trim()) {
    try { return { data: JSON.parse(maybe), _raw: debug ? out : undefined }; }
    catch { return { error: "Sortie OpenAI non-JSON (mini).", _raw: debug ? out : undefined }; }
  }

  return { error: "Sortie OpenAI vide (mini).", _raw: debug ? out : undefined };
}

/* ========= OpenAI (full 28) ========= */
async function oaiFull({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, t } = mkAbort(timeoutMs);
  const body = {
    model,
    temperature: 0.12,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(900, maxtok) : 1500,
    // ⬇️ CORRECTION : text.format => objet { type: "json_schema", schema: ... }
    text: { format: { type: "json_schema", schema: schemaFull } },
    input: prompt
  };

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (e) {
    clearTimeout(t);
    return { error: `OpenAI fetch error: ${e?.message || e}`, _req: debug ? body : undefined };
  }
  clearTimeout(t);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `OpenAI ${res.status}: ${txt}`, _req: debug ? body : undefined, _raw: debug ? txt : undefined };
  }

  const out = await res.json().catch(() => null);
  if (debug && out) out._req = body;

  if (out?.output_parsed) return { data: out.output_parsed, _raw: debug ? out : undefined };

  if (typeof out?.output_text === "string" && out.output_text.trim()) {
    try { return { data: JSON.parse(out.output_text), _raw: debug ? out : undefined }; }
    catch { return { error: "Sortie OpenAI non-JSON (full).", _raw: debug ? out : undefined }; }
  }

  const maybe = out?.output?.[0]?.content?.[0]?.text;
  if (typeof maybe === "string" && maybe.trim()) {
    try { return { data: JSON.parse(maybe), _raw: debug ? out : undefined }; }
    catch { return { error: "Sortie OpenAI non-JSON (full).", _raw: debug ? out : undefined }; }
  }

  return { error: "Sortie OpenAI vide (full).", _raw: debug ? out : undefined };
}

/* ========= Handler principal ========= */
export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const sp = req.query || {};

    const book        = sp.book        || "Genèse";
    const chapter     = sp.chapter     || "1";
    const verse       = sp.verse       || "";
    const translation = sp.translation || "JND";
    const bibleId     = sp.bibleId     || "";
    const mode        = (sp.mode || "full").toLowerCase(); // mini | full
    const model       = sp.model || DEFAULT_MODEL;
    const maxtok      = parseInt(sp.maxtok || (mode === "mini" ? "700" : "1500"), 10);
    const timeout     = parseInt(sp.oaitimeout || "30000", 10);
    const debug       = sp.debug === "1";
    const dry         = sp.dry === "1";

    if (dry) {
      return jOk(res, {
        meta: { book, chapter, verse, translation, reference: `${book} ${chapter}${verse ? ":"+verse : ""}`, osis: "" },
        sections: (mode === "mini")
          ? [
              { index: 1, title: "Thème central", content: "Exemple MINI.", verses: [] },
              { index: 2, title: "Idées majeures (développement)", content: "Exemple MINI.", verses: [] },
              { index: 3, title: "Applications personnelles", content: "Exemple MINI.", verses: [] }
            ]
          : Array.from({length:28}, (_,i)=>({ index:i+1, title:`Section ${i+1}`, content:"Exemple FULL.", verses:[] }))
      });
    }

    // 1) Passage via /api/bibleProvider
    const base = getBaseUrl(req);
    const url =
      `${base}/api/bibleProvider?book=${encodeURIComponent(book)}` +
      `&chapter=${encodeURIComponent(chapter)}` +
      (verse ? `&verse=${encodeURIComponent(verse)}` : "") +
      (bibleId ? `&bibleId=${encodeURIComponent(bibleId)}` : "");

    let passageJson;
    try {
      const pRes = await fetch(url, { headers: { Accept: "application/json" } });
      if (!pRes.ok) {
        const txt = await pRes.text().catch(() => "");
        return jErr(res, `BibleProvider ${pRes.status}: ${txt}`);
      }
      passageJson = await pRes.json().catch(() => null);
    } catch (e) {
      return jErr(res, `BibleProvider fetch error: ${e?.message || e}`);
    }

    if (!passageJson?.ok || !passageJson?.data?.passageText) {
      return jErr(res, passageJson?.error || "BibleProvider: réponse invalide.");
    }
    const passage = passageJson.data;

    // 2) Prompt
    const isFull = mode === "full";
    const header =
`Tu es un bibliste pédagogue. Réponds STRICTEMENT en JSON ${isFull ? "(schéma 28 sections)" : "(3 sections)"}.
Langue: français. N'invente pas de versets. Cite uniquement le passage fourni.`;

    const guideFull =
`Structure 28 sections (index 1..28, titres exacts) :
1.Thème central
2.Résumé en une phrase
3.Contexte historique
4.Auteur et date
5.Genre littéraire
6.Structure du passage
7.Plan détaillé
8.Mots-clés
9.Termes clés (définis)
10.Personnages et lieux
11.Problème / Question de départ
12.Idées majeures (développement)
13.Verset pivot (climax)
14.Références croisées (AT)
15.Références croisées (NT)
16.Parallèles bibliques
17.Lien avec l’Évangile (Christocentrique)
18.Vérités doctrinales (3–5)
19.Promesses et avertissements
20.Principes intemporels
21.Applications personnelles (3–5)
22.Applications communautaires
23.Questions pour petits groupes (6)
24.Prière guidée
25.Méditation courte
26.Versets à mémoriser (2–3)
27.Difficultés/objections & réponses
28.Ressources complémentaires`;

    const guideMini =
`Structure 3 sections EXACTES :
1) Thème central
2) Idées majeures (développement)
3) Applications personnelles`;

    const schemaHint =
`Schéma JSON :
{
  "meta": { "book": string, "chapter": string, "verse": string, "translation": string, "reference": string, "osis": string },
  "sections": [ { "index": number, "title": string, "content": string, "verses": string[]? }, ... ]
}
Réponds UNIQUEMENT par l'objet JSON.`;

    const prompt =
`${header}

Passage : ${passage.reference} (${translation})
OSIS : ${passage.osis}

Texte (entre triples backticks) :
\`\`\`
${passage.passageText}
\`\`\`

Contraintes :
${isFull ? guideFull : guideMini}

${schemaHint}`;

    // 3) OpenAI
    const resOai = isFull
      ? await oaiFull({ model: DEFAULT_MODEL, prompt, maxtok: Number.isFinite(maxtok) ? maxtok : 1500, timeoutMs: timeout, debug })
      : await oaiMini({ model: DEFAULT_MODEL, prompt, maxtok: Number.isFinite(maxtok) ? maxtok : 700,  timeoutMs: timeout, debug });

    if (resOai.error) {
      if (debug) return jErr(res, { message: resOai.error, debug: { request: resOai._req, raw: resOai._raw } });
      return jErr(res, resOai.error);
    }

    const parsed = resOai.data;
    if (!parsed || typeof parsed !== "object") {
      if (debug) return jErr(res, { message: "Sortie OpenAI invalide.", debug: { request: resOai._req, raw: resOai._raw } });
      return jErr(res, "Sortie OpenAI invalide.");
    }

    parsed.meta = {
      book, chapter, verse, translation,
      reference: passage.reference,
      osis: passage.osis,
      ...(parsed.meta || {})
    };

    if (isFull) {
      if (!Array.isArray(parsed.sections)) {
        return jErr(res, "Le modèle n’a pas renvoyé de tableau 'sections'.");
      }
      if (parsed.sections.length !== 28) {
        return jErr(res, `Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`);
      }
    }

    return jOk(res, parsed);

  } catch (e) {
    return jErr(res, e?.message || e);
  }
}

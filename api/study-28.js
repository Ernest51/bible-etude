// /api/study-28.js — Next.js API Route (Node.js runtime)

export const config = { runtime: "nodejs" };

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL  = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

/* ========= Schéma JSON (full 28) ========= */
const schemaFull = {
  name: "study_28",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      meta: {
        type: "object",
        additionalProperties: false,
        properties: {
          book:        { type: "string" },
          chapter:     { type: "string" },
          verse:       { type: "string" },
          translation: { type: "string" },
          reference:   { type: "string" },
          osis:        { type: "string" }
        },
        required: ["book", "chapter", "verse", "translation", "reference", "osis"]
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            index:   { type: "integer" },
            title:   { type: "string" },
            content: { type: "string" },
            verses:  {
              type: "array",
              items: { type: "string" }
            }
          },
          // IMPORTANT: required couvre TOUTES les props, y compris 'verses'
          required: ["index", "title", "content", "verses"]
        }
      }
    },
    required: ["meta", "sections"]
  },
  strict: true
};

/* ========= helpers JSON ========= */
function jOk(res, data)  { res.status(200).json({ ok: true, data }); }
function jErr(res, error){ res.status(200).json({ ok: false, error: typeof error === "string" ? error : JSON.stringify(error) }); }

function getBaseUrl(req) {
  try {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host  = req.headers["x-forwarded-host"] || req.headers.host;
    if (host) return `${proto}://${host}`;
  } catch {}
  return "http://localhost:3000";
}

/* ========= Abort utils ========= */
function mkAbort(ms) {
  if (!ms || ms <= 0) return { ctrl: undefined, clear: () => {} };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return { ctrl, clear: () => clearTimeout(timer) };
}

/* ========= fetch avec retry (429/5xx/AbortError) ========= */
async function fetchWithRetry(url, opts, { tries = 2, backoffMs = 800 } = {}) {
  let lastErr, attempt = 0;
  while (attempt <= tries) {
    try {
      const r = await fetch(url, opts);
      if (r.status === 429 || (r.status >= 500 && r.status <= 599)) {
        lastErr = new Error(`HTTP ${r.status}: ${await r.text().catch(()=> "")}`);
        if (attempt === tries) throw lastErr;
      } else {
        return r;
      }
    } catch (e) {
      const aborted = e?.name === "AbortError";
      if (attempt === tries) throw new Error(aborted ? "AbortError" : (e?.message || e));
      lastErr = e;
    }
    await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt)));
    attempt++;
  }
  throw lastErr || new Error("fetchWithRetry: unknown error");
}

/* ========= OpenAI (mini) ========= */
async function oaiMini({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, clear } = mkAbort(timeoutMs || 55000);
  const body = {
    model,
    temperature: 0.15,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 700,
    text: { format: { type: "json_object", name: "study_28_mini" } },
    input: prompt
  };

  try {
    const r = await fetchWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(body),
        ...(ctrl ? { signal: ctrl.signal } : {})
      }
    );
    clear();

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { error: `OpenAI ${r.status}: ${txt}`, _req: debug ? body : undefined, _raw: debug ? txt : undefined };
    }

    const out = await r.json().catch(() => null);
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

  } catch (e) {
    clear();
    if (e?.message === "AbortError") return { error: "OpenAI fetch error: This operation was aborted" };
    return { error: `OpenAI fetch error: ${e?.message || e}` };
  }
}

/* ========= OpenAI (full 28) ========= */
async function oaiFull({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, clear } = mkAbort(timeoutMs || 55000);
  const body = {
    model,
    temperature: 0.12,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(900, maxtok) : 1500,
    text: {
      format: {
        type: "json_schema",
        name: schemaFull.name,
        schema: schemaFull.schema,
        strict: schemaFull.strict
      }
    },
    input: prompt
  };

  try {
    const r = await fetchWithRetry(
      "https://api.openai.com/v1/responses",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify(body),
        ...(ctrl ? { signal: ctrl.signal } : {})
      }
    );
    clear();

    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      return { error: `OpenAI ${r.status}: ${txt}`, _req: debug ? body : undefined, _raw: debug ? txt : undefined };
    }

    const out = await r.json().catch(() => null);
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

  } catch (e) {
    clear();
    if (e?.message === "AbortError") return { error: "OpenAI fetch error: This operation was aborted" };
    return { error: `OpenAI fetch error: ${e?.message || e}` };
  }
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
    const timeout     = parseInt(sp.oaitimeout || "55000", 10); // ← par défaut 55s
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
      const pRes = await fetchWithRetry(url, { headers: { Accept: "application/json" } }, { tries: 1 });
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
  "sections": [ { "index": number, "title": string, "content": string, "verses": string[] }, ... ]
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

    // 3) OpenAI (avec retry & timeout souple)
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

    // Normalisation meta
    parsed.meta = {
      book, chapter, verse, translation,
      reference: passage.reference,
      osis: passage.osis,
      ...(parsed.meta || {})
    };

    // Normalisation sections: garantir verses: []
    if (Array.isArray(parsed.sections)) {
      parsed.sections = parsed.sections.map(s => ({
        ...s,
        verses: Array.isArray(s?.verses) ? s.verses : []
      }));
    }

    if (isFull) {
      if (!Array.isArray(parsed.sections))
        return jErr(res, "Le modèle n’a pas renvoyé de tableau 'sections'.");
      if (parsed.sections.length !== 28)
        return jErr(res, `Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`);
    }

    return jOk(res, parsed);

  } catch (e) {
    return jErr(res, e?.message || e);
  }
}

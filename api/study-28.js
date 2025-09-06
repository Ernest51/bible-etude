// /api/study-28.js
import { NextResponse } from "next/server";

/** ===== Runtime & cache ===== */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ===== Config ===== */
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini-2024-07-18";

/** ===== Schéma JSON (full 28) ===== */
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

/** ===== Utils ===== */
const jOk  = (data)  => NextResponse.json({ ok: true,  data  });
const jErr = (error) => NextResponse.json({ ok: false, error: String(error) });

function baseUrl(req) {
  try {
    const host  = req.headers.get("x-forwarded-host");
    const proto = req.headers.get("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`;
  } catch {}
  return "http://localhost:3000";
}

function mkAbort(ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), Math.max(1000, ms || 30000));
  return { ctrl, t };
}

/** ===== OpenAI calls ===== */
async function oaiMini({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, t } = mkAbort(timeoutMs);
  const body = {
    model,
    temperature: 0.15,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(300, maxtok) : 700,
    text: { format: "json_object" },
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
    return { error: `OpenAI fetch error: ${e?.message || e}` , _req: debug ? body : undefined };
  }
  clearTimeout(t);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return { error: `OpenAI ${res.status}: ${txt}`, _req: debug ? body : undefined, _raw: debug ? txt : undefined };
  }

  const out = await res.json().catch(() => null);
  if (debug) out && (out._req = body);

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

async function oaiFull({ model, prompt, maxtok, timeoutMs, debug }) {
  if (!OPENAI_API_KEY) return { error: "OPENAI_API_KEY manquante." };

  const { ctrl, t } = mkAbort(timeoutMs);
  const body = {
    model,
    temperature: 0.12,
    max_output_tokens: Number.isFinite(maxtok) ? Math.max(900, maxtok) : 1500,
    text: { format: "json_schema", json_schema: schemaFull },
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
  if (debug) out && (out._req = body);

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

/** ===== Route handler ===== */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);

    const book        = searchParams.get("book")        || "Genèse";
    const chapter     = searchParams.get("chapter")     || "1";
    const verse       = searchParams.get("verse")       || "";
    const translation = searchParams.get("translation") || "JND";
    const bibleId     = searchParams.get("bibleId")     || "";
    const mode        = (searchParams.get("mode") || "full").toLowerCase(); // mini | full
    const model       = searchParams.get("model") || DEFAULT_MODEL;
    const maxtok      = parseInt(searchParams.get("maxtok") || (mode === "mini" ? "700" : "1500"), 10);
    const timeout     = parseInt(searchParams.get("oaitimeout") || "30000", 10);
    const debug       = searchParams.get("debug") === "1";
    const dry         = searchParams.get("dry") === "1";

    // 0) Dry-run sans OpenAI -> pour prouver que la route ne crash pas
    if (dry) {
      return jOk({
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

    // 1) Récupérer le passage via /api/bibleProvider
    const base = baseUrl(req);
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
        return jErr(`BibleProvider ${pRes.status}: ${txt}`);
      }
      passageJson = await pRes.json().catch(() => null);
    } catch (e) {
      return jErr(`BibleProvider fetch error: ${e?.message || e}`);
    }

    if (!passageJson?.ok || !passageJson?.data?.passageText) {
      return jErr(passageJson?.error || "BibleProvider: réponse invalide.");
    }
    const passage = passageJson.data;

    // 2) Prompts
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

    // 3) Appel OpenAI selon le mode
    const res = isFull
      ? await oaiFull({ model: DEFAULT_MODEL, prompt, maxtok: Number.isFinite(maxtok) ? maxtok : 1500, timeoutMs: timeout, debug })
      : await oaiMini({ model: DEFAULT_MODEL, prompt, maxtok: Number.isFinite(maxtok) ? maxtok : 700,  timeoutMs: timeout, debug });

    if (res.error) {
      if (debug) return jErr({ message: res.error, debug: { request: res._req, raw: res._raw } });
      return jErr(res.error);
    }

    const parsed = res.data;
    if (!parsed || typeof parsed !== "object") {
      if (debug) return jErr({ message: "Sortie OpenAI invalide.", debug: { request: res._req, raw: res._raw } });
      return jErr("Sortie OpenAI invalide.");
    }

    // 4) compléter meta et vérifier le nombre de sections
    parsed.meta = {
      book, chapter, verse, translation,
      reference: passage.reference,
      osis: passage.osis,
      ...(parsed.meta || {})
    };

    if (isFull) {
      if (!Array.isArray(parsed.sections)) {
        return jErr("Le modèle n’a pas renvoyé de tableau 'sections'.");
      }
      if (parsed.sections.length !== 28) {
        return jErr(`Le modèle n’a pas renvoyé 28 sections (reçu: ${parsed.sections.length}).`);
      }
    }

    return jOk(parsed);

  } catch (e) {
    // Dernier filet de sécurité : rien ne fuit en 500 non contrôlé
    return jErr(e?.message || e);
  }
}

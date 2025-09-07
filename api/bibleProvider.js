// api/bibleProvider.js
export const config = { runtime: "nodejs" };

const API_ROOT = "https://api.scripture.api.bible/v1";
const KEY = process.env.API_BIBLE_KEY || "";
const DEFAULT_BIBLE_ID =
  process.env.API_BIBLE_ID ||
  process.env.API_BIBLE_BIBLE_ID ||
  "";

// ----------- util -----------

function mkErr(message, status = 500, details) {
  const e = new Error(message);
  e.status = status;
  if (details) e.details = details;
  return e;
}

async function callApiBible(path, params = {}, trace) {
  if (!KEY) throw mkErr("API_BIBLE_KEY manquante dans les variables d’environnement.", 500);

  const url = new URL(API_ROOT + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });

  trace && trace.push({ step: "fetch", url: url.toString() });

  const r = await fetch(url, {
    headers: { accept: "application/json", "api-key": KEY },
  });

  const text = await r.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }

  if (!r.ok) {
    const msg = json?.error?.message || `api.bible ${r.status}`;
    trace && trace.push({ step: "error", status: r.status, body: (json?.error || json?.raw || text)?.toString?.().slice(0, 300) });
    throw mkErr(msg, r.status, json);
  }

  trace && trace.push({ step: "ok", status: r.status });
  return json;
}

// ----------- exports -----------

export async function getBibles({ language } = {}, trace) {
  const data = await callApiBible("/bibles", language ? { language } : {}, trace);
  return data?.data || [];
}

export async function resolveBibleId(preferredId, trace) {
  if (preferredId) return preferredId;
  if (DEFAULT_BIBLE_ID) return DEFAULT_BIBLE_ID;

  const bibles = await getBibles({}, trace);
  if (!bibles.length) throw mkErr("Aucune Bible disponible depuis api.bible", 500);

  const fr = bibles.find(b =>
    (b.language?.id || "").toLowerCase().startsWith("fra") ||
    (b.language?.name || "").toLowerCase().includes("french")
  );
  return fr?.id || bibles[0].id;
}

export async function getPassage({ bibleId, ref, includeVerseNumbers = true }, trace) {
  const id = await resolveBibleId(bibleId, trace);
  if (!ref) throw mkErr('Paramètre "ref" requis (ex: "GEN.1")', 400);

  const params = {
    "content-type": "html",
    "include-notes": false,
    "include-titles": true,
    "include-chapter-numbers": true,
    "include-verse-numbers": !!includeVerseNumbers,
    "include-verse-spans": false,
    "use-org-id": false,
  };

  // 1) tentative /passages/{ref}
  try {
    const j = await callApiBible(`/bibles/${id}/passages/${encodeURIComponent(ref)}`, params, trace);
    return {
      bibleId: id,
      reference: j?.data?.reference || ref,
      contentHtml: j?.data?.content || "",
    };
  } catch (e) {
    // 1b) si chapitre nu (ex: GEN.1), retente avec 1–199 pour bibles récalcitrantes
    if (/^\w+\.\d+$/.test(ref)) {
      const [b, c] = ref.split(".");
      const range = `${b}.${c}.1-${b}.${c}.199`;
      try {
        const j2 = await callApiBible(`/bibles/${id}/passages/${encodeURIComponent(range)}`, params, trace);
        return {
          bibleId: id,
          reference: j2?.data?.reference || range,
          contentHtml: j2?.data?.content || "",
        };
      } catch { /* ignore, on tombera en fallback */ }
    }
  }

  // 2) fallback /chapters/{ref}
  const j3 = await callApiBible(`/bibles/${id}/chapters/${encodeURIComponent(ref)}`, params, trace);
  return {
    bibleId: id,
    reference: j3?.data?.reference || ref,
    contentHtml: j3?.data?.content || "",
  };
}

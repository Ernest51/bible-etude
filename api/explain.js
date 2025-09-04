// /api/explain.js
// "Lire la Bible" — Lecture + explication avec RÉPONSES courtes (sans OpenAI)
// GET: ?book=Genèse&chapter=1&verse=1-3
export const config = { runtime: "nodejs" };

/* ───────────── Utils ───────────── */

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n || 1));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function refString(book, chapter, verse) {
  const ch = clamp(parseInt(chapter, 10), 1, 150);
  return verse ? `${cap(book)} ${ch}:${verse}` : `${cap(book)} ${ch}`;
}

// Autorise p,strong,em,a,ul,ol,li
function safeHtml(s = "") {
  return String(s)
    .replace(/<(?!\/?(p|strong|em|a|ul|ol|li)(\s|>|\/))/gi, "&lt;")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/<a([^>]*?)>/gi, (m, attrs) => {
      const href = (attrs.match(/\shref="[^"]*"/i) || [""])[0];
      return `<a${href} target="_blank" rel="noopener">`;
    });
}

const proseBlock = (inner) => `<div class="prose prose-slate max-w-none">${inner}</div>`;
const esc = (s="") => String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

/* ───────────── Extraction simple depuis le texte ───────────── */

const STOP_CAP = new Set([
  "Et","Or","Car","Mais","Ainsi","Alors","Donc","Afin","Pour","En","Au","Aux","Du","De","La","Le","Les","Un","Une",
  "Que","Quiconque","Qui","Quoi","Où","Quand","Parce","Ce","Cette","Ces","Ceci"
]);

const VERB_PATTERNS = [
  ["aimer","aim","aime","aimé","aima"],
  ["donner","don","donne","donné","donna"],
  ["croire","croi","croit","cru","croyez","croyons"],
  ["dire","dit","dis","déclare","parle"],
  ["envoyer","envoy","envoie","envoyé"],
  ["sauver","sauv","sauvé","salut"],
  ["pardonner","pardon","pardonné"],
  ["juger","jug","jugement"],
  ["bénir","bén","bénit","bénédiction"],
  ["vivre","vie","vivra","vivre"],
  ["périr","pér","périsse","perdition","mort"],
  ["chercher","cherch"],
  ["marcher","march"],
  ["obéir","obé","obéis","obéissance"]
];

const THEME_PATTERNS = [
  ["amour de Dieu", /amour|aim/i],
  ["foi", /croit|foi|croire/i],
  ["grâce / don", /don|gr[aâ]ce/i],
  ["salut / vie", /salut|vie[^\p{L}]?etern|vie étern/i],
  ["jugement / perdition", /jugement|p[ée]r[iy]/i],
  ["Christ / Fils", /fils|christ|j[ée]sus/i],
  ["Alliance / promesse", /alliance|promesse/i],
  ["obéissance / marche", /ob[ée]i|marche/i],
];

const PROMESSE_PAT = /(vie[^\p{L}]?etern|vie étern|salut|paix|joie|gr[aâ]ce|pardon)/i;
const AVERT_PAT   = /(p[ée]r[iy]|jugement|col[èe]re|malheur|mort)/i;
const BUT_PAT     = /(afin que|pour que|en sorte que)/i;
const CAUSE_PAT   = /(car|parce que|puisque)/i;
const CONTR_PAT   = /\bmais\b/i;

function capitalizeFirst(w) {
  if (!w) return w;
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function extractActors(text) {
  // Mots qui commencent par majuscule (y compris accents)
  const tokens = Array.from(text.matchAll(/\b([\p{Lu}ÉÈÀÂÊÎÔÛÄËÏÖÜÇ][\p{L}’'-]{1,})\b/gu)).map(m => m[1]);
  const cleaned = tokens
    .filter(w => !STOP_CAP.has(w))
    .map(w => w.replace(/[’'-]+$/g, ""))
    .filter(w => w.length > 1);

  // Regroupements simples
  const set = new Set(cleaned);
  if (set.has("Éternel") || set.has("Seigneur")) set.add("Dieu");
  if (set.has("Jésus")) set.add("Christ");
  if (set.has("Fils")) set.add("Fils (unique)");
  return Array.from(set).slice(0, 6);
}

function extractActions(text) {
  const lower = text.toLowerCase();
  const actions = [];
  VERB_PATTERNS.forEach(([label, ...stems])=>{
    if (stems.some(s => lower.includes(s))) actions.push(label);
  });
  return Array.from(new Set(actions)).slice(0, 8);
}

function detectStructure(text) {
  return {
    cause: CAUSE_PAT.test(text),
    but: BUT_PAT.test(text),
    contraste: CONTR_PAT.test(text)
  };
}

function detectThemes(text) {
  const themes = [];
  THEME_PATTERNS.forEach(([label, rx]) => { if (rx.test(text)) themes.push(label); });
  return Array.from(new Set(themes)).slice(0, 6);
}

function summarizePromisesWarnings(text) {
  const prom = PROMESSE_PAT.test(text) ? "Promesse : « vie éternelle / salut » (ou bénédiction associée)." : null;
  const av   = AVERT_PAT.test(text) ? "Avertissement : perte / jugement / mort pour qui refuse." : null;
  return { prom, av };
}

function suggestApplication(text) {
  const items = [];
  if (/croit/i.test(text)) items.push("Réponse de foi : croire / se confier personnellement.");
  if (/don/i.test(text)) items.push("Accueillir le don de Dieu avec gratitude (pas par mérite).");
  if (/amour|aim/i.test(text)) items.push("Imiter l’amour reçu en actes concrets envers autrui.");
  if (/p[ée]r/i.test(text)) items.push("Prendre au sérieux l’appel : revenir à Dieu, ne pas rester indifférent.");
  if (!items.length) items.push("Lire, prier, et décider un pas concret (aujourd’hui/cette semaine).");
  return items.slice(0, 3);
}

/* ───────────── Génération HTML avec réponses ───────────── */

function buildExplainHTML(reference, rawText = "") {
  const actors = extractActors(rawText);
  const actions = extractActions(rawText);
  const struct = detectStructure(rawText);
  const themes = detectThemes(rawText);
  const { prom, av } = summarizePromisesWarnings(rawText);
  const apps = suggestApplication(rawText);

  const intro =
    `<p><strong>${esc(reference)}</strong> — Lecture lente du texte avec repères simples (acteurs, actions, structure, thème), puis réponse de foi.</p>`;

  const obs = `
    <p><strong>Observation — réponses.</strong></p>
    <ul>
      <li><strong>Acteurs</strong> : ${actors.length ? actors.map(esc).join(", ") : "—"}</li>
      <li><strong>Actions</strong> : ${actions.length ? actions.map(a=>esc(capitalizeFirst(a))).join(", ") : "—"}</li>
      <li><strong>Structure</strong> : ${[
        struct.cause ? "cause (« car… »)" : null,
        struct.but ? "but/finalité (« afin que… »)" : null,
        struct.contraste ? "contraste (« mais… »)" : null
      ].filter(Boolean).join(" · ") || "—"}</li>
      <li><strong>Thèmes</strong> : ${themes.length ? themes.map(esc).join(", ") : "—"}</li>
    </ul>`;

  const comp = `
    <p><strong>Compréhension — réponses.</strong></p>
    <ul>
      ${prom ? `<li>${esc(prom)}</li>` : ""}
      ${av   ? `<li>${esc(av)}</li>`   : ""}
      ${(!prom && !av) ? `<li>Message central : ${themes.length ? esc(themes[0]) : "Dieu agit, l’humain est invité à répondre par la foi"}.</li>` : ""}
    </ul>`;

  const app = `
    <p><strong>Application — pistes concrètes.</strong></p>
    <ul>${apps.map(a=>`<li>${esc(a)}</li>`).join("")}</ul>`;

  const texte = `<p><em>Texte (extrait)&nbsp;:</em> ${esc(rawText)}</p>`;

  return safeHtml(proseBlock(intro + obs + comp + app + texte));
}

/* ───────────── Handler ───────────── */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  try {
    const { book = "Genèse", chapter = "1", verse = "" } = req.query || {};
    const reference = refString(book, chapter, verse);

    // Appel provider interne (même déploiement)
    const baseUrl =
      (req.headers["x-forwarded-proto"] || "https") + "://" + req.headers.host;
    const qs = new URLSearchParams({ book, chapter, verse }).toString();
    const url = `${baseUrl}/api/bibleProvider?${qs}`;

    const r = await fetch(url, { headers: { "x-internal": "1" } });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`bibleProvider ${r.status}: ${body || r.statusText}`);
    }
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || "Erreur provider");

    // j.data.items : [{ v, text }]
    const items = Array.isArray(j.data?.items) ? j.data.items : [];
    const firstText = items[0]?.text || "";

    const payload = {
      ok: true,
      data: {
        reference,
        items: [
          {
            v: items[0]?.v || 0,
            text: firstText,
            html: buildExplainHTML(reference, firstText)
          }
        ]
      }
    };

    return res.status(200).json(payload);
  } catch (e) {
    // Réponse propre pour l’UI
    return res
      .status(200)
      .json({ ok: false, error: String(e?.message || e || "Erreur inconnue") });
  }
}

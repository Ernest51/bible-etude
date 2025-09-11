// /api/verses.js
// GET /api/verses?book=Genèse&chapter=1[&count=31]
// Réponse: { ok:true, source:'api.bible.verses|api.bible.chapter|fallback-generated', book, chapter, version, verses:[{v,text,noteHTML}] }

export const config = { runtime: "nodejs" };

/* --------------------------- Constantes --------------------------- */
const USFM = {
  "Genèse":"GEN","Exode":"EXO","Lévitique":"LEV","Nombres":"NUM","Deutéronome":"DEU","Josué":"JOS","Juges":"JDG","Ruth":"RUT",
  "1 Samuel":"1SA","2 Samuel":"2SA","1 Rois":"1KI","2 Rois":"2KI","1 Chroniques":"1CH","2 Chroniques":"2CH",
  "Esdras":"EZR","Néhémie":"NEH","Esther":"EST","Job":"JOB","Psaumes":"PSA","Proverbes":"PRO","Ecclésiaste":"ECC",
  "Cantique des Cantiques":"SNG","Ésaïe":"ISA","Jérémie":"JER","Lamentations":"LAM","Ézéchiel":"EZK","Daniel":"DAN",
  "Osée":"HOS","Joël":"JOL","Amos":"AMO","Abdias":"OBA","Jonas":"JON","Michée":"MIC","Nahum":"NAM","Habacuc":"HAB",
  "Sophonie":"ZEP","Aggée":"HAG","Zacharie":"ZEC","Malachie":"MAL","Matthieu":"MAT","Marc":"MRK","Luc":"LUK","Jean":"JHN",
  "Actes":"ACT","Romains":"ROM","1 Corinthiens":"1CO","2 Corinthiens":"2CO","Galates":"GAL","Éphésiens":"EPH",
  "Philippiens":"PHP","Colossiens":"COL","1 Thessaloniciens":"1TH","2 Thessaloniciens":"2TH","1 Timothée":"1TI",
  "2 Timothée":"2TI","Tite":"TIT","Philémon":"PHM","Hébreux":"HEB","Jacques":"JAS","1 Pierre":"1PE","2 Pierre":"2PE",
  "1 Jean":"1JN","2 Jean":"2JN","3 Jean":"3JN","Jude":"JUD","Apocalypse":"REV"
};

const API_BASE = "https://api.scripture.api.bible/v1";

/* --------------------------- Helpers --------------------------- */
function send(res, status, data) {
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store, max-age=0");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type,accept");
  res.statusCode = status;
  res.end(JSON.stringify(data));
}

const CLEAN = (s) => String(s||'')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .replace(/\s([;:,.!?…])/g, '$1')
  .trim();

/* ---------- Q/R heuristiques (Qui/Quoi/Où/Quand/Pourquoi/Comment) ---------- */
function inferQA(text){
  const t = (text||"").toLowerCase();

  // Qui ?
  let qui = "Le texte ne précise pas explicitement.";
  if (/\bdieu|seigneur\b/.test(t)) qui = "Dieu (YHWH) est l’acteur principal.";
  else if (/\bj[eé]sus|christ\b/.test(t)) qui = "Jésus/Christ est au centre du verset.";
  else if (/\besprit\b/.test(t)) qui = "L’Esprit de Dieu est en action.";
  else if (/\bmo[i|ï]se\b/.test(t)) qui = "Moïse.";
  else if (/\bdavid\b/.test(t)) qui = "David.";
  else if (/\bproph[eè]te?s?\b/.test(t)) qui = "Un/des prophète(s).";
  else if (/\bpeuple|isra[eë]l\b/.test(t)) qui = "Le peuple d’Israël.";

  // Quoi ? (verbes clés)
  let quoi = "Le verset énonce une vérité/une action de Dieu.";
  if (/\bcr[eé]a\b/.test(t)) quoi = "Dieu crée/établit.";
  else if (/\bdit\b|\bparla\b/.test(t)) quoi = "Dieu parle/ordonne.";
  else if (/\bvit\b|\bvois\b/.test(t)) quoi = "Dieu voit/évalue.";
  else if (/\bappela\b|\bnoma\b/.test(t)) quoi = "Dieu nomme/définit.";
  else if (/\bfit\b|\bfais(it)?\b/.test(t)) quoi = "Dieu agit/opère.";
  else if (/\bb[eé]nit\b/.test(t)) quoi = "Dieu bénit.";
  else if (/\bsanctifia\b|\bconsacra\b/.test(t)) quoi = "Dieu sanctifie/consacre.";
  else if (/\bcommand(e|a)\b/.test(t)) quoi = "Dieu commande/instruit.";

  // Où ?
  let ou = "Dans le cadre narratif du passage.";
  if (/\bcieux?\b/.test(t) && /\bterre\b/.test(t)) ou = "Dans la création (cieux et terre).";
  else if (/\bd[eé]sert\b/.test(t)) ou = "Au désert.";
  else if (/\bj[eé]rusalem\b/.test(t)) ou = "À Jérusalem.";
  else if (/\btemple\b/.test(t)) ou = "Au temple.";
  else if (/\bmont\b|\bmontagne\b/.test(t)) ou = "Sur une montagne.";

  // Quand ?
  let quand = "Inscrit dans la séquence du récit.";
  if (/\bau commencement\b/.test(t)) quand = "Au commencement.";
  else if (/\bjour\s+\d+\b/.test(t)) quand = "Pendant un des jours du récit.";
  else if (/\bsabbat\b/.test(t)) quand = "Au sabbat.";
  else if (/\bapr[eè]s\b/.test(t)) quand = "Après un événement précédent.";

  // Pourquoi ? (marqueurs intention)
  let pourquoi = "Pour manifester le dessein de Dieu et instruire la foi.";
  if (/\bafin\b|\bpour que\b/.test(t)) pourquoi = "Finalité exprimée (afin/pour que) : obéissance, bénédiction ou ordre de la création.";
  else if (/\bpromesse\b/.test(t)) pourquoi = "Pour accomplir/promulguer une promesse.";
  else if (/\bjug(e|ement)\b/.test(t)) pourquoi = "Pour exercer un jugement et corriger.";
  else if (/\bgloire\b/.test(t)) pourquoi = "Pour la gloire de Dieu.";

  // Comment ? (moyens)
  let comment = "Par la puissance souveraine de Dieu.";
  if (/\bdit\b|\bparla\b|\bparole\b/.test(t)) comment = "Par la Parole efficace de Dieu.";
  else if (/\besprit\b/.test(t)) comment = "Par l’action de l’Esprit de Dieu.";
  else if (/\bmain\b|\bbra\b/.test(t)) comment = "Par la main/le bras de l’Éternel.";
  else if (/\bordre\b|\bcommandement\b/.test(t)) comment = "Par un commandement/ordre divin.";

  return { qui, quoi, ou, quand, pourquoi, comment };
}

function mkQAHTML(book, chapter, v, text){
  const { qui, quoi, ou, quand, pourquoi, comment } = inferQA(text);
  return `
  <div class="qa" style="margin-top:6px">
    <strong>Questions – Réponses (${book} ${chapter}:${v})</strong>
    <ul style="margin:6px 0 0 18px; padding:0">
      <li><strong>Qui ?</strong> ${qui}</li>
      <li><strong>Quoi ?</strong> ${quoi}</li>
      <li><strong>Où ?</strong> ${ou}</li>
      <li><strong>Quand ?</strong> ${quand}</li>
      <li><strong>Pourquoi ?</strong> ${pourquoi}</li>
      <li><strong>Comment ?</strong> ${comment}</li>
    </ul>
  </div>`;
}

/* ---------- Note principale + Q/R ---------- */
function mkNoteHTML(book, chapter, v, text){
  const ref = `${book} ${chapter}:${v}`;
  const t = (text||"").toLowerCase();
  const motifs = [];
  if (/\blumi[eè]re?\b/.test(t)) motifs.push(`théologie de la <strong>lumière</strong> (création, révélation, 2 Co 4:6)`);
  if (/\besprit\b/.test(t)) motifs.push(`œuvre de l’<strong>Esprit</strong> (création, inspiration, nouvelle création)`);
  if (/\bparole\b/.test(t)) motifs.push(`primat de la <strong>Parole</strong> efficace de Dieu (Hé 11:3; Jn 1)`);
  if (/\bhomme\b|\bhumain\b|adam/.test(t)) motifs.push(`<strong>anthropologie</strong> biblique (image de Dieu, vocation)`);
  if (/\bterre\b|\bciel\b/.test(t)) motifs.push(`<strong>cosmologie</strong> ordonnée par Dieu`);
  if (/\bp[ée]ch[ée]\b/.test(t)) motifs.push(`réalité du <strong>péché</strong> et besoin de rédemption`);
  const axes = motifs.length ? motifs.join('; ') : `théologie de la création, providence et finalité en Dieu`;

  const base = [
    `<strong>Analyse littéraire</strong> — Repérer les termes clés, parallélismes et rythmes. Le verset ${ref} s’insère dans l’argument et porte l’accent théologique.`,
    `<strong>Axes théologiques</strong> — ${axes}.`,
    `<strong>Échos canoniques</strong> — Lire “Écriture par l’Écriture” (Torah, Sagesse, Prophètes; puis Évangiles et Épîtres).`,
    `<strong>Christologie</strong> — Comment ${ref} est récapitulé en <strong>Christ</strong> (Col 1:16-17; Lc 24:27) ?`,
    `<strong>Ecclésial & pastoral</strong> — Implications pour l’<strong>Église</strong> (adoration, mission, éthique).`,
    `<strong>Application personnelle</strong> — Prier le texte ; formuler une décision concrète aujourd’hui.`
  ].join(' ');

  return base + `<hr/>` + mkQAHTML(book, chapter, v, text);
}

async function batched(ids, size, worker){
  const out = [];
  for (let i = 0; i < ids.length; i += size) {
    const chunk = ids.slice(i, i + size);
    const part = await Promise.all(chunk.map(worker));
    out.push(...part);
  }
  return out;
}

/* --------------------------- Handler --------------------------- */
export default async function handler(req, res){
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "GET")    return send(res, 405, { ok:false, error:"Method Not Allowed" });

  try{
    const book = String(req.query.book || "");
    const chapter = parseInt(String(req.query.chapter||""), 10);
    const count = Math.min(Math.max(parseInt(String(req.query.count||"31"),10)||31, 1), 200);

    if (!book || !Number.isFinite(chapter)) {
      return send(res, 400, { ok:false, error:"Paramètres manquants: book, chapter" });
    }

    const apiKey  = process.env.API_BIBLE_KEY || "";
    const bibleId = process.env.API_BIBLE_ID || process.env.API_BIBLE_BIBLE_ID || process.env.DARBY_BIBLE_ID || "";
    const code = USFM[book];

    // Fallback si ENV manquantes ou livre inconnu
    if (!apiKey || !bibleId || !code) {
      const verses = Array.from({length: count}, (_,i) => {
        const v = i+1;
        return { v, text: "", noteHTML: mkNoteHTML(book, chapter, v, "") };
      });
      return send(res, 200, {
        ok:true, source:"fallback-generated", book, chapter, version:"LSG",
        youversionBase:`https://www.bible.com/fr/bible/93/${(code||'GEN')}.${chapter}.LSG`,
        verses
      });
    }

    const headers = { "api-key": apiKey, "accept": "application/json" };
    const chapterId = `${code}.${chapter}`;

    // A) liste des IDs de versets
    const listUrl = `${API_BASE}/bibles/${bibleId}/chapters/${chapterId}/verses`;
    const rList = await fetch(listUrl, { headers });
    const jList = await rList.json().catch(()=> ({}));
    let items = Array.isArray(jList?.data) ? jList.data : [];

    // B) si on a des IDs → récupérer chaque verset en texte
    if (items.length) {
      const verses = await batched(items.slice(0, count), 12, async (it) => {
        const vUrl = new URL(`${API_BASE}/bibles/${bibleId}/verses/${it.id}`);
        vUrl.searchParams.set("content-type","text");
        vUrl.searchParams.set("include-notes","false");
        vUrl.searchParams.set("include-titles","false");
        vUrl.searchParams.set("include-verse-numbers","false");

        let text = "";
        try{
          const rr = await fetch(vUrl.toString(), { headers });
          const jj = await rr.json();
          const d = jj?.data || {};
          text = (typeof d.text === "string" && d.text.trim())
            ? d.text.trim()
            : CLEAN(d.content || d.reference || "");
        }catch{}

        // extraire n°
        let vNum;
        const m1 = (it.reference||"").match(/:(\d{1,3})$/);
        if (m1) vNum = parseInt(m1[1],10);
        if (!Number.isFinite(vNum)) {
          const m2 = (text||"").match(/^\s*(\d{1,3})\s+(.*)$/);
          if (m2) { vNum = parseInt(m2[1],10); text = m2[2].trim(); }
        }

        const v = Number.isFinite(vNum) ? vNum : undefined;
        return { v, text, noteHTML: mkNoteHTML(book, chapter, v||0, text) };
      });

      const clean = verses
        .filter(x => Number.isFinite(x.v))
        .sort((a,b)=>a.v-b.v)
        .map(x => ({ v:x.v, text:x.text, noteHTML:x.noteHTML }));

      return send(res, 200, {
        ok:true, source:"api.bible.verses", book, chapter,
        version:"API", verses: clean.slice(0, count)
      });
    }

    // C) plan B : récupérer le chapitre entier en texte, puis découper
    const chapUrl = new URL(`${API_BASE}/bibles/${bibleId}/chapters/${chapterId}`);
    chapUrl.searchParams.set("content-type","text");
    chapUrl.searchParams.set("include-notes","false");
    chapUrl.searchParams.set("include-titles","false");
    chapUrl.searchParams.set("include-verse-numbers","true");

    const rChap = await fetch(chapUrl.toString(), { headers });
    const jChap = await rChap.json().catch(()=> ({}));
    const content = CLEAN(jChap?.data?.content || "");

    let verses = [];
    if (content) {
      const arr = [];
      const re = /(?:^|\s)(\d{1,3})[.)]?\s+([^]+?)(?=(?:\s\d{1,3}[.)]?\s)|$)/g;
      let m; while((m=re.exec(content))){ arr.push({ v:+m[1], text:CLEAN(m[2]) }); }
      verses = arr.map(x => ({ v:x.v, text:x.text, noteHTML: mkNoteHTML(book, chapter, x.v, x.text) }));
    }

    return send(res, 200, {
      ok:true, source:"api.bible.chapter", book, chapter,
      version:"API", verses: verses.slice(0, count)
    });

  } catch (e){
    return send(res, 200, { ok:false, emergency:true, error:String(e?.message||e) });
  }
}

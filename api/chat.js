// api/chat.js — SERVER (Node on Vercel). No browser import here!

// Utilitaires simples de réponse
function sendJSON(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800");
  res.end(JSON.stringify(obj));
}
function ok(res, data) { sendJSON(res, 200, { ok: true, data }); }
function ko(res, status, message) { sendJSON(res, status, { ok: false, error: message }); }

// ——— titres officiels des 28 rubriques ———
const TITLES = [
  "Prière d’ouverture","Canon et testament","Questions du chapitre précédent","Titre du chapitre",
  "Contexte historique","Structure littéraire","Genre littéraire","Auteur et généalogie",
  "Verset-clé doctrinal","Analyse exégétique","Analyse lexicale","Références croisées",
  "Fondements théologiques","Thème doctrinal","Fruits spirituels","Types bibliques",
  "Appui doctrinal","Comparaison entre versets","Comparaison avec Actes 2","Verset à mémoriser",
  "Enseignement pour l’Église","Enseignement pour la famille","Enseignement pour enfants",
  "Application missionnaire","Application pastorale","Application personnelle",
  "Versets à retenir","Prière de fin"
];

// petit helper pour OT/NT
function testamentOf(bookName) {
  const ntStart = "Matthieu";
  const OT = [
    "Genèse","Exode","Lévitique","Nombres","Deutéronome","Josué","Juges","Ruth",
    "1 Samuel","2 Samuel","1 Rois","2 Rois","1 Chroniques","2 Chroniques","Esdras",
    "Néhémie","Esther","Job","Psaumes","Proverbes","Ecclésiaste","Cantique des cantiques",
    "Ésaïe","Jérémie","Lamentations","Ézéchiel","Daniel","Osée","Joël","Amos",
    "Abdias","Jonas","Michée","Nahoum","Habacuc","Sophonie","Aggée","Zacharie","Malachie"
  ];
  return OT.includes(bookName) ? "Ancien Testament" : "Nouveau Testament";
}

// brique déterministe par défaut
function makeDeterministicStudy(reference, templateId) {
  // ex: "Marc 5" / "Marc 5:1-20"
  // on isole "Livre" et "Chapitre" si possible
  const book = String(reference).split(/\s+/)[0] || "Livre";
  const chapMatch = String(reference).match(/\b(\d+)\b/);
  const chap = chapMatch ? chapMatch[1] : "1";
  const testament = testamentOf(book);

  const sections = TITLES.map((t, i) => {
    let content = "";
    if (i === 0) {
      content = `Père céleste, nous lisons ${reference}. Ouvre nos cœurs par ton Saint-Esprit, éclaire notre intelligence et conduis-nous dans la vérité. Amen.`;
    } else if (i === 1) {
      content = `Le livre de ${book} appartient à l’${testament}.`;
    } else if (i === 2) {
      content = `À compléter par l’animateur : préparer au moins 5 questions de révision sur le chapitre précédent (comprendre, appliquer, comparer, retenir).`;
    } else if (i === 8) {
      content = `Verset-clé proposé pour ${reference}.`;
    } else if (i === 27) {
      content = `Seigneur, merci pour ${reference}. Donne-nous de la mettre en pratique et de marcher dans ta volonté. Amen.`;
    } else {
      content = `Contenu « ${t} » pour ${reference}.`;
    }
    const verses = (i === 8) ? [`${book} ${chap}:1`] : [];
    return { id: i + 1, title: t, content, verses };
  });

  return { reference, templateId: templateId || "v28-standard", sections };
}

/**
 * (Optionnel) Si tu veux brancher OpenAI:
 * - Appelle l'API ici pour générer les 28 points au même format,
 * - Valide que sections.length === 28, sinon reviens à makeDeterministicStudy().
 * J’ai volontairement laissé ce handler “sans dépendance” pour que ça déploie partout.
 */

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return ko(res, 405, "Method not allowed");
    }

    const url = req.url ? new URL(req.url, `http://${req.headers.host}`) : null;
    const q = req.method === "GET"
      ? (url?.searchParams.get("q") || "").trim()
      : ( (await (async()=>{try{ return await new Promise((r)=>{ let body=""; req.on("data",(c)=>body+=c); req.on("end",()=>r(body));}); }catch{ return ""; }})()).then(b=>{ try{ return JSON.parse(b||"{}"); }catch{return{};} }) ).q?.trim() || "";

    const templateId = req.method === "GET"
      ? (url?.searchParams.get("templateId") || "v28-standard")
      : "v28-standard";

    if (!q) return ko(res, 400, "Missing q");

    // Ici tu pourrais appeler OpenAI. Pour l’instant, renvoi déterministe (28 rubriques garanties).
    const study = makeDeterministicStudy(q, templateId);
    return ok(res, study);

  } catch (e) {
    console.error(e);
    return ko(res, 500, "Internal error");
  }
}

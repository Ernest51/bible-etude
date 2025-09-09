// app/api/generate-study/route.ts
import { NextRequest, NextResponse } from "next/server";

// === CONFIG ==============================================================
const DARBY_VERSION_ID = process.env.BIBLE_DARBY_VERSION_ID || "REPLACE_ME"; 
// ⚠️ Mets ici l’ID de la version DARBY sur api.bible (scripture.api.bible).
// Exemple: "65eec8e0f5d04f5b-01" (FAUX EXEMPLE: remplace par le tien).
// https://scripture.api.bible - nécessite BIBLE_API_KEY.

const BIBLE_API_KEY = process.env.BIBLE_API_KEY || "";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_VERCEL || "";

// === RUBRIQUES (titres + descriptions) ===================================
const RUBRICS: Record<number, { title: string; desc: string }> = {
  1: { title: "Prière d’ouverture", desc: "Invocation du Saint-Esprit pour éclairer l’étude." },
  2: { title: "Canon et testament", desc: "Appartenance au canon (AT/NT)." },
  3: { title: "Questions du chapitre précédent", desc: "Questions à reprendre de l’étude précédente." },
  4: { title: "Titre du chapitre", desc: "Résumé doctrinal synthétique du chapitre." },
  5: { title: "Contexte historique", desc: "Période, géopolitique, culture, carte." },
  6: { title: "Structure littéraire", desc: "Séquençage narratif et composition." },
  7: { title: "Genre littéraire", desc: "Type de texte : narratif, poétique, prophétique…" },
  8: { title: "Auteur et généalogie", desc: "Auteur et lien aux patriarches (généalogie)." },
  9: { title: "Verset-clé doctrinal", desc: "Verset central du chapitre." },
  10:{ title: "Analyse exégétique", desc: "Commentaire exégétique (original si utile)." },
  11:{ title: "Analyse lexicale", desc: "Mots-clés et portée doctrinale." },
  12:{ title: "Références croisées", desc: "Passages parallèles et complémentaires." },
  13:{ title: "Fondements théologiques", desc: "Doctrines majeures qui émergent du chapitre." },
  14:{ title: "Thème doctrinal", desc: "Correspondance avec les grands thèmes doctrinaux." },
  15:{ title: "Fruits spirituels", desc: "Vertus / attitudes visées." },
  16:{ title: "Types bibliques", desc: "Figures typologiques et symboles." },
  17:{ title: "Appui doctrinal", desc: "Passages d’appui concordants." },
  18:{ title: "Comparaison entre versets", desc: "Comparaison interne des versets." },
  19:{ title: "Comparaison avec Actes 2", desc: "Parallèle avec Actes 2." },
  20:{ title: "Verset à mémoriser", desc: "Verset à mémoriser." },
  21:{ title: "Enseignement pour l’Église", desc: "Implications pour l’Église." },
  22:{ title: "Enseignement pour la famille", desc: "Applications familiales." },
  23:{ title: "Enseignement pour enfants", desc: "Pédagogie enfants (jeux, récits, symboles)." },
  24:{ title: "Application missionnaire", desc: "Applications mission/évangélisation." },
  25:{ title: "Application pastorale", desc: "Applications pastorales/enseignement." },
  26:{ title: "Application personnelle", desc: "Application personnelle engagée." },
  27:{ title: "Versets à retenir", desc: "Versets utiles à retenir." },
  28:{ title: "Prière de fin", desc: "Prière de clôture." },
};

function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
function hardLimit(text: string, maxChars: number) {
  if (text.length <= maxChars) return text;
  // coupe proprement (phrase/point)
  const slice = text.slice(0, maxChars);
  const lastDot = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("!"), slice.lastIndexOf("?"));
  return (lastDot > maxChars * 0.6 ? slice.slice(0, lastDot + 1) : slice + "…");
}

// === Charger le texte (DARBY) si possible =================================
async function fetchDarby(passage: string): Promise<string | null> {
  if (!BIBLE_API_KEY || !DARBY_VERSION_ID) return null;
  try {
    // On prend tout le chapitre demandé: "Livre X"
    // API: GET /v1/bibles/{bibleId}/passages?query={}&reference=Book%20X
    const base = "https://api.scripture.api.bible/v1/bibles";
    const url = new URL(`${base}/${encodeURIComponent(DARBY_VERSION_ID)}/passages`);
    url.searchParams.set("reference", passage); // ex: "Genèse 1"
    url.searchParams.set("content-type", "text"); // texte brut
    url.searchParams.set("include-notes", "false");
    url.searchParams.set("include-titles", "false");
    url.searchParams.set("include-chapter-numbers", "false");
    url.searchParams.set("include-verse-numbers", "true");
    url.searchParams.set("include-verse-spans", "false");

    const r = await fetch(url.toString(), {
      headers: { "api-key": BIBLE_API_KEY },
      // @ts-ignore
      cache: "no-store",
    });
    if (!r.ok) throw new Error(`Bible API ${r.status}`);
    const j = await r.json();
    // Selon le format, "data.content" ou "data.passages[0].content"
    const content = j?.data?.content || j?.data?.passages?.[0]?.content || "";
    return String(content).trim() || null;
  } catch {
    return null;
  }
}

// === Génération (OpenAI) ===================================================
async function genRubrics({
  passage,
  scripture,
  perSectionChars,
}: {
  passage: string;
  scripture: string | null;
  perSectionChars: number;
}) {
  if (!OPENAI_API_KEY) {
    // Pas de clé: on renvoie un squelette cohérent pour ne pas bloquer le front
    const sections = Array.from({ length: 28 }, (_, i) => {
      const id = i + 1;
      const meta = RUBRICS[id];
      return {
        id,
        title: meta.title,
        description: meta.desc,
        content: `(${passage}) — Contenu provisoire. Ajoute OPENAI_API_KEY pour la génération doctrinale DARBY.`
      };
    });
    return sections;
  }

  // Prompt (ton narratif, orthodoxe, sans doublons, réponses aux rubriques).
  const system = `Tu es un théologien évangélique. Tu rédiges une étude en 28 rubriques, ton narratif et pastoral, fidèle à la saine doctrine. 
- Tu t'appuies sur le texte DARBY (si fourni) sans le paraphraser longuement: tu expliques, relies, conclus.
- Aucune redite entre rubriques. 
- Quand une rubrique pose une question, tu y réponds explicitement.
- Cite les versets sous forme "v.3-5" si utile, sans coller le texte intégral.
- Longueur stricte par rubrique: environ ${perSectionChars} caractères (±8%).`;

  const user = [
    `Passage: ${passage}`,
    scripture ? `Texte DARBY (extrait brut, pour contexte – ne pas reproduire en bloc):\n${scripture.slice(0, 8000)}` : `Texte DARBY: (non disponible)`,
    `Produis les 28 rubriques en JSON stricte: { "sections": [ { "id":1..28, "title": "...", "description":"...", "content":"..." }, ... ] }`,
    `Titres/descr. conformes aux libellés suivants (fr): ${JSON.stringify(RUBRICS)}.`,
  ].join("\n\n");

  // Appel OpenAI (responses JSON). Utilise l’API stable completions/chat.
  const body = {
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.6,
    response_format: { type: "json_object" },
  };

  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // @ts-ignore
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`OpenAI ${r.status}`);
  const j = await r.json();
  const raw = j?.choices?.[0]?.message?.content || "{}";
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }
  let sections = Array.isArray(parsed?.sections) ? parsed.sections : [];

  // Normalisation + coupe stricte par rubrique
  const out = Array.from({ length: 28 }, (_, i) => {
    const id = i + 1;
    const meta = RUBRICS[id];
    const found = sections.find((s: any) => Number(s.id) === id) || {};
    const title = String(found.title || meta.title);
    const description = String(found.description || meta.desc);
    const content = hardLimit(String(found.content || ""), clamp(perSectionChars, 300, 5000));
    return { id, title, description, content };
  });

  return out;
}

// === Handler ==============================================================
export async function POST(req: NextRequest) {
  try {
    const { passage, options } = await req.json();
    const perSectionChars = clamp(Number(options?.length || 1500), 300, 5000);

    // Essaie de charger le texte DARBY (facultatif)
    const scripture = await fetchDarby(String(passage || ""));

    // Génère 28 rubriques pertinentes, sans doublons, longueur respectée
    const sections = await genRubrics({
      passage: String(passage || ""),
      scripture,
      perSectionChars,
    });

    return NextResponse.json({ study: { sections } }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { error: String(e?.message || e || "server error") },
      { status: 500 }
    );
  }
}

export const runtime = "edge";

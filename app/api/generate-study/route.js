// app/api/generate-study/route.js
// API route Next.js (App Router).
// Test minimal pour confirmer que l’API répond correctement.

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';       // éviter Edge runtime
export const dynamic = 'force-dynamic'; // pas de cache

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const book = (searchParams.get('book') || 'Genesis') + '';
    const chapter = parseInt(searchParams.get('chapter') || '1', 10) || 1;

    return NextResponse.json({
      ok: true,
      route: '/api/generate-study',
      echo: { book, chapter },
      now: new Date().toISOString(),
      mode: 'ping'
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: String(err && err.message || err) },
      { status: 500 }
    );
  }
}

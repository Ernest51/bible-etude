import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    route: "/api/generate-study",
    method: "GET",
    hint: "Cette route existe bien (App Router).",
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({
    ok: true,
    route: "/api/generate-study",
    method: "POST",
    echo: body,
  });
}

// Optionnel
export const runtime = "edge";

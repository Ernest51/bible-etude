import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ ok:true, route:"/api/_whoami", router:"app" });
}
export const runtime = "edge";

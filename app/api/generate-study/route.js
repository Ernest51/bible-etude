// app/api/generate-study/route.js
// Next.js App Router — ESM

export async function GET() {
  return Response.json(
    {
      ok: true,
      endpoint: "/api/generate-study",
      mode: "echo-minimal",
      hint: "POST JSON to echo it back",
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

export async function POST(request) {
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  return Response.json(
    {
      ok: true,
      endpoint: "/api/generate-study",
      echo: body,
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}

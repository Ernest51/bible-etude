// api/build-info.js
// Diagnostic: montre le commit et l'environnement déployé (Vercel)

export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "/api/build-info",
    commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
    branch: process.env.VERCEL_GIT_COMMIT_REF || null,
    repo: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
      ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
      : null,
    buildAt: new Date().toISOString(),
    node: process.version
  });
}

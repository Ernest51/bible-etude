{
  "version": 2,
  "functions": { "api/*.js": { "runtime": "nodejs20.x" } },
  "routes": [
    { "src": "^/api/generate-study$", "dest": "/api/generateStudy.js" },
    { "src": "^/api/(.*)$", "dest": "/api/$1.js" }
  ]
}

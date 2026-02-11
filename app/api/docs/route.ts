/**
 * GET /api/docs — Swagger UI interactive API explorer (dev only).
 *
 * Serves a self-contained HTML page with locally-hosted swagger-ui-dist
 * assets (from public/swagger-ui/) to comply with the app's strict CSP.
 * The spec is fetched from the sibling route /api/docs/spec.
 *
 * ┌──────────────────────────────────────────────────┐
 * │  /api/docs       →  Swagger UI (this route)      │
 * │  /api/docs/spec  →  OpenAPI 3.1 JSON spec        │
 * └──────────────────────────────────────────────────┘
 */
import { NextResponse } from 'next/server';

const SWAGGER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>YNAB Clone — API Documentation</title>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css" />
  <style>
    html { box-sizing: border-box; overflow-y: scroll; }
    *, *::before, *::after { box-sizing: inherit; }
    body { margin: 0; background: #fafafa; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 30px 0; }
    .swagger-ui .info .title { font-size: 2rem; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: '/api/docs/spec',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout',
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        docExpansion: 'list',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
  </script>
</body>
</html>`;

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 404 });
  }

  return new NextResponse(SWAGGER_HTML, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

// Zero-dependency static file server for local development.
// ES modules, fetch(), and sandboxed iframes all need to be served over http://,
// not opened via file:// — that's the only reason this exists.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  try {
    const requestUrl = new URL(req.url, `http://localhost:${PORT}`);
    let filePath = decodeURIComponent(requestUrl.pathname);
    if (filePath === '/') filePath = '/index.html';

    // Prevent path traversal outside the project root.
    const resolved = path.normalize(path.join(__dirname, filePath));
    if (!resolved.startsWith(__dirname)) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    fs.readFile(resolved, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: ' + filePath);
        return;
      }
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, {
        'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
        // No caching in dev — content changes constantly while building missions.
        'Cache-Control': 'no-cache',
      });
      res.end(data);
    });
  } catch {
    res.writeHead(500).end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Browser Guardian: Runtime Defense Lab running at http://localhost:${PORT}/`);
});

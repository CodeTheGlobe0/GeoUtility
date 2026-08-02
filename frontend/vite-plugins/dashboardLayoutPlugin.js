import fs from 'node:fs';
import path from 'node:path';

// Dev-server-only plugin: persists each user's Home dashboard card layout as
// a real .json file on disk, inside frontend/dashboard-layouts/.
//
// IMPORTANT: this only runs inside the Vite DEV server (`npm run dev`).
// `vite build` produces static files with no server attached, so none of
// this middleware exists in a production deployment — a real backend
// (e.g. the Django API already in this project) would be needed there.
const STORE_DIR = path.resolve(process.cwd(), 'dashboard-layouts');

const safeUserId = (raw) => String(raw || 'anonymous').replace(/[^a-zA-Z0-9_-]/g, '');
const layoutFilePath = (userId) => path.join(STORE_DIR, `user-${safeUserId(userId)}-layout.json`);

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });

export default function dashboardLayoutPlugin() {
  return {
    name: 'dashboard-layout-file-store',
    configureServer(server) {
      fs.mkdirSync(STORE_DIR, { recursive: true });

      server.middlewares.use('/api/dashboard-layout', async (req, res) => {
        const url = new URL(req.url, 'http://localhost');
        const userId = url.searchParams.get('userId');
        const filePath = layoutFilePath(userId);

        if (req.method === 'GET') {
          try {
            const contents = fs.readFileSync(filePath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(contents);
          } catch {
            res.setHeader('Content-Type', 'application/json');
            res.end('{}');
          }
          return;
        }

        if (req.method === 'POST') {
          try {
            const body = await readBody(req);
            JSON.parse(body); // validate it's real JSON before writing
            fs.writeFileSync(filePath, body, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end('{"success":true}');
          } catch (err) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, message: String(err) }));
          }
          return;
        }

        res.statusCode = 405;
        res.end('Method Not Allowed');
      });
    },
  };
}

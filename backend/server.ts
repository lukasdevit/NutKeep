import fs from 'fs';
import { buildApp } from './app.js';
import { PORT, DEFAULT_UPLOAD_DIR } from './config/index.js';
import { writeLog } from './services/log-service.js';
import { bootstrap } from './bootstrap.js';

if (!fs.existsSync(DEFAULT_UPLOAD_DIR)) {
  fs.mkdirSync(DEFAULT_UPLOAD_DIR, { recursive: true });
}

const app = await buildApp({ logger: true });

await bootstrap(app);

await app.listen({ port: PORT, host: '0.0.0.0' });

writeLog({
  time: new Date().toISOString(),
  level: 30,
  levelName: 'info',
  category: 'general',
  msg: `Server listening on port ${PORT}`,
});

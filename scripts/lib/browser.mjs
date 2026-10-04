import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { root } from '../../config/project.mjs';

export function localTool(name, fallback) {
  const file = path.join(root, '.local/tools.json');
  const config = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  return process.env[name] || config[name] || fallback;
}

export function launchBrowser(options = {}) {
  const executablePath = localTool('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH');
  return chromium.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    ...options
  });
}

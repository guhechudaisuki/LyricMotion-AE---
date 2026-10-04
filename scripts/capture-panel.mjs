import { launchBrowser } from './lib/browser.mjs';
// Export documentation screenshots in an isolated headless browser. Does not open AE or call an API.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts', 'preview');
await fs.mkdir(out, { recursive: true });
const browser = await launchBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
    deviceScaleFactor: 1
  });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pathToFileURL(path.join(root, 'src', 'index.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(out, 'panel.png'), fullPage: true });
  await page
    .locator('.timing-settings')
    .screenshot({ path: path.join(out, 'timing-controls.png') });
  await page.locator('#translation-config').click();
  await page
    .locator('#translation-dialog')
    .screenshot({ path: path.join(out, 'panel-settings.png') });
  await page.locator('#translation-dialog button[value="cancel"]').click();
  await page.locator('#add-style').click();
  await page.locator('#recipe-source').selectOption('ornaments');
  await page.locator('#style-dialog').screenshot({ path: path.join(out, 'style-elements.png') });
  await page.locator('#recipe-source').selectOption('positions');
  await page.locator('#style-dialog').screenshot({ path: path.join(out, 'style-positions.png') });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Saved panel, timing, settings and custom-style screenshots. No AE or translation requests.'
  );
} finally {
  await browser.close();
}

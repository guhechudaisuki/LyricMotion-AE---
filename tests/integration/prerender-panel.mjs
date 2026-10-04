/* eslint no-control-regex: off -- Deliberate control-character sanitization and ASCII bridge checks. */
// User-authorized self-check: actual panel/bridge/compiled host, simulated AE only.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { fixture } from '../fixtures/ae-host.mjs';
import { root } from '../../config/project.mjs';
import { launchBrowser } from '../../scripts/lib/browser.mjs';
const out = path.join(root, 'artifacts/panel-check');
const browser = await launchBrowser();
const results = [];
try {
  await fs.mkdir(out, { recursive: true });
  const opts = { lossyEval: true },
    f = fixture(opts),
    errors = [],
    page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:/, (route) => route.abort());
  await page.exposeFunction('__lmOfflineHost', (code) =>
    String(vm.runInContext(code, f.ctx)).replace(/[^\x00-\x7f]/g, '?')
  );
  await page.addInitScript(() => {
    window.__adobe_cep__ = {
      evalScript(code, callback) {
        window
          .__lmOfflineHost(code)
          .then(callback)
          .catch(() => callback('EvalScript error.'));
      }
    };
  });
  await page.goto(pathToFileURL(path.join(root, 'src/index.html')).href);
  await page.waitForFunction(() =>
    document.getElementById('connection').textContent.includes('已连接 AE')
  );
  await page.locator('#prerender').click();
  await page.locator('#render-dialog').waitFor({ state: 'visible' });
  const labels = await page.locator('#render-template option').allTextContents();
  assert.ok(labels.includes('具有 Alpha 的高品质'));
  assert.ok(labels.includes('当前 AE 默认输出设置'));
  assert.ok(labels.every((name) => !name.includes('?')));
  assert.equal(await page.locator('#render-template').inputValue(), 'template:1');
  results.push('Chinese options and RGBA preferred selection remain readable across lossy bridge');
  await page.locator('#render-dialog').screenshot({ path: path.join(out, 'prerender-dialog.png') });
  await page.locator('#render-template').selectOption('current');
  await page.locator('#render-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.startsWith('已导入 AE 项目')
  );
  assert.equal(f.applied.length, 0);
  assert.equal(f.imports.length, 1);
  assert.equal(f.queue.numItems, 0);
  results.push('Default output selection renders and imports via actual panel event handlers');
  opts.rejectTemplate = true;
  await page.locator('#prerender').click();
  await page.locator('#render-dialog').waitFor({ state: 'visible' });
  await page.locator('#render-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('无法应用输出模板')
  );
  assert.equal(await page.locator('#prerender').isEnabled(), true);
  assert.equal(f.queue.numItems, 0);
  results.push('Application failure updates status, restores buttons and cleans temporary queue');
  opts.rejectTemplate = false;
  await page.locator('#prerender').click();
  await page.locator('#render-dialog').waitFor({ state: 'visible' });
  await page.locator('#render-confirm').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.startsWith('已导入 AE 项目')
  );
  assert.equal(f.imports.length, 2);
  assert.equal(f.queue.numItems, 0);
  assert.deepEqual(errors, []);
  results.push('Reopening after failure succeeds with a fresh native template selection');
  await fs.writeFile(
    path.join(out, 'panel-check.json'),
    JSON.stringify(
      {
        scope: 'Actual UI/bridge/compiled host with simulated AE. No AE launch or real rendering.',
        passed: results.length,
        results
      },
      null,
      2
    )
  );
  console.log(`${results.length}/4 panel workflows passed (simulated AE)`);
} finally {
  await browser.close();
}

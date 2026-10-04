import path from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { root } from '../../config/project.mjs';
import { launchBrowser } from '../../scripts/lib/browser.mjs';

const browser = await launchBrowser();
try {
  const page = await browser.newPage();
  await page.route(/^https?:/, (route) => route.abort());
  await page.goto(pathToFileURL(path.join(root, 'src/index.html')).href);
  const result = await page.evaluate(async () => {
    const cache = window.LMTranslationCache;
    await cache.clear();
    const defaults = await cache.stats();
    await cache.setLimit(2);
    const cues = (text) => [{ text, start: 0, end: 4 }],
      result = (text) => [{ index: 0, source: text, target: 'en', note: 'translated ' + text }];
    await cache.put(cues('a'), 'en', result('a'));
    await cache.put(cues('b'), 'en', result('b'));
    await cache.get(cues('a'), 'en');
    await cache.put(cues('c'), 'en', result('c'));
    return {
      defaults,
      evicted: await cache.get(cues('b'), 'en'),
      kept: await cache.get([{ text: 'a', start: 10, end: 20, note: 'manual' }], 'en'),
      stats: await cache.stats()
    };
  });
  assert.equal(result.defaults.limit, 500);
  assert.equal(result.stats.count, 2);
  assert.equal(result.evicted, null);
  assert.equal(result.kept[0].note, 'translated a');
  await page.reload();
  const saved = await page.evaluate(() => window.LMTranslationCache.get([{ text: 'a' }], 'en'));
  assert.equal(saved[0].note, 'translated a');
  console.log(
    '4/4 translation cache checks passed: default limit, LRU eviction, timing-independent identity, reload persistence.'
  );
} finally {
  await browser.close();
}

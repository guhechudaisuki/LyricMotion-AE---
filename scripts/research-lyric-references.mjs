import { launchBrowser } from './lib/browser.mjs';
// Inspect public lyric-typography players directly; no remote media files are downloaded.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts', 'research');
const browser = await launchBrowser({ args: ['--autoplay-policy=no-user-gesture-required'] });
const records = [];
try {
  for (const bvid of ['BV1mM41197Xj', 'BV1XL411d7jY', 'BV1NpTd6nENF']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const record = { bvid, url: `https://www.bilibili.com/video/${bvid}/`, frames: [] };
    try {
      await page.goto(record.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(3500);
      const control = page.locator('.bpx-player-ctrl-play');
      if (await control.count())
        await control
          .first()
          .click({ force: true })
          .catch(() => {});
      await page
        .locator('video')
        .first()
        .evaluate((v) => {
          v.muted = true;
          return v.play().catch(() => {});
        })
        .catch(() => {});
      await page
        .waitForFunction(
          () => {
            const v = document.querySelector('video');
            return v && v.readyState >= 2;
          },
          {},
          { timeout: 12000 }
        )
        .catch(() => {});
      record.title = await page.title();
      record.player = await page.evaluate(() => {
        const v = document.querySelector('video');
        return v
          ? {
              width: v.videoWidth,
              height: v.videoHeight,
              duration: v.duration,
              readyState: v.readyState,
              paused: v.paused,
              error: v.error && v.error.message
            }
          : null;
      });
      const video = page.locator('video').first();
      if (record.player && record.player.readyState >= 1) {
        for (const time of [20, 45, 75, 105]) {
          await video.evaluate(async (v, t) => {
            v.muted = true;
            v.currentTime = Math.min(t, Math.max(0, v.duration - 2));
            await v.play().catch(() => {});
          }, time);
          await page.waitForTimeout(1300);
          await video.evaluate((v) => v.pause());
          const name = `${bvid}-${time}.png`;
          await video.screenshot({ path: path.join(out, name) });
          record.frames.push(name);
        }
      } else {
        await page.screenshot({ path: path.join(out, `${bvid}-page.png`) });
        record.text = (await page.locator('body').innerText()).slice(0, 2000);
      }
    } catch (error) {
      record.error = error.message;
    }
    records.push(record);
    console.log(JSON.stringify(record));
    await page.close();
  }
} finally {
  await browser.close();
  await fs.writeFile(path.join(out, 'lyric-video-sources.json'), JSON.stringify(records, null, 2));
}

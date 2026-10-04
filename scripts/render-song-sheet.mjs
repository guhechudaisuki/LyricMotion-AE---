import { launchBrowser } from './lib/browser.mjs';
// Documentation contact sheets from the actual panel renderer; never starts AE.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts', 'preview');
const browser = await launchBrowser();
try {
  await fs.mkdir(out, { recursive: true });
  const page = await browser.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root, 'docs', '动效演示.html')).href);
  await page.evaluate(() => {
    LMDemo.drawAt(0);
    return document.fonts.ready;
  });
  const lyrics = await fs.readFile(path.join(root, 'assets', '我只能离开.srt'), 'utf8');
  const result = await page.evaluate((lyrics) => {
    const p = LMCore.defaults();
    p.width = 1280;
    p.height = 720;
    p.cues = LMCore.parse(lyrics, '我只能离开.srt');
    const frames = p.cues.map((cue, index) => {
      const c = document.createElement('canvas');
      c.width = 1280;
      c.height = 720;
      LMRender.render(c, p, cue.start + (cue.end - cue.start) * 0.5, { background: 'dark' });
      const scene = LMCore.scene(p, cue, index);
      return { canvas: c, index, text: cue.text, style: scene.style, side: scene.safeSide };
    });
    function sheet(selected) {
      const c = document.createElement('canvas');
      c.width = 1920;
      c.height = 64 + Math.ceil(selected.length / 4) * 302;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#101a22';
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.font = '22px "Microsoft YaHei"';
      ctx.fillStyle = '#dbe6ea';
      ctx.fillText('默认完全随机 · 同一首歌 / 两侧分配（面板引擎预览）', 20, 39);
      selected.forEach((frame, i) => {
        const x = (i % 4) * 480,
          y = 64 + Math.floor(i / 4) * 302;
        ctx.drawImage(frame.canvas, x, y, 480, 270);
        ctx.font = '13px "Microsoft YaHei"';
        ctx.fillStyle = '#9eafb6';
        ctx.fillText(
          `${frame.index + 1}. ${frame.text} · ${frame.side === 'left' ? '左' : '右'}`,
          x + 12,
          y + 290
        );
      });
      return c.toDataURL('image/png').split(',')[1];
    }
    return {
      full: sheet(frames),
      first: sheet(frames.slice(0, 12)),
      cues: frames.map((frame) => {
        const { canvas: _canvas, ...cue } = frame;
        return cue;
      })
    };
  }, lyrics);
  if (errors.length) throw new Error(errors.join('\n'));
  await fs.writeFile(path.join(out, '默认整曲42句.png'), Buffer.from(result.full, 'base64'));
  await fs.writeFile(path.join(out, '默认前12句.png'), Buffer.from(result.first, 'base64'));
  await fs.writeFile(
    path.join(out, '默认整曲说明.json'),
    JSON.stringify(
      {
        seed: 1,
        profile: 'free',
        left: result.cues.filter((c) => c.side === 'left').length,
        right: result.cues.filter((c) => c.side === 'right').length,
        cues: result.cues
      },
      null,
      2
    )
  );
  console.log(`Rendered ${result.cues.length} default lyric cues; no manual positions.`);
} finally {
  await browser.close();
}

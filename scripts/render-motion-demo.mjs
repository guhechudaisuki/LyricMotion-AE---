import { launchBrowser, localTool } from './lib/browser.mjs';
// Render a user-facing preview from the actual panel engine. This does not launch AE.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'artifacts', 'preview');
await fs.mkdir(out, { recursive: true });
const browser = await launchBrowser();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1
});
const renderErrors = [];
page.on('pageerror', (error) => renderErrors.push(error.stack || String(error)));
try {
  await page.goto(pathToFileURL(path.join(root, 'docs', '动效演示.html')).href);
  await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => LMDemo.drawAt(1.65));
  await page.screenshot({ path: path.join(out, 'interactive-page.png'), fullPage: true });
  const frames = [];
  for (let shot = 0; shot < 8; shot++)
    for (const local of [0.32, 1.65, 3.64]) {
      const data = await page.evaluate(
        ({ shot, local }) => {
          LMDemo.drawShot(shot, local);
          return LMDemo.canvas.toDataURL('image/png').split(',')[1];
        },
        { shot, local }
      );
      frames.push({ shot, local, data });
      if (local === 1.65)
        await fs.writeFile(path.join(out, `shot-${shot + 1}.png`), Buffer.from(data, 'base64'));
    }
  const contact = await page.evaluate(async (frames) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1440;
    canvas.height = 2420;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#101a22';
    ctx.fillRect(0, 0, 1440, 2420);
    ctx.fillStyle = '#dfe7e3';
    ctx.font = '24px "Microsoft YaHei"';
    ctx.fillText('映词 1.4.2 · 面板动效演示 / 进场 · 停留 · 退场', 24, 38);
    for (let i = 0; i < frames.length; i++) {
      const row = Math.floor(i / 3),
        col = i % 3,
        img = new Image();
      img.src = 'data:image/png;base64,' + frames[i].data;
      await img.decode();
      ctx.drawImage(img, col * 480, 60 + row * 295, 480, 270);
      ctx.font = '12px "Microsoft YaHei"';
      ctx.fillStyle = '#9cafb8';
      ctx.fillText(
        ['进场 0.32s', '停留 1.65s', '退场 3.64s'][col],
        col * 480 + 12,
        60 + row * 295 + 286
      );
    }
    return canvas.toDataURL('image/png').split(',')[1];
  }, frames);
  await fs.writeFile(path.join(out, 'contact-sheet.png'), Buffer.from(contact, 'base64'));
  if (renderErrors.length) throw new Error(renderErrors.join('\n'));
  console.log('Presentation stills and contact sheet rendered.');
  if (process.argv.includes('--stills')) {
    console.log('Stills only.');
    process.exitCode = 0;
  } else {
    const target = path.join(out, '面板动效演示.mp4'),
      fps = 30,
      total = 32 * fps;
    const encoder = spawn(
      localTool('FFMPEG_PATH', 'ffmpeg'),
      [
        '-y',
        '-hide_banner',
        '-loglevel',
        'error',
        '-f',
        'image2pipe',
        '-vcodec',
        'png',
        '-framerate',
        String(fps),
        '-i',
        'pipe:0',
        '-an',
        '-c:v',
        'libx264',
        '-preset',
        'medium',
        '-crf',
        '18',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        target
      ],
      { windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }
    );
    let errors = '';
    encoder.stderr.on('data', (chunk) => {
      errors += chunk.toString();
    });
    const complete = new Promise((resolve, reject) => {
      encoder.on('error', reject);
      encoder.on('close', (code) =>
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${errors}`))
      );
    });
    for (let frame = 0; frame < total; frame++) {
      const data = await page.evaluate((t) => {
        LMDemo.drawAt(t);
        return LMDemo.canvas.toDataURL('image/png').split(',')[1];
      }, frame / fps);
      if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await once(encoder.stdin, 'drain');
      if (frame % 120 === 0) console.log(`Rendered ${frame / fps}s / 32s`);
    }
    encoder.stdin.end();
    await complete;
    if (renderErrors.length) throw new Error(renderErrors.join('\n'));
    await fs.writeFile(
      path.join(out, '演示说明.txt'),
      '映词 1.4.2 · 面板动效演示\n32秒 / 1280×720 / 30fps / 无音轨\n使用项目src目录中的实际LMCore、LMMotion、LMMotifs、LMLayout与LMRender离线渲染。\n此文件不是AE实测或AE渲染。演示标签、时间条与背景不会加入实际PV。\n八段组合：左岸落字、右岸错层、竖横混排、斜邻小句、行间递进、错行释句、主次揭幕、低位余音。\n交互选型页：docs/动效演示.html。\n'
    );
    console.log(target);
  }
} finally {
  await browser.close();
}

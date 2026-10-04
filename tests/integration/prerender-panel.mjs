/* eslint no-control-regex: off -- Simulate a lossy ExtendScript response. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { root } from '../../config/project.mjs';
import { launchBrowser } from '../../scripts/lib/browser.mjs';
import { fixture } from '../fixtures/ae-host.mjs';
const { createMovie } = createRequire(import.meta.url)('../../src/node/mov-writer.cjs');
const { createFile } = createRequire(import.meta.url)('../../src/node/video-file.cjs');
const out = path.join(root, 'artifacts/prerender');
fs.mkdirSync(out, { recursive: true });
const opts = { lossyEval: true, lossyNative: true, documentsDirectory: out.replaceAll('\\', '/') };
const f = fixture(opts),
  errors = [],
  results = [];
const project = JSON.parse(
  JSON.stringify(
    vm.runInContext(
      'LMCore.normalize(' +
        JSON.stringify({
          title: '面板歌词直接视频',
          width: 640,
          height: 360,
          fps: 23.997,
          cues: [
            { text: '那些模糊破旧回忆', start: 0.5, end: 2.5 },
            { text: '故事已归零', start: 2.5, end: 4 }
          ]
        }) +
        ')',
      f.ctx
    )
  )
);
const browser = await launchBrowser();
let writer,
  output,
  sampleFrames = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route(/^https?:/, (route) => route.abort());
  await page.exposeFunction('__lmOfflineHost', (code) =>
    String(vm.runInContext(code, f.ctx)).replace(/[^\x00-\x7f]/g, '?')
  );
  await page.exposeFunction('__lmMovieStart', (filename, spec) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    writer = createMovie(filename, spec);
    output = filename;
    sampleFrames = [];
  });
  await page.exposeFunction('__lmMovieFrame', (bytes) => {
    sampleFrames.push(Buffer.from(bytes));
    writer.addFrame(Buffer.from(bytes));
  });
  await page.exposeFunction('__lmMovieAudio', (bytes, rate, channels) =>
    writer.addAudio(Buffer.from(bytes), rate, channels)
  );
  await page.exposeFunction('__lmMovieFinish', () => {
    const result = writer.finish();
    f.files.add(output);
    return result;
  });
  await page.exposeFunction('__lmMovieAbort', () => writer.abort());
  await page.exposeFunction('__lmSaveMP4', (filename, writes) => {
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    const file = createFile(filename);
    try {
      for (const write of writes) file.write(Buffer.from(write.bytes), write.at);
      const result = file.finish();
      f.files.add(filename);
      return result;
    } finally {
      file.abort();
    }
  });
  await page.addInitScript((p) => {
    localStorage.setItem('lyricmotion.project', JSON.stringify(p));
    window.__adobe_cep__ = {
      evalScript(code, callback) {
        window
          .__lmOfflineHost(code)
          .then(callback)
          .catch(() => callback('EvalScript error.'));
      }
    };
  }, project);
  await page.goto(pathToFileURL(path.join(root, 'src/index.html')).href);
  await page.waitForFunction(() =>
    document.getElementById('connection').textContent.includes('已连接 AE')
  );
  await page.evaluate(() => {
    LMBridge.createMovie = async (filename, spec) => {
      await window.__lmMovieStart(filename, spec);
      return {
        addFrame: (bytes) => window.__lmMovieFrame(Array.from(bytes)),
        addAudio: (bytes, rate, channels) =>
          window.__lmMovieAudio(Array.from(bytes), rate, channels),
        finish: () => window.__lmMovieFinish(),
        abort: () => window.__lmMovieAbort()
      };
    };
  });
  const clickRender = async () => {
    await page.locator('#background').selectOption('alpha');
    await page.locator('#prerender').click();
    await page.locator('#render-dialog').waitFor({ state: 'visible' });
    assert.ok((await page.locator('#render-name').textContent()).includes(project.title));
    assert.equal(await page.locator('#render-template').count(), 0);
    assert.equal(await page.locator('#render-background').count(), 0);
    await page.locator('#render-confirm').click();
  };
  await clickRender();
  await page.waitForFunction(() => !document.getElementById('prerender').disabled);
  assert.match(await page.locator('#status').textContent(), /^已导入 AE 项目/);
  const movie = fs.readFileSync(output);
  assert.equal(sampleFrames.length, 96);
  assert.ok(movie.includes(Buffer.from('png ')));
  for (const frame of sampleFrames) assert.ok(movie.includes(frame));
  assert.notDeepEqual(sampleFrames[0], sampleFrames[30]);
  assert.deepEqual(f.imports, [output]);
  assert.equal(f.renders.length, 0);
  assert.equal(f.queue.numItems, 0);
  assert.ok(
    f.payloads.every(({ code }) => !/dispatch\("(?:begin|step|renderOptions|preRender)"/.test(code))
  );
  const pixels = await page.evaluate(async (bytes) => {
    const bmp = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let visible = 0,
      transparent = 0;
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i]) visible++;
      else transparent++;
    }
    return { visible, transparent };
  }, Array.from(sampleFrames[30]));
  assert.ok(pixels.visible > 100, JSON.stringify(pixels));
  assert.ok(pixels.transparent > project.width * project.height * 0.5);
  fs.writeFileSync(path.join(out, 'visible-frame.png'), sampleFrames[30]);
  fs.copyFileSync(output, path.join(out, 'panel-output.mov'));
  results.push(
    'Actual panel encodes 96 PNG frames with visible lyrics and transparency, then imports without AE generation or render queue'
  );
  opts.importFailure = true;
  await clickRender();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('导入 AE 失败')
  );
  assert.ok(fs.statSync(output).size > 10000);
  assert.equal(await page.locator('#prerender').isEnabled(), true);
  results.push('Import failure preserves the complete video and restores controls');
  opts.importFailure = false;
  await clickRender();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('正在编码歌词画面')
  );
  await page.locator('#cancel').click();
  await page.waitForFunction(() =>
    document.getElementById('status').textContent.includes('已取消预渲染')
  );
  assert.equal(fs.existsSync(output), false);
  assert.equal(fs.existsSync(output + '.part'), false);
  assert.equal(f.imports.length, 1);
  results.push(
    'Cancelling direct encoding removes its partial file and never imports a partial video'
  );
  const audioFile = path.join(out, 'panel-audio-' + Date.now() + '.mov');
  await page.evaluate(
    async ({ filename, project }) => {
      const audio = new AudioBuffer({ length: 48000, numberOfChannels: 1, sampleRate: 48000 });
      const data = audio.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.sin((i * Math.PI * 880) / 48000) * 0.2;
      await LMVideo.encode(project, {
        audio,
        createMovie: (spec) => LMBridge.createMovie(filename, spec)
      });
    },
    { filename: audioFile, project }
  );
  fs.copyFileSync(audioFile, path.join(out, 'panel-audio.mov'));
  assert.ok(fs.readFileSync(audioFile).includes(Buffer.from('sowt')));
  results.push('MOV preserves a PCM audio track alongside transparent lyric frames');
  await page.evaluate(() => {
    LMBridge.createVideoFile = (filename) => {
      const writes = [];
      return {
        write: (bytes, at) => writes.push({ bytes: Array.from(bytes), at }),
        finish: () => window.__lmSaveMP4(filename, writes),
        abort: () => {}
      };
    };
  });
  await page.locator('#prerender').click();
  await page.locator('#render-format').selectOption('mp4');
  await page.locator('#background').selectOption('light');
  await page.locator('#render-confirm').click();
  await page.waitForFunction(() => !document.getElementById('prerender').disabled);
  const status = await page.locator('#status').textContent();
  assert.match(status, /^已导入 AE 项目/);
  const mp4File = f.imports.at(-1);
  assert.ok(mp4File.endsWith('.mp4'));
  fs.copyFileSync(mp4File, path.join(out, 'panel-output.mp4'));
  results.push('MP4 selection encodes real H.264 frames through WebCodecs and imports the MP4');
  assert.deepEqual(errors, []);
  fs.writeFileSync(
    path.join(out, 'panel-check.json'),
    JSON.stringify(
      {
        scope: 'Real Canvas frames and MOV file; AE import API simulated. AE not launched.',
        passed: results.length,
        results,
        pixels
      },
      null,
      2
    )
  );
  console.log(
    `${results.length}/5 direct-video panel workflows passed; visible pixels: ${pixels.visible}.`
  );
} finally {
  if (writer) writer.abort();
  await browser.close();
}

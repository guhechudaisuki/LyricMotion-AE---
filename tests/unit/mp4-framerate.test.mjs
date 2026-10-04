import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const vendor = fs.readFileSync(
  new URL('../../assets/vendor/mp4-muxer.min.js', import.meta.url),
  'utf8'
);
const exporter = fs.readFileSync(new URL('../../src/panel/mp4-export.js', import.meta.url), 'utf8');
function harness(source = exporter) {
  const configurations = [];
  class VideoEncoder {
    static async isConfigSupported() {
      return { supported: true };
    }
    configure(config) {
      configurations.push(config);
      this.state = 'configured';
    }
    close() {
      this.state = 'closed';
    }
  }
  const context = vm.createContext({ window: {}, VideoEncoder });
  vm.runInContext(vendor, context);
  vm.runInContext(source, context);
  return { api: context.window.LMMP4, configurations };
}
const createFile = () => ({ write() {}, abort() {} });
test('Recorded fractional-FPS error is reproduced by passing FPS as muxer timescale', async () => {
  const old = harness(
    exporter.replace('frameRate: Math.round(spec.fps * 1000)', 'frameRate: spec.fps')
  );
  await assert.rejects(
    old.api.create('unused', { width: 640, height: 360, fps: 23.997, frames: 96 }, 0, createFile),
    /frame rate.*positive integer/i
  );
});
test('Fractional FPS reaches encoder unchanged and uses an integer MP4 track timescale', async () => {
  for (const fps of [23.976, 23.997, 29.97, 59.94]) {
    const f = harness();
    const writer = await f.api.create(
      'unused',
      { width: 640, height: 360, fps, frames: 96 },
      0,
      createFile
    );
    assert.equal(f.configurations[0].framerate, fps);
    await writer.abort();
  }
});

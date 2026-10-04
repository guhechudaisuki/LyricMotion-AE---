import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../fixtures/ae-host.mjs';
const spec = {
  title: '中文歌词视频',
  width: 1920,
  height: 1080,
  fps: 24,
  duration: 4,
  previewTime: 1.4
};
test('Panel video import works with an empty active comp and never queues or generates AE layers', async () => {
  const f = fixture({ lossyNative: true });
  f.app.project.activeItem = null;
  const target = await f.api.call('prepareVideo', spec);
  f.files.add(target.path);
  const result = await f.api.call('importVideo', { token: target.token });
  assert.deepEqual(f.imports, [target.path]);
  assert.match(result.name, /中文歌词视频/);
  assert.equal(f.projects.find((item) => item.id === result.id).time, 1.4);
  assert.equal(f.queue.numItems, 0);
  assert.equal(f.renders.length, 0);
  assert.equal(f.scripting.appEncoding, 'CP1252');
});
test('Video cannot be imported before writing, after release, or into a switched project', async () => {
  const f = fixture();
  const target = await f.api.call('prepareVideo', spec);
  await assert.rejects(f.api.call('importVideo', { token: target.token }), /尚未写入/);
  f.files.add(target.path);
  f.app.project = {};
  await assert.rejects(f.api.call('importVideo', { token: target.token }), /项目已切换/);
  await f.api.call('releaseVideo', { token: target.token });
  await assert.rejects(f.api.call('importVideo', { token: target.token }), /已失效/);
  assert.equal(f.imports.length, 0);
  assert.ok(f.files.has(target.path));
});
test('Failed video import preserves the encoded file and restores native encoding', async () => {
  const f = fixture({ importFailure: true, lossyNative: true });
  const target = await f.api.call('prepareVideo', spec);
  f.files.add(target.path);
  await assert.rejects(f.api.call('importVideo', { token: target.token }), /文件位置：.*\.mov/);
  assert.ok(f.files.has(target.path));
  assert.equal(f.scripting.appEncoding, 'CP1252');
  assert.equal(f.queue.numItems, 0);
});

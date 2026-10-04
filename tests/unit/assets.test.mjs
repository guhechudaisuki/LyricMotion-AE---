import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import aep from '../../src/node/aep-resources.cjs';
import assets from '../../src/node/assets.cjs';

function chunk(id, data) {
  const b = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const h = Buffer.alloc(8);
  h.write(id);
  h.writeUInt32BE(b.length, 4);
  return Buffer.concat([h, b, ...(b.length % 2 ? [Buffer.alloc(1)] : [])]);
}
function sample() {
  const alias = chunk(
    'alas',
    JSON.stringify({ fullpath: 'lyricmotion://resources/media/序列', target_is_folder: true })
  );
  const body = chunk('LIST', Buffer.concat([Buffer.from('Als2'), alias]));
  const h = Buffer.alloc(12);
  h.write('RIFX');
  h.writeUInt32BE(body.length + 4, 4);
  h.write('Egg!', 8);
  return Buffer.concat([h, body, Buffer.from('unchanged trailer')]);
}
test('AEP rewriting preserves no-op containers and unknown trailing metadata', () => {
  const input = sample();
  assert.deepEqual(
    aep.rewriteAliases(input, (v) => v),
    input
  );
  const output = aep.rewriteAliases(input, (v) => ({ ...v, fullpath: 'resources/short' }));
  assert.ok(output.includes(Buffer.from('unchanged trailer')));
  const names = [];
  aep.rewriteAliases(output, (v) => {
    names.push(v.fullpath);
    return v;
  });
  assert.deepEqual(names, ['resources/short']);
  assert.throws(() => aep.rewriteAliases(input.subarray(0, 20), (v) => v), /length|chunk/);
});
test('Resource resolver blocks traversal and leaves user-added local paths intact', () => {
  const resolver = assets.createResolver(path.resolve('extension'));
  assert.throws(() => resolver.resolveResource('resources/../../secrets'), /Invalid/);
  assert.equal(resolver.resolveResource('my-own-project.aep'), 'my-own-project.aep');
  assert.equal(
    resolver.resolveResource('resources/presets/a.ffx'),
    path.resolve('extension/resources/presets/a.ffx')
  );
});
test('Bundled AEP and automatic recipe imports resolve against a relocated Unicode install', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricmotion-test-'));
  const extension = path.join(temporary, '新安装目录'),
    cache = path.join(temporary, 'cache');
  try {
    fs.mkdirSync(path.join(extension, 'resources/media/序列'), { recursive: true });
    fs.mkdirSync(path.join(extension, 'resources/presets'), { recursive: true });
    fs.writeFileSync(path.join(extension, 'resources/presets/demo.aep'), sample());
    const resolver = assets.createResolver(extension, cache);
    const project = { recipe: { local: [{ path: 'resources/presets/demo.aep' }] } };
    const prepared = await resolver.prepareProject(project);
    assert.equal(project.recipe.local[0].path, 'resources/presets/demo.aep');
    const aliases = [];
    aep.rewriteAliases(fs.readFileSync(prepared.recipe.local[0].path), (v) => {
      aliases.push(v.fullpath);
      return v;
    });
    assert.deepEqual(aliases, [path.join(extension, 'resources/media/序列')]);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});

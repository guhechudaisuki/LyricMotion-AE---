import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { root } from '../config/project.mjs';
import aep from '../src/node/aep-resources.cjs';

const resourceRoot = process.argv[2] ? path.resolve(process.argv[2]) : root;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'resources/manifest.json'), 'utf8'));
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'src/data/curated-motion.js'), 'utf8'), context);
const catalog = context.window.LMCuratedMotion;
assert.equal(catalog.records.length, 522);
const files = new Set();
for (const record of manifest.files) {
  assert.match(record.path, /^resources\//);
  assert.ok(!record.path.includes('..'));
  const bytes = fs.readFileSync(path.join(resourceRoot, record.path));
  assert.equal(bytes.length, record.bytes, record.path);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), record.sha256, record.path);
  files.add(record.path);
}
let references = 0;
for (const record of catalog.records) {
  assert.ok(files.has(record.path), record.path);
  if (record.preview) assert.ok(files.has(record.preview), record.preview);
  for (const file of record.dependencies) assert.ok(files.has(file), file);
  if (record.kind === 'aep')
    aep.rewriteAliases(
      fs.readFileSync(path.join(resourceRoot, record.path)),
      (v) => {
        assert.match(v.fullpath, /^lyricmotion:\/\/resources\//);
        assert.equal(v.server_name, '');
        return v;
      },
      (alias, names) => {
        const folder = alias.fullpath.slice('lyricmotion://'.length),
          prefix = names[0],
          ext = names[1];
        const frames = record.dependencies.filter(
          (file) =>
            path.posix.dirname(file) === folder &&
            path.posix.basename(file).startsWith(prefix) &&
            file.endsWith(ext)
        );
        assert.ok(frames.length > 0, `${record.name}/${prefix}${ext}`);
        references++;
      }
    );
}
console.log(
  `Verified ${catalog.records.length} presets, ${manifest.files.length} file hashes and ${references} AEP footage references.`
);

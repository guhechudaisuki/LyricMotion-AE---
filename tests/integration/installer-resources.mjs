import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { root } from '../../config/project.mjs';

if (process.platform !== 'win32') throw new Error('Installer checks require Windows PowerShell');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricmotion-installer-test-'));
const dest = path.join(temporary, 'installed'),
  objects = path.join(temporary, 'remote'),
  cache = path.join(temporary, 'cache');
const files = [];
for (const [name, value] of [
  ['a', 'alpha'],
  ['b', 'beta'],
  ['copy', 'alpha']
]) {
  const data = Buffer.from(value),
    sha256 = createHash('sha256').update(data).digest('hex');
  const relative = `objects/${sha256.slice(0, 2)}/${sha256}.gz`;
  fs.mkdirSync(path.dirname(path.join(objects, relative)), { recursive: true });
  fs.writeFileSync(path.join(objects, relative), gzipSync(data));
  files.push({ path: `resources/${name}.txt`, bytes: data.length, sha256 });
}
const manifest = path.join(temporary, 'manifest.json'),
  lock = path.join(temporary, 'lock.json');
fs.writeFileSync(manifest, JSON.stringify({ files }));
fs.writeFileSync(
  lock,
  JSON.stringify({
    version: 'test',
    baseUrl:
      'https://raw.githubusercontent.com/guhechudaisuki/LyricMotion-AE---/' + 'a'.repeat(40) + '/',
    format: 'sha256-gzip-v1',
    files: files.length
  })
);
const run = (offline = objects, destination = dest, reuseDirectory) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      path.join(root, 'installer/Install-Resources.ps1'),
      '-LockFile',
      lock,
      '-ManifestFile',
      manifest,
      '-Destination',
      destination,
      '-OfflineObjects',
      offline,
      '-CacheDirectory',
      cache,
      ...(reuseDirectory ? ['-ReuseDirectory', reuseDirectory] : [])
    ],
    { encoding: 'utf8', windowsHide: true }
  );
try {
  let result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /installed=3; reused=0; downloaded=2;/);
  result = run(path.join(temporary, 'must-not-be-read'));
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /installed=0; reused=3; downloaded=0;/);
  fs.unlinkSync(path.join(dest, 'resources/copy.txt'));
  result = run(path.join(temporary, 'must-not-be-read'));
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /installed=1; reused=2; downloaded=0;/);
  fs.writeFileSync(path.join(dest, 'resources/b.txt'), 'corrupt');
  result = run();
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /installed=1; reused=2; downloaded=1;/);
  fs.writeFileSync(path.join(dest, 'resources/b.txt'), 'old');
  const b = files[1];
  fs.writeFileSync(
    path.join(objects, `objects/${b.sha256.slice(0, 2)}/${b.sha256}.gz`),
    gzipSync(Buffer.from('wrong payload'))
  );
  result = run();
  assert.equal(result.status, 1);
  assert.equal(fs.readFileSync(path.join(dest, 'resources/b.txt'), 'utf8'), 'old');
  assert.match(result.stdout, /validation|verification|declared size/i);
  fs.writeFileSync(path.join(dest, 'resources/b.txt'), 'beta');
  const relocated = path.join(temporary, 'new-location');
  result = run(path.join(temporary, 'must-not-be-read'), relocated, dest);
  assert.equal(result.status, 0, result.stdout);
  assert.match(result.stdout, /installed=3; reused=0; downloaded=0;/);
  assert.equal(fs.readFileSync(path.join(relocated, 'resources/b.txt'), 'utf8'), 'beta');
  console.log(
    '6/6 installer resource flows passed: first install, reuse, duplicate reuse, repair, failed download preservation, and relocation reuse.'
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

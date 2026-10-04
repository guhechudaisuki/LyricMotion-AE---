import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { root, metadata } from '../config/project.mjs';

const output = path.join(root, 'artifacts', 'resource-upload');
if (path.dirname(output) !== path.join(root, 'artifacts'))
  throw new Error('Invalid output directory');
fs.mkdirSync(output, { recursive: true });
// The output can also be a resource-branch checkout. Keep its Git metadata.
const objectsDirectory = path.resolve(output, 'objects');
if (path.dirname(objectsDirectory) !== output) throw new Error('Invalid objects directory');
fs.rmSync(objectsDirectory, { recursive: true, force: true });
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'resources/manifest.json'), 'utf8'));
const seen = new Set();
let bytes = 0;
for (const file of manifest.files) {
  if (seen.has(file.sha256)) continue;
  const data = fs.readFileSync(path.join(root, file.path));
  if (createHash('sha256').update(data).digest('hex') !== file.sha256)
    throw new Error(`Resource changed: ${file.path}`);
  const compressed = gzipSync(data, { level: 9 });
  const name = `objects/${file.sha256.slice(0, 2)}/${file.sha256}.gz`;
  fs.mkdirSync(path.dirname(path.join(output, name)), { recursive: true });
  fs.writeFileSync(path.join(output, name), compressed);
  seen.add(file.sha256);
  bytes += compressed.length;
}
const lock = {
  version: metadata.version,
  baseUrl: '',
  format: 'sha256-gzip-v1',
  files: manifest.files.length,
  objects: seen.size,
  downloadBytes: bytes
};
fs.writeFileSync(
  path.join(root, 'config/resources-lock.json'),
  JSON.stringify(lock, null, 2) + '\n'
);
fs.copyFileSync(path.join(root, 'resources/manifest.json'), path.join(output, 'manifest.json'));
fs.writeFileSync(
  path.join(output, 'README.md'),
  `# LyricMotion ${metadata.version} resources\n\nContent-addressed gzip objects for the online installer. Only missing or damaged files are downloaded. Each decompressed object is checked against its SHA-256 filename.\n\nIncludes selected presets and their referenced footage only. Source and rights: main branch THIRD_PARTY_NOTICES.md.\n`
);
console.log(
  `Packed ${manifest.files.length} files as ${seen.size} objects (${bytes} bytes). Pin the resource commit before packaging.`
);

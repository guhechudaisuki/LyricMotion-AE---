import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { root, metadata } from '../config/project.mjs';

for (const file of [
  'src/index.html',
  'src/CSXS/manifest.xml',
  'src/panel/bridge.js',
  'src/host/host.jsx'
]) {
  assert.ok(
    fs.readFileSync(path.join(root, file), 'utf8').includes(metadata.version),
    `Version mismatch: ${file}`
  );
}
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
assert.equal(lock.version, metadata.version);
assert.equal(lock.packages[''].version, metadata.version);
const roots = ['src', 'scripts', 'config', 'installer', 'docs', 'tests'];
const files = ['README.md', 'package.json'];
function collect(directory) {
  for (const entry of fs.readdirSync(path.join(root, directory), { withFileTypes: true })) {
    const file = directory + '/' + entry.name;
    if (entry.isDirectory()) collect(file);
    else if (/\.(?:mjs|cjs|jsx?|html|md|json|ps1|nsi|xml|css)$/.test(file)) files.push(file);
  }
}
for (const directory of roots) collect(directory);
for (const file of files) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!/(?:[A-Z]:[\\/](?:Users|yun|预设))/i.test(text), `Machine path leaked: ${file}`);
  assert.ok(!/(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}/.test(text), `Credential leaked: ${file}`);
}
console.log(`Project metadata and ${files.length} public text files checked.`);

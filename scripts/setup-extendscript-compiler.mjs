import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { root } from '../config/project.mjs';

// Pinned developer tool, never copied into the panel or the installer.
// jsxbin bundles Adobe's standalone compiler; no Adobe application is required.
assert.equal(process.platform, 'win32', 'This installer verification tool requires Windows');
assert.equal(process.arch, 'x64', 'Use 64-bit Node.js for the standalone compiler');
const version = '2.3.0';
const integrity =
  '3BS8fdbyNVrMQDE9Q+h65KHhVRMnWPbK4AMjOZsLnuObwEe9ewn2USs2LRLU4Tlwjd9FiuoA9nXjI/F8zzMiZQ==';
const directory = path.join(root, '.local/tools', 'jsxbin-' + version);
const archive = path.join(root, '.local/tools', 'jsxbin-' + version + '.tgz');
const valid = (bytes) => createHash('sha512').update(bytes).digest('base64') === integrity;
fs.mkdirSync(directory, { recursive: true });
if (!fs.existsSync(archive) || !valid(fs.readFileSync(archive))) {
  const response = await fetch('https://registry.npmjs.org/jsxbin/-/jsxbin-' + version + '.tgz', {
    signal: AbortSignal.timeout(60000)
  });
  assert.ok(response.ok, 'Compiler download failed: HTTP ' + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.ok(valid(bytes), 'Compiler archive failed SHA-512 verification');
  fs.writeFileSync(archive, bytes);
}
function extract(file, destination) {
  const result = spawnSync('tar', ['-xf', file, '-C', destination], {
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, 'Compiler archive extraction failed');
}
extract(archive, directory);
extract(
  path.join(directory, 'package/esdebugger-core-win.tar.gz'),
  path.join(directory, 'package')
);
assert.ok(
  fs.existsSync(path.join(directory, 'package/esdebugger-core/win/x64/esdcorelibinterface.node'))
);
console.log('Standalone ExtendScript compiler ready in .local/tools (jsxbin ' + version + ').');

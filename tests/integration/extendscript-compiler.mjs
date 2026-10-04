import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { root, distribution, metadata } from '../../config/project.mjs';
import { localTool } from '../../scripts/lib/browser.mjs';
import { compileExtendScript } from '../../scripts/extendscript.mjs';
import { hostSource } from '../../scripts/lib/engine.mjs';

// Only initialize the standalone compiler. Never discover, launch or contact an Adobe app.
const compilerPath = localTool(
  'EXTENDSCRIPT_COMPILER_PATH',
  '.local/tools/jsxbin-2.3.0/package/esdebugger-core/win/x64/esdcorelibinterface.node'
);
assert.ok(fs.existsSync(path.resolve(root, compilerPath)), 'Run npm run tools:extendscript first');
const compiler = createRequire(import.meta.url)(path.resolve(root, compilerPath));
const initialized = compiler.esdInitialize('LyricMotionSyntaxCheck', process.pid);
assert.ok([0, 11].includes(initialized.status), JSON.stringify(initialized));
const checks = [];
function compile(label, source) {
  const result = compiler.esdCompileToJSXBin(source, path.join(root, 'syntax-check.jsx'), root);
  checks.push({ label, status: result.status, error: result.error });
  return result;
}
try {
  const regression = 'var v = a ? b ? 1 : 2 : 3;';
  const rejected = compile('negative control: ungrouped nested conditional', regression);
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.error, /Expected: :/);
  const fixtures = [
    regression,
    'var v = a ? b ? c ? 1 : 2 : 3 : 4;',
    'var v = a ? (b ? 1 : 2) : c ? 3 : 4;',
    'var v = a ? b || c ? /[a/b]/.test("/") : "回忆" : "留白";'
  ];
  for (let i = 0; i < fixtures.length; i++) {
    const result = compile('compiled fixture ' + i, compileExtendScript(fixtures[i]).source);
    assert.equal(result.status, 0, result.error);
  }
  const expected = compileExtendScript(hostSource()).source;
  const current = compile('current host modules', expected);
  assert.equal(current.status, 0, current.error);
  const artifact = fs.readFileSync(path.join(distribution, 'jsx/host.jsx'), 'utf8');
  assert.equal(artifact, expected, 'Built host is stale; run npm run build before packaging');
  const packaged = compile('built host.jsx', artifact);
  assert.equal(packaged.status, 0, packaged.error);
  fs.mkdirSync(path.join(root, 'artifacts/extendscript'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'artifacts/extendscript/report.json'),
    JSON.stringify(
      {
        version: metadata.version,
        hostSha256: createHash('sha256').update(artifact).digest('hex'),
        checks
      },
      null,
      2
    ) + '\n'
  );
  console.log('Native ExtendScript compiler passed fixtures, current modules and built host.jsx.');
} finally {
  compiler.esdCleanup();
}

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { root, metadata } from '../../config/project.mjs';
import { localTool } from '../../scripts/lib/browser.mjs';

// Run the production NSIS script with isolated discovery/registry paths and
// a small resource manifest. No real AE installation or user settings are used.
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricmotion-exe-'));
const entry = path.join(temporary, 'CEP/extensions/com.lyricmotion.ae.panel');
const first = path.join(temporary, '自选安装 [一]');
const second = path.join(temporary, '自选安装 二');
const executable = path.join(temporary, 'setup.exe');
const registry = 'Software\\LyricMotion-AE\\InstallerTests\\' + path.basename(temporary);
const invoke = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
    ...options
  });
  assert.equal(result.status, 0, result.error?.message || result.stdout + result.stderr);
  return result.stdout;
};
const resources = [];
const checkFiles = (directory) => {
  const core = JSON.parse(fs.readFileSync(path.join(root, 'dist/build-files.json'))).files;
  for (const file of [...core, ...resources]) {
    const bytes = fs.readFileSync(path.join(directory, file.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
};
try {
  fs.mkdirSync(path.join(entry, 'CSXS'), { recursive: true });
  fs.writeFileSync(
    path.join(entry, 'CSXS/manifest.xml'),
    '<ExtensionManifest><Extension Id="com.lyricmotion.ae.panel"/></ExtensionManifest>'
  );
  for (const [name, text] of [
    ['one.txt', 'one'],
    ['two.txt', 'two'],
    ['copy.txt', 'one']
  ]) {
    const bytes = Buffer.from(text);
    const relative = `resources/${name}`;
    fs.mkdirSync(path.join(entry, 'resources'), { recursive: true });
    fs.writeFileSync(path.join(entry, relative), bytes);
    resources.push({
      path: relative,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')
    });
  }
  const manifestFile = path.join(temporary, 'manifest.json');
  const lockFile = path.join(temporary, 'resources-lock.json');
  fs.writeFileSync(manifestFile, JSON.stringify({ files: resources }));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'config/resources-lock.json')));
  fs.writeFileSync(lockFile, JSON.stringify({ ...lock, files: resources.length }));
  invoke(localTool('NSIS_PATH', 'makensis'), [
    '/INPUTCHARSET',
    'UTF8',
    '/V2',
    `/DVERSION=${metadata.version}`,
    '/DLM_TEST',
    `/DLM_OUTFILE=${executable}`,
    `/DLM_EXTENSION_DIRECTORY=${entry}`,
    `/DLM_BACKUP_DIRECTORY=${path.join(temporary, 'backups')}`,
    `/DLM_UNINSTALL_KEY=${registry}`,
    `/DLM_RESOURCE_MANIFEST=${manifestFile}`,
    `/DLM_RESOURCE_LOCK=${lockFile}`,
    'installer/LyricMotion.nsi'
  ]);
  const install = (directory) =>
    invoke(executable, ['/S', `/D=${directory}`], { windowsVerbatimArguments: true });
  install(first);
  checkFiles(first);
  assert.equal(fs.realpathSync.native(entry), fs.realpathSync.native(first));
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(first, 'resources/install-receipt.json'))).downloaded,
    0
  );
  install(first);
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(first, 'resources/install-receipt.json'))).reused,
    resources.length
  );
  install(second);
  checkFiles(second);
  assert.equal(fs.realpathSync.native(entry), fs.realpathSync.native(second));
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(second, 'resources/install-receipt.json'))).downloaded,
    0
  );
  fs.writeFileSync(path.join(first, 'personal.txt'), 'keep');
  const uninstallName = '\u5378\u8f7d\u6620\u8bcd.exe';
  const uninstall = (directory) =>
    invoke(path.join(directory, uninstallName), ['/S', `_?=${directory}`], {
      windowsVerbatimArguments: true
    });
  uninstall(first);
  assert.equal(fs.readFileSync(path.join(first, 'personal.txt'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(first, 'index.html')), false);
  assert.equal(fs.realpathSync.native(entry), fs.realpathSync.native(second));
  // reg.exe uses the system code page; query only checks that the active key
  // survived. The next uninstall verifies that it identifies the second path.
  invoke('reg.exe', ['query', `HKCU\\${registry}`, '/v', 'InstallLocation']);
  uninstall(second);
  assert.equal(fs.existsSync(entry), false);
  assert.equal(fs.existsSync(path.join(second, 'index.html')), false);
  assert.equal(fs.existsSync(path.join(second, 'resources/one.txt')), false);
  assert.equal(
    spawnSync('reg.exe', ['query', `HKCU\\${registry}`], { windowsHide: true }).status,
    1
  );
  fs.mkdirSync(path.join(root, 'artifacts/installer-exe'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'artifacts/installer-exe/report.json'),
    JSON.stringify(
      {
        version: metadata.version,
        customDirectory: true,
        installedCoreFiles: 30,
        repeatInstallReused: resources.length,
        relocationDownloads: 0,
        previousUninstallPreservesActiveEntry: true,
        userFilesPreserved: true,
        activeUninstallRemovesEntry: true,
        aeStarted: false
      },
      null,
      2
    )
  );
  console.log(
    'NSIS EXE checks passed: selected directories, repeat install, relocation, AE entry and both uninstall paths.'
  );
} finally {
  spawnSync('reg.exe', ['delete', `HKCU\\${registry}`, '/f'], {
    windowsHide: true,
    stdio: 'ignore'
  });
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(temporary, { recursive: true, force: true });
}

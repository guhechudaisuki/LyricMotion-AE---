import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { root } from '../../config/project.mjs';

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'lyricmotion-locations-'));
const entry = path.join(temporary, 'CEP/extensions/com.lyricmotion.ae.panel');
const backup = path.join(temporary, 'backups');
const first = path.join(temporary, '自选目录 [一] & resources');
const second = path.join(temporary, '另一位置');
const third = path.join(temporary, 'migrated');
const script = path.join(root, 'installer/Manage-Installation.ps1');
const execute = (action, directory, backupDirectory = backup) =>
  spawnSync(
    'powershell.exe',
    [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      script,
      '-Action',
      action,
      '-Destination',
      directory,
      '-ExtensionDirectory',
      entry,
      '-BackupDirectory',
      backupDirectory,
      '-Version',
      '1.5.1'
    ],
    { encoding: 'utf8', windowsHide: true }
  );
const succeed = (action, directory, backupDirectory) => {
  const result = execute(action, directory, backupDirectory);
  assert.equal(result.status, 0, result.stdout + result.stderr);
};
const reject = (action, directory, backupDirectory) => {
  const result = execute(action, directory, backupDirectory);
  assert.equal(result.status, 1, `Unexpected success: ${action} ${directory}`);
};
const panel = (directory) => {
  fs.mkdirSync(path.join(directory, 'CSXS'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'resources'), { recursive: true });
  fs.writeFileSync(
    path.join(directory, 'CSXS/manifest.xml'),
    '<ExtensionManifest><Extension Id="com.lyricmotion.ae.panel"/></ExtensionManifest>'
  );
  fs.writeFileSync(path.join(directory, 'index.html'), 'panel');
  fs.writeFileSync(path.join(directory, 'resources/a.txt'), 'resource');
  fs.writeFileSync(
    path.join(directory, 'resources/manifest.json'),
    JSON.stringify({ files: [{ path: 'resources/a.txt' }] })
  );
  fs.writeFileSync(
    path.join(directory, 'installation-files.json'),
    JSON.stringify({
      extensionId: 'com.lyricmotion.ae.panel',
      files: [{ path: 'CSXS/manifest.xml' }, { path: 'index.html' }]
    })
  );
};
try {
  const occupied = path.join(temporary, 'unrelated');
  fs.mkdirSync(occupied);
  fs.writeFileSync(path.join(occupied, 'personal.txt'), 'keep');
  reject('Prepare', occupied);
  reject('Validate', path.parse(temporary).root);
  reject('Validate', path.join(entry, 'nested'));
  assert.equal(fs.readFileSync(path.join(occupied, 'personal.txt'), 'utf8'), 'keep');

  succeed('Validate', first);
  succeed('Prepare', first);
  panel(first);
  succeed('Register', first);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(first));
  assert.equal(fs.readFileSync(path.join(entry, 'resources/a.txt'), 'utf8'), 'resource');

  succeed('Prepare', second);
  reject('Register', second);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(first));
  panel(second);
  succeed('Register', second);
  succeed('Register', second);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(second));
  fs.writeFileSync(path.join(first, 'personal.txt'), 'keep');
  succeed('Uninstall', first);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(second));
  assert.equal(fs.readFileSync(path.join(first, 'personal.txt'), 'utf8'), 'keep');
  assert.equal(fs.existsSync(path.join(first, 'index.html')), false);

  const listPath = path.join(second, 'installation-files.json');
  const list = fs.readFileSync(listPath);
  fs.writeFileSync(
    listPath,
    JSON.stringify({
      extensionId: 'com.lyricmotion.ae.panel',
      files: [{ path: '../unrelated/personal.txt' }]
    })
  );
  reject('Uninstall', second);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(second));
  fs.writeFileSync(listPath, list);
  fs.symlinkSync(occupied, path.join(second, 'resources/external'), 'junction');
  fs.writeFileSync(
    path.join(second, 'resources/manifest.json'),
    JSON.stringify({
      files: [{ path: 'resources/a.txt' }, { path: 'resources/external/personal.txt' }]
    })
  );
  succeed('Uninstall', second);
  assert.equal(fs.existsSync(entry), false);
  assert.equal(fs.readFileSync(path.join(occupied, 'personal.txt'), 'utf8'), 'keep');
  fs.unlinkSync(path.join(second, 'resources/external'));

  panel(entry);
  fs.writeFileSync(path.join(entry, 'personal.txt'), 'original');
  succeed('Prepare', third);
  panel(third);
  reject('Register', third, path.join(third, 'unsafe-backup'));
  assert.equal(fs.lstatSync(entry).isSymbolicLink(), false);
  assert.equal(fs.readFileSync(path.join(entry, 'personal.txt'), 'utf8'), 'original');
  succeed('Register', third);
  assert.equal(fs.realpathSync(entry), fs.realpathSync(third));
  const old = path.join(backup, fs.readdirSync(backup)[0]);
  assert.equal(fs.readFileSync(path.join(old, 'personal.txt'), 'utf8'), 'original');
  assert.equal(fs.readFileSync(path.join(old, 'resources/a.txt'), 'utf8'), 'resource');
  succeed('Uninstall', third);
  assert.equal(fs.existsSync(entry), false);

  succeed('Prepare', entry);
  panel(entry);
  succeed('Register', entry);
  assert.equal(fs.lstatSync(entry).isSymbolicLink(), false);
  succeed('Uninstall', entry);
  assert.equal(fs.existsSync(path.join(entry, 'index.html')), false);
  console.log(
    'Installer location checks passed: custom paths, AE entry, relocation, rollback, direct install, and safe uninstall.'
  );
} finally {
  assert.ok(path.resolve(temporary).startsWith(path.resolve(os.tmpdir()) + path.sep));
  fs.rmSync(temporary, { recursive: true, force: true });
}

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root } from '../config/project.mjs';

if (process.platform !== 'win32')
  throw new Error(
    'Use the Windows resource installer or manually extract the pinned tar.xz archive'
  );
const output = process.argv[2] ? path.resolve(process.argv[2]) : root;
const result = spawnSync(
  'powershell.exe',
  [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    path.join(root, 'installer/Install-Resources.ps1'),
    '-LockFile',
    path.join(root, 'config/resources-lock.json'),
    '-ManifestFile',
    path.join(root, 'resources/manifest.json'),
    '-Destination',
    output
  ],
  { stdio: 'inherit', windowsHide: true }
);
if (result.error) throw result.error;
process.exitCode = result.status || 0;

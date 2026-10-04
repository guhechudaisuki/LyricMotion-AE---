import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { root, metadata } from '../config/project.mjs';
import { localTool } from './lib/browser.mjs';

const lock = JSON.parse(fs.readFileSync(path.join(root, 'config/resources-lock.json'), 'utf8'));
if (
  lock.version !== metadata.version ||
  !/^https:\/\/raw\.githubusercontent\.com\/guhechudaisuki\/LyricMotion-AE---\/[a-f0-9]{40}\/$/.test(
    lock.baseUrl
  )
)
  throw new Error('Publish resource commit and pin resources-lock.json before packaging');
const nsis = localTool('NSIS_PATH', 'makensis');
const result = spawnSync(
  nsis,
  ['/INPUTCHARSET', 'UTF8', '/V3', `/DVERSION=${metadata.version}`, 'installer/LyricMotion.nsi'],
  { cwd: root, stdio: 'inherit', windowsHide: true }
);
if (result.error) throw result.error;
if (result.status) throw new Error('NSIS packaging failed');

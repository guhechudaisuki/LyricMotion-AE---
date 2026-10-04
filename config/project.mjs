import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
export const extensionId = 'com.lyricmotion.ae.panel';
export const distribution = path.join(root, 'dist', extensionId);
export const sharedModules = [
  'motion',
  'motifs',
  'layout-fit',
  'choreography',
  'song-profiles',
  'presets',
  'annotations',
  'core'
].map((name) => `src/shared/${name}.js`);
export const hostModules = [...sharedModules, 'src/host/host.jsx'];

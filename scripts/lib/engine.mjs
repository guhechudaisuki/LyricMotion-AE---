import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root, sharedModules, hostModules } from '../../config/project.mjs';

export function hostSource() {
  return hostModules.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
}

export function loadEngine() {
  const context = vm.createContext({});
  for (const file of sharedModules) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

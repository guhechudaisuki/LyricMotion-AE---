import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) =>
  fs
    .readFileSync(path.join(root, '.local', 'inventories', name), 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean);
const files = [
  ...new Set([...read('g-presets-inventory.txt'), ...read('local-ffx-inventory.txt')])
];
const previewKey = (file) =>
  file
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/atom (after effects|preview assets)/g, 'atom-assets')
    .replace(/\.[^./]+$/, '');
const previews = new Map();
for (const f of files)
  if (/\.(gif|jpg|jpeg|png)$/i.test(f) && /preview|thumb/i.test(f)) previews.set(previewKey(f), f);
const records = [];
for (const file of files) {
  const ext = path.extname(file).slice(1).toLowerCase();
  if (!['ffx', 'aep', 'aepx', 'mov', 'mp4', 'png', 'jpg', 'jpeg', 'gif', 'webm'].includes(ext))
    continue;
  if (/preview|thumbnail|thumbs|预览/i.test(file) && ext !== 'ffx' && ext !== 'aep') continue;
  if (/\d{4,}\.(png|jpg|jpeg)$/i.test(file)) continue;
  const kind = ext === 'ffx' ? 'ffx' : /^aep/.test(ext) ? 'aep' : 'media';
  const folder = path.dirname(file),
    name = path.basename(file, '.' + ext);
  const role =
    kind === 'ffx' && /text|typogra|文字|字效|字符|glyph|otext/i.test(folder + '\\' + name)
      ? 'text'
      : 'decor';
  records.push({
    id: 'local:' + file.toLowerCase(),
    path: file,
    name,
    kind,
    role,
    folder,
    preview: previews.get(previewKey(file)) || ''
  });
}
records.sort((a, b) => {
  const score = (r) =>
    /text presets|hand drawn|crispy|glyph|文字动画|opacity|tracking/i.test(r.path) ? 0 : 1;
  return score(a) - score(b) || a.path.localeCompare(b.path);
});
const folders = [],
  folderIndex = new Map();
const getFolder = (folder) => {
  if (!folderIndex.has(folder)) {
    folderIndex.set(folder, folders.length);
    folders.push(folder);
  }
  return folderIndex.get(folder);
};
const packed = records.map((r) => [
  getFolder(r.folder),
  path.basename(r.path),
  r.kind,
  r.role,
  r.preview
]);
const source =
  'window.LMCatalog = (function(){\nvar folders=' +
  JSON.stringify(folders) +
  ';\nvar packed=[\n' +
  packed.map((r) => JSON.stringify(r)).join(',\n') +
  '\n];\nreturn packed.map(function(r){var folder=folders[r[0]],file=folder+"\\\\"+r[1];return {id:"local:"+file.toLowerCase(),path:file,name:r[1].replace(/\\.[^.]+$/,""),kind:r[2],role:r[3],folder:folder,preview:r[4]};});\n})();\n';
fs.writeFileSync(path.join(root, '.local/local-catalog.js'), source);
const counts = records.reduce((out, r) => {
  out[r.kind] = (out[r.kind] || 0) + 1;
  return out;
}, {});
fs.writeFileSync(
  path.join(root, '.local/catalog-summary.json'),
  JSON.stringify(
    { indexed: records.length, previews: records.filter((r) => r.preview).length, counts },
    null,
    2
  )
);
console.log({ indexed: records.length, counts });

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { root } from '../config/project.mjs';
import aep from '../src/node/aep-resources.cjs';

const sourceFile = path.join(root, '.local', 'curated-motion.js');
const outputRoot = path.join(root, 'resources');
const source = fs.readFileSync(sourceFile, 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(source, sandbox, { filename: sourceFile });
const curated = sandbox.window.LMCuratedMotion;
if (!curated || !Array.isArray(curated.records)) throw new Error('精选库格式无效');

if (path.dirname(path.resolve(outputRoot)) !== root)
  throw new Error('Invalid resource destination');
fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });
const used = new Set();
const files = [];
const inventory = fs
  .readFileSync(path.join(root, '.local/inventories/g-presets-inventory.txt'), 'utf8')
  .replace(/^\uFEFF/, '')
  .split(/\r?\n/)
  .filter(Boolean);
const mediaFiles = inventory.filter((file) => /[\\/]Footages[\\/].*\.png$/i.test(file));
const byFolder = new Map();
for (const file of mediaFiles) {
  const name = path.basename(path.dirname(file));
  if (!byFolder.has(name)) byFolder.set(name, []);
  byFolder.get(name).push(file);
}
const copied = new Set();
const clean = (value) =>
  String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'asset';
const copy = (sourcePath, relativePath, replacement) => {
  if (copied.has(relativePath)) return;
  if (!fs.existsSync(sourcePath)) throw new Error(`精选资源不存在：${sourcePath}`);
  const destination = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (replacement) fs.writeFileSync(destination, replacement);
  else fs.copyFileSync(sourcePath, destination);
  copied.add(relativePath);
  const data = fs.readFileSync(destination);
  files.push({
    path: `resources/${relativePath.replaceAll('\\', '/')}`,
    bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex')
  });
};
const records = curated.records
  .filter((record) => !(record.name === 'Symbols' && record.kind === 'aep'))
  .map((record, index) => {
    const group = clean(record.group || 'uncategorized');
    const extension = path.extname(record.path).toLowerCase();
    const key = `${group}/${String(index + 1).padStart(3, '0')}_${clean(path.basename(record.path, extension))}${extension}`;
    let asset = key;
    while (used.has(asset))
      asset = `${group}/${String(index + 1).padStart(3, '0')}_${clean(path.basename(record.path, extension))}_${used.size}${extension}`;
    used.add(asset);
    const dependencies = new Set();
    let portable;
    if (extension === '.aep') {
      portable = aep.rewriteAliases(
        fs.readFileSync(record.path),
        (alias) => {
          if (!alias.fullpath) return alias;
          const folder = path.win32.basename(alias.fullpath);
          if (!alias.target_is_folder || !byFolder.has(folder))
            throw new Error(`Unresolved AEP alias: ${record.name}/${folder}`);
          return {
            ...alias,
            fullpath: `lyricmotion://resources/media/hand-drawn/${folder}`,
            server_name: '',
            server_volume_name: '',
            ascendcount_base: 0,
            ascendcount_target: 0
          };
        },
        (alias, names) => {
          const folder = path.win32.basename(alias.fullpath);
          const candidates = byFolder.get(folder) || [];
          const prefix = names[0],
            ext = names[1];
          if (!prefix || !/^\.[a-z0-9]+$/i.test(ext || ''))
            throw new Error(`Unsupported footage reference: ${record.name}/${names}`);
          const selected = candidates.filter((file) => {
            const base = path.basename(file);
            if (!base.startsWith(prefix) || !base.endsWith(ext)) return false;
            return /^\d*$/.test(base.slice(prefix.length, -ext.length));
          });
          if (!selected.length)
            throw new Error(`Missing sequence: ${record.name}/${folder}/${prefix}${ext}`);
          for (const file of selected) {
            const relative = `media/hand-drawn/${folder}/${path.basename(file)}`;
            copy(file, relative);
            dependencies.add(`resources/${relative}`);
          }
        }
      );
    }
    copy(record.path, `presets/${asset}`, portable);
    let preview = '';
    if (record.preview && fs.existsSync(record.preview)) {
      const previewExt = path.extname(record.preview).toLowerCase() || '.gif';
      preview = `previews/${group}/${String(index + 1).padStart(3, '0')}_${clean(path.basename(record.preview, previewExt))}${previewExt}`;
      copy(record.preview, preview);
    }
    const bundled = {
      ...record,
      id: `bundled:${String(index + 1).padStart(4, '0')}`,
      path: `resources/presets/${asset}`,
      pairKey: `${record.group}/${path.basename(path.dirname(record.path))}/${record.name.replace(/^(IN_|OUT_)/i, '')}`,
      preview: preview ? `resources/${preview}` : '',
      folder: record.source || '随包精选资源',
      bundled: true,
      dependencies: [...dependencies].sort()
    };
    delete bundled.source;
    return bundled;
  });
const output = `window.LMCuratedMotion = ${JSON.stringify({ version: 2, groups: curated.groups.map((group) => ({ ...group, count: records.filter((record) => record.group === group.id).length })), records, summary: { records: records.length, groups: curated.groups.length, ffx: records.filter((r) => r.kind === 'ffx').length, projects: records.filter((r) => r.kind === 'aep').length, previews: records.filter((r) => r.preview).length } }, null, 2)};\n`;
fs.writeFileSync(path.join(root, 'src', 'data', 'curated-motion.js'), output, 'utf8');
fs.writeFileSync(
  path.join(outputRoot, 'manifest.json'),
  JSON.stringify(
    {
      version: 1,
      records: records.length,
      excluded: [
        {
          project: 'Symbols.aep',
          reason: 'Original Crown_10_ PNG sequence is missing; excluded at user request.'
        }
      ],
      files: files.sort((a, b) => a.path.localeCompare(b.path, 'en'))
    },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(`Bundled ${records.length} curated records and ${files.length} files`);

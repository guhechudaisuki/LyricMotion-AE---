import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { compileExtendScript } from './extendscript.mjs';
import { root, distribution, metadata, hostModules } from '../config/project.mjs';

if (path.dirname(path.resolve(distribution)) !== path.join(root, 'dist'))
  throw new Error('Invalid distribution directory');
fs.rmSync(distribution, { recursive: true, force: true });
fs.mkdirSync(distribution, { recursive: true });
const copy = (relative, target = relative) => {
  const source = path.join(root, relative);
  const destination = path.join(distribution, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
};
for (const file of ['src/index.html', 'src/panel.css']) copy(file, file.slice(4));
for (const directory of ['CSXS', 'panel', 'shared', 'data', 'node'])
  copy(`src/${directory}`, directory);
copy('assets', 'assets');
const htmlFile = path.join(distribution, 'index.html');
fs.writeFileSync(
  htmlFile,
  fs.readFileSync(htmlFile, 'utf8').replace('content="../resources/"', 'content="resources/"')
);
const hostSource = hostModules
  .map((file) => fs.readFileSync(path.join(root, file), 'utf8'))
  .join('\n');
const compiled = compileExtendScript(hostSource);
fs.mkdirSync(path.join(distribution, 'jsx'), { recursive: true });
fs.writeFileSync(path.join(distribution, 'jsx', 'host.jsx'), compiled.source, 'utf8');
fs.copyFileSync(path.join(root, 'README.md'), path.join(distribution, '使用说明.md'));
for (const file of ['THIRD_PARTY_NOTICES.md', 'CHANGELOG.md']) copy(file, file);
copy('docs/USER_GUIDE.md', 'docs/USER_GUIDE.md');
const legacyFiles = [
  'app',
  'bridge',
  'choreography',
  'core',
  'curated-motion',
  'demo',
  'layout-fit',
  'local-catalog',
  'local-library',
  'motion',
  'motifs',
  'presets',
  'render',
  'song-profiles',
  'startup',
  'styles-ui',
  'subtitles',
  'translation-cache',
  'translation'
];
fs.writeFileSync(
  path.join(root, 'dist/cleanup-legacy.nsh'),
  legacyFiles.map((name) => 'Delete "$INSTDIR\\' + name + '.js"').join('\r\n') + '\r\n'
);

const files = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(full);
    else {
      const data = fs.readFileSync(full);
      files.push({
        path: path.relative(distribution, full).replaceAll('\\', '/'),
        bytes: data.length,
        sha256: createHash('sha256').update(data).digest('hex')
      });
    }
  }
}
walk(distribution);
fs.writeFileSync(
  path.join(root, 'dist', 'build-files.json'),
  JSON.stringify(
    { version: metadata.version, extensionId: 'com.lyricmotion.ae.panel', files },
    null,
    2
  ) + '\n',
  'utf8'
);
console.log(
  `Built ${files.length} files for LyricMotion ${metadata.version}; escaped ${compiled.escapedClasses} regex classes; grouped ${compiled.groupedConditionals} nested conditionals for ExtendScript`
);

import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { root } from '../../config/project.mjs';

const script = fs.readFileSync(path.join(root, 'installer/LyricMotion.nsi'), 'utf8');

test('Installer offers directory selection before writing files', () => {
  const pages = [...script.matchAll(/!insertmacro MUI_PAGE_(\w+)/g)].map((match) => match[1]);
  assert.deepEqual(pages, ['WELCOME', 'DIRECTORY', 'INSTFILES', 'FINISH']);
});

test('Install section respects the selected directory and the NSIS /D override', () => {
  const section = script.match(/Section "安装映词"([\s\S]*?)SectionEnd/)[1];
  assert.doesNotMatch(section, /StrCpy\s+\$INSTDIR\b/);
});

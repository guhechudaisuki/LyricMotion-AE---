import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEngine } from './lib/engine.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const core = loadEngine().LMCore;
const subtitle = path.join(root, 'assets', '我只能离开.srt');
const demo = core.defaults();
demo.title = '我只能离开 · 动态歌词';
demo.cues = core.parse(fs.readFileSync(subtitle, 'utf8'), subtitle);
demo.seed = 670213;
const focus = [
  '回忆',
  '归零',
  '在意',
  '倒影',
  '清晰',
  '意义',
  '痕迹',
  '提醒',
  '旋律',
  '逃离',
  '忘不掉',
  '离开',
  '资格',
  '双手',
  '冷漠',
  '难题',
  '呼吸',
  '难忘',
  '泪',
  '重头',
  '离开'
];
demo.cues.forEach((cue, i) => {
  if (i < focus.length && cue.text.includes(focus[i])) cue.focus = focus[i];
});
fs.writeFileSync(
  path.join(root, 'src/data/demo.js'),
  'window.LMDemo = ' + JSON.stringify(demo) + ';\n'
);
console.log('Demo asset: ' + demo.cues.length + ' timed cues');

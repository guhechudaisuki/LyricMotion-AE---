import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Build a small, purpose-specific view of the user's library. No assets are copied.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const inventory = ['g-presets-inventory.txt', 'local-ffx-inventory.txt'].flatMap((name) =>
  fs
    .readFileSync(path.join(root, '.local', 'inventories', name), 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(Boolean)
);
const files = [...new Set(inventory)];
const key = (file) =>
  file
    .toLowerCase()
    .replace(/\\/g, '/')
    .replace(/atom (after effects|preview assets)/g, 'atom-assets')
    .replace(/\.[^./]+$/, '')
    .replace(/\/(?:in_|out_|mid_)/, '/');
const previews = new Map();
for (const file of files)
  if (/Atom Preview Assets.*\.(?:gif|png|jpg)$/i.test(file)) {
    const k = key(file);
    if (!previews.has(k) || /\.gif$/i.test(file)) previews.set(k, file);
  }
const groups = [],
  records = [],
  missing = [];
const seen = new Set();
const number = (file) => +(path.basename(file).match(/_(\d+)\./) || [0, 0])[1];
const assetFiles = files.filter(
  (f) => /\.(?:ffx|aep|aepx)$/i.test(f) && !/preview|autosave|auto-save/i.test(f)
);
function addGroup(id, name, role, note, selector, maxVariant = 999) {
  const group = { id, name, role, note, count: 0 };
  groups.push(group);
  const selected = assetFiles
    .filter((file) => selector.test(file) && number(file) <= maxVariant)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  for (const file of selected) {
    if (seen.has(file.toLowerCase())) continue;
    if (!fs.existsSync(file)) {
      missing.push(file);
      continue;
    }
    const kind = /\.ffx$/i.test(file) ? 'ffx' : 'aep';
    let preview = previews.get(key(file)) || '',
      previewMode = 'paired',
      previewCount = 0;
    if (!preview && kind === 'aep') {
      const candidates = files
        .filter((f) => /\.gif$/i.test(f) && key(f).startsWith(key(file) + '/'))
        .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
      preview =
        candidates.find((f) =>
          /(?:Markers_12|Lines_12|Arrows_12|Scribble_12|Super Simple 12|Strokes 12)\.gif$/i.test(f)
        ) ||
        candidates[0] ||
        '';
      previewCount = candidates.length;
      previewMode = 'collection';
    }
    if (preview && !fs.existsSync(preview)) {
      missing.push(preview);
      preview = '';
    }
    const data = kind === 'ffx' ? fs.readFileSync(file) : null;
    const pseudo =
      data &&
      (/Pseudo\//i.test(data.toString('latin1')) || /Pseudo\//i.test(data.toString('utf16le')));
    const phase = (path.basename(file).match(/^(IN|OUT|MID)_/i) || [0, ''])[1].toLowerCase();
    records.push({
      id: 'local:' + file.toLowerCase(),
      path: file,
      name: path.basename(file, path.extname(file)),
      kind,
      role,
      folder: path.dirname(file),
      preview,
      group: id,
      phase,
      previewMode,
      previewCount,
      dependencyNote:
        kind === 'aep'
          ? '工程合集：导入后选择内部合成，字体和关联素材由原工程决定。'
          : pseudo
            ? '检测到 Pseudo 自定义控件；可能依赖原预设包，尚未在 AE 中逐项验证。'
            : '已检查文件与预览路径；字体、表达式和 AE 兼容性尚未逐项验证。',
      source: /Text Presets V3/i.test(file)
        ? 'Text Presets V3'
        : /Motion Presets/i.test(file)
          ? 'Motion Presets'
          : /Hand Drawn/i.test(file)
            ? 'Hand Drawn Constructor'
            : /CrispyType/i.test(file)
              ? 'CrispyType'
              : /Motion Elements/i.test(file)
                ? 'Motion Elements'
                : '本机文字工具'
    });
    seen.add(file.toLowerCase());
    group.count++;
  }
}

addGroup(
  'text-mask',
  '文字 · 遮罩出入',
  'text',
  '逐字、逐词从遮罩进入再退出；IN 是进入，OUT 是离开，需成对搭配。',
  /Text Presets V3.*\\Text Mask\\.*\.ffx$/i
);
addGroup(
  'text-position',
  '文字 · 逐字位移',
  'text',
  '逐字滑入、归位；精选基础位移与透明度组合。',
  /Text Presets V3.*\\Characters Animation\\(?:Position\\Position|Opacity\\Opacity & Position)\\Basic\\.*\.ffx$/i,
  5
);
addGroup(
  'text-rotation',
  '文字 · 逐字转入',
  'text',
  '每字旋转、缩放归位，适合短关键词。',
  /Text Presets V3.*\\Characters Animation\\(?:Rotation\\Rotation & Scale|Opacity\\Opacity & Rotation|Position\\Position & Rotation)\\Basic\\.*\.ffx$/i,
  8
);
addGroup(
  'text-tracking',
  '文字 · 字距开合',
  'text',
  '字符间距展开、压缩，配合缩放或淡入淡出。',
  /Text Presets V3.*\\Characters Animation\\(?:Scale\\Scale & Tracking|Opacity\\Opacity & Tracking|Opacity\\Opacity & Scale & Tracking)\\Basic\\.*\.ffx$/i,
  10
);
addGroup(
  'text-elastic',
  '文字 · 轻弹错峰',
  'text',
  '逐字错峰和轻弹；用于少量重拍、重点句。',
  /Text Presets V3.*\\Characters Animation\\(?:Scale\\Scale|Position\\Position|Opacity\\Opacity & Position)\\(?:Elastic|Bounce)\\.*\.ffx$/i,
  5
);
addGroup(
  'text-lines',
  '文字 · 逐行进退',
  'text',
  '多行文字按行进退；不改变原歌词时间。',
  /Text Presets V3.*\\Lines Animation\\(?:Position\\Position|Opacity\\Opacity & Position|Scale\\Scale & Tracking)\\Basic\\.*\.ffx$/i,
  8
);
addGroup(
  'text-words',
  '文字 · 逐词进退',
  'text',
  '适合分词歌词；中文没有空格时请先合理分词。',
  /Text Presets V3.*\\Words Animation\\(?:Position\\Position|Opacity\\Opacity & Position|Scale\\Scale & Tracking)\\Basic\\.*\.ffx$/i,
  8
);
addGroup(
  'text-typewriter',
  '文字 · 打字与光标',
  'text',
  '基础打字、光标和局部着色，不收录大面积底框版本。',
  /Text Presets V3.*\\Typewriter\\(?:Typewriter|Typewriter & Cursor|Typewriter & Color)\\.*\.ffx$/i,
  10
);
addGroup(
  'text-glyph',
  '文字 · 字形轨迹',
  'text',
  '本机 GlyphGlide / GlyphFlow / GlyphTrace；字体适配请在自己的 AE 中确认。',
  /GlyphGlide.*\\Glyph(?:Glide|Flow|Trace)\.ffx$/i
);
addGroup(
  'text-clean',
  '文字 · Clean 动态排版合集',
  'text',
  '简洁多行、关键字和 Kinetic 合集；需自行选择内部合成、替换原文。',
  /Motion Elements.*\\CrispyType\\Clean\\(?:Super Simple|Kinetic|Captions|Quotes|Big|Minimal\\Minimal [IV]+)\.aep$/i
);
addGroup(
  'decor-position',
  '元素 · 短滑与淡入',
  'decor',
  '给线、点、角标等已有图层添加短距离出入；可调原预设位移幅度。',
  /Motion Presets.*\\2D Animation\\(?:Position|Fade & Position|Fade & Scale)\\Basic\\.*\.ffx$/i,
  8
);
addGroup(
  'decor-bounce',
  '元素 · 缩放轻弹',
  'decor',
  '用于星点、菱形和小圆环，不需要铺满画面。',
  /Motion Presets.*\\2D Animation\\(?:Scale|Fade & Scale)\\(?:Bounce|Overshoot)\\.*\.ffx$/i,
  6
);
addGroup(
  'decor-rotate',
  '元素 · 小幅转动',
  'decor',
  '旋转或旋转加缩放，用于字旁的小图形。',
  /Motion Presets.*\\2D Animation\\(?:Rotation & Scale|Fade & Rotation)\\Basic\\.*\.ffx$/i,
  6
);
addGroup(
  'decor-hand-lines',
  '元素 · 手绘线与圈',
  'decor',
  '线条写出、圈线描边再擦去；预览是工程内示例。',
  /Hand Drawn Constructor.*\\Constructor\\(?:Lines|Figures)\.aep$/i
);
addGroup(
  'decor-hand-arrows',
  '元素 · 手绘箭头',
  'decor',
  '曲线箭头、指向线条；缩小放在关键词旁。',
  /Hand Drawn Constructor.*\\Constructor\\Arrows\.aep$/i
);
addGroup(
  'decor-hand-marks',
  '元素 · 涂画与符号',
  'decor',
  '涂画、符号与 Doodles 合集；密实涂抹建议低透明度、小尺寸。',
  /Hand Drawn Constructor.*\\Constructor\\(?:Scribbles|Symbols|Doodles)\.aep$/i
);
addGroup(
  'decor-geometric',
  '元素 · 极简几何线',
  'decor',
  '细线、局部几何描边、简洁箭头；预览背景属于演示，导入后选择所需合成。',
  /Motion Elements.*\\CrispyShapes\\Clean\\(?:Strokes|Minimal I|Minimal II|Arrows)\.aep$/i
);
// Flow/Flat/Lines and Shapes were inspected: these are full-frame backgrounds,
// so their suggestive filenames must not put them in the lyric-decoration view.
addGroup(
  'decor-particles',
  '元素 · 微粒合集',
  'decor',
  '局部微粒点缀工程，先选内部合成再缩小使用；不默认加入整屏粒子背景。',
  /Motion Elements.*\\Flow\\Overlays\\Particles\.aep$/i
);

const result = {
  version: 1,
  generatedAt: new Date().toISOString(),
  groups: groups.filter((g) => g.count),
  records,
  summary: {
    records: records.length,
    groups: groups.filter((g) => g.count).length,
    ffx: records.filter((r) => r.kind === 'ffx').length,
    projects: records.filter((r) => r.kind === 'aep').length,
    previews: records.filter((r) => r.preview).length,
    pseudo: records.filter((r) => /Pseudo/.test(r.dependencyNote)).length,
    missing: missing.length
  }
};
fs.writeFileSync(
  path.join(root, '.local', 'curated-motion.js'),
  '// Local path references only. Generated by scripts/curate-motion.mjs.\nwindow.LMCuratedMotion = ' +
    JSON.stringify(result) +
    ';\n'
);
console.log(
  JSON.stringify(
    {
      ...result.summary,
      groups: result.groups.map((g) => ({ name: g.name, count: g.count })),
      missing
    },
    null,
    2
  )
);

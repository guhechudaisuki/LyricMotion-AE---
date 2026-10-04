/* exported LMCore */
/* Shared ES3-compatible layout and motion descriptions for Canvas and AE. */
var LMCore = (function () {
  var styles = [
    {
      id: 'scattered',
      name: '双字错落',
      group: '参考系',
      desc: '关键词错位叠放，小字在侧',
      kind: 'split',
      x: 0.19,
      y: 0.62,
      motion: 'mist',
      favorite: true
    },
    {
      id: 'margin',
      name: '留白侧记',
      group: '参考系',
      desc: '细宋体与短句，靠左轻显',
      kind: 'side',
      x: 0.18,
      y: 0.43,
      motion: 'slide',
      favorite: true
    },
    {
      id: 'right',
      name: '右岸疏影',
      group: '参考系',
      desc: '关键词靠右，旁白向内延伸',
      kind: 'right',
      x: 0.79,
      y: 0.58,
      motion: 'mist',
      favorite: true
    },
    {
      id: 'vertical',
      name: '竖行微光',
      group: '参考系',
      desc: '两列短诗，逐行轻轻浮现',
      kind: 'vertical',
      x: 0.17,
      y: 0.46,
      motion: 'rise',
      favorite: true
    },
    {
      id: 'stagger',
      name: '错行短诗',
      group: '参考系',
      desc: '三行不齐的呼吸与停顿',
      kind: 'stagger',
      x: 0.22,
      y: 0.58,
      motion: 'slide',
      favorite: true
    },
    {
      id: 'focus',
      name: '一字焦点',
      group: '参考系',
      desc: '一个字略大，其余字安静陪衬',
      kind: 'focus',
      x: 0.18,
      y: 0.54,
      motion: 'mist',
      favorite: true
    },
    {
      id: 'whisper',
      name: '低位耳语',
      group: '参考系',
      desc: '靠下的小字，缓缓浮起',
      kind: 'whisper',
      x: 0.27,
      y: 0.79,
      motion: 'rise',
      favorite: true
    },
    {
      id: 'tracking',
      name: '横向疏排',
      group: '参考系',
      desc: '舒展字距，一行缓入',
      kind: 'tracking',
      x: 0.26,
      y: 0.37,
      motion: 'slide',
      favorite: true
    },
    {
      id: 'stack',
      name: '上下叠句',
      group: '参考系',
      desc: '大小两行，相错半个字',
      kind: 'stack',
      x: 0.76,
      y: 0.36,
      motion: 'rise',
      favorite: true
    },
    {
      id: 'breathe',
      name: '断句呼吸',
      group: '参考系',
      desc: '短句依次显影，保持留白',
      kind: 'breathe',
      x: 0.22,
      y: 0.48,
      motion: 'mist',
      favorite: true
    },
    {
      id: 'soft',
      name: '柔焦显影',
      group: '参考系',
      desc: '极轻的失焦到清晰',
      kind: 'soft',
      x: 0.78,
      y: 0.65,
      motion: 'mist',
      favorite: true
    },
    {
      id: 'steps',
      name: '行间递进',
      group: '参考系',
      desc: '三行沿斜向轻轻展开',
      kind: 'steps',
      x: 0.21,
      y: 0.44,
      motion: 'rise',
      favorite: true
    },
    {
      id: 'center',
      name: '极简短句',
      group: '轻量叠字',
      desc: '一行宋体，靠侧平稳淡入淡出',
      kind: 'center',
      x: 0.5,
      y: 0.72,
      motion: 'fade'
    },
    {
      id: 'bilingual',
      name: '双语落款',
      group: '轻量叠字',
      desc: '主句与自填注释上下相随',
      kind: 'bilingual',
      x: 0.5,
      y: 0.8,
      motion: 'rise'
    },
    {
      id: 'rule',
      name: '细线旁白',
      group: '轻量叠字',
      desc: '短横线与两行小字',
      kind: 'rule',
      x: 0.22,
      y: 0.69,
      motion: 'slide'
    },
    {
      id: 'corner',
      name: '角落片语',
      group: '轻量叠字',
      desc: '贴近安全区的静谧小字',
      kind: 'corner',
      x: 0.79,
      y: 0.8,
      motion: 'fade'
    }
  ];
  if (typeof LMPresets !== 'undefined') styles = styles.concat(LMPresets.styles);
  if (typeof LMChoreography !== 'undefined') styles = styles.concat(LMChoreography.styles);
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function trim(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }
  function chars(s) {
    var out = [],
      i = 0;
    for (; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c >= 55296 && c <= 56319 && i + 1 < s.length) out.push(s.substr(i++, 2));
      else out.push(s.charAt(i));
    }
    return out;
  }
  function num(v, fallback) {
    return v != null && v !== '' && isFinite(Number(v)) ? Number(v) : fallback;
  }
  function copy(o) {
    var n = {},
      k;
    for (k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n[k] = o[k];
    return n;
  }
  function findStyle(id) {
    for (var i = 0; i < styles.length; i++) if (styles[i].id === id) return styles[i];
    return styles[0];
  }
  function favorites() {
    var ids = [];
    for (var i = 0; i < styles.length; i++) if (styles[i].favorite) ids.push(styles[i].id);
    return ids;
  }
  var styleChoices = {
    exits: [
      { id: 'dissolve', name: '柔和消散' },
      { id: 'drift', name: '向上轻收' },
      { id: 'shrink', name: '收小淡出' },
      { id: 'slide', name: '横向收走' }
    ],
    positions: [
      { id: 'left', name: '画面左侧' },
      { id: 'right', name: '画面右侧' }
    ],
    fonts: [
      { id: 'SimSun', name: '宋体' },
      { id: 'STSong', name: '华文宋体' },
      { id: 'FangSong', name: '仿宋' },
      { id: 'KaiTi', name: '楷体' },
      { id: 'MicrosoftYaHei', name: '微软雅黑' }
    ],
    focusFonts: [
      { id: 'inherit', name: '与正文相同' },
      { id: 'STXingkai', name: '华文行楷' },
      { id: 'KaiTi', name: '楷体' },
      { id: 'SimSun', name: '宋体' },
      { id: 'STSong', name: '华文宋体' }
    ],
    palettes: [
      { id: 'blue', name: '冷白浅蓝', color: '#F3F4F1', accent: '#A9D2E7' },
      { id: 'warm', name: '米白暖金', color: '#F4F0EA', accent: '#D4C1A7' },
      { id: 'lilac', name: '月白淡紫', color: '#F1F4FA', accent: '#B9C5E0' },
      { id: 'rose', name: '暖白灰粉', color: '#F7EEEE', accent: '#DABBC4' },
      { id: 'sage', name: '霜白浅绿', color: '#EFF6F0', accent: '#B5D1C3' },
      { id: 'white', name: '纯白银灰', color: '#FFFFFF', accent: '#C7CFD8' }
    ],
    highlights: [
      { id: 'color', name: '关键词着色' },
      { id: 'none', name: '只做大小对比' }
    ]
  };
  function recipeValues(recipe, key) {
    var values = recipe && recipe[key],
      options = styleChoices[key],
      out = [],
      seen = {},
      i,
      j;
    if (!(values instanceof Array)) return out;
    for (i = 0; i < values.length; i++)
      for (j = 0; j < options.length; j++)
        if (values[i] === options[j].id && !seen[values[i]]) {
          out.push(values[i]);
          seen[values[i]] = true;
        }
    return out;
  }
  function sideFor(p, index) {
    var pool = recipeValues(p.recipe, 'positions');
    if (!pool.length) pool = ['left', 'right'];
    if (pool.length === 1) return pool[0];
    var pair = Math.floor(index / 2),
      first = random(p.seed, pair, 117) < 0.5 ? 0 : 1;
    return pool[(first + (index % 2)) % 2];
  }
  var ornamentSets = {
    stars: ['spark', 'constellation', 'spark-cluster', 'star-trail', 'shooting-star', 'dust'],
    lines: ['dash', 'dash-trail', 'wave-line', 'scribble', 'underline', 'arrow'],
    orbit: ['orbit', 'ring', 'arc', 'echo-rings', 'orbit-dots', 'ripple-arc', 'orbit-quad'],
    petals: ['petal', 'flower', 'dust', 'arc'],
    brackets: ['bracket', 'corner', 'scan-bracket', 'grid-dots'],
    diamonds: ['diamond', 'diamond-pair', 'triangles', 'spark'],
    ticks: ['ticks', 'slash', 'equalizer', 'compass', 'pulse-cross', 'ray-burst']
  };
  var allOrnaments = [
    'spark',
    'ring',
    'arc',
    'diamond',
    'petal',
    'bracket',
    'dot',
    'dash',
    'slash',
    'ticks',
    'orbit',
    'constellation',
    'cross',
    'corner'
  ];
  if (typeof LMMotifs !== 'undefined') {
    allOrnaments = [];
    for (var mi = 0; mi < LMMotifs.list.length; mi++) allOrnaments.push(LMMotifs.list[mi][0]);
  }
  ornamentSets.stars = ornamentSets.stars.concat([
    'twinkle-field',
    'corner-stars',
    'aurora-dots',
    'comet-arc'
  ]);
  ornamentSets.lines = ornamentSets.lines.concat(['ribbon-swoosh', 'stitch-curve']);
  ornamentSets.orbit = ornamentSets.orbit.concat([
    'silk-orbit',
    'crescent-frame',
    'diamond-curve',
    'pearl-drift'
  ]);
  ornamentSets.petals = ornamentSets.petals.concat(['petal-curve', 'leaf-pair', 'pearl-drift']);
  ornamentSets.diamonds = ornamentSets.diamonds.concat(['diamond-curve', 'corner-stars']);
  var themes = [
    {
      id: 'mist',
      name: '雾蓝留白',
      desc: '细宋体 · 错落短句 · 疏散星点',
      font: 'SimSun',
      color: '#FFFFFF',
      accent: '#ADC5D5',
      intensity: 0.4,
      scale: 1,
      ornaments: 'stars',
      layouts: ['scattered', 'margin', 'right', 'soft', 'stagger']
    },
    {
      id: 'frost',
      name: '霜白极简',
      desc: '纯白细字 · 低位留白 · 短线标记',
      font: 'STSong',
      color: '#F2F5F8',
      accent: '#C4CDD6',
      intensity: 0.25,
      scale: 0.9,
      ornaments: 'lines',
      layouts: ['whisper', 'tracking', 'center', 'corner']
    },
    {
      id: 'moon',
      name: '月影手记',
      desc: '轻楷书 · 竖行旁白 · 细环',
      font: 'KaiTi',
      color: '#F5F0E6',
      accent: '#CDBDA7',
      intensity: 0.4,
      scale: 1,
      ornaments: 'orbit',
      layouts: ['vertical', 'focus', 'stagger', 'margin']
    },
    {
      id: 'sakura',
      name: '樱灰细语',
      desc: '淡粉白字 · 上下叠句 · 花瓣',
      font: 'SimSun',
      color: '#FBEFF1',
      accent: '#D8AFC0',
      intensity: 0.38,
      scale: 0.95,
      ornaments: 'petals',
      layouts: ['stack', 'breathe', 'right', 'bilingual']
    },
    {
      id: 'ink',
      name: '墨色纸痕',
      desc: '深色仿宋 · 明亮画面适用 · 角括号',
      font: 'FangSong',
      color: '#33323C',
      accent: '#6C737D',
      intensity: 0.32,
      scale: 1,
      ornaments: 'brackets',
      layouts: ['rule', 'steps', 'vertical', 'tracking']
    },
    {
      id: 'night',
      name: '夜航星屑',
      desc: '冷白细字 · 两岸留白 · 星轨',
      font: 'STSong',
      color: '#ECF4FC',
      accent: '#9FC6E3',
      intensity: 0.46,
      scale: 1,
      ornaments: 'stars',
      layouts: ['right', 'scattered', 'soft', 'focus']
    },
    {
      id: 'amber',
      name: '琥珀片语',
      desc: '暖白宋体 · 小字叠句 · 菱形微光',
      font: 'SimSun',
      color: '#FFF1DB',
      accent: '#D9B783',
      intensity: 0.36,
      scale: 0.98,
      ornaments: 'diamonds',
      layouts: ['margin', 'stack', 'breathe', 'whisper']
    },
    {
      id: 'cool',
      name: '冷调节拍',
      desc: '纤细黑体 · 递进短句 · 几何刻度',
      font: 'MicrosoftYaHei',
      color: '#F1F5F8',
      accent: '#9BBDCA',
      intensity: 0.56,
      scale: 0.85,
      ornaments: 'ticks',
      layouts: ['steps', 'stagger', 'rule', 'corner']
    }
  ];
  if (typeof LMPresets !== 'undefined') {
    var themeExtras = [
      ['hero-1', 'hero-2', 'hero-5', 'duet-1', 'duet-3', 'ribbon-2', 'bookend-1', 'cascade-3'],
      ['hero-4', 'hero-6', 'ribbon-1', 'ribbon-6', 'sidenote-6', 'bookend-2'],
      ['columns-1', 'columns-3', 'columns-4', 'columns-5', 'duet-5', 'bookend-3'],
      ['hero-3', 'duet-2', 'duet-6', 'ribbon-2', 'cascade-6', 'diagonal-5'],
      ['sidenote-1', 'sidenote-3', 'sidenote-4', 'columns-6', 'diagonal-3', 'diagonal-6'],
      ['duet-1', 'duet-3', 'duet-4', 'bookend-4', 'bookend-5', 'cascade-1', 'cascade-3'],
      ['hero-1', 'hero-6', 'sidenote-2', 'sidenote-5', 'ribbon-4', 'bookend-6'],
      ['cascade-4', 'cascade-5', 'ribbon-3', 'ribbon-5', 'diagonal-1', 'diagonal-2']
    ];
    for (var ti = 0; ti < themes.length; ti++)
      themes[ti].layouts = themes[ti].layouts.concat(themeExtras[ti]);
    themes = themes.concat(LMPresets.themes);
  }
  function defaults() {
    return {
      version: 1,
      songProfile: 'free',
      motionMode: 'auto',
      compositionScale: 'auto',
      enterPercent: 35,
      exitPercent: 30,
      title: '我的动态歌词',
      width: 1920,
      height: 1080,
      fps: 25,
      scale: 1,
      emphasisScale: 1,
      highlightMode: 'auto',
      highlightColor: '#B9DFF8',
      recipe: null,
      intensity: 0.5,
      opacity: 100,
      font: 'SimSun',
      focusFont: '',
      color: '#FFFFFF',
      accent: '#ADC5D5',
      mode: 'random',
      theme: 'none',
      style: 'scattered',
      favorites: favorites(),
      seed: 1,
      ornaments: 'auto',
      ornamentSize: 1,
      ornamentDensity: 2,
      audioPath: '',
      audioName: '',
      cues: []
    };
  }
  function songProfile(p) {
    return typeof LMSongProfiles !== 'undefined' ? LMSongProfiles.find(p.songProfile) : null;
  }
  function applySongProfile(p, id, rnd) {
    if (typeof LMSongProfiles !== 'undefined') LMSongProfiles.apply(p, id, rnd);
  }
  function normalize(input) {
    var p = defaults(),
      k,
      i;
    input = input || {};
    for (k in p)
      if (Object.prototype.hasOwnProperty.call(p, k) && input[k] != null) p[k] = input[k];
    p.width = Math.round(clamp(num(p.width, 1920), 320, 7680));
    p.height = Math.round(clamp(num(p.height, 1080), 320, 4320));
    p.fps = clamp(num(p.fps, 25), 12, 60);
    p.scale = clamp(num(p.scale, 1), 0.5, 2);
    if (p.compositionScale !== 'display' && p.compositionScale !== 'compact')
      p.compositionScale = 'auto';
    p.intensity = clamp(num(p.intensity, 0.5), 0, 1);
    p.opacity = clamp(num(p.opacity, 100), 10, 100);
    p.enterPercent = Math.round(clamp(num(p.enterPercent, 35), 25, 75));
    p.exitPercent = Math.round(clamp(num(p.exitPercent, 30), 25, 100 - p.enterPercent));
    p.emphasisScale = clamp(num(p.emphasisScale, 1), 0.65, 1.5);
    if (p.motionMode !== 'auto') {
      var foundMotion = false;
      for (i = 0; i < LMMotion.list.length; i++)
        if (LMMotion.list[i][0] === p.motionMode) foundMotion = true;
      if (!foundMotion) p.motionMode = 'auto';
    }
    if (!/^#[0-9a-f]{6}$/i.test(p.highlightColor)) p.highlightColor = '#B9DFF8';
    if (p.highlightMode !== 'none' && p.highlightMode !== 'color') p.highlightMode = 'auto';
    if (
      !p.recipe ||
      !(p.recipe.layouts instanceof Array) ||
      !(p.recipe.ornaments instanceof Array) ||
      !(p.recipe.local instanceof Array)
    )
      p.recipe = null;
    var fav = [],
      seen = {};
    if (p.favorites instanceof Array)
      for (i = 0; i < p.favorites.length; i++) {
        k = String(p.favorites[i]);
        if (findStyle(k).id === k && !seen[k]) {
          fav.push(k);
          seen[k] = true;
        }
      }
    p.favorites = fav;
    // Keep the chosen layouts in saved 1.0/1.1 single-layout and favorites plans.
    if (
      input.songProfile == null &&
      !p.recipe &&
      (p.mode === 'single' || (p.mode === 'mix' && p.theme === 'none'))
    ) {
      p.recipe = {
        layouts:
          p.mode === 'single' ? [findStyle(p.style).id] : (fav.length ? fav : favorites()).slice(0),
        ornaments:
          p.ornaments === 'none' ? [] : (ornamentSets[p.ornaments] || allOrnaments).slice(0),
        local: []
      };
      p.theme = 'user:legacy-' + p.mode;
    }
    if (input.songProfile == null && typeof LMSongProfiles !== 'undefined')
      p.songProfile = LMSongProfiles.migrate(p);
    if (p.recipe) p.songProfile = p.theme;
    else if (!songProfile(p)) p.songProfile = 'free';
    p.font = trim(p.font) || 'SimSun';
    p.focusFont = trim(p.focusFont);
    p.title = trim(p.title) || '我的动态歌词';
    if (!/^#[0-9a-f]{6}$/i.test(p.color)) p.color = '#FFFFFF';
    if (!/^#[0-9a-f]{6}$/i.test(p.accent)) p.accent = '#ADC5D5';
    p.seed = Math.round(num(p.seed, 1));
    p.mode = p.recipe ? 'mix' : 'random';
    p.ornamentSize = clamp(num(p.ornamentSize, 1), 0.3, 2);
    p.ornamentDensity = Math.round(clamp(num(p.ornamentDensity, 2), 0, 4));
    var profile = songProfile(p);
    if (profile) {
      var manualMotif = String(p.ornaments).indexOf('motif:') === 0;
      p.intensity = Math.min(p.intensity, profile.intensity);
      p.ornamentDensity = Math.min(
        p.ornamentDensity,
        manualMotif ? Math.max(1, profile.maxDecor) : profile.maxDecor
      );
      if (!profile.maxDecor && !manualMotif) p.ornaments = 'none';
      else if (!manualMotif && p.ornaments !== 'none' && p.ornaments !== 'auto') {
        var allowed = false;
        for (i = 0; i < profile.ornaments.length; i++)
          if (p.ornaments === profile.ornaments[i]) allowed = true;
        if (!allowed) p.ornaments = profile.ornaments[0];
      }
    }
    var inputCues = p.cues instanceof Array ? p.cues : [];
    p.cues = [];
    for (i = 0; i < inputCues.length; i++) {
      var cue = copy(inputCues[i]);
      // Older saved plans only stored note text. Keep those authored notes manual.
      if (typeof cue.noteExplicit !== 'boolean')
        cue.noteExplicit = !!trim(cue.note) && cue.noteAutomatic !== true;
      p.cues.push(cue);
    }
    return p;
  }
  function stamp(t, srt) {
    var ms = Math.max(0, Math.round(t * 1000)),
      pad = function (n, w) {
        var s = String(n);
        while (s.length < w) s = '0' + s;
        return s;
      };
    var h = Math.floor(ms / 3600000),
      m = Math.floor(ms / 60000) % 60,
      s = Math.floor(ms / 1000) % 60;
    return (
      (srt || h ? pad(h, 2) + ':' : '') +
      pad(m, 2) +
      ':' +
      pad(s, 2) +
      (srt ? ',' : '.') +
      pad(ms % 1000, 3)
    );
  }
  function time(s) {
    var str = trim(s).replace(',', '.'),
      m = str.match(/^(?:(\d+):)?(\d+):(\d{1,2})(?:\.(\d{1,3}))?$/);
    if (!m) {
      if (/^\d+(?:\.\d+)?$/.test(str)) return Number(str);
      throw new Error('时间格式无效：' + str);
    }
    if (+m[3] >= 60 || (m[1] && +m[2] >= 60)) throw new Error('时间格式无效：' + str);
    return +(m[1] || 0) * 3600 + +m[2] * 60 + +m[3] + (m[4] ? Number('0.' + m[4]) : 0);
  }
  function lyric(raw) {
    var s = trim(raw),
      bar = s.indexOf('|'),
      note = '',
      focus = '';
    if (bar >= 0) {
      note = trim(s.slice(bar + 1));
      s = trim(s.slice(0, bar));
    }
    s = s.replace(/\*([^*]+)\*/g, function (_, word) {
      if (!focus) focus = word;
      return word;
    });
    return { text: s, note: note, focus: focus, noteExplicit: bar >= 0 };
  }
  function parse(raw, name) {
    var text = String(raw)
        .replace(/^\uFEFF/, '')
        .replace(/\r\n?/g, '\n'),
      rows = [],
      i,
      m,
      ls,
      cue,
      start,
      end;
    if (/\.srt$/i.test(name || '') || /\d\s*-->\s*\d/.test(text)) {
      var blocks = trim(text).split(/\n\s*\n/);
      for (i = 0; i < blocks.length; i++) {
        ls = trim(blocks[i]).split('\n');
        if (/^\d+$/.test(ls[0])) ls.shift();
        m = (ls.shift() || '').match(/^(\S+)\s*-->\s*(\S+)/);
        if (!m) throw new Error('第 ' + (i + 1) + ' 条 SRT 缺少时间范围');
        start = time(m[1]);
        end = time(m[2]);
        if (end <= start) throw new Error('第 ' + (i + 1) + ' 条结束时间需晚于开始时间');
        cue = lyric(ls.join('\n').replace(/<[^>]*>/g, ''));
        if (cue.text) {
          cue.start = start;
          cue.end = end;
          rows.push(cue);
        }
      }
    } else {
      ls = text.split('\n');
      var previous = 0,
        offset = text.match(/\[offset:([+-]?\d+)\]/i),
        shift = offset ? +offset[1] / 1000 : 0;
      for (i = 0; i < ls.length; i++) {
        var line = trim(ls[i]),
          times = [];
        if (!line || /^\[(ti|ar|al|by|offset|length|re|ve):/i.test(line) || /^#/.test(line))
          continue;
        while ((m = line.match(/^\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/))) {
          times.push(Math.max(0, time(m[1] + ':' + m[2] + (m[3] ? '.' + m[3] : '')) + shift));
          line = line.slice(m[0].length);
        }
        line = line.replace(/<\d+:\d+(?:\.\d+)?>/g, '');
        if (!times.length) {
          times.push(previous);
          previous += 4;
        }
        for (var j = 0; j < times.length; j++) {
          cue = lyric(line);
          cue.start = times[j];
          cue.end = null;
          rows.push(cue);
        }
      }
      rows.sort(function (a, b) {
        return a.start - b.start;
      });
      for (i = 0; i < rows.length; i++)
        rows[i].end =
          i + 1 < rows.length && rows[i + 1].start > rows[i].start
            ? rows[i + 1].start
            : rows[i].start + 4;
      var nonempty = [];
      for (i = 0; i < rows.length; i++) if (rows[i].text) nonempty.push(rows[i]);
      rows = nonempty;
    }
    if (!rows.length) throw new Error('没有可导入的歌词');
    rows.sort(function (a, b) {
      return a.start - b.start;
    });
    if (rows.length > 1000) throw new Error('一次最多导入 1000 句歌词');
    return rows;
  }
  function toSRT(cues) {
    var out = [];
    for (var i = 0; i < cues.length; i++)
      out.push(
        i +
          1 +
          '\r\n' +
          stamp(cues[i].start, true) +
          ' --> ' +
          stamp(cues[i].end, true) +
          '\r\n' +
          cues[i].text +
          (cues[i].note || cues[i].noteExplicit === true ? '|' + (cues[i].note || '') : '')
      );
    return out.join('\r\n\r\n') + '\r\n';
  }
  function wrap(s, count, keep) {
    var explicit = String(s).split('\n'),
      out = [],
      i,
      j;
    for (i = 0; i < explicit.length; i++) {
      var units = /[A-Za-z]/.test(explicit[i]) ? explicit[i].split(/\s+/) : chars(explicit[i]);
      var row = '',
        spaced = /[A-Za-z]/.test(explicit[i]);
      for (j = 0; j < units.length; j++) {
        var part = (row && spaced ? ' ' : '') + units[j];
        if (row && chars(row + part).length > count) {
          out.push(row);
          row = units[j];
        } else row += part;
      }
      if (row) out.push(row);
    }
    if (keep && !/[A-Za-z]/.test(s))
      for (i = 0; i + 1 < out.length; i++) {
        var joined = out[i] + out[i + 1],
          at = joined.indexOf(keep);
        if (at > 0 && at < out[i].length && at + keep.length > out[i].length) {
          out[i + 1] = out[i].slice(at) + out[i + 1];
          out[i] = out[i].slice(0, at);
        }
      }
    return out;
  }
  function focusParts(cue) {
    var text = trim(cue.text),
      focus = trim(cue.focus),
      letters = chars(text.replace(/[\s，。！？,.!?；;、]+$/g, ''));
    if (!focus || text.indexOf(focus) < 0) {
      if (/[A-Za-z]/.test(text)) {
        var words = text.split(/\s+/);
        focus = words[words.length - 1];
      } else focus = letters.slice(Math.max(0, letters.length - 2)).join('');
    }
    var at = text.lastIndexOf(focus),
      before = at >= 0 ? text.slice(0, at) : text,
      after = at >= 0 ? text.slice(at + focus.length) : '';
    return {
      focus: focus,
      before: trim(before),
      after: trim(after),
      body: trim(before + (before && after && /[A-Za-z]/.test(text) ? ' ' : '') + after)
    };
  }
  function shufflePick(items, seed, index, salt) {
    if (items.length < 2) return items[0];
    var cycle = items.length === 2 ? 0 : Math.floor(index / items.length);
    function deck(n) {
      var out = items.slice(0),
        i,
        j,
        temp;
      for (i = out.length - 1; i > 0; i--) {
        j = Math.floor(random(seed, n, salt + i) * (i + 1));
        temp = out[i];
        out[i] = out[j];
        out[j] = temp;
      }
      return out;
    }
    var current = deck(cycle),
      previous,
      temp;
    if (cycle > 0) {
      previous = deck(cycle - 1);
      if (current[0] === previous[previous.length - 1]) {
        temp = current[0];
        current[0] = current[1];
        current[1] = temp;
      }
    }
    return current[index % current.length];
  }
  function diverse(ids, p, index) {
    var families = [],
      groups = {},
      i,
      st,
      key;
    for (i = 0; i < ids.length; i++) {
      st = findStyle(ids[i]);
      key = st.family || st.kind;
      if (!groups[key]) {
        groups[key] = [];
        families.push(key);
      }
      groups[key].push(st.id);
    }
    if (!families.length) return 'center';
    key = shufflePick(families, p.seed, index, 811);
    var options = groups[key];
    return options[Math.floor(random(p.seed, index, 831) * options.length)];
  }
  function chosen(p, cue, index) {
    if (cue.style && findStyle(cue.style).id === cue.style) return findStyle(cue.style);
    if (p.recipe)
      return findStyle(p.recipe.layouts.length ? diverse(p.recipe.layouts, p, index) : 'center');
    var profile = songProfile(p);
    if (profile) return findStyle(diverse(profile.layouts, p, index));
    if (p.mode === 'single') return findStyle(p.style);
    var list = p.favorites.length ? p.favorites : favorites(),
      i;
    if (p.mode === 'random') {
      list = [];
      for (i = 0; i < styles.length; i++) list.push(styles[i].id);
    }
    return findStyle(diverse(list, p, index));
  }
  // Most small text is part of the original lyric, not a translated subtitle.
  function styleNeedsNote(style) {
    return style.kind === 'bilingual' || style.family === 'sidenote';
  }
  // Like chosen(), callers pass the already normalized project; do not copy an entire song per cue.
  function needsNote(project, cue, index) {
    return styleNeedsNote(chosen(project, cue || {}, Math.max(0, Math.floor(num(index, 0)))));
  }
  function random(seed, index, salt) {
    var n = Math.sin(seed * 13.17 + index * 47.71 + salt * 137.31) * 43758.5453;
    return n - Math.floor(n);
  }
  function applyTheme(p, id) {
    for (var i = 0; i < themes.length; i++)
      if (themes[i].id === id) {
        var t = themes[i],
          keys = ['font', 'color', 'accent', 'intensity', 'scale', 'ornaments'];
        for (var j = 0; j < keys.length; j++) p[keys[j]] = t[keys[j]];
        p.highlightColor = t.accent;
        p.recipe = null;
        p.favorites = t.layouts.slice(0);
        p.mode = 'mix';
        p.theme = id;
        return;
      }
  }
  function highlights(text, words) {
    var flat = '',
      positions = [],
      ranges = [],
      i,
      j,
      at,
      word;
    for (i = 0; i < text.length; i++)
      if (text.charAt(i) !== '\n' && text.charAt(i) !== '\r') {
        positions.push(i);
        flat += text.charAt(i);
      }
    for (j = 0; j < words.length; j++) {
      word = trim(words[j]);
      if (!word) continue;
      at = flat.indexOf(word);
      while (at >= 0) {
        ranges.push([positions[at], positions[at + word.length - 1] + 1]);
        at = flat.indexOf(word, at + word.length);
      }
    }
    return ranges;
  }
  function ornament(kind, size) {
    var paths = [],
      i,
      circle = function (r, start, stop, count) {
        var pts = [];
        for (var k = 0; k <= count; k++) {
          var a = ((start + ((stop - start) * k) / count) * Math.PI) / 180;
          pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return pts;
      };
    if (kind === 'ring') paths.push({ points: circle(9, 0, 360, 28), closed: true });
    else if (kind === 'arc') paths.push({ points: circle(12, -60, 155, 20) });
    else if (kind === 'diamond')
      paths.push({
        points: [
          [0, -9],
          [5, 0],
          [0, 9],
          [-5, 0]
        ],
        closed: true
      });
    else if (kind === 'petal')
      paths.push({
        points: [
          [0, -12],
          [5, -6],
          [6, 0],
          [0, 9],
          [-3, 1],
          [-3, -6]
        ],
        closed: true
      });
    else if (kind === 'bracket')
      paths.push({
        points: [
          [7, -12],
          [-5, -12],
          [-5, 12],
          [7, 12]
        ]
      });
    else if (kind === 'corner')
      paths.push({
        points: [
          [-9, 7],
          [-9, -8],
          [9, -8]
        ]
      });
    else if (kind === 'dot')
      paths.push({ points: circle(2, 0, 360, 12), closed: true, fill: true });
    else if (kind === 'dash')
      paths.push({
        points: [
          [-12, 0],
          [12, 0]
        ]
      });
    else if (kind === 'slash') {
      paths.push({
        points: [
          [-5, 7],
          [2, -7]
        ]
      });
      paths.push({
        points: [
          [2, 7],
          [9, -7]
        ]
      });
    } else if (kind === 'ticks')
      for (i = 0; i < 4; i++)
        paths.push({
          points: [
            [i * 5 - 8, i === 0 ? -5 : -2],
            [i * 5 - 8, 5]
          ]
        });
    else if (kind === 'orbit') {
      paths.push({ points: circle(10, 0, 300, 24) });
      paths.push({
        points: [
          [8, -8],
          [12, -8]
        ]
      });
    } else if (kind === 'constellation') {
      paths.push({
        points: [
          [-13, 8],
          [-3, -5],
          [13, 0]
        ]
      });
      for (i = 0; i < 3; i++) {
        var pt = [
          [-13, 8],
          [-3, -5],
          [13, 0]
        ][i];
        paths.push({
          points: [
            [pt[0] - 1, pt[1] - 1],
            [pt[0] + 1, pt[1] - 1],
            [pt[0] + 1, pt[1] + 1],
            [pt[0] - 1, pt[1] + 1]
          ],
          closed: true,
          fill: true
        });
      }
    } else if (kind === 'spark')
      paths.push({
        points: [
          [0, -11],
          [2, -2],
          [10, 0],
          [2, 2],
          [0, 11],
          [-2, 2],
          [-10, 0],
          [-2, -2]
        ],
        closed: true
      });
    else {
      paths.push({
        points: [
          [-7, 0],
          [7, 0]
        ]
      });
      paths.push({
        points: [
          [0, -7],
          [0, 7]
        ]
      });
    }
    for (i = 0; i < paths.length; i++)
      for (var j = 0; j < paths[i].points.length; j++) {
        paths[i].points[j][0] *= size;
        paths[i].points[j][1] *= size;
      }
    return paths;
  }
  var decorThemes = {
    silk: [
      'silk-orbit',
      'ribbon-swoosh',
      'crescent-frame',
      'comet-arc',
      'arc',
      'ripple-arc',
      'pearl-drift'
    ],
    stars: [
      'twinkle-field',
      'corner-stars',
      'aurora-dots',
      'comet-arc',
      'spark-cluster',
      'star-trail',
      'dust'
    ],
    botanical: ['petal-curve', 'leaf-pair', 'pearl-drift', 'petal', 'flower', 'scribble'],
    geometry: [
      'diamond-curve',
      'stitch-curve',
      'scan-bracket',
      'corner',
      'diamond-pair',
      'grid-dots'
    ],
    lines: [
      'ribbon-swoosh',
      'stitch-curve',
      'wave-line',
      'underline',
      'dash-trail',
      'scribble',
      'arrow'
    ]
  };
  function themedDecor(st, pool) {
    var theme = st.ornamentTheme;
    if (!theme)
      theme = /vertical|columns|blur|soft/.test(st.family || st.kind)
        ? 'silk'
        : /wave|reveal|breathe|swing/.test(st.family || st.kind)
          ? 'stars'
          : /fold|shutter|tracking|cascade|steps/.test(st.family || st.kind)
            ? 'geometry'
            : /hero|duet|split/.test(st.family || st.kind)
              ? 'botanical'
              : 'lines';
    var allowed = decorThemes[theme] || decorThemes.lines,
      out = [];
    for (var i = 0; i < pool.length; i++)
      for (var j = 0; j < allowed.length; j++) if (pool[i] === allowed[j]) out.push(pool[i]);
    return out.length ? out : pool;
  }
  function footprint(st, p) {
    var presence =
      p.compositionScale === 'compact'
        ? 'compact'
        : p.compositionScale === 'display'
          ? st.side && st.side !== 'center'
            ? 'side'
            : 'display'
          : st.presence;
    if (!presence)
      presence = /whisper|corner|bilingual/.test(st.kind)
        ? 'compact'
        : /focus|split|vertical/.test(st.kind) || /hero|columns|duet/.test(st.family || '')
          ? 'side'
          : 'normal';
    var dims =
      presence === 'side'
        ? [0.32, 0.55]
        : presence === 'display'
          ? [0.44, 0.46]
          : presence === 'compact'
            ? [0.2, 0.28]
            : [0.28, 0.4];
    return {
      width: dims[0] * p.scale,
      height: dims[1] * p.scale,
      maxWidth: presence === 'side' ? 0.42 : 0.62,
      maxHeight: 0.7
    };
  }
  function scene(project, cue, index) {
    var p = normalize(project),
      st = chosen(p, cue, index),
      w = p.width,
      h = p.height,
      unit = Math.min(w / 1920, h / 1080) * p.scale;
    if (p.recipe) {
      var fonts = recipeValues(p.recipe, 'fonts'),
        focusFonts = recipeValues(p.recipe, 'focusFonts'),
        palettes = recipeValues(p.recipe, 'palettes'),
        highlightModes = recipeValues(p.recipe, 'highlights');
      if (fonts.length) p.font = shufflePick(fonts, p.seed, 0, 127);
      if (focusFonts.length) p.focusFont = shufflePick(focusFonts, p.seed, 0, 129);
      if (palettes.length) {
        var palette = shufflePick(palettes, p.seed, 0, 131);
        for (var pc = 0; pc < styleChoices.palettes.length; pc++)
          if (styleChoices.palettes[pc].id === palette) {
            p.color = styleChoices.palettes[pc].color;
            p.accent = p.highlightColor = styleChoices.palettes[pc].accent;
          }
      }
      if (highlightModes.length) p.highlightMode = shufflePick(highlightModes, p.seed, index, 133);
    }
    var profile = songProfile(p),
      free = !profile && !p.recipe,
      explicit = cue.style && findStyle(cue.style).id === cue.style;
    var entries = profile
      ? profile.enter
      : [
          'mask-up',
          'mask-down',
          'mask-left',
          'mask-right',
          'mask-return',
          'wipe-x',
          'blur-rise',
          'spring',
          'fold-x',
          'wave',
          'spread',
          'swing',
          'type',
          'float'
        ];
    var exits = profile ? profile.exits : ['dissolve', 'drift', 'shrink', 'slide'];
    var requested = cue.motion || p.motionMode;
    if (
      (!requested || requested === 'auto') &&
      p.recipe &&
      p.recipe.motions instanceof Array &&
      p.recipe.motions.length
    )
      requested = shufflePick(p.recipe.motions, p.seed, index, 104);
    var entry =
      requested && requested !== 'auto'
        ? requested
        : st.kind === 'choreography' || explicit || p.recipe
          ? st.motion
          : shufflePick(entries, p.seed, index, 101);
    var exitMotion =
      st.exitMotion ||
      (profile || free ? exits[Math.floor(random(p.seed, index, 102) * exits.length)] : 'legacy');
    var recipeExits = recipeValues(p.recipe, 'exits');
    if (recipeExits.length) exitMotion = shufflePick(recipeExits, p.seed, index, 135);
    var anchorFraction = clamp(num(cue.x, st.x), 0.1, 0.9);
    if (cue.x == null) {
      var chosenSide = sideFor(p, index),
        edgeOffset = clamp(Math.min(anchorFraction, 1 - anchorFraction), 0.18, 0.25);
      anchorFraction = chosenSide === 'left' ? edgeOffset : 1 - edgeOffset;
    }
    var safeSide = anchorFraction <= 0.35 ? 'left' : anchorFraction >= 0.65 ? 'right' : '';
    var cx = w * anchorFraction,
      cy = h * clamp(num(cue.y, st.y), 0.1, 0.9),
      items = [],
      fp = focusParts(cue);
    var duration = Math.max(0.08, num(cue.end, 4) - num(cue.start, 0)),
      maxW = Math.min(w * 0.42, 530 * unit),
      noteY = 95,
      lineCount = 0,
      i;
    function text(str, x, y, size, width, delay, options) {
      if (!trim(str)) return;
      var o = options || {},
        rows = String(str).split('\n'),
        emph = size >= 53,
        ww = Math.min(width * unit, maxW);
      if (emph) size *= p.emphasisScale;
      var enabled =
        cue.highlightMode === 'color' ||
        (cue.highlightMode !== 'none' &&
          (p.highlightMode === 'color' ||
            (p.highlightMode === 'auto' && (cue.highlight || random(p.seed, index, 93) < 0.68))));
      var words = cue.highlight ? String(cue.highlight).split(/[,，、|]/) : [fp.focus];
      var ranges = enabled && !o.note ? highlights(String(str), words) : [];
      // Preserve emphasis when a word is split across staggered lines or individual glyph layers.
      if (enabled && !o.note && !ranges.length) {
        var original = String(cue.text).replace(/[\r\n]/g, ''),
          plain = String(str).replace(/[\r\n]/g, ''),
          origin = original.indexOf(plain),
          fullRanges = highlights(original, words);
        if (origin >= 0)
          for (var hi = 0; hi < fullRanges.length; hi++) {
            var lo = Math.max(origin, fullRanges[hi][0]),
              high = Math.min(origin + plain.length, fullRanges[hi][1]);
            if (high > lo) {
              var map = [],
                mi;
              for (mi = 0; mi < String(str).length; mi++)
                if (String(str).charAt(mi) !== '\n' && String(str).charAt(mi) !== '\r')
                  map.push(mi);
              ranges.push([map[lo - origin], map[high - origin - 1] + 1]);
            }
          }
      }
      if (enabled && !o.note && emph && !cue.highlight && fp.focus.indexOf(String(str)) >= 0)
        ranges = [[0, String(str).length]];
      if (enabled && !o.note && emph && cue.highlight && fp.focus.indexOf(String(str)) >= 0)
        for (var wi = 0; wi < words.length; wi++)
          if (trim(words[wi]) === fp.focus) ranges = [[0, String(str).length]];
      var font =
        o.font ||
        (emph && !o.note
          ? p.focusFont === 'inherit'
            ? p.font
            : p.focusFont || st.emphasisFont || p.font
          : p.font);
      var plainText = String(str).replace(/[\r\n]/g, '');
      items.push({
        type: 'text',
        text: String(str),
        focus: !o.note && !!plainText && fp.focus.indexOf(plainText) >= 0,
        x: cx + x * unit,
        y: cy + y * unit,
        size: size * unit,
        maxW: ww,
        maxH: Math.max(size * unit * 1.4, rows.length * size * unit * 1.5),
        align: o.align || 'center',
        font: font,
        tracking: o.tracking || 0,
        color: o.accent ? p.accent : p.color,
        highlightColor: p.highlightColor,
        highlights: ranges,
        alpha: o.alpha == null ? 1 : o.alpha,
        lag: delay || 0,
        motion: o.note
          ? 'mask-up'
          : requested && requested !== 'auto'
            ? requested
            : st.kind === 'choreography'
              ? o.motion || entry
              : entry,
        note: !!o.note,
        flow: o.flow || '',
        order: o.order || 0,
        spread: (o.spread || 0) * unit,
        tilt: profile && profile.id === 'minimal' ? 0 : o.tilt || 0,
        drift: o.drift == null ? 1 : o.drift
      });
    }
    function line(x, y, len) {
      if (p.ornaments === 'none' || lineCount >= p.ornamentDensity) return;
      if (p.ornaments === 'auto' && st.ornamentTheme && st.ornamentTheme !== 'lines' && !p.recipe)
        return;
      var allowed = p.ornaments === 'auto' || p.ornaments === 'lines' || p.ornaments === 'brackets';
      if (p.recipe) allowed = false;
      if (!allowed) return;
      lineCount++;
      items.push({
        type: 'path',
        name: 'underline',
        attachment: 'baseline',
        x: cx + x * unit,
        y: cy + y * unit,
        maxW: len * unit,
        maxH: 12 * unit,
        paths: [
          {
            points: [
              [(-len * unit) / 2, 0],
              [(len * unit) / 2, 0]
            ]
          }
        ],
        stroke: Math.max(1, 1.5 * unit),
        color: p.accent,
        alpha: 0.7,
        lag: 0.1,
        motion: 'fade',
        drift: 0
      });
    }
    function body(x, y, n, size, width, delay) {
      var rr = wrap(fp.body, n);
      text(rr.join('\n'), x, y, size, width, delay);
    }
    var focusChars = chars(fp.focus),
      all;
    if (st.kind === 'choreography') {
      noteY = LMChoreography.compose(st, cue, fp, text, line, { wrap: wrap, chars: chars });
    } else if (st.kind === 'extended' && typeof LMPresets !== 'undefined') {
      noteY = LMPresets.compose(st, cue, fp, text, line, { wrap: wrap, chars: chars });
    } else if (st.kind === 'split') {
      if (focusChars.length <= 3)
        for (i = 0; i < focusChars.length; i++)
          text(focusChars[i], -55 + i * 51, -14 + i * 25, i === 0 ? 100 : 73, 132, i * 0.08, {
            tilt: -4
          });
      else text(fp.focus, -45, 0, 78, 245, 0, { tilt: -3 });
      body(130, 2, 6, 25, 230, 0.12);
      line(95, 55, 30);
    } else if (st.kind === 'side' || st.kind === 'right') {
      var right = st.kind === 'right';
      text(fp.focus, right ? 70 : -60, -2, 82, 250, 0, { tilt: right ? 2 : -2 });
      body(right ? -98 : 112, 1, 7, 25, 225, 0.12);
      line(right ? -58 : 72, 56, 24);
    } else if (st.kind === 'vertical') {
      var vertical = chars(fp.focus).join('\n');
      text(vertical, 36, 0, 67, 100, 0);
      var rr = wrap(fp.body, Math.ceil(chars(fp.body).length / 2) || 1);
      for (i = 0; i < rr.length; i++)
        text(chars(rr[i]).join('\n'), -30 - i * 37, 0, 25, 36, 0.12 + i * 0.08);
      noteY = Math.min(220, Math.max(115, focusChars.length * 42));
    } else if (st.kind === 'stagger' || st.kind === 'steps' || st.kind === 'breathe') {
      var count = st.kind === 'breathe' ? 6 : Math.max(4, Math.ceil(chars(cue.text).length / 3));
      all = wrap(cue.text, count, fp.focus);
      for (i = 0; i < all.length; i++)
        text(
          all[i],
          (i - (all.length - 1) / 2) * (st.kind === 'steps' ? 32 : 19),
          (i - (all.length - 1) / 2) * 45,
          st.kind === 'stagger' && i === all.length - 1 ? 41 : 32,
          400,
          i * (st.kind === 'breathe' ? 0.16 : 0.08)
        );
      noteY = all.length * 25 + 32;
    } else if (st.kind === 'focus') {
      text(focusChars[0] || fp.focus, -48, -9, 108, 150, 0);
      text(focusChars.slice(1).join(''), 25, 34, 53, 180, 0.1);
      body(132, -2, 7, 25, 220, 0.16);
    } else if (st.kind === 'stack') {
      body(-26, -39, 12, 25, 390, 0);
      text(fp.focus, 35, 21, 80, 315, 0.12);
      line(-86, 63, 23);
    } else if (st.kind === 'tracking') {
      text(wrap(cue.text, 16).join('\n'), 0, 0, 30, 525, 0, { tracking: 170 });
      noteY = 66;
    } else if (st.kind === 'soft') {
      text(fp.focus, 0, -11, 69, 320, 0);
      body(0, 52, 16, 23, 450, 0.15);
      noteY = 106;
    } else if (st.kind === 'rule') {
      line(-142, -39, 46);
      text(wrap(cue.text, 12).join('\n'), 0, 10, 29, 420, 0.1);
      noteY = 89;
    } else {
      var fs = st.kind === 'center' ? 40 : st.kind === 'bilingual' ? 35 : 29;
      text(wrap(cue.text, st.kind === 'corner' ? 10 : 20).join('\n'), 0, 0, fs, 515, 0, {
        tracking: st.kind === 'whisper' ? 90 : 20
      });
      noteY = 62;
    }
    if (cue.note && (cue.noteAutomatic !== true || cue.noteExplicit === true || styleNeedsNote(st)))
      text(wrap(cue.note, 36).join('\n'), 0, noteY, st.kind === 'bilingual' ? 21 : 18, 470, 0.18, {
        note: true,
        alpha: 0.76,
        font: /[A-Za-z]/.test(cue.note) ? 'Georgia' : p.font,
        motion: 'fade',
        tracking: 30
      });
    if (p.ornaments !== 'none' && p.ornamentDensity && (!p.recipe || p.recipe.ornaments.length)) {
      var pool = ornamentSets[p.ornaments] || allOrnaments;
      var manual = String(p.ornaments).indexOf('motif:') === 0;
      if (manual) pool = [String(p.ornaments).slice(6)];
      if (p.recipe) pool = p.recipe.ornaments;
      if (profile && !manual) {
        var filtered = [];
        for (var pi = 0; pi < pool.length; pi++)
          for (var pj = 0; pj < profile.decorPool.length; pj++)
            if (pool[pi] === profile.decorPool[pj]) filtered.push(pool[pi]);
        pool = filtered.length ? filtered : profile.decorPool;
      }
      if (!manual && !p.recipe && p.ornaments === 'auto') pool = themedDecor(st, pool);
      var usedSurround = false;
      for (i = 0; i < Math.max(0, p.ornamentDensity - lineCount) && pool.length; i++) {
        var mark = shufflePick(pool, p.seed, index * Math.max(1, p.ornamentDensity) + i, 505),
          side = i % 2 ? -1 : 1,
          ox = (i < 2 ? 223 : 152) * side,
          oy = i < 2 ? -64 : 79;
        var surround = typeof LMMotifs.isSurround === 'function' && LMMotifs.isSurround(mark);
        if (surround && usedSurround) continue;
        usedSurround = usedSurround || surround;
        items.push({
          type: 'path',
          name: mark,
          paths: LMMotifs.make(mark, unit * p.ornamentSize, ornament),
          x: cx + ox * unit,
          y: cy + oy * unit,
          maxW: 60 * unit * p.ornamentSize,
          maxH: 60 * unit * p.ornamentSize,
          motifSize: p.ornamentSize,
          stroke: Math.max(0.9, (surround ? 2 : 1.5) * unit),
          color: p.accent,
          alpha: 0.8,
          lag: Math.min(0.4, duration * 0.13) + i * 0.09,
          motion: 'mist',
          tilt: mark === 'petal' ? -25 : 0,
          drift: 0,
          spin: mark === 'orbit' || mark === 'ring' ? 8 : 0
        });
      }
    }
    // Adapters resolve this geometry using their actual font metrics before animation.
    var maxLag = 0;
    for (i = 0; i < items.length; i++)
      if (items[i].type === 'text') maxLag = Math.max(maxLag, items[i].lag);
    var enterSpan = (duration * p.enterPercent) / 100,
      exitSpan = (duration * p.exitPercent) / 100;
    var enterStagger = Math.min(maxLag, enterSpan * 0.35),
      exitStagger = Math.min(maxLag * 0.36, exitSpan * 0.28);
    for (i = 0; i < items.length; i++) {
      var part = items[i];
      if (part.type === 'text') {
        var order = maxLag ? part.lag / maxLag : 0;
        part.lag = order * enterStagger;
        part.enterSpan = enterSpan - enterStagger;
        part.exitStart = duration - exitSpan + order * exitStagger;
        part.exitSpan = exitSpan - exitStagger;
      } else part.lag = Math.min(part.lag, enterSpan * 0.6);
    }
    return {
      name: st.name,
      style: st.id,
      profile: profile ? profile.id : 'free',
      width: w,
      height: h,
      anchorX: cx,
      anchorY: cy,
      safeSide: safeSide,
      footprint: footprint(st, p),
      exitMotion: exitMotion,
      exitOverride: recipeExits.length > 0,
      hold: 'still',
      enterSpan: enterSpan,
      exitSpan: exitSpan,
      start: num(cue.start, 0),
      duration: duration,
      items: items,
      unit: unit,
      intensity: p.intensity,
      opacity: p.opacity / 100
    };
  }
  function motion(scene, item, t) {
    return item.type === 'text' ? LMMotion.sample(scene, item, t) : LMMotifs.state(scene, item, t);
  }
  return {
    styles: styles,
    styleChoices: styleChoices,
    themes: themes,
    profiles: typeof LMSongProfiles !== 'undefined' ? LMSongProfiles.list : [],
    songProfile: songProfile,
    applySongProfile: applySongProfile,
    random: random,
    applyTheme: applyTheme,
    defaults: defaults,
    normalize: normalize,
    findStyle: findStyle,
    favorites: favorites,
    chosen: chosen,
    needsNote: needsNote,
    scene: scene,
    motion: motion,
    makeOrnament: function (kind, size) {
      return LMMotifs.make(kind, size, ornament);
    },
    parse: parse,
    toSRT: toSRT,
    time: time,
    stamp: stamp,
    wrap: wrap,
    trim: trim,
    chars: chars,
    clamp: clamp,
    copy: copy
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = LMCore;

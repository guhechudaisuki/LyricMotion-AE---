/* exported LMSongProfiles */
/* Song categories follow JIZURA's six-category workflow. ES3 for the AE host. */
var LMSongProfiles = (function () {
  var list = [
    {
      id: 'ballad',
      name: '慢歌抒情',
      desc: '适合慢歌、钢琴与抒情人声。柔和显影、缓慢消散，少装饰。',
      layouts: [
        'scattered',
        'margin',
        'right',
        'vertical',
        'stagger',
        'focus',
        'whisper',
        'stack',
        'breathe',
        'soft',
        'bilingual',
        'hero-1',
        'hero-2',
        'hero-3',
        'hero-4',
        'hero-5',
        'hero-6',
        'columns-1',
        'columns-3',
        'columns-4',
        'duet-1',
        'duet-2',
        'duet-3',
        'duet-6',
        'bookend-1',
        'bookend-3',
        'ribbon-1',
        'ribbon-6'
      ],
      enter: ['mist', 'fade', 'rise'],
      exits: ['dissolve', 'drift'],
      maxDecor: 1,
      intensity: 0.32,
      scale: 0.95,
      fonts: ['SimSun', 'STSong', 'FangSong'],
      palettes: [
        ['#FFFFFF', '#ADC5D5'],
        ['#F7F1E9', '#CDBDA7'],
        ['#F4EEF3', '#CAB4C4']
      ],
      ornaments: ['lines', 'orbit', 'petals'],
      decorPool: ['dot', 'dash', 'arc', 'petal', 'ring']
    },
    {
      id: 'minimal',
      name: '极简叙事',
      desc: '适合民谣、独白与安静叙事。以阅读为主，淡入淡出，不添加字旁装饰。',
      layouts: [
        'center',
        'whisper',
        'tracking',
        'bilingual',
        'corner',
        'margin',
        'hero-4',
        'hero-6',
        'columns-4',
        'columns-5',
        'ribbon-1',
        'ribbon-6'
      ],
      enter: ['fade', 'rise'],
      exits: ['dissolve'],
      maxDecor: 0,
      intensity: 0.15,
      scale: 0.88,
      fonts: ['SimSun', 'STSong'],
      palettes: [
        ['#F5F5F3', '#C8CED1'],
        ['#F4F0E9', '#C9BFAE']
      ],
      ornaments: ['none'],
      decorPool: []
    },
    {
      id: 'pop',
      name: '流行轻快',
      desc: '适合轻快流行、青春与可爱歌曲。轻弹、逐字错拍，搭配少量星点。',
      layouts: [
        'stagger',
        'steps',
        'stack',
        'focus',
        'hero-3',
        'hero-5',
        'cascade-1',
        'cascade-2',
        'cascade-3',
        'cascade-4',
        'cascade-5',
        'cascade-6',
        'ribbon-1',
        'ribbon-2',
        'ribbon-3',
        'ribbon-4',
        'ribbon-5',
        'ribbon-6',
        'diagonal-1',
        'diagonal-4',
        'diagonal-5',
        'duet-2',
        'duet-4',
        'bookend-4'
      ],
      enter: ['pop', 'rise', 'pivot', 'settle'],
      exits: ['shrink', 'drift', 'dissolve'],
      maxDecor: 2,
      intensity: 0.58,
      scale: 0.95,
      fonts: ['SimSun', 'KaiTi', 'MicrosoftYaHei'],
      palettes: [
        ['#FFF5F6', '#D9B4C4'],
        ['#FFF5E9', '#D9BE97'],
        ['#EEF8F3', '#ABD4C2']
      ],
      ornaments: ['stars', 'petals', 'diamonds'],
      decorPool: ['spark', 'dot', 'diamond', 'petal', 'cross']
    },
    {
      id: 'rock',
      name: '摇滚燃曲',
      desc: '适合摇滚、燃曲与高能副歌。主字突出、快速收放、短促位移。',
      layouts: [
        'focus',
        'scattered',
        'stack',
        'steps',
        'stagger',
        'hero-1',
        'hero-2',
        'hero-3',
        'hero-5',
        'duet-1',
        'duet-3',
        'duet-4',
        'bookend-2',
        'bookend-4',
        'bookend-5',
        'bookend-6',
        'diagonal-1',
        'diagonal-2',
        'diagonal-3',
        'diagonal-4',
        'cascade-3',
        'cascade-4',
        'ribbon-4',
        'ribbon-5'
      ],
      enter: ['snap', 'settle', 'slide', 'slideR'],
      exits: ['slide', 'shrink'],
      maxDecor: 2,
      intensity: 0.72,
      scale: 1.06,
      fonts: ['SimSun', 'MicrosoftYaHei', 'STSong'],
      palettes: [
        ['#FCF2EF', '#CF9B97'],
        ['#F8F3EA', '#D8BD91'],
        ['#F2F4F6', '#A8B6C4']
      ],
      ornaments: ['ticks', 'lines', 'diamonds'],
      decorPool: ['slash', 'dash', 'ticks', 'diamond', 'spark']
    },
    {
      id: 'electronic',
      name: '电子舞曲',
      desc: '适合电子、舞曲与合成器音乐。阶梯式显字、几何字距，点状节奏变化。',
      layouts: [
        'tracking',
        'steps',
        'stagger',
        'rule',
        'corner',
        'cascade-3',
        'cascade-4',
        'cascade-5',
        'ribbon-2',
        'ribbon-3',
        'ribbon-5',
        'diagonal-1',
        'diagonal-2',
        'diagonal-5',
        'sidenote-1',
        'sidenote-2',
        'sidenote-3',
        'sidenote-5',
        'bookend-2',
        'bookend-6'
      ],
      enter: ['step', 'snap', 'slideR'],
      exits: ['slide', 'shrink'],
      maxDecor: 2,
      intensity: 0.64,
      scale: 0.92,
      fonts: ['MicrosoftYaHei', 'SimSun'],
      palettes: [
        ['#EEF7FA', '#96C5D3'],
        ['#F1EFFA', '#B9AED9'],
        ['#EFF8F4', '#9FCEBB']
      ],
      ornaments: ['ticks', 'orbit', 'brackets'],
      decorPool: ['ticks', 'slash', 'corner', 'ring', 'dot', 'orbit']
    },
    {
      id: 'cinematic',
      name: '电影感',
      desc: '适合叙事歌曲、氛围音乐与电影配乐。大字与留白，柔和显影和消散。',
      layouts: [
        'scattered',
        'margin',
        'right',
        'vertical',
        'focus',
        'stack',
        'soft',
        'center',
        'bilingual',
        'hero-1',
        'hero-2',
        'hero-4',
        'hero-5',
        'columns-1',
        'columns-4',
        'columns-5',
        'duet-1',
        'duet-3',
        'duet-5',
        'bookend-1',
        'bookend-3',
        'bookend-5',
        'sidenote-1',
        'sidenote-6'
      ],
      enter: ['mist', 'settle', 'float'],
      exits: ['dissolve', 'drift'],
      maxDecor: 1,
      intensity: 0.38,
      scale: 1.02,
      fonts: ['SimSun', 'STSong', 'FangSong'],
      palettes: [
        ['#EFF4FA', '#AFC5D8'],
        ['#F7F0E7', '#C7B79E'],
        ['#F2F1F5', '#BDBDD1']
      ],
      ornaments: ['orbit', 'lines'],
      decorPool: ['ring', 'arc', 'dash', 'dot']
    }
  ];
  var motionFamilies = {
    ballad: [
      'reveal-row',
      'reveal-word',
      'reveal-char',
      'blur-motion',
      'tracking-motion',
      'split-motion'
    ],
    minimal: ['reveal-row', 'reveal-word', 'type-motion', 'tracking-motion'],
    pop: ['reveal-char', 'shutter', 'spring-motion', 'wave-motion', 'fold-motion', 'swing-motion'],
    rock: ['shutter', 'spring-motion', 'fold-motion', 'tracking-motion', 'split-motion'],
    electronic: ['shutter', 'fold-motion', 'tracking-motion', 'type-motion', 'wave-motion'],
    cinematic: ['reveal-row', 'reveal-word', 'split-motion', 'blur-motion', 'swing-motion']
  };
  var entrances = {
    ballad: ['mask-up', 'mask-return', 'wipe-x', 'blur-rise', 'blur-slide', 'float'],
    minimal: ['mask-up', 'wipe-x', 'fade'],
    pop: ['mask-up', 'mask-right', 'spring', 'fold-x', 'wave', 'swing'],
    rock: ['mask-left', 'mask-right', 'snap', 'bounce', 'fold-y', 'spread'],
    electronic: ['mask-left', 'mask-down', 'wipe-y', 'fold-y', 'type', 'gather'],
    cinematic: ['mask-up', 'mask-return', 'wipe-x', 'blur-slide', 'drift-up']
  };
  var extraDecor = {
    ballad: ['echo-rings', 'dust', 'wave-line', 'scribble', 'star-trail'],
    minimal: [],
    pop: ['spark-cluster', 'flower', 'orbit-dots', 'ray-burst', 'diamond-pair'],
    rock: ['dash-trail', 'ray-burst', 'equalizer', 'triangles', 'pulse-cross'],
    electronic: ['scan-bracket', 'equalizer', 'compass', 'grid-dots', 'orbit-quad'],
    cinematic: ['ripple-arc', 'echo-rings', 'dust', 'underline', 'shooting-star']
  };
  for (var ci = 0; ci < list.length; ci++) {
    var profile = list[ci],
      families = motionFamilies[profile.id];
    for (var fi = 0; fi < families.length; fi++)
      for (var vi = 1; vi <= 4; vi++) profile.layouts.push(families[fi] + '-' + vi);
    profile.enter = entrances[profile.id];
    profile.decorPool = profile.decorPool.concat(extraDecor[profile.id]);
  }
  var lyricFamilies = {
    ballad: ['poster', 'satellite', 'axis', 'essay'],
    minimal: ['essay', 'banner'],
    pop: ['poster', 'stair', 'satellite', 'banner'],
    rock: ['poster', 'stair', 'broad', 'axis'],
    electronic: ['stair', 'broad', 'banner'],
    cinematic: ['poster', 'satellite', 'axis', 'essay']
  };
  var lyricDecor = {
    ballad: [
      'silk-orbit',
      'ribbon-swoosh',
      'petal-curve',
      'corner-stars',
      'twinkle-field',
      'pearl-drift',
      'leaf-pair'
    ],
    minimal: [],
    pop: ['twinkle-field', 'petal-curve', 'aurora-dots', 'diamond-curve', 'leaf-pair'],
    rock: ['diamond-curve', 'stitch-curve', 'comet-arc'],
    electronic: ['diamond-curve', 'stitch-curve', 'aurora-dots'],
    cinematic: ['silk-orbit', 'crescent-frame', 'comet-arc', 'corner-stars', 'pearl-drift']
  };
  if (typeof LMChoreography !== 'undefined')
    for (ci = 0; ci < list.length; ci++) {
      profile = list[ci];
      families = lyricFamilies[profile.id];
      for (var si = 0; si < LMChoreography.styles.length; si++)
        for (fi = 0; fi < families.length; fi++)
          if (LMChoreography.styles[si].family === families[fi])
            profile.layouts.push(LMChoreography.styles[si].id);
      profile.decorPool = profile.decorPool.concat(lyricDecor[profile.id]);
    }
  var legacy = {
    mist: 'ballad',
    frost: 'minimal',
    moon: 'ballad',
    sakura: 'pop',
    ink: 'minimal',
    night: 'cinematic',
    amber: 'ballad',
    cool: 'electronic',
    drift: 'pop',
    poem: 'ballad',
    dialogue: 'ballad',
    fold: 'cinematic',
    letter: 'minimal',
    silent: 'minimal',
    silver: 'pop',
    shore: 'ballad'
  };
  function find(id) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function migrate(p) {
    return p.recipe ? p.theme : legacy[p.theme] || 'free';
  }
  function pick(items, rnd) {
    return items[Math.min(items.length - 1, Math.floor(rnd() * items.length))];
  }
  function apply(p, id, rnd) {
    var profile = find(id);
    p.songProfile = profile ? id : 'free';
    p.mode = 'random';
    p.recipe = null;
    p.theme = 'none';
    p.motionMode = 'auto';
    rnd = rnd || Math.random;
    var palette;
    if (!profile) {
      palette = pick(
        [
          ['#FFFFFF', '#ADC5D5'],
          ['#F4F0EA', '#D4C1A7'],
          ['#F1F4FA', '#B9C5E0'],
          ['#F7EEEE', '#DABBC4'],
          ['#EFF6F0', '#B5D1C3']
        ],
        rnd
      );
      p.font = pick(['SimSun', 'STSong', 'FangSong', 'KaiTi'], rnd);
      p.color = palette[0];
      p.accent = palette[1];
      p.highlightColor = palette[1];
      p.scale = Math.round((0.85 + rnd() * 0.25) * 100) / 100;
      p.intensity = Math.round((0.28 + rnd() * 0.26) * 100) / 100;
      p.ornaments = 'auto';
      p.ornamentDensity = rnd() < 0.5 ? 1 : 2;
      p.seed = Math.floor(rnd() * 10000000) + 1;
      return;
    }
    palette = pick(profile.palettes, rnd);
    p.font = pick(profile.fonts, rnd);
    p.color = palette[0];
    p.accent = palette[1];
    p.highlightColor = palette[1];
    p.scale = Math.round(profile.scale * (0.95 + 0.1 * rnd()) * 100) / 100;
    p.intensity = Math.round(profile.intensity * (0.85 + 0.15 * rnd()) * 100) / 100;
    p.ornaments = pick(profile.ornaments, rnd);
    p.ornamentDensity = profile.maxDecor;
    p.seed = Math.floor(rnd() * 10000000) + 1;
  }
  return { list: list, find: find, migrate: migrate, apply: apply };
})();

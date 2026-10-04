/* exported LMPresets */
/* Native, editable typography presets. ES3, shared by Canvas and ExtendScript. */
var LMPresets = (function () {
  var styles = [],
    motions = ['rise', 'slideR', 'settle', 'float', 'fall', 'pivot'];
  var families = [
    [
      'hero',
      '主词留白',
      ['左肩短诗', '右肩回声', '上句下词', '下句上词', '悬置主词', '侧写落款'],
      '主词与旁句分别落位，保留明显的字号反差'
    ],
    [
      'cascade',
      '逐字动态',
      ['逐字浮升', '逐字回落', '错拍显字', '交错字阶', '疏字轻移', '微弧字列'],
      '单字分别进入，关键词更大，其他字保持轻盈'
    ],
    [
      'columns',
      '竖向诗笺',
      ['双列诗笺', '三列短笺', '长短竖影', '竖词横注', '横词竖注', '右起细笺'],
      '横竖文字相接，行长与主次字号各不相同'
    ],
    [
      'bookend',
      '词间留白',
      ['词间小句', '左右停顿', '上下停顿', '大字夹行', '两端回望', '斜角对答'],
      '关键词拆到两端，小句落在中间的留白里'
    ],
    [
      'diagonal',
      '错行短句',
      ['向右拾级', '向左拾级', '轻斜诗行', '大小折行', '交替疏行', '逐行落笔'],
      '短句逐行错开，重点词在折行中突出'
    ],
    [
      'duet',
      '双字呼应',
      ['近远双字', '上下双字', '错落双影', '错位双音', '横竖双生', '低位双词'],
      '两个主字以不同尺度呼应，旁句贴近一侧'
    ],
    [
      'ribbon',
      '横向混排',
      ['同轴大小字', '高低短笺', '疏密横行', '中段放大', '尾词抬起', '横行留气'],
      '同一行混合字号和基线，保持歌词阅读方向'
    ],
    [
      'sidenote',
      '边侧注记',
      ['细线侧题', '角标小句', '主词分栏', '窄行叠题', '双线旁白', '低位脚注'],
      '细线、短注与主词组合，适合叠在人物空白处'
    ]
  ];
  var anchors = [
    [0.23, 0.54],
    [0.77, 0.56],
    [0.26, 0.68],
    [0.72, 0.38],
    [0.22, 0.35],
    [0.71, 0.75]
  ];
  for (var f = 0; f < families.length; f++)
    for (var v = 0; v < 6; v++)
      styles.push({
        id: families[f][0] + '-' + (v + 1),
        name: families[f][2][v],
        group: families[f][1],
        desc: families[f][3],
        kind: 'extended',
        family: families[f][0],
        variant: v,
        x: anchors[v][0],
        y: anchors[v][1],
        motion: motions[(f + v) % motions.length],
        favorite: true
      });
  var themes = [
    {
      id: 'drift',
      name: '浮字微光',
      desc: '逐字错时 · 局部放大 · 冷白微光',
      font: 'SimSun',
      color: '#F3F7FB',
      accent: '#A6CADB',
      intensity: 0.42,
      scale: 0.95,
      ornaments: 'stars',
      layouts: ['cascade-1', 'cascade-3', 'ribbon-2', 'hero-1', 'duet-1', 'scattered']
    },
    {
      id: 'poem',
      name: '竖笺诗行',
      desc: '长短竖排 · 横竖相接 · 细宋体',
      font: 'STSong',
      color: '#F9F3E9',
      accent: '#C8BDA9',
      intensity: 0.32,
      scale: 0.88,
      ornaments: 'brackets',
      layouts: [
        'columns-1',
        'columns-2',
        'columns-3',
        'columns-4',
        'columns-5',
        'columns-6',
        'vertical'
      ]
    },
    {
      id: 'dialogue',
      name: '双字回声',
      desc: '大小双字 · 轻错位 · 旁句留白',
      font: 'SimSun',
      color: '#F1F3FA',
      accent: '#B6BCDB',
      intensity: 0.38,
      scale: 1,
      ornaments: 'orbit',
      layouts: ['duet-1', 'duet-2', 'duet-3', 'duet-4', 'duet-5', 'duet-6', 'bookend-1']
    },
    {
      id: 'fold',
      name: '折行叙事',
      desc: '不齐短句 · 逐行展开 · 淡青色',
      font: 'FangSong',
      color: '#EAF4F0',
      accent: '#A3C9BC',
      intensity: 0.4,
      scale: 0.95,
      ornaments: 'lines',
      layouts: [
        'diagonal-1',
        'diagonal-2',
        'diagonal-3',
        'diagonal-4',
        'diagonal-5',
        'diagonal-6',
        'steps'
      ]
    },
    {
      id: 'letter',
      name: '信笺边角',
      desc: '小字落款 · 细线 · 主词轻轻突出',
      font: 'SimSun',
      color: '#FFF5E6',
      accent: '#D1B991',
      intensity: 0.25,
      scale: 0.88,
      ornaments: 'lines',
      layouts: ['sidenote-1', 'sidenote-2', 'sidenote-4', 'sidenote-5', 'sidenote-6', 'hero-6']
    },
    {
      id: 'silent',
      name: '静默留气',
      desc: '疏字横行 · 缓入 · 极少元素',
      font: 'STSong',
      color: '#F2F4F5',
      accent: '#B8C8CE',
      intensity: 0.22,
      scale: 0.9,
      ornaments: 'lines',
      layouts: ['ribbon-1', 'ribbon-3', 'ribbon-6', 'hero-4', 'bookend-2', 'whisper']
    },
    {
      id: 'silver',
      name: '银灰片段',
      desc: '交替大小字 · 轻楷书 · 银灰高亮',
      font: 'KaiTi',
      color: '#F1F0F4',
      accent: '#BCC4D5',
      intensity: 0.45,
      scale: 0.98,
      ornaments: 'diamonds',
      layouts: ['cascade-4', 'cascade-5', 'ribbon-4', 'ribbon-5', 'duet-4', 'bookend-4']
    },
    {
      id: 'shore',
      name: '两岸旁白',
      desc: '两端主词 · 留白对答 · 雾蓝',
      font: 'SimSun',
      color: '#EDF5FC',
      accent: '#A4C9E4',
      intensity: 0.36,
      scale: 0.94,
      ornaments: 'orbit',
      layouts: [
        'bookend-1',
        'bookend-2',
        'bookend-3',
        'bookend-4',
        'bookend-5',
        'bookend-6',
        'right'
      ]
    }
  ];
  function compose(st, cue, fp, text, line, core) {
    var v = st.variant,
      family = st.family,
      fchars = core.chars(fp.focus),
      rows,
      i,
      x,
      y,
      size;
    function body(x, y, n, size, delay) {
      text(core.wrap(fp.body, n).join('\n'), x, y, size, 350, delay);
    }
    if (family === 'hero') {
      var hero = [
        [-87, 0, 94],
        [85, 0, 90],
        [0, 34, 91],
        [0, -27, 85],
        [-47, -36, 96],
        [52, 31, 80]
      ][v];
      text(fp.focus, hero[0], hero[1], hero[2], 280, 0, { tilt: v === 4 ? -3 : 0 });
      var note = [
        [112, 4, 6],
        [-111, 4, 6],
        [0, -48, 17],
        [0, 53, 17],
        [88, 32, 7],
        [-87, -38, 9]
      ][v];
      body(note[0], note[1], note[2], 25, 0.12);
      line(v % 2 ? 68 : -72, v === 3 ? 84 : 72, v === 4 ? 13 : 31);
      return 116;
    }
    if (family === 'cascade') {
      rows = core.wrap(cue.text, v === 5 ? 7 : 9, fp.focus);
      for (i = 0; i < rows.length; i++) {
        var chars = core.chars(rows[i]),
          widths = [],
          total = 0;
        for (var ci = 0; ci < chars.length; ci++) {
          var glyphSize = fp.focus.indexOf(chars[ci]) >= 0 && /\S/.test(chars[ci]) ? 61 : 31;
          widths[ci] =
            glyphSize * (chars[ci].charCodeAt(0) < 256 ? 0.66 : 1.04) + (v === 4 ? 14 : 9);
          total += widths[ci];
        }
        cursor = -total / 2;
        for (var j = 0; j < chars.length; j++) {
          var important = fp.focus.indexOf(chars[j]) >= 0 && /\S/.test(chars[j]);
          size = important ? 61 : 31;
          x = cursor + widths[j] / 2;
          cursor += widths[j];
          y = (i - (rows.length - 1) / 2) * 90;
          if (v === 1) y += (j % 2) * 13;
          if (v === 3) y += j * 5;
          if (v === 5) y += Math.pow(j - (chars.length - 1) / 2, 2) * 2.1;
          text(chars[j], x, y, size, 74, (i * 9 + j) * (v === 2 ? 0.055 : 0.08), {
            tilt: v === 2 ? (j % 2 ? 2 : -2) : 0,
            motion: st.motion,
            flow: 'cascade-' + i
          });
        }
      }
      return rows.length * 42 + 52;
    }
    if (family === 'columns') {
      rows = core.wrap(fp.body, v === 1 ? 4 : 6);
      if (v === 4) {
        text(fp.focus, 0, -70, 65, 300, 0);
        for (i = 0; i < rows.length; i++)
          text(
            core.chars(rows[i]).join('\n'),
            (i - (rows.length - 1) / 2) * 41,
            54,
            25,
            34,
            0.1 + i * 0.05
          );
        return 188;
      }
      text(fchars.join('\n'), v === 5 ? -70 : 69, -4, v === 3 ? 53 : 64, 91, 0);
      if (v === 3) {
        body(-87, 6, 8, 26, 0.12);
        return 142;
      }
      for (i = 0; i < rows.length; i++)
        text(
          core.chars(rows[i]).join('\n'),
          (v === 5 ? 1 : -1) * (i * 39 + 5),
          v === 2 ? (i % 2 ? 25 : -20) : 0,
          v === 1 ? 22 : 25,
          34,
          0.12 + i * 0.06
        );
      return Math.max(135, Math.min(245, fchars.length * 45));
    }
    if (family === 'bookend') {
      var first = fchars[0] || fp.focus,
        rest = fchars.slice(1).join('');
      var ends = [
        [
          [-132, 0],
          [132, 17]
        ],
        [
          [-141, -10],
          [138, 12]
        ],
        [
          [0, -73],
          [25, 68]
        ],
        [
          [-97, -43],
          [101, 36]
        ],
        [
          [-139, 37],
          [135, -29]
        ],
        [
          [-98, -51],
          [95, 53]
        ]
      ][v];
      text(first, ends[0][0], ends[0][1], v === 4 ? 100 : 86, 125, 0, { tilt: v === 5 ? -4 : 0 });
      text(rest, ends[1][0], ends[1][1], v === 1 ? 57 : 68, 168, 0.1);
      body(v === 2 ? -12 : 0, v === 2 ? 0 : 4, v === 2 ? 11 : 5, v === 2 ? 25 : 23, 0.18);
      return v === 2 ? 135 : 119;
    }
    if (family === 'diagonal') {
      rows = core.wrap(cue.text, v === 3 ? 4 : 6, fp.focus);
      for (i = 0; i < rows.length; i++) {
        x = (i - (rows.length - 1) / 2) * (v === 1 ? -39 : v === 4 ? (i % 2 ? -32 : 32) : 34);
        y = (i - (rows.length - 1) / 2) * (v === 3 ? 59 : 47);
        size = v === 3 ? (i % 2 ? 43 : 26) : v === 4 ? (i === 1 ? 46 : 28) : 32;
        text(rows[i], x, y, size, 375, 0.08 * i, {
          tilt: v === 2 ? -3 : 0,
          tracking: v === 5 ? 70 : 0
        });
      }
      return rows.length * 29 + 53;
    }
    if (family === 'duet') {
      var points = [
        [
          [-35, -11, 106],
          [43, 28, 54]
        ],
        [
          [0, -39, 90],
          [30, 52, 65]
        ],
        [
          [-28, -15, 106],
          [22, 35, 77]
        ],
        [
          [-57, 24, 67],
          [35, -12, 98]
        ],
        [
          [-45, -5, 101],
          [43, 28, 53]
        ],
        [
          [-37, 18, 86],
          [42, 39, 49]
        ]
      ][v];
      for (i = 0; i < fchars.length; i++) {
        var pp = points[Math.min(i, 1)];
        text(fchars[i], pp[0] + Math.max(0, i - 1) * 53, pp[1], pp[2], 123, i * 0.09, {
          tilt: v === 2 ? -5 : 0
        });
      }
      body(v === 4 ? -133 : 145, v === 5 ? -40 : 4, 6, 24, 0.16);
      return 121;
    }
    if (family === 'ribbon') {
      rows = core.wrap(cue.text, v === 2 ? 9 : 11, fp.focus);
      for (i = 0; i < rows.length; i++) {
        var glyphs = core.chars(rows[i]),
          sizes = [];
        widths = [];
        total = 0;
        for (var k = 0; k < glyphs.length; k++) {
          sizes[k] = fp.focus.indexOf(glyphs[k]) >= 0 ? 62 : 28;
          widths[k] = sizes[k] + (v === 2 ? 12 : 5);
          total += widths[k];
        }
        var cursor = -total / 2;
        for (k = 0; k < glyphs.length; k++) {
          y = (i - (rows.length - 1) / 2) * 91;
          if (v === 1) y += (k % 2) * 12;
          if (v === 4 && sizes[k] > 40) y -= 16;
          if (v === 5) y += Math.sin(k * 0.65) * 6;
          text(glyphs[k], cursor + widths[k] / 2, y, sizes[k], 85, (i * 11 + k) * 0.04, {
            motion: st.motion,
            flow: 'ribbon-' + i
          });
          cursor += widths[k];
        }
      }
      return rows.length * 44 + 50;
    }
    if (family === 'sidenote') {
      if (v === 2) {
        text(fp.focus, -86, 0, 78, 235, 0);
        body(104, 0, 5, 24, 0.12);
        line(15, 52, 19);
        return 105;
      }
      if (v === 3) {
        text(fp.focus, 54, 35, 69, 235, 0.1);
        body(-78, -35, 5, 23, 0);
        line(-32, 72, 37);
        return 113;
      }
      text(fp.focus, v === 1 ? -95 : -53, -31, v === 5 ? 57 : 73, 260, 0);
      body(v === 1 ? 89 : 26, 35, v === 5 ? 18 : 12, 24, 0.12);
      line(v === 1 ? -55 : -128, -78, v === 4 ? 73 : 30);
      if (v === 4) line(95, 77, 28);
      return 100;
    }
    return 100;
  }
  return { styles: styles, themes: themes, compose: compose };
})();

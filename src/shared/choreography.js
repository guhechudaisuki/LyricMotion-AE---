/* exported LMChoreography */
/* Editable lyric layouts built around movement, hierarchy and reading order. ES3. */
var LMChoreography = (function () {
  var styles = [],
    families = [
      [
        'reveal-row',
        '遮罩分行',
        ['向上揭句', '向下落句', '左右接句', '折返收句'],
        ['mask-up', 'mask-down', 'mask-left', 'mask-return']
      ],
      [
        'reveal-word',
        '主次遮罩',
        ['主词先揭', '旁句先揭', '错向揭幕', '横竖开合'],
        ['mask-up', 'mask-right', 'mask-diagonal', 'wipe-x']
      ],
      [
        'reveal-char',
        '逐字遮罩',
        ['逐字上揭', '逐字下收', '反向揭字', '斜向揭字'],
        ['mask-up', 'mask-down', 'mask-right', 'mask-diagonal']
      ],
      [
        'shutter',
        '交错快门',
        ['上下错门', '左右错门', '中间开门', '双向收门'],
        ['mask-up', 'mask-left', 'wipe-y', 'mask-return']
      ],
      [
        'tracking-motion',
        '动态字距',
        ['从紧到疏', '从疏到齐', '两行展开', '主字归队'],
        ['spread', 'gather', 'spread', 'gather']
      ],
      [
        'fold-motion',
        '翻页显字',
        ['横轴翻起', '竖轴展开', '上下翻页', '交错翻转'],
        ['fold-x', 'fold-y', 'fold-x', 'fold-y']
      ],
      [
        'spring-motion',
        '弹性入句',
        ['轻弹入列', '错拍弹落', '关键词回弹', '双行弹入'],
        ['spring', 'bounce', 'spring', 'bounce']
      ],
      [
        'wave-motion',
        '流动字列',
        ['微波起伏', '斜阶流动', '双行错波', '尾字起伏'],
        ['wave', 'wave', 'wave', 'wave']
      ],
      [
        'swing-motion',
        '旋摆归位',
        ['摆入小字', '轻旋主字', '错时旋入', '两岸旋摆'],
        ['swing', 'roll', 'swing', 'roll']
      ],
      [
        'blur-motion',
        '失焦递进',
        ['逐字聚焦', '横移聚焦', '主次显影', '两行柔焦'],
        ['blur-rise', 'blur-slide', 'mist', 'blur-rise']
      ],
      [
        'type-motion',
        '错时读句',
        ['逐字点亮', '两行接力', '反向点亮', '短句接力'],
        ['type', 'type', 'type', 'type']
      ],
      [
        'split-motion',
        '分组接句',
        ['大小接句', '对向来信', '上下一问', '两段呼应'],
        ['mask-right', 'mask-left', 'mask-up', 'wipe-x']
      ]
    ];
  var anchors = [
    [0.24, 0.52],
    [0.75, 0.55],
    [0.27, 0.67],
    [0.72, 0.37]
  ];
  for (var f = 0; f < families.length; f++)
    for (var v = 0; v < 4; v++)
      styles.push({
        id: families[f][0] + '-' + (v + 1),
        name: families[f][2][v],
        group: families[f][1],
        desc: '完整进场、停留与退场；关键词大小对比，文字保持可编辑',
        kind: 'choreography',
        family: families[f][0],
        variant: v,
        x: anchors[v][0],
        y: anchors[v][1],
        motion: families[f][3][v],
        favorite: true
      });
  var display = [
    [
      'poster-left',
      '左岸落字',
      'poster',
      0,
      0.25,
      0.53,
      'left',
      'parallax',
      'still',
      'drift',
      'spark'
    ],
    [
      'poster-right',
      '右岸错层',
      'poster',
      1,
      0.75,
      0.51,
      'right',
      'glide-arc',
      'breathe',
      'slide',
      'arc'
    ],
    [
      'poster-low',
      '低位主词',
      'poster',
      2,
      0.29,
      0.67,
      'left',
      'compress',
      'breathe',
      'shrink',
      'underline'
    ],
    [
      'poster-high',
      '高位留白',
      'poster',
      3,
      0.67,
      0.36,
      'right',
      'hinge',
      'still',
      'drift',
      'corner'
    ],
    [
      'stair-rise',
      '上行阶句',
      'stair',
      0,
      0.39,
      0.54,
      'left',
      'glide-arc',
      'still',
      'slide',
      'slash'
    ],
    [
      'stair-fall',
      '下行阶句',
      'stair',
      1,
      0.59,
      0.48,
      'right',
      'parallax',
      'breathe',
      'drift',
      'ticks'
    ],
    [
      'stair-center',
      '中轴阶句',
      'stair',
      2,
      0.5,
      0.52,
      'center',
      'compress',
      'push',
      'shrink',
      'dash'
    ],
    ['stair-edge', '靠边阶句', 'stair', 3, 0.31, 0.55, 'left', 'hinge', 'still', 'slide', 'corner'],
    [
      'satellite-cross',
      '关键词四邻',
      'satellite',
      0,
      0.5,
      0.51,
      'center',
      'compress',
      'breathe',
      'shrink',
      'spark'
    ],
    [
      'satellite-side',
      '关键词侧邻',
      'satellite',
      1,
      0.35,
      0.52,
      'left',
      'parallax',
      'drift',
      'slide',
      'bracket'
    ],
    [
      'satellite-top',
      '关键词上邻',
      'satellite',
      2,
      0.53,
      0.47,
      'center',
      'hinge',
      'pulse',
      'drift',
      'arc'
    ],
    [
      'satellite-corner',
      '关键词斜邻',
      'satellite',
      3,
      0.64,
      0.53,
      'right',
      'glide-arc',
      'breathe',
      'slide',
      'diamond'
    ],
    [
      'broad-stack',
      '宽幅叠行',
      'broad',
      0,
      0.5,
      0.54,
      'center',
      'compress',
      'push',
      'shrink',
      'underline'
    ],
    [
      'broad-ascent',
      '上宽下窄',
      'broad',
      1,
      0.49,
      0.48,
      'center',
      'parallax',
      'breathe',
      'drift',
      'dash'
    ],
    [
      'broad-offset',
      '错幅叠行',
      'broad',
      2,
      0.47,
      0.55,
      'center',
      'glide-arc',
      'still',
      'slide',
      'corner'
    ],
    [
      'broad-bottom',
      '底部宽句',
      'broad',
      3,
      0.51,
      0.71,
      'center',
      'hinge',
      'pulse',
      'shrink',
      'underline'
    ],
    ['axis-left', '左竖右横', 'axis', 0, 0.32, 0.51, 'left', 'hinge', 'still', 'drift', 'bracket'],
    [
      'axis-right',
      '右竖左横',
      'axis',
      1,
      0.68,
      0.52,
      'right',
      'compress',
      'breathe',
      'slide',
      'slash'
    ],
    [
      'axis-centered',
      '竖心横翼',
      'axis',
      2,
      0.5,
      0.53,
      'center',
      'parallax',
      'pulse',
      'shrink',
      'arc'
    ],
    [
      'axis-low',
      '低位竖签',
      'axis',
      3,
      0.61,
      0.64,
      'right',
      'glide-arc',
      'still',
      'drift',
      'corner'
    ],
    [
      'banner-left',
      '左锚横幅',
      'banner',
      0,
      0.4,
      0.54,
      'left',
      'parallax',
      'push',
      'slide',
      'dash'
    ],
    [
      'banner-right',
      '右锚横幅',
      'banner',
      1,
      0.6,
      0.54,
      'right',
      'glide-arc',
      'breathe',
      'drift',
      'underline'
    ],
    [
      'banner-top',
      '上沿横幅',
      'banner',
      2,
      0.51,
      0.37,
      'center',
      'compress',
      'still',
      'shrink',
      'bracket'
    ],
    [
      'banner-bottom',
      '下沿横幅',
      'banner',
      3,
      0.49,
      0.7,
      'center',
      'hinge',
      'pulse',
      'slide',
      'dash'
    ],
    ['essay-left', '左栏短章', 'essay', 0, 0.28, 0.53, 'left', 'hinge', 'still', 'drift', 'corner'],
    [
      'essay-right',
      '右栏短章',
      'essay',
      1,
      0.71,
      0.51,
      'right',
      'parallax',
      'breathe',
      'slide',
      'bracket'
    ],
    [
      'essay-center',
      '齐行短章',
      'essay',
      2,
      0.5,
      0.53,
      'center',
      'compress',
      'push',
      'shrink',
      'underline'
    ],
    [
      'essay-low',
      '底栏短章',
      'essay',
      3,
      0.49,
      0.7,
      'center',
      'glide-arc',
      'still',
      'drift',
      'dash'
    ]
  ];
  var ornamentGroups = {
    dash: 'lines',
    bracket: 'geometry',
    underline: 'lines',
    corner: 'geometry',
    slash: 'lines',
    ticks: 'geometry',
    spark: 'stars',
    arc: 'silk',
    diamond: 'geometry'
  };
  for (var q = 0; q < display.length; q++) {
    var d = display[q];
    styles.push({
      id: d[0],
      name: d[1],
      group: '词组层次',
      desc: '主词与短句错层、边侧留白、分拍显字与收回',
      kind: 'choreography',
      family: d[2],
      variant: d[3],
      x: d[4],
      y: d[5],
      presence: d[6] === 'center' ? 'display' : 'side',
      side: d[6],
      motion: d[7],
      hold: d[8],
      exitMotion: d[9],
      emphasisFont: /^(poster|axis|satellite|banner)$/.test(d[2]) && d[3] !== 2 ? 'STXingkai' : '',
      ornamentTheme: ornamentGroups[d[10]] || 'lines',
      favorite: true
    });
  }
  function compose(st, cue, fp, text, line, core) {
    var v = st.variant,
      family = st.family,
      rows,
      i,
      j;
    function phrase(s, n) {
      var rr = core.wrap(s, n),
        last = rr.length - 1;
      if (
        last > 0 &&
        !/[A-Za-z]/.test(s) &&
        core.chars(rr[last]).length === 1 &&
        core.chars(rr[last - 1]).length > 3
      ) {
        var prev = core.chars(rr[last - 1]);
        rr[last] = prev.slice(-2).join('') + rr[last];
        rr[last - 1] = prev.slice(0, -2).join('');
      }
      return rr.join('\n');
    }
    if (family === 'poster') {
      var fx = v === 2 ? 60 : v === 3 ? -35 : 15,
        fy = fp.before ? 18 : -15;
      if (fp.before)
        text(phrase(fp.before, 9), v === 1 ? -115 : -142, -62, 29, 360, 0, {
          motion: 'mask-up',
          align: 'left'
        });
      var glyphs = core.chars(fp.focus);
      if (v === 1 && glyphs.length === 2) {
        text(glyphs[0], fx - 30, fy - 16, 102, 120, 0.16, { motion: st.motion, tilt: -4 });
        text(glyphs[1], fx + 32, fy + 49, 82, 105, 0.25, { motion: 'mask-up', tilt: 2 });
      } else
        text(fp.focus, fx, fy, v === 2 ? 106 : 94, 285, fp.before ? 0.16 : 0, {
          motion: st.motion,
          tilt: v === 3 ? -3 : 0
        });
      var afterY = v === 1 ? fy + (glyphs.length === 2 ? 98 : 69) : 99;
      if (fp.after)
        text(phrase(fp.after, 9), v === 3 ? 145 : 160, afterY, 28, 360, 0.32, {
          motion: 'mask-left',
          align: 'right'
        });
      return fp.after ? (v === 1 ? afterY + 45 : 144) : 118;
    }
    if (family === 'stair') {
      var count = Math.max(6, Math.ceil(core.chars(cue.text).length / (v === 2 ? 3 : 4)));
      rows = core.wrap(cue.text, count, fp.focus);
      var step = v === 1 ? -55 : v === 3 ? 34 : 49;
      for (i = 0; i < rows.length; i++) {
        var off = i - (rows.length - 1) / 2;
        text(
          rows[i],
          off * step + (v === 2 && i % 2 ? 25 : 0),
          off * (v === 3 ? 52 : 59),
          rows[i].indexOf(fp.focus) >= 0 ? 57 : i === 0 ? 40 : 31,
          370,
          i * 0.1,
          { motion: i % 2 ? 'mask-up' : st.motion, flow: 'stair-' + i }
        );
      }
      return Math.min(170, rows.length * 30 + 42);
    }
    if (family === 'satellite') {
      text(
        fp.focus,
        v === 1 ? -35 : v === 3 ? 35 : 0,
        v === 2 ? 13 : 0,
        99,
        265,
        fp.before ? 0.16 : 0,
        { motion: st.motion, tilt: v === 3 ? -3 : 0 }
      );
      if (fp.before)
        text(phrase(fp.before, 8), -155, v === 2 ? -82 : -72, 28, 300, 0, {
          motion: 'mask-up',
          align: 'left'
        });
      if (fp.after)
        text(phrase(fp.after, 8), 155, v === 2 ? 88 : 85, 27, 300, 0.3, {
          motion: 'parallax',
          align: 'right'
        });
      return fp.after ? 145 : 100;
    }
    if (family === 'broad') {
      var target = Math.max(7, Math.ceil(core.chars(cue.text).length / (v === 3 ? 2 : 3)));
      rows = core.wrap(cue.text, target, fp.focus);
      var spacing = v === 3 ? 58 : 63;
      for (i = 0; i < rows.length; i++) {
        var shift = v === 2 ? (i % 2 ? -48 : 36) : v === 1 ? (i - (rows.length - 1) / 2) * 18 : 0;
        var size = rows[i].indexOf(fp.focus) >= 0 ? 66 : 36;
        text(rows[i], shift, (i - (rows.length - 1) / 2) * spacing, size, 510, i * 0.1, {
          motion: i === 0 ? st.motion : 'mask-up',
          flow: 'broad-' + i
        });
      }
      line(v === 2 ? -82 : 0, Math.min(126, rows.length * 32 + 18), v === 3 ? 88 : 65);
      return Math.min(173, rows.length * 34 + 56);
    }
    if (family === 'axis') {
      var vertical = core.chars(fp.focus).join('\n'),
        axisSide = v === 1 || v === 3 ? 1 : -1;
      text(
        vertical,
        axisSide * 90,
        v === 3 ? 12 : 0,
        v === 2 ? 70 : 76,
        105,
        fp.before ? 0.14 : 0,
        { motion: st.motion }
      );
      if (fp.before)
        text(phrase(fp.before, v === 2 ? 9 : 7), -axisSide * 63, fp.after ? -45 : 0, 29, 270, 0, {
          motion: 'mask-up'
        });
      if (fp.after)
        text(phrase(fp.after, 8), -axisSide * 63, 70, 27, 270, 0.28, { motion: 'parallax' });
      return 145;
    }
    if (family === 'banner') {
      if (fp.before)
        text(phrase(fp.before, 11), -165, v === 2 ? -55 : -48, 29, 350, 0, {
          motion: 'mask-up',
          align: 'left'
        });
      text(
        fp.focus,
        v === 0 ? -25 : v === 1 ? 55 : 20,
        v === 3 ? 20 : 12,
        86,
        270,
        fp.before ? 0.15 : 0,
        { motion: st.motion }
      );
      if (fp.after)
        text(phrase(fp.after, 11), 175, v === 3 ? 100 : 89, 27, 350, 0.3, {
          motion: 'mask-left',
          align: 'right'
        });
      return fp.after ? 145 : 105;
    }
    if (family === 'essay') {
      var content = core
        .wrap(cue.text, Math.max(8, Math.ceil(core.chars(cue.text).length / 3)), fp.focus)
        .join('\n');
      text(
        content,
        v === 0 ? -145 : v === 1 ? 145 : 0,
        v === 3 ? 8 : 0,
        v === 2 ? 42 : 36,
        455,
        0,
        { motion: st.motion, flow: 'essay', align: v === 0 ? 'left' : v === 1 ? 'right' : 'center' }
      );
      line(v === 0 ? -113 : v === 1 ? 113 : 0, v === 3 ? 96 : 104, v === 2 ? 108 : 72);
      return 150;
    }
    if (family === 'reveal-word' || family === 'split-motion') {
      var horizontal = v % 2 === 1;
      text(fp.focus, horizontal ? -99 : 0, horizontal ? 0 : 35, 82, 270, v === 1 ? 0.3 : 0, {
        motion: st.motion
      });
      text(
        core.wrap(fp.body, horizontal ? 6 : 13).join('\n'),
        horizontal ? 111 : 0,
        horizontal ? 0 : -47,
        27,
        340,
        v === 1 ? 0 : 0.2,
        { motion: v === 2 ? 'mask-down' : st.motion }
      );
      line(-76, 94, 53);
      return 137;
    }
    if (family === 'reveal-row') {
      rows = core.wrap(cue.text, v === 2 ? 5 : 7, fp.focus);
      for (i = 0; i < rows.length; i++)
        text(
          rows[i],
          (i - (rows.length - 1) / 2) * 17,
          (i - (rows.length - 1) / 2) * 62,
          i === rows.length - 1 ? 46 : 32,
          425,
          i * 0.17,
          { motion: st.motion }
        );
      return rows.length * 34 + 45;
    }
    rows = core.wrap(cue.text, v === 2 ? 7 : 10, fp.focus);
    var orderBase = 0;
    for (i = 0; i < rows.length; i++) {
      glyphs = core.chars(rows[i]);
      var sizes = [],
        widths = [],
        total = 0,
        cursor;
      for (j = 0; j < glyphs.length; j++) {
        sizes[j] = fp.focus.indexOf(glyphs[j]) >= 0 && /\S/.test(glyphs[j]) ? 58 : 29;
        widths[j] = sizes[j] * (glyphs[j].charCodeAt(0) < 256 ? 0.66 : 1.04) + 10;
        total += widths[j];
      }
      cursor = -total / 2;
      for (j = 0; j < glyphs.length; j++) {
        var x = cursor + widths[j] / 2,
          y = (i - (rows.length - 1) / 2) * 91,
          order = v === 2 ? glyphs.length - 1 - j : j,
          motion = st.motion;
        if (family === 'shutter' && j % 2) motion = v === 1 ? 'mask-right' : 'mask-down';
        if (family === 'wave-motion')
          y += v === 1 ? j * 3 : v === 3 && sizes[j] > 40 ? -11 : Math.sin(j * 0.6) * 7;
        if (family === 'fold-motion' && v === 3 && j % 2) motion = 'fold-y';
        text(glyphs[j], x, y, sizes[j], 85, (orderBase + order) * 0.07, {
          motion: motion,
          flow: 'row-' + i,
          order: order,
          spread: x * 0.4
        });
        cursor += widths[j];
      }
      orderBase += glyphs.length;
    }
    return rows.length * 49 + 48;
  }
  return { styles: styles, compose: compose };
})();

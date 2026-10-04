/* exported LMMotifs */
/* Small editable motion graphics, designed to sit beside a lyric. ES3. */
var LMMotifs = (function () {
  var list = [
    ['spark', '四角微光'],
    ['ring', '细圆环'],
    ['arc', '短圆弧'],
    ['diamond', '细菱形'],
    ['petal', '小花瓣'],
    ['bracket', '方括号'],
    ['dot', '小圆点'],
    ['dash', '短横线'],
    ['slash', '双斜线'],
    ['ticks', '细刻度'],
    ['orbit', '小星轨'],
    ['constellation', '三点连星'],
    ['cross', '小十字'],
    ['corner', '直角标'],
    ['echo-rings', '涟漪双环'],
    ['dash-trail', '游走短线'],
    ['ray-burst', '短线放射'],
    ['dust', '浮游微粒'],
    ['shooting-star', '划过流星'],
    ['orbit-dots', '绕行光点'],
    ['flower', '转动花瓣'],
    ['diamond-pair', '交错菱形'],
    ['wave-line', '波形细线'],
    ['scan-bracket', '开合括号'],
    ['equalizer', '跳动音阶'],
    ['scribble', '手绘线生长'],
    ['underline', '双线划出'],
    ['arrow', '游动箭头'],
    ['triangles', '叠三角'],
    ['grid-dots', '呼吸点阵'],
    ['compass', '转动罗盘'],
    ['spark-cluster', '错拍星群'],
    ['star-trail', '星点轨迹'],
    ['ripple-arc', '追逐圆弧'],
    ['pulse-cross', '脉冲十字'],
    ['orbit-quad', '环绕小方块'],
    ['silk-orbit', '字沿细丝'],
    ['ribbon-swoosh', '尾笔轻掠'],
    ['petal-curve', '细叶随弧'],
    ['diamond-curve', '一线菱光'],
    ['corner-stars', '字角碎星'],
    ['crescent-frame', '偏笔月钩'],
    ['comet-arc', '短弧流光'],
    ['stitch-curve', '断笔银线'],
    ['aurora-dots', '微芒散落'],
    ['twinkle-field', '一点星闪'],
    ['pearl-drift', '轻屑浮光'],
    ['leaf-pair', '双叶落笔']
  ];
  function line(points, closed, fill) {
    return { points: points, closed: !!closed, fill: !!fill };
  }
  function circle(r, cx, cy, start, end) {
    var p = [],
      a;
    for (var i = 0; i <= 24; i++) {
      a = ((start + ((end - start) * i) / 24) * Math.PI) / 180;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return line(p, end - start === 360);
  }
  function isSurround(kind) {
    return /^(silk-orbit|ribbon-swoosh|petal-curve|diamond-curve|corner-stars|crescent-frame|comet-arc|stitch-curve|aurora-dots)$/.test(
      kind
    );
  }
  function isNew(kind) {
    return isSurround(kind) || /^(twinkle-field|pearl-drift|leaf-pair)$/.test(kind);
  }
  function isAnimated(kind) {
    return (
      isNew(kind) ||
      /^(echo-rings|ray-burst|pulse-cross|equalizer|dust|orbit-dots|diamond-pair|scan-bracket|spark-cluster|star-trail|wave-line)$/.test(
        kind
      )
    );
  }
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function styled(part, opacity, stroke) {
    part.opacity = clamp(opacity, 0, 1);
    part.strokeScale = stroke == null ? 1 : stroke;
    return part;
  }
  function twinkle(t, seed, power) {
    var wave = (Math.sin(t * (1.35 + seed * 0.113) + seed * 2.399) + 1) / 2;
    return 1 - power * (0.83 - 0.83 * Math.pow(wave, 3));
  }
  // Filled, narrow centres read as light rather than a hollow icon.
  function turn(part, x, y, angle) {
    var c = Math.cos(angle || 0),
      s = Math.sin(angle || 0);
    for (var i = 0; i < part.points.length; i++) {
      var px = part.points[i][0],
        py = part.points[i][1];
      part.points[i] = [x + px * c - py * s, y + px * s + py * c];
    }
    return part;
  }
  function star(x, y, r, angle) {
    return turn(
      line(
        [
          [0, -r * 1.42],
          [r * 0.19, -r * 0.19],
          [r * 0.79, 0],
          [r * 0.19, r * 0.19],
          [0, r * 1.42],
          [-r * 0.19, r * 0.19],
          [-r * 0.79, 0],
          [-r * 0.19, -r * 0.19]
        ],
        true,
        true
      ),
      x,
      y,
      angle
    );
  }
  function diamond(x, y, r, angle) {
    return turn(
      line(
        [
          [0, -r],
          [r * 0.25, 0],
          [0, r],
          [-r * 0.25, 0]
        ],
        true,
        true
      ),
      x,
      y,
      angle
    );
  }
  function leaf(x, y, r, angle) {
    var pts = [],
      a;
    for (var i = 0; i <= 6; i++) {
      a = i / 6;
      pts.push([Math.sin(a * Math.PI) * r * 0.2, -r + 2 * r * a]);
    }
    for (i = 1; i < 6; i++) {
      a = 1 - i / 6;
      pts.push([-Math.sin(a * Math.PI) * r * 0.12, -r + 2 * r * a]);
    }
    return turn(line(pts, true, true), x, y, angle);
  }
  function bezier(controls, t) {
    var a = 1 - t;
    return [
      a * a * a * controls[0][0] +
        3 * a * a * t * controls[1][0] +
        3 * a * t * t * controls[2][0] +
        t * t * t * controls[3][0],
      a * a * a * controls[0][1] +
        3 * a * a * t * controls[1][1] +
        3 * a * t * t * controls[2][1] +
        t * t * t * controls[3][1]
    ];
  }
  function curve(controls, start, end) {
    var pts = [];
    for (var i = 0; i <= 24; i++) pts.push(bezier(controls, start + ((end - start) * i) / 24));
    return line(pts);
  }
  function context(scene, item) {
    if (item.surroundSpan) return item.surroundSpan;
    var u = (item.paths && item.paths.length && item.paths[0].motifUnit) || scene.unit || 1;
    return { u: u, length: 38 * u, depth: 4 * u, spark: 3.2 * u, angle: 0, flip: 1, visible: 1 };
  }
  function offsetCurve(controls, x, y) {
    var out = [];
    for (var i = 0; i < 4; i++) out.push([controls[i][0] + x, controls[i][1] + y]);
    return out;
  }
  function specialPaths(scene, item, t) {
    var name = item.name,
      c = context(scene, item),
      u = c.u,
      p = [],
      intensity = scene.intensity == null ? 0.5 : scene.intensity,
      power = intensity > 0 ? 0.5 + clamp(intensity, 0, 1) * 0.5 : 0;
    var phase = t * (0.65 + intensity * 0.35),
      l = c.length,
      d = c.depth,
      r = c.spark,
      i,
      j,
      at,
      part,
      controls,
      other,
      point,
      shine;
    var sway = Math.sin(phase * 0.65) * d * 0.08 * power;
    if (name === 'silk-orbit') {
      controls = [
        [-l * 0.5, d * 0.32],
        [-l * 0.19, -d * 0.95 + sway],
        [l * 0.18, d * 0.58],
        [l * 0.5, -d * 0.2]
      ];
      p.push(
        styled(curve(controls, 0, 0.32), 0.43, 0.42),
        styled(curve(controls, 0.32, 0.76), 0.72, 0.83),
        styled(curve(controls, 0.76, 1), 0.4, 0.36)
      );
      other = offsetCurve(controls, l * 0.035, d * 0.62);
      p.push(styled(curve(other, 0.12, 0.48), 0.25, 0.36));
      point = bezier(controls, 0.79 + Math.sin(phase * 0.58) * 0.045 * power);
      p.push(
        styled(
          diamond(point[0], point[1], r * 0.67, -0.52),
          0.35 + 0.55 * twinkle(t, 3, power),
          0.5
        )
      );
    } else if (name === 'ribbon-swoosh') {
      controls = [
        [-l * 0.5, -d * 0.42],
        [-l * 0.29, d * 0.94 + sway],
        [l * 0.2, d * 0.72],
        [l * 0.5, -d * 0.5]
      ];
      p.push(
        styled(curve(controls, 0, 0.28), 0.36, 0.36),
        styled(curve(controls, 0.28, 0.71), 0.7, 1.03),
        styled(curve(controls, 0.71, 1), 0.48, 0.47)
      );
      other = offsetCurve(controls, l * 0.03, -d * 0.45);
      p.push(styled(curve(other, 0.57, 0.94), 0.3, 0.38));
    } else if (name === 'petal-curve' || name === 'diamond-curve') {
      controls = [
        [-l * 0.5, d * 0.55],
        [-l * 0.15, -d * 0.54],
        [l * 0.23, -d * 0.66 + sway],
        [l * 0.5, -d * 0.12]
      ];
      p.push(
        styled(curve(controls, 0, 0.61), 0.54, 0.64),
        styled(curve(controls, 0.61, 1), 0.31, 0.34)
      );
      at = 0.56 + Math.sin(phase * 0.7) * 0.14 * power;
      point = bezier(controls, at);
      shine = twinkle(t, 2, power);
      part =
        name === 'petal-curve'
          ? leaf(point[0], point[1], r * 1.15, 0.67 + Math.sin(phase) * 0.1 * power)
          : diamond(point[0], point[1], r * 1.05, 0.32);
      p.push(styled(part, 0.42 + 0.46 * shine, 0.5));
      point = bezier(controls, 0.85 + Math.sin(phase * 0.7 + 2) * 0.025 * power);
      p.push(
        styled(
          name === 'petal-curve'
            ? leaf(point[0], point[1] + d * 0.42, r * 0.52, -0.63)
            : diamond(point[0], point[1] + d * 0.38, r * 0.34, -0.3),
          0.3 + 0.28 * twinkle(t, 6, power),
          0.4
        )
      );
    } else if (name === 'corner-stars') {
      shine = twinkle(t, 3, power);
      p.push(
        styled(
          star(l * 0.12, -d * 0.18, r * (0.83 + 0.17 * shine), -0.12),
          0.36 + 0.61 * shine,
          0.5
        )
      );
      p.push(
        styled(diamond(-l * 0.13, d * 0.51, r * 0.31, 0.48), 0.2 + 0.55 * twinkle(t, 7, power), 0.4)
      );
      p.push(
        styled(star(l * 0.33, d * 0.56, r * 0.29, 0.26), 0.15 + 0.49 * twinkle(t, 1, power), 0.4)
      );
      part = circle(r * 0.12, -l * 0.36, -d * 0.3, 0, 360);
      part.fill = true;
      p.push(styled(part, 0.42 + 0.3 * twinkle(t, 4, power), 0.4));
    } else if (name === 'crescent-frame') {
      controls = [
        [-l * 0.43, -d * 0.62],
        [-l * 0.05, d * 1.23],
        [l * 0.31, d * 0.89 + sway],
        [l * 0.43, -d * 0.22]
      ];
      p.push(
        styled(curve(controls, 0, 0.29), 0.33, 0.32),
        styled(curve(controls, 0.29, 0.73), 0.64, 0.91),
        styled(curve(controls, 0.73, 1), 0.4, 0.4)
      );
      point = bezier(controls, 0.77 + Math.sin(phase * 0.8) * 0.04 * power);
      p.push(
        styled(leaf(point[0], point[1], r * 0.64, -0.59), 0.27 + 0.27 * twinkle(t, 4, power), 0.4)
      );
    } else if (name === 'comet-arc') {
      controls = [
        [-l * 0.5, d * 0.59],
        [-l * 0.18, -d * 0.46],
        [l * 0.26, -d * 0.85],
        [l * 0.5, -d * 0.34]
      ];
      at = (0.19 + phase * 0.17 * power) % 1;
      shine = Math.pow(Math.sin(Math.PI * at), 2);
      p.push(
        styled(curve(controls, 0.04, 0.94), 0.23, 0.35),
        styled(curve(controls, Math.max(0, at - 0.27), at), 0.66 * shine, 0.77)
      );
      point = bezier(controls, at);
      p.push(styled(star(point[0], point[1], r * 0.76, -0.3), 0.95 * shine, 0.4));
      point = bezier(controls, Math.max(0, at - 0.16));
      p.push(styled(diamond(point[0], point[1] + d * 0.17, r * 0.26, 0.45), 0.43 * shine, 0.4));
    } else if (name === 'stitch-curve') {
      controls = [
        [-l * 0.5, d * 0.36],
        [-l * 0.2, -d * 0.72 + sway],
        [l * 0.15, d * 0.77],
        [l * 0.5, -d * 0.22]
      ];
      p.push(
        styled(curve(controls, 0, 0.16), 0.39, 0.39),
        styled(curve(controls, 0.23, 0.69), 0.61, 0.75),
        styled(curve(controls, 0.84, 1), 0.31, 0.34)
      );
      point = bezier(controls, 0.75);
      p.push(
        styled(
          diamond(point[0], point[1], r * 0.42, -0.55),
          0.24 + 0.53 * twinkle(t, 6, power),
          0.4
        )
      );
    } else if (name === 'aurora-dots') {
      shine = twinkle(t, 2, power);
      p.push(
        styled(
          star(-l * 0.07, -d * 0.19, r * 0.73 * (0.85 + 0.15 * shine), 0.2),
          0.25 + 0.66 * shine,
          0.4
        )
      );
      p.push(
        styled(
          diamond(l * 0.24, d * 0.43 + sway, r * 0.35, -0.6),
          0.17 + 0.39 * twinkle(t, 5, power),
          0.4
        ),
        styled(
          diamond(-l * 0.34, d * 0.63 - sway, r * 0.23, 0.3),
          0.12 + 0.33 * twinkle(t, 8, power),
          0.4
        )
      );
      controls = [
        [l * 0.19, -d * 0.37],
        [l * 0.23, -d * 0.69],
        [l * 0.37, -d * 0.37],
        [l * 0.44, -d * 0.55]
      ];
      p.push(styled(curve(controls, 0, 1), 0.27, 0.34));
    } else if (name === 'twinkle-field') {
      shine = twinkle(t, 1, power);
      p.push(
        styled(star(l * 0.03, -d * 0.04, r * (0.8 + 0.2 * shine), -0.15), 0.27 + 0.68 * shine, 0.4)
      );
      p.push(
        styled(
          diamond(-l * 0.25, d * 0.67, r * 0.29, 0.4),
          0.13 + 0.52 * twinkle(t, 6, power),
          0.4
        ),
        styled(star(l * 0.3, -d * 0.64, r * 0.26, 0.2), 0.12 + 0.37 * twinkle(t, 9, power), 0.4)
      );
    } else if (name === 'pearl-drift') {
      p.push(
        styled(
          leaf(-l * 0.08, -d * 0.24 + sway, r * 0.81, -0.53),
          0.37 + 0.41 * twinkle(t, 2, power),
          0.4
        )
      );
      p.push(
        styled(
          diamond(l * 0.24, d * 0.54 - sway, r * 0.36, 0.51),
          0.18 + 0.41 * twinkle(t, 5, power),
          0.4
        ),
        styled(
          diamond(-l * 0.31, d * 0.64, r * 0.22, -0.2),
          0.12 + 0.31 * twinkle(t, 8, power),
          0.4
        )
      );
    } else if (name === 'leaf-pair') {
      controls = [
        [-l * 0.43, d * 0.56],
        [-l * 0.07, d * 0.03],
        [l * 0.21, -d * 0.31],
        [l * 0.45, -d * 0.48]
      ];
      p.push(styled(curve(controls, 0, 0.92), 0.39, 0.46));
      point = bezier(controls, 0.46);
      p.push(
        styled(
          leaf(
            point[0],
            point[1] - r * 0.47,
            r * 1.12,
            -0.67 + Math.sin(phase * 0.8) * 0.07 * power
          ),
          0.48 + 0.28 * twinkle(t, 2, power),
          0.4
        )
      );
      point = bezier(controls, 0.7);
      p.push(
        styled(
          leaf(
            point[0],
            point[1] + r * 0.35,
            r * 0.68,
            0.73 + Math.sin(phase * 0.8 + 1) * 0.07 * power
          ),
          0.32 + 0.26 * twinkle(t, 5, power),
          0.4
        )
      );
    }
    // The same branch always emits the same number of paths and vertices at every time.
    var cosine = Math.cos(c.angle || 0),
      sine = Math.sin(c.angle || 0),
      flip = c.flip || 1;
    for (i = 0; i < p.length; i++) {
      p[i].motifUnit = u;
      p[i].opacity *= c.visible == null ? 1 : c.visible;
      for (j = 0; j < p[i].points.length; j++) {
        var px = p[i].points[j][0],
          py = p[i].points[j][1] * flip;
        p[i].points[j] = [px * cosine - py * sine, px * sine + py * cosine];
      }
    }
    return p;
  }
  function validBounds(b) {
    return (
      b &&
      isFinite(b.left) &&
      isFinite(b.right) &&
      isFinite(b.top) &&
      isFinite(b.bottom) &&
      b.right > b.left &&
      b.bottom > b.top
    );
  }
  function overlaps(a, b, padding) {
    return (
      a.left < b.right + padding &&
      a.right > b.left - padding &&
      a.top < b.bottom + padding &&
      a.bottom > b.top - padding
    );
  }
  function ornamentEnvelope(name, span, compact) {
    var parts = specialPaths({ intensity: 0 }, { name: name, surroundSpan: span }, 0),
      x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (var i = 0; i < parts.length; i++)
      for (var j = 0; j < parts[i].points.length; j++) {
        var p = parts[i].points[j];
        x0 = Math.min(x0, p[0]);
        x1 = Math.max(x1, p[0]);
        y0 = Math.min(y0, p[1]);
        y1 = Math.max(y1, p[1]);
      }
    // Filled stars are measured at full brightness and size. Curves reserve extra
    // room for their moving tip; the empty control hull is not visible decoration.
    var motionPad = compact
      ? span.depth * 0.09
      : name === 'comet-arc'
        ? span.spark * 1.45
        : span.spark * 0.55 + span.depth * 0.16;
    var pad = span.u + motionPad;
    return {
      halfW: (x1 - x0) / 2 + pad,
      halfH: (y1 - y0) / 2 + pad,
      offsetX: (x0 + x1) / 2,
      offsetY: (y0 + y1) / 2
    };
  }
  function place(scene, item) {
    if (!isNew(item.name || '')) return false;
    var w = scene.width || 360,
      h = scene.height || 180,
      boxes = scene.textBounds || [],
      b = scene.focusBounds,
      i,
      j,
      k,
      edge,
      choice = null;
    if (!validBounds(b)) {
      b = null;
      for (i = 0; i < boxes.length; i++)
        if (
          validBounds(boxes[i]) &&
          (!b ||
            (boxes[i].right - boxes[i].left) * (boxes[i].bottom - boxes[i].top) >
              (b.right - b.left) * (b.bottom - b.top))
        )
          b = boxes[i];
    }
    if (!b)
      b = validBounds(scene.bounds)
        ? scene.bounds
        : { left: w * 0.33, right: w * 0.67, top: h * 0.4, bottom: h * 0.6 };
    var size = clamp(item.motifSize || 1, 0.5, 2),
      u =
        (scene.unit || 1) * size * Math.max(0.75, Math.min(1.5, Math.sqrt(scene.layoutScale || 1)));
    var fw = b.right - b.left,
      fh = b.bottom - b.top,
      cx = (b.left + b.right) / 2,
      cy = (b.top + b.bottom) / 2,
      glyphH = scene.focusGlyphHeight || Math.min(fh, fw);
    var ratios = {
      'silk-orbit': 0.69,
      'ribbon-swoosh': 0.86,
      'petal-curve': 0.67,
      'diamond-curve': 0.57,
      'corner-stars': 0.53,
      'crescent-frame': 0.54,
      'comet-arc': 0.76,
      'stitch-curve': 0.78,
      'aurora-dots': 0.49,
      'twinkle-field': 0.46,
      'pearl-drift': 0.47,
      'leaf-pair': 0.61
    };
    var compact = /^(corner-stars|aurora-dots|twinkle-field|pearl-drift)$/.test(item.name);
    var length = compact
      ? clamp(glyphH * 0.62 * Math.sqrt(size), 30 * u, 68 * u)
      : Math.min(fw * clamp(ratios[item.name] * Math.sqrt(size), 0.45, 0.9), glyphH * 1.85);
    var depth = Math.max(2 * u, Math.min(glyphH * 0.18, length * 0.26)),
      spark = Math.max(2 * u, Math.min(glyphH * 0.105, length * 0.18, 9 * u));
    var margin = Math.min(w, h) * 0.018,
      minX = scene.safeSide === 'right' ? w * 0.58 : margin,
      maxX = scene.safeSide === 'left' ? w * 0.42 : w - margin;
    var upper =
        /^(silk-orbit|diamond-curve|corner-stars|comet-arc|aurora-dots|twinkle-field)$/.test(
          item.name
        ),
      edges = [
        upper ? 'top' : 'bottom',
        upper ? 'bottom' : 'top',
        scene.safeSide === 'right' ? 'right' : 'left',
        scene.safeSide === 'right' ? 'left' : 'right'
      ];
    if (compact)
      edges = [
        scene.safeSide === 'right' ? 'right' : 'left',
        upper ? 'top' : 'bottom',
        upper ? 'bottom' : 'top',
        scene.safeSide === 'right' ? 'left' : 'right'
      ];
    else if (fh > fw * 1.6)
      edges = [
        scene.safeSide === 'right' ? 'right' : 'left',
        upper ? 'top' : 'bottom',
        upper ? 'bottom' : 'top',
        scene.safeSide === 'right' ? 'left' : 'right'
      ];
    var shifts = [0.24, -0.28, 0],
      scales = [1, 0.82, 0.65],
      gap = Math.max(1.5 * u, Math.min(4 * u, glyphH * 0.035)),
      pad = Math.max(0.5, u * 0.5),
      siblings = scene.items || [],
      envelopes = {};
    // Search close to the measured focus, then shorten or switch edge. The envelope
    // includes all animated tips, so ornaments cannot drift onto neighbouring text.
    for (k = 0; k < scales.length && !choice; k++)
      for (i = 0; i < edges.length && !choice; i++)
        for (j = 0; j < shifts.length && !choice; j++) {
          edge = edges[i];
          var vertical = edge === 'left' || edge === 'right',
            len = Math.min(length * scales[k], vertical ? fh * 0.86 : length),
            dep = Math.min(depth * scales[k], len * 0.26),
            rad = Math.min(spark * scales[k], len * 0.18);
          var span = {
            u: u,
            length: len,
            depth: dep,
            spark: rad,
            angle: vertical && !compact ? Math.PI / 2 : 0,
            flip: edge === 'bottom' || edge === 'left' ? -1 : 1,
            visible: 1
          };
          var key = k + '-' + edge,
            env = envelopes[key] || (envelopes[key] = ornamentEnvelope(item.name, span, compact));
          var halfW = env.halfW,
            halfH = env.halfH,
            x,
            y;
          if (vertical) {
            x = edge === 'left' ? b.left - gap - halfW : b.right + gap + halfW;
            y = cy + shifts[j] * fh;
          } else {
            x = cx + shifts[j] * fw;
            y = edge === 'top' ? b.top - gap - halfH : b.bottom + gap + halfH;
          }
          if (halfW * 2 > maxX - minX || halfH * 2 > h - margin * 2) continue;
          x = clamp(x, minX + halfW, maxX - halfW);
          y = clamp(y, margin + halfH, h - margin - halfH);
          var box = { left: x - halfW, right: x + halfW, top: y - halfH, bottom: y + halfH },
            blocked = overlaps(box, b, pad),
            n;
          for (n = 0; n < boxes.length && !blocked; n++)
            if (validBounds(boxes[n]) && overlaps(box, boxes[n], pad)) blocked = true;
          for (n = 0; n < siblings.length && !blocked; n++) {
            if (siblings[n] === item) break;
            if (siblings[n].motifBounds && overlaps(box, siblings[n].motifBounds, pad * 2))
              blocked = true;
          }
          if (!blocked) choice = { x: x - env.offsetX, y: y - env.offsetY, box: box, span: span };
        }
    // A crowded keyword may have no free edge. Preserve topology without drawing
    // an ornament over a small lyric or shifting it into the central picture.
    if (!choice)
      choice = {
        x: cx,
        y: cy,
        box: null,
        span: {
          u: u,
          length: length * 0.65,
          depth: depth * 0.65,
          spark: spark * 0.65,
          angle: 0,
          flip: 1,
          visible: 0
        }
      };
    item.x = choice.x;
    item.y = choice.y;
    item.fitScale = 1;
    item.surround = true;
    item.behind = true;
    item.tilt = 0;
    item.motifBounds = choice.box;
    item.surroundSpan = choice.span;
    item.stroke = Math.max(1, 1.7 * u);
    item.alpha = Math.max(item.alpha || 0, 0.9);
    item.maxW = choice.box ? choice.box.right - choice.box.left : length;
    item.maxH = choice.box ? choice.box.bottom - choice.box.top : 2 * (depth + spark);
    item.paths = specialPaths(scene, item, 0);
    return true;
  }
  function specialState(scene, item, t) {
    var d = Math.max(0.08, scene.duration || 4),
      lag = item.lag || 0,
      span = Math.min(0.82, d * 0.27),
      exit = Math.min(0.72, d * 0.24),
      a = clamp((t - lag) / span, 0, 1),
      b = clamp((t - (d - exit)) / exit, 0, 1);
    var entered = 1 - Math.pow(1 - a, 3),
      left = b * b * (3 - 2 * b),
      intensity = scene.intensity == null ? 0.5 : scene.intensity,
      fit = item.fitScale || 1,
      opacity = scene.opacity == null ? 1 : scene.opacity;
    return {
      x: item.x,
      y: item.y,
      scale: fit,
      scaleX: fit,
      scaleY: fit,
      rotation: isSurround(item.name) ? 0 : item.tilt || 0,
      opacity: entered * (1 - left) * (item.alpha == null ? 0.7 : item.alpha) * opacity,
      blur: 0,
      trimStart: 0,
      trimEnd: intensity > 0 ? entered * (1 - left) : 1,
      power: intensity > 0 ? 0.5 + intensity * 0.5 : 0,
      phase: t * (0.65 + intensity * 0.35)
    };
  }
  function make(kind, size, legacy) {
    if (isNew(kind))
      return specialPaths({ unit: size, intensity: 0.5, duration: 4 }, { name: kind }, 0);
    var p = [],
      i,
      a,
      x,
      y,
      part;
    if (kind === 'echo-rings') {
      p.push(circle(9, 0, 0, 0, 360), circle(17, 0, 0, 0, 360));
    } else if (kind === 'dash-trail')
      for (i = 0; i < 4; i++)
        p.push(
          line([
            [-23 + i * 13, 0],
            [-17 + i * 13, 0]
          ])
        );
    else if (kind === 'ray-burst')
      for (i = 0; i < 7; i++) {
        a = (i * Math.PI * 2) / 7;
        p.push(
          line([
            [Math.cos(a) * 7, Math.sin(a) * 7],
            [Math.cos(a) * 18, Math.sin(a) * 18]
          ])
        );
      }
    else if (kind === 'dust' || kind === 'orbit-dots' || kind === 'grid-dots') {
      for (i = 0; i < (kind === 'grid-dots' ? 9 : 5); i++) {
        a = i * 2.4;
        x = kind === 'grid-dots' ? ((i % 3) - 1) * 10 : Math.cos(a) * (10 + i * 3);
        y = kind === 'grid-dots' ? (Math.floor(i / 3) - 1) * 10 : Math.sin(a) * (10 + i * 3);
        part = circle(i % 2 ? 1.3 : 2, x, y, 0, 360);
        part.fill = true;
        p.push(part);
      }
    } else if (kind === 'shooting-star') {
      p.push(
        line([
          [-24, 6],
          [-9, 2],
          [3, -2]
        ])
      );
      p.push(
        line(
          [
            [9, -11],
            [11, -4],
            [18, -2],
            [11, 0],
            [9, 7],
            [7, 0],
            [0, -2],
            [7, -4]
          ],
          true
        )
      );
    } else if (kind === 'flower')
      for (i = 0; i < 5; i++) {
        a = (i * Math.PI * 2) / 5;
        p.push(
          line(
            [
              [0, 0],
              [Math.cos(a - 0.25) * 12, Math.sin(a - 0.25) * 12],
              [Math.cos(a) * 20, Math.sin(a) * 20],
              [Math.cos(a + 0.25) * 12, Math.sin(a + 0.25) * 12]
            ],
            true
          )
        );
      }
    else if (kind === 'diamond-pair' || kind === 'triangles') {
      for (i = 0; i < 2; i++) {
        x = i * 12 - 6;
        p.push(
          kind === 'triangles'
            ? line(
                [
                  [x, -13],
                  [x + 11, 8],
                  [x - 11, 8]
                ],
                true
              )
            : line(
                [
                  [x, -15],
                  [x + 8, 0],
                  [x, 15],
                  [x - 8, 0]
                ],
                true
              )
        );
      }
    } else if (kind === 'wave-line' || kind === 'scribble') {
      var pts = [];
      for (i = 0; i < 19; i++)
        pts.push([
          i * 3 - 27,
          kind === 'wave-line'
            ? Math.sin(i * 0.65) * 5
            : Math.sin(i * 0.91) * 2 + Math.cos(i * 0.37) * 3
        ]);
      p.push(line(pts));
      if (kind === 'scribble')
        p.push(
          line([
            [-22, 8],
            [20, 5]
          ])
        );
    } else if (kind === 'scan-bracket') {
      p.push(
        line([
          [-10, -13],
          [-18, -13],
          [-18, 13],
          [-10, 13]
        ]),
        line([
          [10, -13],
          [18, -13],
          [18, 13],
          [10, 13]
        ])
      );
    } else if (kind === 'equalizer')
      for (i = 0; i < 5; i++)
        p.push(
          line([
            [i * 7 - 14, 10],
            [i * 7 - 14, -(4 + (i % 3) * 5)]
          ])
        );
    else if (kind === 'underline') {
      p.push(
        line([
          [-27, 0],
          [27, 0]
        ]),
        line([
          [-17, 6],
          [14, 6]
        ])
      );
    } else if (kind === 'arrow') {
      p.push(
        line([
          [-24, 0],
          [22, 0]
        ]),
        line([
          [13, -7],
          [22, 0],
          [13, 7]
        ])
      );
    } else if (kind === 'compass') {
      p.push(
        circle(16, 0, 0, 0, 360),
        line([
          [0, -20],
          [0, 20]
        ]),
        line([
          [-20, 0],
          [20, 0]
        ]),
        line([
          [-6, 5],
          [6, -5]
        ])
      );
    } else if (kind === 'spark-cluster' || kind === 'star-trail') {
      for (i = 0; i < 3; i++) {
        x = i * 17 - 17;
        y = kind === 'star-trail' ? -i * 6 + 6 : i % 2 ? -8 : 5;
        var r = i === 1 ? 8 : 4;
        p.push(
          line(
            [
              [x, y - r],
              [x + 2, y - 2],
              [x + r, y],
              [x + 2, y + 2],
              [x, y + r],
              [x - 2, y + 2],
              [x - r, y],
              [x - 2, y - 2]
            ],
            true
          )
        );
      }
    } else if (kind === 'ripple-arc') {
      p.push(circle(12, 0, 0, -50, 155), circle(19, 0, 0, 125, 310));
    } else if (kind === 'pulse-cross') {
      p.push(
        line([
          [-16, 0],
          [16, 0]
        ]),
        line([
          [0, -16],
          [0, 16]
        ]),
        circle(6, 0, 0, 0, 360)
      );
    } else if (kind === 'orbit-quad') {
      p.push(circle(16, 0, 0, 0, 360));
      for (i = 0; i < 4; i++) {
        a = (i * Math.PI) / 2;
        x = Math.cos(a) * 16;
        y = Math.sin(a) * 16;
        p.push(
          line(
            [
              [x - 2, y - 2],
              [x + 2, y - 2],
              [x + 2, y + 2],
              [x - 2, y + 2]
            ],
            true,
            true
          )
        );
      }
    } else return legacy(kind, size);
    for (i = 0; i < p.length; i++)
      for (var j = 0; j < p[i].points.length; j++) {
        p[i].points[j][0] *= size;
        p[i].points[j][1] *= size;
      }
    return p;
  }
  function state(scene, item, t) {
    if (isNew(item.name || '')) return specialState(scene, item, t);
    var d = scene.duration,
      lag = item.lag || 0,
      a = Math.max(0, Math.min(1, (t - lag) / Math.min(0.65, d * 0.25))),
      b = Math.max(0, Math.min(1, (t - (d - Math.min(0.6, d * 0.23))) / Math.min(0.6, d * 0.23)));
    var power = scene.intensity > 0 ? 0.6 + scene.intensity * 0.6 : 0,
      name = item.name || 'dash',
      cycle = t * (1.8 + scene.intensity),
      draw = 1 - Math.pow(1 - a, 3),
      scale = 1,
      rotation = item.tilt || 0,
      dx = 0,
      dy = 0,
      opacity = (a > 0 ? 1 : 0) * (1 - b);
    if (/ring|orbit|arc|compass|flower/.test(name)) rotation += t * 22 * power;
    if (/spark|star|diamond|cross|dot|petal/.test(name)) {
      scale = 1 + Math.sin(cycle * 2) * 0.15 * power;
      opacity *= 1 + (-0.28 + 0.28 * Math.pow(Math.sin(cycle + 1), 2)) * power;
    }
    if (/trail|arrow/.test(name)) dx = Math.sin(cycle) * 6 * power * scene.unit;
    if (/dust|petal/.test(name)) dy = -Math.sin(cycle * 0.8) * 6 * power * scene.unit;
    return {
      x: item.x + dx,
      y: item.y + dy,
      scale: scale * (item.fitScale || 1),
      scaleX: scale * (item.fitScale || 1),
      scaleY: scale * (item.fitScale || 1),
      rotation: rotation,
      opacity: opacity * (item.alpha == null ? 0.7 : item.alpha) * scene.opacity,
      blur: 0,
      trimStart: b,
      trimEnd: Math.max(b, draw),
      power: power,
      phase: cycle
    };
  }
  function paths(scene, item, t) {
    if (isNew(item.name || '')) return specialPaths(scene, item, t);
    var source = item.paths || [],
      out = [],
      state = stateFor(scene, item, t),
      name = item.name || '',
      u = scene.unit;
    for (var i = 0; i < source.length; i++) {
      var part = source[i],
        pts = [],
        factor = 1,
        angle = 0,
        dx = 0,
        dy = 0;
      if (/echo-rings|ray-burst|pulse-cross/.test(name))
        factor = 1 + Math.sin(state.phase * 1.5 - i * 0.9) * 0.16 * state.power;
      if (name === 'equalizer')
        factor = 1 + (-0.35 + 0.35 * Math.sin(state.phase * 3 + i * 1.2)) * state.power;
      if (name === 'dust') {
        dx = Math.sin(state.phase * 0.6 + i) * 5 * state.power * u;
        dy = Math.cos(state.phase * 0.8 + i * 1.7) * 9 * state.power * u;
      }
      if (name === 'orbit-dots') angle = t * (i % 2 ? -0.7 : 0.55) * state.power;
      if (name === 'diamond-pair' || name === 'scan-bracket')
        dx = (i % 2 ? 1 : -1) * Math.sin(state.phase) * 4 * state.power * u;
      if (name === 'spark-cluster' || name === 'star-trail')
        factor = 1 + Math.sin(state.phase * 2 + i * 2) * 0.23 * state.power;
      for (var j = 0; j < part.points.length; j++) {
        var x = part.points[j][0],
          y = part.points[j][1];
        if (name === 'equalizer') y *= factor;
        else {
          x *= factor;
          y *= factor;
        }
        if (name === 'wave-line') y += Math.sin(j * 0.65 - state.phase * 1.4) * 3 * state.power * u;
        pts.push([
          x * Math.cos(angle) - y * Math.sin(angle) + dx,
          x * Math.sin(angle) + y * Math.cos(angle) + dy
        ]);
      }
      out.push({ points: pts, closed: part.closed, fill: part.fill });
    }
    return out;
  }
  function stateFor(scene, item, t) {
    return state(scene, item, t);
  }
  return {
    list: list,
    make: make,
    state: state,
    paths: paths,
    place: place,
    isSurround: isSurround,
    isAnimated: isAnimated
  };
})();

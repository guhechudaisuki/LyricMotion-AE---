/* exported LMMotion */
/* Reversible text choreography. A mask stays still while glyphs cross its boundary. ES3. */
var LMMotion = (function () {
  var list = [
    ['mask-up', '遮罩上揭'],
    ['mask-down', '遮罩下落'],
    ['mask-left', '遮罩左行'],
    ['mask-right', '遮罩右行'],
    ['mask-diagonal', '斜向揭幕'],
    ['mask-return', '揭开后原路收回'],
    ['wipe-x', '横向开合'],
    ['wipe-y', '纵向开合'],
    ['fold-x', '横轴翻起'],
    ['fold-y', '竖轴翻起'],
    ['spring', '弹性落字'],
    ['wave', '逐字波浪'],
    ['spread', '字距展开'],
    ['gather', '字距聚拢'],
    ['swing', '摆动归位'],
    ['roll', '旋入旋出'],
    ['blur-rise', '失焦浮现'],
    ['blur-slide', '柔焦横移'],
    ['type', '逐字点亮'],
    ['bounce', '短拍弹入'],
    ['drift-up', '缓升停留'],
    ['float', '轻浮显隐'],
    ['snap', '短促切入'],
    ['fade', '柔和淡入'],
    ['parallax', '错层接句'],
    ['hinge', '书页转入'],
    ['compress', '收幅展开'],
    ['glide-arc', '弧线落位']
  ];
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }
  function ease(v) {
    return 1 - Math.pow(1 - v, 3);
  }
  function masked(id) {
    return id.indexOf('mask-') === 0 || id === 'wipe-x' || id === 'wipe-y';
  }
  function timing(scene, item) {
    var enterSpan =
      item.enterSpan == null
        ? scene.enterSpan == null
          ? scene.duration * 0.35
          : scene.enterSpan
        : item.enterSpan;
    var exitSpan =
      item.exitSpan == null
        ? scene.exitSpan == null
          ? scene.duration * 0.3
          : scene.exitSpan
        : item.exitSpan;
    return {
      lag: item.lag || 0,
      enterSpan: enterSpan,
      exitStart: item.exitStart == null ? scene.duration - exitSpan : item.exitStart,
      exitSpan: exitSpan
    };
  }
  function sample(scene, item, t) {
    var clock = timing(scene, item),
      lag = clock.lag,
      span = clock.enterSpan,
      out = clock.exitSpan,
      exitStart = clock.exitStart;
    var a = clamp((t - lag) / Math.max(0.000001, span), 0, 1),
      b = clamp((t - exitStart) / Math.max(0.000001, out), 0, 1);
    var ea = ease(a),
      eb = b * b * (3 - 2 * b),
      amt = scene.intensity,
      active = amt > 0,
      energy = active ? 0.62 + amt * 0.65 : 0;
    var m = item.motion || 'fade',
      s = item.fitScale || 1,
      u = scene.unit,
      dx = 0,
      dy = 0,
      sx = 1,
      sy = 1,
      rot = item.tilt || 0,
      blur = 0,
      opacity = ea * (1 - eb);
    var bw = item.boxW || item.maxW || item.width || 40 * u,
      bh = item.boxH || item.maxH || item.height || 40 * u,
      pad = 4 * u;
    var clip = masked(m),
      clipW = bw + pad * 2,
      clipH = bh + pad * 2,
      travelX = (clipW + pad) * s,
      travelY = (clipH + pad) * s;
    if (clip && active) {
      opacity = a > 0 && b < 1 ? 1 : 0;
      if (m === 'mask-up' || m === 'mask-return')
        dy = (1 - ea) * travelY + (m === 'mask-return' ? eb : -eb) * travelY;
      if (m === 'mask-down') dy = -(1 - ea) * travelY + eb * travelY;
      if (m === 'mask-left') dx = (1 - ea) * travelX - eb * travelX;
      if (m === 'mask-right') dx = -(1 - ea) * travelX + eb * travelX;
      if (m === 'mask-diagonal') {
        dx = -(1 - ea + eb) * travelX * 0.55;
        dy = (1 - ea - eb) * travelY;
      }
      if (m === 'wipe-x') clipW *= Math.max(0.001, ea * (1 - eb));
      if (m === 'wipe-y') clipH *= Math.max(0.001, ea * (1 - eb));
    } else {
      if (m === 'rise' || m === 'drift-up' || m === 'blur-rise')
        dy = ((1 - ea) * 38 - eb * 22) * energy * u;
      if (m === 'fall') dy = (-(1 - ea) * 36 + eb * 22) * energy * u;
      if (m === 'slide' || m === 'blur-slide') dx = (-(1 - ea) * 46 + eb * 32) * energy * u;
      if (m === 'slideR') dx = ((1 - ea) * 46 - eb * 32) * energy * u;
      if (m === 'mist' || m === 'blur-slide' || m === 'blur-rise') {
        blur = ((1 - ea) * 9 + eb * 6) * energy * u;
        if (m === 'mist') dx = (-(1 - ea) * 18 + eb * 12) * energy * u;
      }
      if (m === 'fold-x') {
        sy = 1 - ((1 - ea) * 0.96 * energy) / 1.27;
        rot += (1 - ea) * -9 * energy;
        dy = (1 - ea) * 16 * energy * u;
      }
      if (m === 'fold-y') {
        sx = 1 - ((1 - ea) * 0.96 * energy) / 1.27;
        rot += (1 - ea) * 8 * energy;
      }
      if (m === 'spring' || m === 'bounce' || m === 'pop') {
        var spring = 1 - Math.exp(-a * 6) * Math.cos(a * Math.PI * 2.5);
        dy = (1 - spring) * 32 * energy * u;
        sx = sy = 1 + (spring - 1) * 0.22 * energy - eb * 0.13 * energy;
      }
      if (m === 'wave')
        dy =
          ((1 - ea) * Math.sin((item.order || 0) * 0.75 + 1) * 32 +
            Math.sin(a * Math.PI * 2 + (item.order || 0) * 0.65) * Math.sin(a * Math.PI) * 8 -
            eb * Math.sin((item.order || 0) * 0.75 + 1) * 18) *
          energy *
          u;
      if (m === 'float') {
        dy = ((1 - ea) * 18 - eb * 14) * energy * u;
        sx = sy = 1 - (1 - ea) * 0.035 * energy - eb * 0.025 * energy;
      }
      if (m === 'spread' || m === 'gather')
        dx = (item.spread || 0) * (m === 'spread' ? -1 : 1) * (1 - ea + eb) * energy;
      if (m === 'swing' || m === 'pivot')
        rot += Math.sin(a * Math.PI * 1.5) * (1 - a) * 16 * energy + eb * 5 * energy;
      if (m === 'roll') {
        rot += (1 - ea) * -24 * energy + eb * 18 * energy;
        dx = (-(1 - ea) * 18 + eb * 20) * energy * u;
      }
      if (m === 'type') {
        opacity = (a > 0 ? 1 : 0) * (b < 0.7 ? 1 : 0);
      }
      if (m === 'step') {
        opacity = (Math.floor(a * 4) / 4) * (1 - eb);
        dy = (1 - Math.floor(a * 4) / 4) * 18 * energy * u;
      }
      if (m === 'snap') {
        dx = -(1 - ease(clamp(a * 1.9, 0, 1))) * 38 * energy * u;
        sx = sy = 1 + (1 - ea) * 0.05 * energy;
      }
      if (m === 'settle') sx = sy = 1 - (1 - ea) * 0.16 * energy;
      if (m === 'parallax') {
        var side = item.x < scene.width * 0.5 ? -1 : 1;
        dx = side * ((1 - ea) * 48 + eb * 33) * energy * u;
        dy = ((1 - ea) * 12 - eb * 8) * energy * u;
        sx = sy = 1 + (1 - ea) * 0.045 * energy - eb * 0.035 * energy;
      }
      if (m === 'hinge') {
        rot += ((1 - ea) * -13 + eb * 10) * energy;
        dx = (-(1 - ea) * 20 + eb * 14) * energy * u;
        dy = ((1 - ea) * 14 - eb * 9) * energy * u;
      }
      if (m === 'compress') {
        sx = 1 - (1 - ea) * 0.32 * energy - eb * 0.2 * energy;
        sy = 1 + (1 - ea) * 0.09 * energy - eb * 0.07 * energy;
        dx = ((1 - ea) * 20 - eb * 12) * energy * u;
      }
      if (m === 'glide-arc') {
        dx = (-(1 - ea) * 44 + eb * 37) * energy * u;
        dy = ((1 - ea) * 25 - eb * 20) * energy * u;
        rot += ((1 - ea) * -5 + eb * 4) * energy;
      }
      if (scene.exitMotion === 'slide') dx += eb * 24 * energy * u;
      if (scene.exitMotion === 'drift') dy -= eb * 18 * energy * u;
      if (scene.exitMotion === 'shrink') {
        sx *= 1 - eb * 0.14 * energy;
        sy *= 1 - eb * 0.14 * energy;
      }
    }
    // A selected recipe exit replaces the entry's paired exit, including mask exits.
    // Keep the full resting mask so Canvas and AE share the same static boundary.
    if (scene.exitOverride && b > 0) {
      dx = 0;
      dy = 0;
      sx = sy = 1;
      rot = item.tilt || 0;
      blur = 0;
      opacity = 1 - eb;
      clipW = bw + pad * 2;
      clipH = bh + pad * 2;
      if (scene.exitMotion === 'slide') dx = eb * 24 * energy * u;
      if (scene.exitMotion === 'drift') dy = -eb * 18 * energy * u;
      if (scene.exitMotion === 'shrink') sx = sy = 1 - eb * 0.14 * energy;
    }
    // Keep the visible glyph envelope beside the picture throughout unmasked motion.
    // Masked text is already confined by its stationary, fitted mask.
    if (scene.safeSide && !clip) {
      var angle = (rot * Math.PI) / 180,
        halfWidth =
          ((Math.abs(Math.cos(angle)) * bw * Math.max(0.02, sx) +
            Math.abs(Math.sin(angle)) * bh * Math.max(0.02, sy)) *
            s) /
            2 +
          blur * 2;
      if (scene.safeSide === 'left') dx = Math.min(dx, scene.width * 0.42 - item.x - halfWidth);
      else dx = Math.max(dx, scene.width * 0.58 - item.x + halfWidth);
    }
    return {
      x: item.x + dx,
      y: item.y + dy,
      opacity: opacity * (item.alpha == null ? 1 : item.alpha) * scene.opacity,
      scale: s,
      scaleX: Math.max(0.02, sx) * s,
      scaleY: Math.max(0.02, sy) * s,
      rotation: rot,
      blur: blur,
      clip: clip,
      clipW: clipW,
      clipH: clipH
    };
  }
  return { list: list, masked: masked, timing: timing, sample: sample };
})();

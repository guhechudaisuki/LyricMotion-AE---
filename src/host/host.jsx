/* eslint no-control-regex: off -- Deliberate control-character sanitization and ASCII bridge checks. */
/* exported LMHost */
/* LyricMotion native host. Invoked only from the panel inside After Effects. */
var LMHost = (function () {
  var job = null,
    lastComp = null,
    lastResult = null,
    lastProject = null,
    version = '1.5.2';
  var renderChoice = null,
    renderSequence = 0;
  function unicodeEscape(c) {
    var h = c.charCodeAt(0).toString(16);
    while (h.length < 4) h = '0' + h;
    return '\\u' + h;
  }
  // CEP and ExtendScript eval may cross a legacy system code page. Keep JSON ASCII.
  function quote(s) {
    return (
      '"' +
      String(s).replace(/[\\"\x00-\x1f\x7f-\uffff]/g, function (c) {
        var m = { '"': '\\"', '\\': '\\\\', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
        return m[c] || unicodeEscape(c);
      }) +
      '"'
    );
  }
  function stringify(v) {
    var t = typeof v,
      out = [],
      i;
    if (v === null || t === 'undefined') return 'null';
    if (t === 'string') return quote(v);
    if (t === 'number') return isFinite(v) ? String(v) : 'null';
    if (t === 'boolean') return String(v);
    if (v instanceof Array) {
      for (i = 0; i < v.length; i++) out.push(stringify(v[i]));
      return '[' + out.join(',') + ']';
    }
    for (i in v)
      if (Object.prototype.hasOwnProperty.call(v, i) && typeof v[i] !== 'function')
        out.push(quote(i) + ':' + stringify(v[i]));
    return '{' + out.join(',') + '}';
  }
  function parse(s) {
    s = String(s).replace(/^\uFEFF/, '');
    if (
      /^[\],:{}\s]*$/.test(
        s
          .replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@')
          .replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?/g, ']')
          .replace(/(?:^|:|,)(?:\s*\[)+/g, '')
      )
    )
      return eval('(' + s.replace(/[\x7f-\uffff]/g, unicodeEscape) + ')');
    throw new Error('数据格式无效');
  }
  function readJSON(file) {
    var f = File(file);
    if (!f.exists) throw new Error('找不到方案文件');
    f.encoding = 'UTF-8';
    if (!f.open('r')) throw new Error('无法读取方案文件');
    var s;
    try {
      s = f.read();
    } finally {
      f.close();
    }
    return parse(s);
  }
  function safeName(s) {
    // ExtendScript's regex lexer rejects an unescaped / inside a character class.
    var text = String(s || '歌词'),
      forbidden = '\\/:*?"<>|',
      out = '',
      i,
      ch;
    for (i = 0; i < text.length && i < 90; i++) {
      ch = text.charAt(i);
      out += text.charCodeAt(i) < 32 || forbidden.indexOf(ch) >= 0 ? '_' : ch;
    }
    return out;
  }
  function rgb(hex) {
    return [
      parseInt(hex.substr(1, 2), 16) / 255,
      parseInt(hex.substr(3, 2), 16) / 255,
      parseInt(hex.substr(5, 2), 16) / 255
    ];
  }
  function xf(l, name) {
    return l.property('ADBE Transform Group').property(name);
  }
  function activeComp() {
    var c = app.project && app.project.activeItem;
    if (!(c instanceof CompItem)) throw new Error('请先打开一个 AE 合成');
    return c;
  }
  function itemById(id) {
    for (var i = 1; app.project && i <= app.project.numItems; i++)
      if (app.project.item(i).id === id) return app.project.item(i);
    return null;
  }
  function warn(s) {
    if (!job) return;
    for (var i = 0; i < job.warnings.length; i++) if (job.warnings[i] === s) return;
    if (job.warnings.length < 30) job.warnings.push(s);
  }
  function addText(comp, item) {
    var l = comp.layers.addText(item.text),
      source = l.property('ADBE Text Properties').property('ADBE Text Document'),
      d = source.value;
    d.resetCharStyle();
    d.resetParagraphStyle();
    d.text = item.text;
    d.fontSize = item.size;
    d.applyFill = true;
    d.applyStroke = false;
    d.fillColor = rgb(item.color);
    d.justification =
      item.align === 'left'
        ? ParagraphJustification.LEFT_JUSTIFY
        : item.align === 'right'
          ? ParagraphJustification.RIGHT_JUSTIFY
          : ParagraphJustification.CENTER_JUSTIFY;
    try {
      d.font = item.font;
    } catch (e) {
      warn('字体不可用：' + item.font);
    }
    d.tracking = item.tracking;
    d.autoLeading = false;
    d.leading = item.size * 1.3;
    source.setValue(d);
    var rect = l.sourceRectAtTime(0, false),
      fit = Math.min(1, item.maxW / Math.max(1, rect.width), item.maxH / Math.max(1, rect.height));
    if (fit < 1) {
      d = source.value;
      d.fontSize *= fit;
      d.leading *= fit;
      source.setValue(d);
      rect = l.sourceRectAtTime(0, false);
    }
    xf(l, 'ADBE Anchor Point').setValue([rect.left + rect.width / 2, rect.top + rect.height / 2]);
    l.name = item.text.replace(/\n/g, ' ').substr(0, 55);
    l.comment = 'LyricMotion · 可编辑文字';
    return l;
  }
  function addHighlights(l, item) {
    if (!item.highlights || !item.highlights.length) return;
    for (var i = 0; i < item.highlights.length; i++) {
      var animators = l.property('ADBE Text Properties').property('ADBE Text Animators');
      var a = animators.addProperty('ADBE Text Animator');
      a.name = '映词 · 关键词高亮';
      var animatorIndex = a.propertyIndex;
      a.property('ADBE Text Animator Properties')
        .addProperty('ADBE Text Fill Color')
        .setValue(rgb(item.highlightColor));
      a = l
        .property('ADBE Text Properties')
        .property('ADBE Text Animators')
        .property(animatorIndex);
      var selectors = a.property('ADBE Text Selectors');
      var s = selectors.numProperties
        ? selectors.property(1)
        : selectors.addProperty('ADBE Text Selector');
      s.property('ADBE Text Range Advanced').property('ADBE Text Range Units').setValue(2);
      s.property('ADBE Text Index Start').setValue(item.highlights[i][0]);
      s.property('ADBE Text Index End').setValue(item.highlights[i][1]);
      var smooth = s.property('ADBE Text Range Advanced').property('ADBE Text Selector Smoothness');
      if (smooth) smooth.setValue(0);
    }
  }
  function applyRecipeFFX(comp, layer, record, atTime, keepTransforms) {
    var f = File(record.path);
    if (!f.exists) {
      warn('预设不在原位置：' + record.name);
      return false;
    }
    var tp = layer.property('ADBE Text Properties'),
      doc = tp ? tp.property('ADBE Text Document').value : null;
    var anchor = xf(layer, 'ADBE Anchor Point').value,
      previousTime = comp.time,
      names = ['ADBE Position', 'ADBE Scale', 'ADBE Rotate Z', 'ADBE Opacity', 'ADBE Anchor Point'],
      applied = false;
    try {
      for (var i = 1; i <= comp.numLayers; i++) comp.layer(i).selected = false;
      layer.selected = true;
      comp.time = atTime || 0;
      layer.applyPreset(f);
      applied = true;
    } catch (e) {
      warn('预设未能完整应用：' + record.name + ' · ' + e.toString());
    } finally {
      layer.threeDLayer = false;
      if (doc) {
        var source = layer.property('ADBE Text Properties').property('ADBE Text Document');
        while (source.numKeys) source.removeKey(source.numKeys);
        if (source.canSetExpression) source.expression = '';
        source.setValue(doc);
      }
      if (!keepTransforms) {
        for (var k = 0; k < names.length; k++) {
          var prop = xf(layer, names[k]);
          if (prop.canSetExpression) prop.expression = '';
          if (prop.isSeparationLeader && prop.dimensionsSeparated) prop.dimensionsSeparated = false;
          while (prop.numKeys) prop.removeKey(prop.numKeys);
        }
        xf(layer, 'ADBE Anchor Point').setValue(anchor);
      }
      layer.selected = false;
      comp.time = previousTime;
    }
    return applied;
  }
  function recipePhase(record) {
    if (record.phase === 'in' || record.phase === 'out' || record.phase === 'mid')
      return record.phase;
    var name = String(record.path || record.name || '').replace(/^.*[\\\/]/, '');
    return /^OUT_/i.test(name) ? 'out' : /^IN_/i.test(name) ? 'in' : 'mid';
  }
  function recipePairKey(record) {
    if (record.pairKey) return record.pairKey;
    var path = String(record.path || '')
      .replace(/\\/g, '/')
      .toLowerCase();
    return (
      path.replace(/[^\/]*$/, '') +
      path
        .replace(/^.*\//, '')
        .replace(/\.ffx$/i, '')
        .replace(/^(in_|out_)/i, '')
    );
  }
  function applyRecipePair(comp, layer, pool, scene, index, keepTransforms, outAt) {
    if (!pool.length) return false;
    var primary = [],
      outgoing = [],
      i,
      main,
      pair = null,
      applied = false;
    for (i = 0; i < pool.length; i++)
      (recipePhase(pool[i]) === 'out' ? outgoing : primary).push(pool[i]);
    if (primary.length) {
      main = primary[Math.floor(LMCore.random(job.p.seed, index, 301) * primary.length)];
      var key = recipePairKey(main);
      for (i = 0; i < outgoing.length; i++)
        if (recipePairKey(outgoing[i]) === key) {
          pair = outgoing[i];
          break;
        }
      applied = applyRecipeFFX(comp, layer, main, 0, keepTransforms) || applied;
    } else pair = outgoing[Math.floor(LMCore.random(job.p.seed, index, 301) * outgoing.length)];
    if (pair)
      applied =
        applyRecipeFFX(
          comp,
          layer,
          pair,
          outAt == null
            ? Math.max(0, scene.duration - Math.min(0.8, scene.duration * 0.25))
            : outAt,
          keepTransforms
        ) || applied;
    return applied;
  }
  function recipeAsset(comp, record, scene) {
    var key = record.path + '|' + (record.compName || ''),
      source = job.assets[key],
      i;
    if (!source) {
      var file = File(record.path);
      if (!file.exists) {
        warn('字旁素材不在原位置：' + record.name);
        return;
      }
      source = app.project.importFile(new ImportOptions(file));
      source.parentFolder = job.folder;
      if (source instanceof FolderItem) {
        var candidates = [];
        for (i = 1; i <= app.project.numItems; i++) {
          var it = app.project.item(i);
          if (
            it instanceof CompItem &&
            inside(it, source) &&
            (!record.compName || it.name === record.compName)
          )
            candidates.push(it);
        }
        if (candidates.length !== 1)
          throw new Error('请在风格集合中重新选择 AEP 内的合成：' + record.name);
        source = candidates[0];
      }
      job.assets[key] = source;
    }
    var scale = ((comp.width * 0.035) / Math.max(1, source.width)) * 100;
    var attachment = { width: (source.width * scale) / 100, height: (source.height * scale) / 100 };
    if (!LMLayout.placeDecoration(scene, attachment)) {
      warn('字旁空间不足，已跳过素材：' + record.name);
      return;
    }
    scale *= attachment.fitScale;
    var l = comp.layers.add(source);
    l.name = '字旁素材 · ' + record.name;
    l.startTime = 0;
    l.inPoint = 0;
    l.outPoint = Math.min(scene.duration, source.duration > 0 ? source.duration : scene.duration);
    l.audioEnabled = false;
    xf(l, 'ADBE Scale').setValue([scale, scale]);
    xf(l, 'ADBE Position').setValue([attachment.x, attachment.y]);
    var end = l.outPoint,
      span = Math.min(0.3, end / 3);
    xf(l, 'ADBE Opacity').setValuesAtTimes([0, span, end - span, end], [0, 55, 55, 0]);
    if (record.screen) l.blendingMode = BlendingMode.SCREEN;
  }
  function makeShape(part) {
    var shape = new Shape(),
      zeros = [],
      j;
    shape.vertices = part.points;
    shape.closed = !!part.closed;
    for (j = 0; j < part.points.length; j++) zeros.push([0, 0]);
    shape.inTangents = zeros;
    shape.outTangents = zeros;
    return shape;
  }
  function addShape(comp, item) {
    var l = comp.layers.addShape(),
      root = l.property('ADBE Root Vectors Group'),
      pathRefs = [];
    l.name = '字旁 · ' + (item.name || '短线');
    if (item.type === 'line') {
      var g = root.addProperty('ADBE Vector Group'),
        v = g.property('ADBE Vectors Group'),
        r = v.addProperty('ADBE Vector Shape - Rect');
      r.property('ADBE Vector Rect Size').setValue([item.width, item.height]);
      v.addProperty('ADBE Vector Graphic - Fill')
        .property('ADBE Vector Fill Color')
        .setValue(rgb(item.color));
    } else
      for (var i = 0; i < item.paths.length; i++) {
        var part = item.paths[i],
          group = l.property('ADBE Root Vectors Group').addProperty('ADBE Vector Group'),
          groupIndex = group.propertyIndex,
          vec = group.property('ADBE Vectors Group');
        var pathGroup = vec.addProperty('ADBE Vector Shape - Group'),
          pathIndex = pathGroup.propertyIndex;
        pathGroup.property('ADBE Vector Shape').setValue(makeShape(part));
        vec = l
          .property('ADBE Root Vectors Group')
          .property(groupIndex)
          .property('ADBE Vectors Group');
        var strokeIndex = 0;
        if (part.fill)
          vec
            .addProperty('ADBE Vector Graphic - Fill')
            .property('ADBE Vector Fill Color')
            .setValue(rgb(item.color));
        else {
          var stroke = vec.addProperty('ADBE Vector Graphic - Stroke');
          strokeIndex = stroke.propertyIndex;
          stroke.property('ADBE Vector Stroke Color').setValue(rgb(item.color));
          stroke
            .property('ADBE Vector Stroke Width')
            .setValue(item.stroke * (part.strokeScale == null ? 1 : part.strokeScale));
          stroke.property('ADBE Vector Stroke Line Cap').setValue(2);
          stroke.property('ADBE Vector Stroke Line Join').setValue(2);
        }
        l.property('ADBE Root Vectors Group')
          .property(groupIndex)
          .property('ADBE Vector Transform Group')
          .property('ADBE Vector Group Opacity')
          .setValue((part.opacity == null ? 1 : part.opacity) * 100);
        pathRefs.push({ group: groupIndex, path: pathIndex, stroke: strokeIndex });
      }
    var trim = l.property('ADBE Root Vectors Group').addProperty('ADBE Vector Filter - Trim');
    xf(l, 'ADBE Anchor Point').setValue([0, 0]);
    if (item.behind) l.moveToEnd();
    return { layer: l, paths: pathRefs, trim: trim.propertyIndex };
  }
  function sampleTimes(scene, item, shape) {
    var list = [0, scene.duration],
      i,
      n = shape ? 6 : 16;
    var timing = shape ? null : LMMotion.timing(scene, item);
    var span = shape ? Math.min(0.65, scene.duration * 0.25) : timing.enterSpan;
    var lag = timing ? timing.lag : item.lag || 0;
    var endSpan = shape ? Math.min(0.6, scene.duration * 0.23) : timing.exitSpan;
    var exitStart = shape ? scene.duration - endSpan : timing.exitStart;
    var exitDuration = endSpan;
    if (!shape) {
      list.push(Math.min(scene.duration, lag + span));
      list.push(Math.min(scene.duration, exitStart));
    }
    for (i = 0; i <= n; i++) {
      list.push(Math.min(scene.duration, lag + (span * i) / n));
      list.push(Math.min(scene.duration, exitStart + (exitDuration * i) / n));
    }
    if (item.motion === 'step')
      for (i = 1; i < 4; i++) list.push(Math.min(scene.duration, lag + (span * i) / 4));
    if (item.motion === 'type') {
      list.push(Math.min(scene.duration, lag + 0.0001));
      list.push(Math.min(scene.duration, exitStart + endSpan * 0.7));
    }
    if (shape) {
      var intervals = Math.min(480, Math.max(1, Math.ceil(scene.duration * 8)));
      for (i = 1; i < intervals; i++) list.push((scene.duration * i) / intervals);
    }
    list.sort(function (a, b) {
      return a - b;
    });
    var out = [],
      prev = -1;
    for (i = 0; i < list.length; i++)
      if (list[i] > prev + 0.000001) {
        prev = list[i];
        out.push(prev);
      }
    return out;
  }
  function setMotion(prop, times, values, stepEnd) {
    var same = true,
      a,
      b;
    for (a = 1; a < values.length; a++) {
      if (values[a] instanceof Array) {
        for (b = 0; b < values[a].length; b++)
          if (Math.abs(values[a][b] - values[0][b]) > 0.00001) same = false;
      } else if (Math.abs(values[a] - values[0]) > 0.00001) same = false;
    }
    if (same) prop.setValue(values[0]);
    else {
      prop.setValuesAtTimes(times, values);
      for (a = 1; a <= prop.numKeys; a++) {
        if (stepEnd != null && prop.keyTime(a) < stepEnd)
          prop.setInterpolationTypeAtKey(
            a,
            KeyframeInterpolationType.HOLD,
            KeyframeInterpolationType.HOLD
          );
        else
          prop.setInterpolationTypeAtKey(
            a,
            KeyframeInterpolationType.LINEAR,
            KeyframeInterpolationType.LINEAR
          );
      }
    }
  }
  function freezeHold(prop, start, end, holdIn, holdOut) {
    if (end <= start + 0.000001 || !prop.numKeys) return;
    for (var i = 1; i <= prop.numKeys; i++) {
      var t = prop.keyTime(i);
      if (Math.abs(t - start) < 0.000001)
        prop.setInterpolationTypeAtKey(
          i,
          holdIn ? KeyframeInterpolationType.HOLD : KeyframeInterpolationType.LINEAR,
          KeyframeInterpolationType.HOLD
        );
      if (Math.abs(t - end) < 0.000001)
        prop.setInterpolationTypeAtKey(
          i,
          KeyframeInterpolationType.HOLD,
          holdOut ? KeyframeInterpolationType.HOLD : KeyframeInterpolationType.LINEAR
        );
    }
  }
  function clipShape(anchor, w, h) {
    var s = new Shape(),
      x = anchor[0],
      y = anchor[1];
    s.vertices = [
      [x - w / 2, y - h / 2],
      [x + w / 2, y - h / 2],
      [x + w / 2, y + h / 2],
      [x - w / 2, y + h / 2]
    ];
    s.inTangents = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ];
    s.outTangents = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ];
    s.closed = true;
    return s;
  }
  function animateText(l, scene, item) {
    var times = sampleTimes(scene, item, false),
      positions = [],
      alphas = [],
      scales = [],
      rotations = [],
      blurs = [],
      clips = [],
      i,
      t,
      m;
    var timing = LMMotion.timing(scene, item);
    var enterEnd = timing.lag + timing.enterSpan,
      exitStart = timing.exitStart;
    var anchor = xf(l, 'ADBE Anchor Point').value,
      useClip = false,
      varyingClip = false,
      firstW = null,
      firstH = null;
    for (i = 0; i < times.length; i++) {
      t = times[i];
      m = LMMotion.sample(scene, item, t);
      var radians = (m.rotation * Math.PI) / 180,
        dx = m.x - item.x,
        dy = m.y - item.y,
        co = Math.cos(radians),
        si = Math.sin(radians);
      var sx = m.scaleX || m.scale || 1,
        sy = m.scaleY || m.scale || 1;
      positions.push([(co * dx + si * dy) / sx, (-si * dx + co * dy) / sy, 0]);
      alphas.push(m.opacity * 100);
      scales.push([sx * 100, sy * 100]);
      rotations.push(m.rotation);
      blurs.push(m.blur);
      if (m.clip) {
        useClip = true;
        if (
          firstW !== null &&
          (Math.abs(m.clipW - firstW) > 0.00001 || Math.abs(m.clipH - firstH) > 0.00001)
        )
          varyingClip = true;
        firstW = firstW === null ? m.clipW : firstW;
        firstH = firstH === null ? m.clipH : firstH;
        clips.push(clipShape(anchor, m.clipW, m.clipH));
      }
    }
    xf(l, 'ADBE Position').setValue([item.x, item.y]);
    var animator = l
      .property('ADBE Text Properties')
      .property('ADBE Text Animators')
      .addProperty('ADBE Text Animator');
    animator.name = '映词 · 字形位移';
    var animatorIndex = animator.propertyIndex;
    animator.property('ADBE Text Animator Properties').addProperty('ADBE Text Position 3D');
    animator = l
      .property('ADBE Text Properties')
      .property('ADBE Text Animators')
      .property(animatorIndex);
    var selectors = animator.property('ADBE Text Selectors');
    var selector = selectors.numProperties
      ? selectors.property(1)
      : selectors.addProperty('ADBE Text Selector');
    selector.property('ADBE Text Range Advanced').property('ADBE Text Range Units').setValue(1);
    selector.property('ADBE Text Percent Start').setValue(0);
    selector.property('ADBE Text Percent End').setValue(100);
    var offset = l
      .property('ADBE Text Properties')
      .property('ADBE Text Animators')
      .property(animatorIndex)
      .property('ADBE Text Animator Properties')
      .property('ADBE Text Position 3D');
    var stepEnd = item.motion === 'step' ? enterEnd : null;
    setMotion(offset, times, positions, stepEnd);
    freezeHold(offset, enterEnd, exitStart, item.motion === 'step', false);
    var opacity = xf(l, 'ADBE Opacity'),
      scale = xf(l, 'ADBE Scale'),
      rotation = xf(l, 'ADBE Rotate Z');
    setMotion(opacity, times, alphas, item.motion === 'type' ? scene.duration + 1 : stepEnd);
    setMotion(scale, times, scales, stepEnd);
    setMotion(rotation, times, rotations, stepEnd);
    freezeHold(
      opacity,
      enterEnd,
      exitStart,
      item.motion === 'step' || item.motion === 'type',
      item.motion === 'type'
    );
    freezeHold(scale, enterEnd, exitStart, item.motion === 'step', false);
    freezeHold(rotation, enterEnd, exitStart, item.motion === 'step', false);
    if (useClip) {
      var mask = l.property('ADBE Mask Parade').addProperty('ADBE Mask Atom'),
        path = mask.property('ADBE Mask Shape');
      if (varyingClip) {
        path.setValuesAtTimes(times, clips);
        freezeHold(path, enterEnd, exitStart);
      } else path.setValue(clips[0]);
    }
    if (scene.intensity > 0) {
      var blurred = false;
      for (i = 0; i < blurs.length; i++) if (blurs[i] > 0.00001) blurred = true;
      if (blurred)
        try {
          var blur = l.property('ADBE Effect Parade').addProperty('ADBE Gaussian Blur 2'),
            amount = blur.property(1);
          setMotion(amount, times, blurs, null);
          freezeHold(amount, enterEnd, exitStart);
        } catch (e) {
          warn('当前 AE 无法添加高斯模糊，已保留位移和淡入淡出');
        }
    }
    l.inPoint = 0;
    l.outPoint = scene.duration;
  }
  function compactTextTiming(scene, item) {
    var hold = Math.max(0, scene.duration - scene.enterSpan - scene.exitSpan),
      sourceScene = {},
      sourceItem = {},
      key;
    for (key in scene)
      if (Object.prototype.hasOwnProperty.call(scene, key)) sourceScene[key] = scene[key];
    for (key in item)
      if (Object.prototype.hasOwnProperty.call(item, key)) sourceItem[key] = item[key];
    sourceScene.duration = scene.enterSpan + scene.exitSpan;
    sourceScene.hold = 'still';
    sourceItem.exitStart = LMMotion.timing(scene, item).exitStart - hold;
    return { scene: sourceScene, item: sourceItem };
  }
  function pauseTextComp(layer, scene) {
    var enterEnd = scene.enterSpan,
      exitStart = scene.duration - scene.exitSpan,
      sourceDuration = enterEnd + scene.exitSpan;
    layer.startTime = 0;
    layer.inPoint = 0;
    layer.outPoint = scene.duration;
    layer.timeRemapEnabled = true;
    layer.outPoint = scene.duration;
    var remap = layer.property('ADBE Time Remapping');
    while (remap.numKeys) remap.removeKey(remap.numKeys);
    if (exitStart > enterEnd + 0.000001)
      remap.setValuesAtTimes(
        [0, enterEnd, exitStart, scene.duration],
        [0, enterEnd, enterEnd, sourceDuration]
      );
    else remap.setValuesAtTimes([0, scene.duration], [0, sourceDuration]);
    for (var i = 1; i <= remap.numKeys; i++)
      remap.setInterpolationTypeAtKey(
        i,
        KeyframeInterpolationType.LINEAR,
        KeyframeInterpolationType.LINEAR
      );
    layer.outPoint = scene.duration;
  }
  function animateShape(record, scene, item) {
    var l = record.layer,
      target = record.parent || l,
      ref = record.reference,
      times = sampleTimes(scene, item, true),
      positions = [],
      alphas = [],
      scales = [],
      rotations = [],
      starts = [],
      ends = [],
      i,
      j,
      m;
    for (i = 0; i < times.length; i++) {
      m = LMMotifs.state(scene, item, times[i]);
      positions.push([m.x, m.y]);
      alphas.push(m.opacity * 100);
      scales.push(
        ref
          ? [(m.scaleX * 10000) / ref.scale[0], (m.scaleY * 10000) / ref.scale[1]]
          : [m.scaleX * 100, m.scaleY * 100]
      );
      rotations.push(m.rotation - (ref ? ref.rotation : 0));
      starts.push(m.trimStart * 100);
      ends.push(m.trimEnd * 100);
    }
    setMotion(xf(target, 'ADBE Position'), times, positions, null);
    if (!record.parent) setMotion(xf(l, 'ADBE Opacity'), times, alphas, null);
    setMotion(xf(target, 'ADBE Scale'), times, scales, null);
    setMotion(xf(target, 'ADBE Rotate Z'), times, rotations, null);
    var root = l.property('ADBE Root Vectors Group'),
      trim = root.property(record.trim);
    setMotion(trim.property('ADBE Vector Trim Start'), times, starts, null);
    setMotion(trim.property('ADBE Vector Trim End'), times, ends, null);
    if (record.paths.length && LMMotifs.isAnimated(item.name || '')) {
      var pathTimes = [],
        values = [],
        pathOpacity = [],
        pathStroke = [],
        count = Math.min(480, Math.max(2, Math.ceil(scene.duration * 12)));
      for (i = 0; i <= count; i++) {
        var pt = (scene.duration * i) / count,
          parts = LMMotifs.paths(scene, item, pt);
        pathTimes.push(pt);
        for (j = 0; j < record.paths.length; j++) {
          if (!values[j]) {
            values[j] = [];
            pathOpacity[j] = [];
            pathStroke[j] = [];
          }
          values[j].push(makeShape(parts[j]));
          pathOpacity[j].push((parts[j].opacity == null ? 1 : parts[j].opacity) * 100);
          pathStroke[j].push(
            item.stroke * (parts[j].strokeScale == null ? 1 : parts[j].strokeScale)
          );
        }
      }
      for (j = 0; j < record.paths.length; j++) {
        ref = record.paths[j];
        var group = l.property('ADBE Root Vectors Group').property(ref.group);
        group
          .property('ADBE Vectors Group')
          .property(ref.path)
          .property('ADBE Vector Shape')
          .setValuesAtTimes(pathTimes, values[j]);
        setMotion(
          group.property('ADBE Vector Transform Group').property('ADBE Vector Group Opacity'),
          pathTimes,
          pathOpacity[j],
          null
        );
        if (ref.stroke)
          setMotion(
            group
              .property('ADBE Vectors Group')
              .property(ref.stroke)
              .property('ADBE Vector Stroke Width'),
            pathTimes,
            pathStroke[j],
            null
          );
      }
    }
    l.inPoint = 0;
    l.outPoint = scene.duration;
  }
  function attachDecorParent(comp, record, scene, item) {
    var child = record.layer,
      t = scene.duration * 0.5,
      position,
      scale,
      rotation,
      anchor,
      parent;
    try {
      position = xf(child, 'ADBE Position').valueAtTime(t, false);
      scale = xf(child, 'ADBE Scale').valueAtTime(t, false);
      rotation = xf(child, 'ADBE Rotate Z').valueAtTime(t, false);
      anchor = xf(child, 'ADBE Anchor Point').valueAtTime(t, false);
      if (Math.abs(scale[0]) < 1 || Math.abs(scale[1]) < 1) throw new Error('参考帧缩放过小');
      var angle = (rotation * Math.PI) / 180,
        ox = (-anchor[0] * scale[0]) / 100,
        oy = (-anchor[1] * scale[1]) / 100;
      var origin = [
        position[0] + Math.cos(angle) * ox - Math.sin(angle) * oy,
        position[1] + Math.sin(angle) * ox + Math.cos(angle) * oy
      ];
      parent = comp.layers.addNull();
      parent.name = '字旁动效定位';
      parent.inPoint = 0;
      parent.outPoint = scene.duration;
      xf(parent, 'ADBE Anchor Point').setValue(origin);
      xf(parent, 'ADBE Position').setValue([item.x, item.y]);
      child.setParentWithJump(parent);
      record.parent = parent;
      record.reference = { scale: [scale[0], scale[1]], rotation: rotation };
    } catch (e) {
      if (parent)
        try {
          if (child.parent === parent) child.setParentWithJump(null);
        } catch (ignoreParent) {}
      if (parent)
        try {
          parent.remove();
        } catch (ignore) {}
      record.parent = null;
      record.reference = null;
      try {
        resetDecorTransforms(child);
      } catch (resetError) {
        try {
          child.remove();
          var fresh = addShape(comp, item);
          fresh.layer.inPoint = 0;
          fresh.layer.outPoint = scene.duration;
          record.layer = fresh.layer;
          record.paths = fresh.paths;
          record.trim = fresh.trim;
        } catch (rebuildError) {
          record.skip = true;
          warn('字旁图层重建失败，已跳过这一处字旁：' + rebuildError.toString());
        }
      }
      warn('字旁预设定位失败，该 FFX 已退回原生动效：' + e.toString());
    }
  }
  function resetDecorTransforms(layer) {
    var names = [
      'ADBE Position',
      'ADBE Scale',
      'ADBE Rotate Z',
      'ADBE Opacity',
      'ADBE Anchor Point'
    ];
    var values = [[0, 0], [100, 100], 0, 100, [0, 0]];
    for (var i = 0; i < names.length; i++) {
      var prop = xf(layer, names[i]);
      if (prop.isSeparationLeader && prop.dimensionsSeparated) prop.dimensionsSeparated = false;
      prop = xf(layer, names[i]);
      if (prop.canSetExpression) prop.expression = '';
      while (prop.numKeys) prop.removeKey(prop.numKeys);
      prop.setValue(values[i]);
    }
  }
  function validate(p) {
    if (!p.cues.length || p.cues.length > 1000) throw new Error('需要 1–1000 句歌词');
    for (var i = 0; i < p.cues.length; i++) {
      var c = p.cues[i];
      c.start = Number(c.start);
      c.end = Number(c.end);
      if (
        !isFinite(c.start) ||
        !isFinite(c.end) ||
        c.start < 0 ||
        c.end <= c.start ||
        c.end > 86400
      )
        throw new Error('第 ' + (i + 1) + ' 句时间无效');
      if (!LMCore.trim(c.text) || String(c.text).length > 500 || String(c.note || '').length > 500)
        throw new Error('第 ' + (i + 1) + ' 句为空或过长（每句最多 500 字符）');
    }
  }
  function begin(args) {
    if (job) throw new Error('上一批生成尚未结束');
    var p = LMCore.normalize(args.path ? readJSON(args.path) : args.project);
    validate(p);
    if (!app.project) app.newProject();
    lastResult = null;
    var proj = app.project,
      target = proj.activeItem instanceof CompItem && args.overlay ? proj.activeItem : null;
    app.beginUndoGroup('映词 · 新建动态歌词');
    var folder = null;
    try {
      folder = proj.items.addFolder('映词 · ' + safeName(p.title));
      var subs = proj.items.addFolder('逐句歌词');
      subs.parentFolder = folder;
      var dur = 1;
      for (var i = 0; i < p.cues.length; i++) dur = Math.max(dur, p.cues[i].end);
      var main = proj.items.addComp(
        '映词 · ' + safeName(p.title),
        p.width,
        p.height,
        1,
        Math.ceil((dur + 0.1) * p.fps) / p.fps,
        p.fps
      );
      main.parentFolder = folder;
      main.comment = 'LyricMotion 1.5.2 · 透明歌词叠加层 · 每句预合成内为可编辑文字和字旁形状';
      job = {
        project: proj,
        p: p,
        main: main,
        folder: folder,
        subs: subs,
        index: 0,
        target: target,
        warnings: [],
        assets: {},
        current: null,
        textPool: [],
        decorPool: [],
        mediaPool: []
      };
      if (p.recipe)
        for (var ri = 0; ri < p.recipe.local.length; ri++) {
          var rec = p.recipe.local[ri];
          if (!rec || !rec.path) continue;
          if (/\.ffx$/i.test(rec.path))
            (rec.role === 'decor' ? job.decorPool : job.textPool).push(rec);
          else if ((rec.kind === 'aep' || /\.aepx?$/i.test(rec.path)) && rec.role === 'text')
            warn('文字工程请手动导入并替换歌词：' + rec.name);
          else job.mediaPool.push(rec);
        }
      if (p.audioPath) {
        var f = File(p.audioPath);
        if (f.exists) {
          var audio = proj.importFile(new ImportOptions(f));
          audio.parentFolder = folder;
          if (audio.hasAudio) {
            var a = main.layers.add(audio);
            a.startTime = 0;
            main.duration = Math.max(main.duration, audio.duration);
          } else warn('所选文件没有可用音轨');
        } else warn('找不到音乐文件，本次生成仅含文字');
      }
      return { total: p.cues.length, done: false };
    } catch (e) {
      job = null;
      if (folder)
        try {
          folder.remove();
        } catch (ignore) {}
      throw e;
    } finally {
      app.endUndoGroup();
    }
  }
  function removeCurrent(current) {
    if (!current) return;
    try {
      current.comp.remove();
    } catch (ignoreComp) {}
    if (current.nested)
      for (var i = 0; i < current.nested.length; i++)
        try {
          current.nested[i].remove();
        } catch (ignoreNested) {}
  }
  function step() {
    if (!job) throw new Error('没有正在生成的方案');
    if (app.project !== job.project) {
      job = null;
      throw new Error('AE 项目已切换，生成已停止');
    }
    var started = new Date().getTime(),
      budget = 250;
    app.beginUndoGroup('映词 · 生成歌词图层');
    try {
      var p = job.p,
        cue = p.cues[job.index];
      if (!job.current) {
        var scene = LMCore.scene(p, cue, job.index),
          comp = job.project.items.addComp(
            cue.text.replace(/\n/g, ' ').substr(0, 55),
            p.width,
            p.height,
            1,
            Math.max(1 / p.fps, scene.duration),
            p.fps
          );
        comp.parentFolder = job.subs;
        if (job.decorPool.length && !p.recipe.ornaments.length)
          scene.items.push({
            type: 'line',
            width: 24 * scene.unit,
            height: 1.5 * scene.unit,
            color: p.accent,
            x: scene.items[0].x + 140 * scene.unit,
            y: scene.items[0].y - 60 * scene.unit,
            lag: 0.1,
            motion: 'fade',
            alpha: 0.6
          });
        scene.width = p.width;
        scene.height = p.height;
        job.current = {
          comp: comp,
          scene: scene,
          phase: 'createText',
          scan: 0,
          text: [],
          nested: [],
          textAt: 0,
          work: 0,
          mediaDone: false
        };
        return progress();
      }
      var current = job.current,
        c = current.comp;
      scene = current.scene;
      do {
        if (current.phase === 'createText') {
          if (current.scan < scene.items.length) {
            var item = scene.items[current.scan++];
            if (item.type === 'text') {
              var sourceComp = null,
                outer = null;
              if (job.textPool.length) {
                sourceComp = job.project.items.addComp(
                  '可编辑文字 · ' + item.text.replace(/\n/g, ' ').substr(0, 38),
                  p.width,
                  p.height,
                  1,
                  Math.max(1 / p.fps, scene.enterSpan + scene.exitSpan),
                  p.fps
                );
                sourceComp.parentFolder = job.subs;
                current.nested.push(sourceComp);
              }
              var l = addText(sourceComp || c, item),
                rect = l.sourceRectAtTime(0, false);
              item._lmMeasure = { width: rect.width, height: rect.height };
              l.inPoint = 0;
              l.outPoint = sourceComp ? sourceComp.duration : scene.duration;
              if (sourceComp)
                applyRecipePair(
                  sourceComp,
                  l,
                  job.textPool,
                  scene,
                  job.index,
                  false,
                  scene.enterSpan
                );
              addHighlights(l, item);
              if (sourceComp) {
                outer = c.layers.add(sourceComp);
                outer.name = '可编辑文字 · ' + l.name;
                outer.inPoint = 0;
                outer.outPoint = scene.duration;
              }
              current.text.push({ item: item, layer: l, outer: outer });
            }
          } else current.phase = 'layout';
        } else if (current.phase === 'layout') {
          LMLayout.resolve(scene, function (item) {
            return item._lmMeasure;
          });
          current.phase = 'animateText';
        } else if (current.phase === 'animateText') {
          if (current.textAt < current.text.length) {
            var entry = current.text[current.textAt++];
            if (entry.outer) {
              var compact = compactTextTiming(scene, entry.item);
              animateText(entry.layer, compact.scene, compact.item);
              pauseTextComp(entry.outer, scene);
            } else animateText(entry.layer, scene, entry.item);
            current.work++;
          } else {
            current.phase = 'shapes';
            current.scan = 0;
          }
        } else if (current.phase === 'shapes') {
          if (current.scan < scene.items.length) {
            var shapeItem = scene.items[current.scan++];
            if (shapeItem.type !== 'text' && !shapeItem.layoutHidden) {
              var shape = addShape(c, shapeItem);
              shape.layer.inPoint = 0;
              shape.layer.outPoint = scene.duration;
              if (job.decorPool.length) {
                xf(shape.layer, 'ADBE Position').setValue([0, 0]);
                xf(shape.layer, 'ADBE Scale').setValue([100, 100]);
                xf(shape.layer, 'ADBE Rotate Z').setValue(0);
                if (applyRecipePair(c, shape.layer, job.decorPool, scene, job.index, true))
                  attachDecorParent(c, shape, scene, shapeItem);
              }
              if (!shape.skip) animateShape(shape, scene, shapeItem);
              current.work++;
            }
          } else current.phase = 'media';
        } else break;
      } while (new Date().getTime() - started < budget);
      if (current.phase !== 'media') return progress();
      if (!current.mediaDone && job.mediaPool.length) {
        current.mediaDone = true;
        try {
          recipeAsset(
            c,
            job.mediaPool[Math.floor(LMCore.random(p.seed, job.index, 303) * job.mediaPool.length)],
            scene
          );
        } catch (assetError) {
          warn(assetError.toString());
        }
        return progress();
      }
      var layer = job.main.layers.add(c);
      layer.startTime = cue.start;
      layer.inPoint = cue.start;
      layer.outPoint = cue.end;
      job.index++;
      job.current = null;
      if (job.index < p.cues.length) return progress();
      return finish(false);
    } catch (e) {
      if (job && job.current) removeCurrent(job.current);
      var count = job ? job.index : 0;
      job = null;
      throw new Error(e.toString() + '；已生成的 ' + count + ' 句保留在项目中');
    } finally {
      app.endUndoGroup();
    }
  }
  function progress() {
    return {
      done: false,
      count: job.index,
      total: job.p.cues.length,
      line: job.index + 1,
      layer: job.current ? job.current.work : 0,
      layers: job.current ? job.current.scene.items.length : 0
    };
  }
  function finish(cancelled) {
    if (!job) return { done: true, cancelled: true };
    if (app.project !== job.project) {
      job = null;
      throw new Error('AE 项目已切换');
    }
    if (cancelled && job.current) {
      removeCurrent(job.current);
      job.current = null;
    }
    lastComp = job.main;
    if (!cancelled && job.target) {
      var overlay = job.target.layers.add(job.main);
      overlay.startTime = 0;
      overlay.name = job.main.name;
    }
    if (job.index)
      job.main.time = Math.min(
        job.main.duration - 1 / job.p.fps,
        job.p.cues[0].start + Math.min(0.9, (job.p.cues[0].end - job.p.cues[0].start) / 2)
      );
    job.main.openInViewer();
    var result = {
      done: true,
      cancelled: cancelled,
      count: job.index,
      total: job.p.cues.length,
      name: job.main.name,
      id: job.main.id,
      warnings: job.warnings
    };
    lastResult = result;
    lastProject = job.project;
    job = null;
    return result;
  }
  function selectedPreset(args) {
    var comp = activeComp(),
      preset = File(args.path);
    if (!preset.exists || !/\.ffx$/i.test(preset.name))
      throw new Error('请选择存在的 FFX 动画预设');
    var chosen = comp.selectedLayers.slice(0),
      original = comp.selectedLayers.slice(0),
      t = comp.time,
      count = 0,
      i,
      j;
    if (!chosen.length) throw new Error('请先在 AE 时间轴选中要应用预设的文字或形状图层');
    app.beginUndoGroup('映词 · 应用本地预设');
    try {
      for (i = 0; i < chosen.length; i++) {
        var l = chosen[i];
        if (!(l instanceof AVLayer) || l.locked) continue;
        var source = l.property('ADBE Text Properties'),
          oldText = source ? source.property('ADBE Text Document').value.text : null;
        for (j = 1; j <= comp.numLayers; j++) comp.layer(j).selected = false;
        l.selected = true;
        comp.time = args.atPlayhead ? t : Math.max(0, l.inPoint);
        l.applyPreset(preset);
        if (oldText !== null) {
          var prop = l.property('ADBE Text Properties').property('ADBE Text Document'),
            doc;
          if (prop.numKeys)
            for (j = 1; j <= prop.numKeys; j++) {
              doc = prop.keyValue(j);
              doc.text = oldText;
              prop.setValueAtKey(j, doc);
            }
          else {
            doc = prop.value;
            doc.text = oldText;
            prop.setValue(doc);
          }
        }
        count++;
      }
      if (!count) throw new Error('选中的图层不可应用预设');
      return { count: count };
    } finally {
      comp.time = t;
      for (j = 1; j <= comp.numLayers; j++) comp.layer(j).selected = false;
      for (i = 0; i < original.length; i++)
        try {
          original[i].selected = true;
        } catch (ignore) {}
      app.endUndoGroup();
    }
  }
  function inside(item, folder) {
    var p = item.parentFolder;
    while (p && p !== app.project.rootFolder) {
      if (p === folder) return true;
      p = p.parentFolder;
    }
    return false;
  }
  function importLocal(args) {
    var file = File(args.path);
    if (!file.exists) throw new Error('本地素材已移动或磁盘未连接');
    if (!/\.(aep|aepx|mov|mp4|png|jpg|jpeg|gif|webm)$/i.test(file.name))
      throw new Error('该格式不能作为字旁素材导入');
    if (!app.project) app.newProject();
    app.beginUndoGroup('映词 · 导入本地素材');
    try {
      var opts = new ImportOptions(file);
      if (args.sequence && /\.(png|jpg|jpeg)$/i.test(file.name)) opts.sequence = true;
      var imported = app.project.importFile(opts),
        comps = [],
        i;
      if (imported instanceof FolderItem) {
        for (i = 1; i <= app.project.numItems; i++) {
          var it = app.project.item(i);
          if (it instanceof CompItem && inside(it, imported))
            comps.push({ id: it.id, name: it.name, width: it.width, height: it.height });
        }
        return { kind: 'project', comps: comps, name: imported.name };
      }
      return { kind: 'footage', id: imported.id, name: imported.name };
    } finally {
      app.endUndoGroup();
    }
  }
  function addLocal(args) {
    var comp = activeComp(),
      source = itemById(args.id);
    if (!(source instanceof FootageItem) && !(source instanceof CompItem))
      throw new Error('素材已从项目中移除');
    if (source === comp) throw new Error('不能把合成加入自身');
    var selected = comp.selectedLayers,
      parent = selected.length === 1 && selected[0] instanceof TextLayer ? selected[0] : null;
    app.beginUndoGroup('映词 · 加入字旁素材');
    try {
      var l = comp.layers.add(source);
      l.startTime = comp.time;
      l.inPoint = comp.time;
      l.outPoint = Math.min(comp.duration, comp.time + (source.duration > 0 ? source.duration : 4));
      l.name = '字旁素材 · ' + source.name;
      var scale = ((comp.width * 0.09) / Math.max(1, source.width)) * 100;
      xf(l, 'ADBE Scale').setValue([scale, scale]);
      xf(l, 'ADBE Opacity').setValue(65);
      if (args.screen) l.blendingMode = BlendingMode.SCREEN;
      if (parent) {
        var r = parent.sourceRectAtTime(comp.time, false);
        l.parent = parent;
        xf(l, 'ADBE Position').setValue([
          r.left + r.width + comp.width * 0.035,
          r.top + r.height / 2
        ]);
      } else xf(l, 'ADBE Position').setValue([comp.width * 0.73, comp.height * 0.6]);
      return { name: l.name };
    } finally {
      app.endUndoGroup();
    }
  }
  function openLocal(args) {
    var comp = itemById(args.id);
    if (!(comp instanceof CompItem)) throw new Error('要打开的合成已从项目中移除');
    comp.openInViewer();
    return { id: comp.id, name: comp.name };
  }
  function renderTarget(id) {
    var c = id ? itemById(id) : app.project && app.project.activeItem;
    if (id && !(c instanceof CompItem))
      throw new Error('要预渲染的合成已删除或项目已切换，请重新选择');
    if (!(c instanceof CompItem) && lastProject === app.project) c = lastComp;
    try {
      if (!(c instanceof CompItem) || c.parentFolder === null) throw new Error('missing');
    } catch (e) {
      throw new Error('请先生成或打开需要预渲染的合成');
    }
    return c;
  }
  function templateSignature(list) {
    var out = '';
    for (var i = 0; i < list.length; i++) {
      var name = String(list[i]);
      out += name.length + ':' + name;
    }
    return out;
  }
  function renderOptions() {
    renderChoice = null;
    var c = renderTarget(),
      project = app.project,
      queue = project.renderQueue;
    if (queue.rendering) throw new Error('AE 正在渲染，请结束当前渲染后再打开预渲染');
    var rq = queue.items.add(c);
    try {
      rq.render = false;
      var list = rq.outputModule(1).templates,
        names = [{ id: 'current', name: '当前 AE 默认输出设置' }],
        pick = 'current';
      for (var i = 0; i < list.length; i++) {
        var name = String(list[i]);
        if (name.indexOf('_HIDDEN') === 0) continue;
        var id = 'template:' + i;
        names.push({ id: id, name: name });
        if (
          pick === 'current' &&
          /alpha|透明/i.test(name) &&
          !/png|tiff|序列|sequence|仅|only/i.test(name)
        )
          pick = id;
      }
      var token = String(new Date().getTime()) + '-' + ++renderSequence;
      // Native template names stay inside AE; the panel sends only an ASCII ID.
      renderChoice = {
        project: project,
        comp: c,
        token: token,
        templates: names,
        signature: templateSignature(list)
      };
      return { id: c.id, name: c.name, templates: names, preferred: pick, selection: token };
    } finally {
      rq.remove();
    }
  }
  function preRender(args) {
    var choice = renderChoice,
      project = app.project,
      selected = null,
      i;
    if (
      !choice ||
      choice.project !== project ||
      args.selection !== choice.token ||
      args.id !== choice.comp.id
    )
      throw new Error('预渲染选择已失效，请重新打开预渲染并选择模板');
    var comp = renderTarget(args.id),
      queue = project.renderQueue;
    if (comp !== choice.comp) throw new Error('要预渲染的合成已变化，请重新打开预渲染');
    if (queue.rendering) throw new Error('AE 正在渲染，请结束当前渲染后再试');
    for (i = 0; i < choice.templates.length; i++)
      if (choice.templates[i].id === args.template) selected = choice.templates[i];
    if (!selected) throw new Error('请选择有效的输出设置');
    renderChoice = null;
    var states = [],
      rq = queue.items.add(comp),
      savedFile,
      stage = '设置输出模块';
    try {
      rq.render = false;
      var om = rq.outputModule(1);
      if (selected.id !== 'current') {
        if (templateSignature(om.templates) !== choice.signature)
          throw new Error('AE 输出模板列表已变化，请重新打开预渲染');
        try {
          om.applyTemplate(selected.name);
        } catch (templateError) {
          throw new Error(
            '无法应用输出模板「' +
              selected.name +
              '」。请重新选择模板，或使用“当前 AE 默认输出设置”。' +
              String(templateError.message || templateError)
          );
        }
        om = rq.outputModule(1);
      }
      var settings = om.getSettings(GetSettingsFormat.STRING),
        format = String(settings.Format || settings['格式'] || ''),
        ext = /quicktime/i.test(format)
          ? '.mov'
          : /avi/i.test(format)
            ? '.avi'
            : /h.?264|mpeg.?4/i.test(format)
              ? '.mp4'
              : '';
      if (!format && om.file) {
        var match = om.file.name.match(/\.(mov|avi|mp4)$/i);
        if (match) ext = '.' + match[1].toLowerCase();
      }
      if (
        !ext ||
        /sequence|序列|png|tiff|jpeg|openexr|aiff|wav|mp3|audio|音频|photoshop|psd/i.test(format)
      )
        throw new Error(
          '请选择视频输出模块（QuickTime、AVI 或 H.264）。透明叠加请选择带 Alpha 的视频模板。'
        );
      stage = '创建输出文件';
      var parent = project.file ? project.file.parent : Folder.myDocuments,
        root = Folder(parent.fsName + '/LyricMotion预渲染');
      if (!root.exists && !root.create()) throw new Error('无法创建预渲染目录');
      var dest = Folder(root.fsName + '/' + safeName(comp.name) + '-' + new Date().getTime());
      if (!dest.create()) throw new Error('无法创建素材子目录');
      savedFile = File(dest.fsName + '/' + safeName(comp.name) + ext);
      om.file = savedFile;
      rq.timeSpanStart = 0;
      rq.timeSpanDuration = comp.duration;
      for (i = 1; i <= queue.numItems; i++) {
        var q = queue.item(i);
        if (q !== rq) {
          states.push({ item: q, render: q.render });
          if (q.render) q.render = false;
        }
      }
      stage = '渲染视频';
      rq.render = true;
      queue.render();
      if (rq.status !== RQItemStatus.DONE) throw new Error('预渲染已取消或失败，未导入视频');
      if (!savedFile.exists) throw new Error('AE 没有生成视频文件');
      if (app.project !== project) throw new Error('项目已切换，视频保留在：' + savedFile.fsName);
      stage = '导入 AE 项目';
      var footage = project.importFile(new ImportOptions(savedFile)),
        folder = project.items.addFolder('映词 · 预渲染');
      footage.parentFolder = folder;
      var video = project.items.addComp(
        '预渲染 · ' + comp.name,
        comp.width,
        comp.height,
        comp.pixelAspect,
        comp.duration,
        comp.frameRate
      );
      video.parentFolder = folder;
      video.layers.add(footage);
      video.openInViewer();
      return { name: video.name, path: savedFile.fsName };
    } catch (e) {
      throw new Error(
        '预渲染：' +
          stage +
          '失败。' +
          String(e.message || e) +
          (savedFile && savedFile.exists ? '\n文件位置：' + savedFile.fsName : '')
      );
    } finally {
      for (var k = 0; k < states.length; k++)
        try {
          if (states[k].item.render !== states[k].render) states[k].item.render = states[k].render;
        } catch (ignore) {}
      try {
        if (rq.status !== RQItemStatus.RENDERING) rq.remove();
      } catch (ignoreRemove) {}
    }
  }
  var api = {
    info: function () {
      return {
        version: version,
        ae: app.version,
        building: !!job,
        progress: job ? progress() : null,
        lastResult: app.project === lastProject ? lastResult : null
      };
    },
    begin: begin,
    step: step,
    cancel: function () {
      return finish(true);
    },
    active: function () {
      var c = activeComp();
      return { id: c.id, width: c.width, height: c.height, fps: c.frameRate, name: c.name };
    },
    applyPreset: selectedPreset,
    importLocal: importLocal,
    addLocal: addLocal,
    openLocal: openLocal,
    renderOptions: renderOptions,
    preRender: preRender,
    folder: function () {
      var d = Folder.selectDialog('选择预设／素材所在文件夹');
      return { path: d ? d.fsName : null };
    },
    savePath: function (args) {
      var f = File.saveDialog(
        '保存 ' + safeName(args.name),
        '*.' + (args.ext === 'srt' ? 'srt' : 'json')
      );
      return { path: f ? f.fsName : null };
    }
  };
  return {
    dispatch: function (op, encoded) {
      try {
        if (!Object.prototype.hasOwnProperty.call(api, op)) throw new Error('未知操作');
        if (job && op !== 'step' && op !== 'cancel' && op !== 'info')
          throw new Error('请先等待歌词生成结束');
        var result = api[op](parse(decodeURIComponent(encoded || '%7B%7D'))) || {};
        result.ok = true;
        return stringify(result);
      } catch (e) {
        return stringify({
          ok: false,
          error: e.toString() + (e.line ? '（行 ' + e.line + '）' : '')
        });
      }
    }
  };
})();

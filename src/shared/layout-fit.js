/* exported LMLayout */
/* Shared geometry pass. Adapters supply actual glyph measurements before motion is added. ES3. */
var LMLayout = (function () {
  function envelope(item) {
    var r = ((item.tilt || 0) * Math.PI) / 180,
      c = Math.abs(Math.cos(r)),
      s = Math.abs(Math.sin(r));
    return { w: item.boxW * c + item.boxH * s, h: item.boxW * s + item.boxH * c };
  }
  function estimate(item) {
    var rows = item.text.split('\n'),
      width = 0,
      i,
      j,
      sum;
    for (i = 0; i < rows.length; i++) {
      sum = 0;
      for (j = 0; j < rows[i].length; j++)
        sum += item.size * (rows[i].charCodeAt(j) < 256 ? 0.58 : 1);
      width = Math.max(
        width,
        sum + (Math.max(0, rows[i].length - 1) * item.tracking * item.size) / 1000
      );
    }
    var height = item.size * (1 + (rows.length - 1) * 1.3),
      fit = Math.min(1, item.maxW / Math.max(1, width), item.maxH / Math.max(1, height));
    return { width: width * fit, height: height * fit };
  }
  function placeLocal(scene, item, occupied, slot) {
    var b = scene.focusBounds || scene.bounds,
      cy = (b.top + b.bottom) / 2,
      hh = (b.bottom - b.top) / 2;
    var minX = scene.safeSide === 'right' ? scene.width * 0.56 : 0,
      maxX = scene.safeSide === 'left' ? scene.width * 0.44 : scene.width;
    var x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity,
      paths = item.paths || [],
      i,
      j;
    for (i = 0; i < paths.length; i++)
      for (j = 0; j < paths[i].points.length; j++) {
        var point = paths[i].points[j];
        x0 = Math.min(x0, point[0]);
        x1 = Math.max(x1, point[0]);
        y0 = Math.min(y0, point[1]);
        y1 = Math.max(y1, point[1]);
      }
    if (!isFinite(x0)) {
      x0 = -(item.width || 20 * scene.unit) / 2;
      x1 = -x0;
      y0 = -(item.height || 3 * scene.unit) / 2;
      y1 = -y0;
    }
    var pw = x1 - x0,
      ph = y1 - y0,
      offsetX = (x0 + x1) / 2,
      offsetY = (y0 + y1) / 2;
    var gap = Math.max(3 * scene.unit, Math.min(10 * scene.unit, hh * 0.12)),
      motionPad = 5 * scene.unit;
    item.fitScale = Math.min(item.fitScale, Math.max(0.55, (hh * 0.6) / Math.max(1, ph)));
    for (var attempt = 0; attempt < 4; attempt++) {
      var halfW = pw * item.fitScale * 0.58 + motionPad,
        halfH = ph * item.fitScale * 0.58 + motionPad;
      if (/ring|orbit|arc|compass|flower/.test(item.name || ''))
        halfW = halfH = Math.sqrt(pw * pw + ph * ph) * item.fitScale * 0.55 + motionPad;
      var candidates = [
        [b.right + gap + halfW, b.top + hh * 0.38],
        [b.left - gap - halfW, b.bottom - hh * 0.38],
        [b.right - halfW, b.bottom + gap + halfH],
        [b.left + halfW, b.top - gap - halfH],
        [b.right - halfW, b.top - gap - halfH],
        [b.left + halfW, b.bottom + gap + halfH],
        [b.left - gap - halfW, cy],
        [b.right + gap + halfW, cy]
      ];
      for (j = 0; j < candidates.length; j++) {
        var p = candidates[(slot * 2 + j) % candidates.length],
          box = {
            left: p[0] - halfW,
            right: p[0] + halfW,
            top: p[1] - halfH,
            bottom: p[1] + halfH
          },
          blocked = box.left < minX || box.right > maxX || box.top < 0 || box.bottom > scene.height;
        for (var k = 0; !blocked && k < scene.textBounds.length; k++) {
          var tb = scene.textBounds[k];
          if (
            box.left < tb.right + 2 * scene.unit &&
            box.right > tb.left - 2 * scene.unit &&
            box.top < tb.bottom + 2 * scene.unit &&
            box.bottom > tb.top - 2 * scene.unit
          )
            blocked = true;
        }
        for (k = 0; !blocked && k < occupied.length; k++)
          if (
            Math.abs(p[0] - occupied[k].x) < halfW + occupied[k].w / 2 &&
            Math.abs(p[1] - occupied[k].y) < halfH + occupied[k].h / 2
          )
            blocked = true;
        if (!blocked) {
          item.x = p[0] - offsetX * item.fitScale;
          item.y = p[1] - offsetY * item.fitScale;
          item.motifBounds = box;
          occupied.push({ x: p[0], y: p[1], w: halfW * 2, h: halfH * 2 });
          return true;
        }
      }
      if (item.fitScale <= 0.6) break;
      item.fitScale = Math.max(0.6, item.fitScale * 0.75);
    }
    return false;
  }
  function resolve(scene, measure) {
    var text = [],
      i,
      j,
      k,
      it,
      b,
      other,
      ob,
      dx,
      dy,
      overX,
      overY,
      axis,
      gap = 8 * scene.unit;
    for (i = 0; i < scene.items.length; i++) {
      it = scene.items[i];
      it.fitScale = 1;
      it.layoutHidden = false;
      it.motifBounds = null;
      if (it.designX == null) {
        it.designX = it.x;
        it.designY = it.y;
      }
      it.x = it.designX;
      it.y = it.designY;
      if (it.type !== 'text') continue;
      var m = measure ? measure(it) : estimate(it);
      it.boxW = Math.max(1, m.width);
      it.boxH = Math.max(1, m.height);
      if (it.align === 'left') it.x += it.boxW / 2;
      else if (it.align === 'right') it.x -= it.boxW / 2;
      text.push(it);
    }
    // Keep previously placed text still. Give each later word or glyph its own space.
    for (i = 0; i < text.length; i++) {
      it = text[i];
      b = envelope(it);
      if (it.flow)
        for (j = 0; j < i; j++)
          if (text[j].flow === it.flow) {
            ob = envelope(text[j]);
            it.x = Math.max(it.x, text[j].x + (ob.w + b.w) / 2 + gap);
          }
      for (k = 0; k < Math.max(4, text.length * 2); k++) {
        var moved = false;
        for (j = 0; j < i; j++) {
          other = text[j];
          ob = envelope(other);
          dx = it.x - other.x;
          dy = it.y - other.y;
          overX = (b.w + ob.w) / 2 + gap - Math.abs(dx);
          overY = (b.h + ob.h) / 2 + gap - Math.abs(dy);
          if (overX <= 0 || overY <= 0) continue;
          axis =
            it.flow && it.flow === other.flow
              ? 'x'
              : Math.abs(dy) < Math.min(b.h, ob.h) * 0.42
                ? 'x'
                : Math.abs(dx) < Math.min(b.w, ob.w) * 0.42
                  ? 'y'
                  : overX < overY
                    ? 'x'
                    : 'y';
          if (it.note) axis = 'y';
          if (it.flow && it.flow === other.flow) it.x = other.x + (b.w + ob.w) / 2 + gap;
          else if (axis === 'x') it.x += (dx < 0 ? -1 : 1) * overX;
          else it.y += (dy < 0 && !it.note ? -1 : 1) * overY;
          moved = true;
        }
        if (!moved) break;
      }
      // Dense layouts can leave a word trapped between two blocks. Use a free edge.
      var conflict = false,
        right = -Infinity,
        bottom = -Infinity;
      for (j = 0; j < i; j++) {
        other = text[j];
        ob = envelope(other);
        right = Math.max(right, other.x + ob.w / 2);
        bottom = Math.max(bottom, other.y + ob.h / 2);
        if (
          Math.abs(it.x - other.x) < (b.w + ob.w) / 2 + gap - 0.01 &&
          Math.abs(it.y - other.y) < (b.h + ob.h) / 2 + gap - 0.01
        )
          conflict = true;
      }
      if (conflict) {
        var freeX = right + b.w / 2 + gap,
          freeY = bottom + b.h / 2 + gap;
        if (it.flow || (!it.note && Math.abs(freeX - it.x) < Math.abs(freeY - it.y))) it.x = freeX;
        else it.y = freeY;
      }
    }
    var x0 = Infinity,
      x1 = -Infinity,
      y0 = Infinity,
      y1 = -Infinity;
    for (i = 0; i < text.length; i++) {
      it = text[i];
      b = envelope(it);
      x0 = Math.min(x0, it.x - b.w / 2);
      x1 = Math.max(x1, it.x + b.w / 2);
      y0 = Math.min(y0, it.y - b.h / 2);
      y1 = Math.max(y1, it.y + b.h / 2);
    }
    if (!text.length) return scene;
    // Composition sets the intended presence. Measure first, then grow or shrink the whole group together.
    var fw = x1 - x0,
      fh = y1 - y0,
      target = scene.footprint;
    var fit = target
      ? Math.min(
          4.5,
          (scene.width * Math.min(target.width, target.maxWidth)) / Math.max(1, fw),
          (scene.height * Math.min(target.height, target.maxHeight)) / Math.max(1, fh)
        )
      : Math.min(
          1,
          (scene.width * 0.48) / Math.max(1, fw),
          (scene.height * 0.54) / Math.max(1, fh)
        );
    var cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2,
      margin = Math.min(scene.width, scene.height) * 0.07;
    var minX = scene.safeSide === 'right' ? scene.width * 0.62 : margin,
      maxX = scene.safeSide === 'left' ? scene.width * 0.38 : scene.width - margin;
    fit = Math.min(fit, (maxX - minX) / Math.max(1, fw));
    var hw = (fw * fit) / 2,
      hh = (fh * fit) / 2;
    var anchorX = scene.anchorX == null ? cx : scene.anchorX,
      anchorY = scene.anchorY == null ? cy : scene.anchorY;
    var tx = Math.max(minX + hw, Math.min(maxX - hw, anchorX)),
      ty = Math.max(margin + hh, Math.min(scene.height - margin - hh, anchorY));
    for (i = 0; i < text.length; i++) {
      it = text[i];
      it.x = tx + (it.x - cx) * fit;
      it.y = ty + (it.y - cy) * fit;
      it.fitScale = fit;
    }
    scene.bounds = { left: tx - hw, right: tx + hw, top: ty - hh, bottom: ty + hh };
    scene.layoutScale = fit;
    scene.textBounds = [];
    scene.focusBounds = null;
    scene.focusGlyphHeight = 0;
    var largest = null,
      largestSize = 0;
    for (i = 0; i < text.length; i++) {
      it = text[i];
      b = envelope(it);
      var tb = {
        left: it.x - (b.w * fit) / 2,
        right: it.x + (b.w * fit) / 2,
        top: it.y - (b.h * fit) / 2,
        bottom: it.y + (b.h * fit) / 2,
        focus: it.focus,
        note: it.note
      };
      scene.textBounds.push(tb);
      if (!it.note && it.size > largestSize) {
        largest = tb;
        largestSize = it.size;
      }
      if (it.focus) {
        scene.focusGlyphHeight = Math.max(
          scene.focusGlyphHeight,
          (it.boxH * fit) / (1 + (it.text.split('\n').length - 1) * 1.3)
        );
        if (!scene.focusBounds)
          scene.focusBounds = { left: tb.left, right: tb.right, top: tb.top, bottom: tb.bottom };
        else {
          scene.focusBounds.left = Math.min(scene.focusBounds.left, tb.left);
          scene.focusBounds.right = Math.max(scene.focusBounds.right, tb.right);
          scene.focusBounds.top = Math.min(scene.focusBounds.top, tb.top);
          scene.focusBounds.bottom = Math.max(scene.focusBounds.bottom, tb.bottom);
        }
      }
    }
    if (!scene.focusBounds) scene.focusBounds = largest || scene.bounds;
    if (!scene.focusGlyphHeight)
      scene.focusGlyphHeight = Math.min(
        scene.focusBounds.bottom - scene.focusBounds.top,
        largestSize * fit
      );
    var slot = 0,
      occupied = [];
    for (i = 0; i < scene.items.length; i++) {
      it = scene.items[i];
      if (it.type === 'text') continue;
      if (typeof LMMotifs !== 'undefined' && LMMotifs.place && LMMotifs.place(scene, it)) {
        var mb = it.motifBounds;
        if (mb)
          occupied.push({
            x: (mb.left + mb.right) / 2,
            y: (mb.top + mb.bottom) / 2,
            w: mb.right - mb.left,
            h: mb.bottom - mb.top
          });
        continue;
      }
      it.fitScale = Math.max(0.6, Math.min(1.75, fit));
      if (it.attachment === 'baseline') {
        it.fitScale = Math.min(
          it.fitScale,
          (scene.bounds.right - scene.bounds.left) / Math.max(1, it.maxW)
        );
        var halfLine = (it.maxW * it.fitScale) / 2;
        it.x = Math.max(
          scene.bounds.left + halfLine,
          Math.min(scene.bounds.right - halfLine, tx + (it.designX - cx) * fit)
        );
        it.y = scene.bounds.bottom + 14 * scene.unit;
        it.layoutHidden = it.y + 6 * scene.unit > scene.height - margin;
        if (!it.layoutHidden)
          occupied.push({
            x: it.x,
            y: it.y,
            w: halfLine * 2 + 12 * scene.unit,
            h: 12 * scene.unit
          });
        continue;
      }
      it.layoutHidden = !placeLocal(scene, it, occupied, slot++);
    }
    scene.layoutReady = true;
    return scene;
  }
  function placeDecoration(scene, item) {
    var occupied = [];
    for (var i = 0; i < scene.items.length; i++) {
      var b = scene.items[i].motifBounds;
      if (b)
        occupied.push({
          x: (b.left + b.right) / 2,
          y: (b.top + b.bottom) / 2,
          w: b.right - b.left,
          h: b.bottom - b.top
        });
    }
    item.fitScale = 1;
    return placeLocal(scene, item, occupied, 0);
  }
  return { resolve: resolve, estimate: estimate, placeDecoration: placeDecoration };
})();

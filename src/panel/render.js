/* Seekable Canvas preview. The exported AE scene uses the same layout/motion data. */
window.LMRender = (() => {
  const metrics = new Map();
  const families = {
    SimSun: 'SimSun,宋体',
    STSong: 'STSong,华文宋体',
    FangSong: 'FangSong,仿宋',
    KaiTi: 'KaiTi,楷体',
    STXingkai: 'STXingkai,华文行楷',
    STKaiti: 'STKaiti,华文楷体',
    MicrosoftYaHei: 'Microsoft YaHei,微软雅黑'
  };
  const cssFont = (name, size) =>
    `${size}px ${families[name] || '"' + String(name).replace(/["\\]/g, '') + '"'},serif`;
  function layoutText(ctx, item) {
    const key = [
      item.text,
      item.font,
      item.size,
      item.maxW,
      item.maxH,
      item.tracking,
      item.align
    ].join('|');
    if (metrics.has(key)) return metrics.get(key);
    function atSize(size) {
      ctx.font = cssFont(item.font, size);
      const leading = size * 1.3,
        gap = (item.tracking * size) / 1000;
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      const rows = item.text.split('\n').map((line, i) => {
        const glyphs = LMCore.chars(line),
          width = ctx.measureText(line).width + Math.max(0, glyphs.length - 1) * gap;
        const m = ctx.measureText(line),
          row = {
            text: line,
            glyphs,
            x: item.align === 'left' ? 0 : item.align === 'right' ? -width : -width / 2,
            y: i * leading,
            width
          };
        x0 = Math.min(x0, row.x - (m.actualBoundingBoxLeft || 0));
        x1 = Math.max(
          x1,
          row.x + (m.actualBoundingBoxRight || m.width) + Math.max(0, glyphs.length - 1) * gap
        );
        y0 = Math.min(y0, row.y - (m.actualBoundingBoxAscent || size * 0.85));
        y1 = Math.max(y1, row.y + (m.actualBoundingBoxDescent || size * 0.15));
        return row;
      });
      return {
        size,
        gap,
        rows,
        centerX: (x0 + x1) / 2,
        centerY: (y0 + y1) / 2,
        width: x1 - x0,
        height: y1 - y0
      };
    }
    let m = atSize(item.size),
      fit = Math.min(1, item.maxW / Math.max(1, m.width), item.maxH / Math.max(1, m.height));
    if (fit < 1) m = atSize(item.size * fit);
    if (metrics.size > 3000) metrics.clear();
    metrics.set(key, m);
    return m;
  }
  function paintScene(ctx, scene, localTime) {
    if (localTime < 0 || localTime > scene.duration) return;
    if (!scene.layoutReady) LMLayout.resolve(scene, (item) => layoutText(ctx, item));
    const ordered = scene.items
      .filter((item) => item.behind)
      .concat(scene.items.filter((item) => !item.behind));
    for (const item of ordered) {
      if (item.layoutHidden) continue;
      const m = LMCore.motion(scene, item, localTime);
      if (m.opacity < 0.002) continue;
      ctx.save();
      ctx.translate(m.clip ? item.x : m.x, m.clip ? item.y : m.y);
      ctx.rotate((m.rotation * Math.PI) / 180);
      ctx.scale(m.scaleX || m.scale, m.scaleY || m.scale);
      if (m.clip) {
        ctx.beginPath();
        ctx.rect(-m.clipW / 2, -m.clipH / 2, m.clipW, m.clipH);
        ctx.clip();
        const r = (m.rotation * Math.PI) / 180,
          dx = m.x - item.x,
          dy = m.y - item.y;
        ctx.translate(
          (dx * Math.cos(r) + dy * Math.sin(r)) / (m.scaleX || m.scale),
          (-dx * Math.sin(r) + dy * Math.cos(r)) / (m.scaleY || m.scale)
        );
      }
      ctx.globalAlpha = m.opacity;
      ctx.fillStyle = item.color;
      ctx.strokeStyle = item.color;
      ctx.filter = m.blur > 0.15 ? `blur(${m.blur}px)` : 'none';
      if (item.type === 'text') {
        const measure = layoutText(ctx, item);
        ctx.font = cssFont(item.font, measure.size);
        ctx.textBaseline = 'alphabetic';
        ctx.textAlign = 'left';
        let offset = 0;
        for (const row of measure.rows) {
          let x = row.x - measure.centerX;
          const y = row.y - measure.centerY;
          if (measure.gap || (item.highlights && item.highlights.length)) {
            let index = 0;
            for (const char of row.glyphs) {
              ctx.fillStyle = (item.highlights || []).some(
                (range) => offset + index >= range[0] && offset + index < range[1]
              )
                ? item.highlightColor
                : item.color;
              // Prefix measurement retains kerning when the line contains Latin text.
              const dx =
                ctx.measureText(row.text.slice(0, index)).width +
                LMCore.chars(row.text.slice(0, index)).length * measure.gap;
              ctx.fillText(char, x + dx, y);
              index += char.length;
            }
          } else {
            ctx.fillStyle = item.color;
            ctx.fillText(row.text, x, y);
          }
          offset += row.text.length + 1;
        }
      } else if (item.type === 'line')
        ctx.fillRect(-item.width / 2, -item.height / 2, item.width, item.height);
      else {
        ctx.lineWidth = item.stroke;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const path of LMMotifs.paths(scene, item, localTime)) {
          ctx.globalAlpha = m.opacity * (path.opacity == null ? 1 : path.opacity);
          ctx.lineWidth = item.stroke * (path.strokeScale == null ? 1 : path.strokeScale);
          if (path.fill) {
            ctx.beginPath();
            path.points.forEach((pt, i) =>
              i ? ctx.lineTo(pt[0], pt[1]) : ctx.moveTo(pt[0], pt[1])
            );
            ctx.closePath();
            ctx.fill();
          } else strokeSlice(ctx, path, m.trimStart || 0, m.trimEnd == null ? 1 : m.trimEnd);
        }
      }
      ctx.restore();
    }
  }
  function strokeSlice(ctx, path, start, end) {
    const pts = path.closed ? path.points.concat([path.points[0]]) : path.points;
    let total = 0;
    const lengths = [];
    for (let i = 1; i < pts.length; i++) {
      const n = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lengths.push(n);
      total += n;
    }
    let cursor = 0;
    ctx.beginPath();
    for (let i = 1; i < pts.length; i++) {
      const n = lengths[i - 1],
        lo = Math.max(cursor, start * total),
        hi = Math.min(cursor + n, end * total);
      if (n && hi > lo) {
        const a = (lo - cursor) / n,
          b = (hi - cursor) / n,
          from = pts[i - 1],
          to = pts[i];
        ctx.moveTo(from[0] + (to[0] - from[0]) * a, from[1] + (to[1] - from[1]) * a);
        ctx.lineTo(from[0] + (to[0] - from[0]) * b, from[1] + (to[1] - from[1]) * b);
      }
      cursor += n;
    }
    ctx.stroke();
  }
  function backdrop(ctx, w, h, mode, media) {
    if (media && (media.complete || media.readyState >= 2)) {
      const sw = media.videoWidth || media.naturalWidth,
        sh = media.videoHeight || media.naturalHeight;
      if (sw && sh) {
        const k = Math.max(w / sw, h / sh);
        ctx.drawImage(media, (w - sw * k) / 2, (h - sh * k) / 2, sw * k, sh * k);
        return;
      }
    }
    if (mode === 'alpha') {
      const cell = Math.max(16, w / 40);
      ctx.fillStyle = '#292F38';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#323A45';
      for (let y = 0; y < h; y += cell)
        for (let x = 0; x < w; x += cell)
          if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2) ctx.fillRect(x, y, cell, cell);
      return;
    }
    ctx.fillStyle = mode === 'light' ? '#DEDFE1' : mode === 'dark' ? '#202835' : '#617D98';
    ctx.fillRect(0, 0, w, h);
    if (mode === 'mist') {
      const gradient = ctx.createLinearGradient(0, h, w, 0);
      gradient.addColorStop(0, 'rgba(199,218,215,.88)');
      gradient.addColorStop(0.5, 'rgba(79,111,144,.10)');
      gradient.addColorStop(1, 'rgba(190,208,208,.70)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    }
  }
  function render(canvas, project, time, opts = {}) {
    const ctx = canvas.getContext('2d'),
      w = project.width,
      h = project.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(canvas.width / w, canvas.height / h);
    if (!opts.transparent) backdrop(ctx, w, h, opts.background || 'mist', opts.media);
    const cues = opts.cues || project.cues;
    for (let i = 0; i < cues.length; i++)
      if (time >= cues[i].start && time <= cues[i].end)
        paintScene(
          ctx,
          LMCore.scene(project, cues[i], opts.index == null ? i : opts.index),
          time - cues[i].start
        );
    if (opts.guides) {
      ctx.strokeStyle = 'rgba(227,239,251,.28)';
      ctx.lineWidth = w / canvas.width;
      ctx.setLineDash([w * 0.006, w * 0.006]);
      ctx.strokeRect(w * 0.05, h * 0.05, w * 0.9, h * 0.9);
      ctx.strokeStyle = 'rgba(227,239,251,.15)';
      ctx.strokeRect(w * 0.33, h * 0.2, w * 0.34, h * 0.6);
    }
    ctx.restore();
  }
  return { render, paintScene };
})();

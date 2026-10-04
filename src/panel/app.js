(() => {
  'use strict';
  const $ = (id) => document.getElementById(id),
    clone = (v) => JSON.parse(JSON.stringify(v));
  let p,
    index = 0,
    position = 0,
    playing = false,
    started = 0,
    lastFrame = 0,
    busy = false,
    outputBusy = false,
    stopRequested = false,
    videoController = null,
    visual = null,
    visualURL = '',
    audioURL = '',
    toastTimer,
    storageWarned = false,
    uncertain = false,
    recovering = false;
  const history = [],
    audio = new Audio();
  audio.preload = 'metadata';
  try {
    const saved = JSON.parse(localStorage.getItem('lyricmotion.project') || 'null');
    p = validateProject(saved || clone(LMDemo));
    if (!saved) p.seed = Math.floor(Math.random() * 10000000) + 1;
  } catch (_) {
    p = LMCore.normalize(clone(LMDemo));
    p.seed = Math.floor(Math.random() * 10000000) + 1;
  }
  position = p.cues.length
    ? p.cues[0].start + Math.min(1, (p.cues[0].end - p.cues[0].start) / 2)
    : 0;
  const globals = [
    'title',
    'font',
    'focusFont',
    'compositionScale',
    'enterPercent',
    'exitPercent',
    'color',
    'accent',
    'highlightColor',
    'highlightMode',
    'motionMode',
    'emphasisScale',
    'scale',
    'intensity',
    'opacity',
    'width',
    'height',
    'fps',
    'ornaments',
    'ornamentSize',
    'ornamentDensity'
  ];
  const numeric = [
    'enterPercent',
    'exitPercent',
    'emphasisScale',
    'scale',
    'intensity',
    'opacity',
    'width',
    'height',
    'fps',
    'ornamentSize',
    'ornamentDensity'
  ];
  $('scale').step = '0.01';
  $('intensity').step = '0.01';
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($('toast').hidden = true), 6500);
  }
  async function run(work) {
    try {
      return await work();
    } catch (e) {
      $('status').textContent = e.message || String(e);
      toast(e.message || String(e));
    }
  }
  function persist() {
    try {
      localStorage.setItem('lyricmotion.project', JSON.stringify(p));
    } catch (_) {
      if (!storageWarned) {
        storageWarned = true;
        toast('自动保存空间不足，请点「保存方案」保存到文件');
      }
    }
  }
  function checkpoint() {
    history.push(JSON.stringify(p));
    if (history.length > 35) history.shift();
  }
  function change(fn) {
    if (busy) return;
    checkpoint();
    fn(p);
    p = LMCore.normalize(p);
    LMSubtitles.sync(p);
    persist();
    draw();
  }
  function duration() {
    return Math.max(
      1,
      ...p.cues.map((c) => Number(c.end) || 0),
      Number.isFinite(audio.duration) ? audio.duration : 0
    );
  }
  function paint() {
    const canvas = $('preview'),
      h = Math.round((1280 * p.height) / p.width);
    if (canvas.height !== h) canvas.height = h;
    LMRender.render(canvas, p, position, {
      background: $('background').value,
      media: visual,
      guides: $('guides').checked
    });
    $('seek').max = duration();
    $('seek').value = position;
    $('clock').textContent = LMCore.stamp(position);
    const current = p.cues.findIndex((c) => position >= c.start && position < c.end);
    $('preview-title').textContent =
      current >= 0
        ? LMCore.chosen(p, p.cues[current], current).name +
          ' · ' +
          p.cues[current].text.replace(/\n/g, ' ')
        : '歌词的留白，也是画面的一部分';
  }
  function pause() {
    playing = false;
    audio.pause();
    if (visual && visual.tagName === 'VIDEO') visual.pause();
    $('play').textContent = '播放';
  }
  function seek(t) {
    position = LMCore.clamp(t, 0, duration());
    if (audio.src)
      try {
        audio.currentTime = position;
      } catch (_) {}
    if (visual && visual.tagName === 'VIDEO')
      try {
        visual.currentTime = Math.min(position, visual.duration || position);
      } catch (_) {}
    started = performance.now() - position * 1000;
    paint();
  }
  function loop(now) {
    if (!playing) return;
    if (now - lastFrame > 30) {
      position = !audio.paused && !audio.ended ? audio.currentTime : (now - started) / 1000;
      lastFrame = now;
      if (position >= duration()) {
        position = duration();
        pause();
      }
      paint();
    }
    if (playing) requestAnimationFrame(loop);
  }
  async function play() {
    if (playing) {
      pause();
      return;
    }
    if (position >= duration()) seek(0);
    playing = true;
    started = performance.now() - position * 1000;
    $('play').textContent = '暂停';
    if (audio.src && (!Number.isFinite(audio.duration) || position < audio.duration))
      try {
        await audio.play();
      } catch (_) {
        toast('音乐无法播放；画面预览继续，可重新载入音乐');
      }
    if (visual && visual.tagName === 'VIDEO') visual.play().catch(() => {});
    requestAnimationFrame(loop);
  }
  function renderCues() {
    const list = $('cue-list');
    list.textContent = '';
    $('cue-count').textContent = p.cues.length + ' 句';
    p.cues.forEach((cue, i) => {
      const b = document.createElement('button');
      b.className = 'cue-row' + (i === index ? ' current' : '');
      b.setAttribute('role', 'listitem');
      const no = document.createElement('span');
      no.textContent = i + 1;
      const time = document.createElement('time');
      time.textContent = LMCore.stamp(cue.start);
      const text = document.createElement('span');
      text.className = 'cue-copy';
      text.textContent = cue.text.replace(/\n/g, ' ');
      b.append(no, time, text);
      b.onclick = () => {
        index = i;
        seek(cue.start + Math.min(0.9, (cue.end - cue.start) / 2));
        renderCues();
        inspector();
      };
      list.appendChild(b);
    });
    if (!p.cues.length) {
      const e = document.createElement('p');
      e.className = 'cue-empty';
      e.textContent = '导入歌词，或添加第一句';
      list.appendChild(e);
    }
  }
  function inspector() {
    const cue = p.cues[index];
    document
      .querySelectorAll('.inspector input,.inspector textarea,.inspector select')
      .forEach((e) => (e.disabled = !cue));
    for (const key of ['text', 'note', 'focus', 'highlight', 'style', 'motion'])
      $('cue-' + key).value = (cue && cue[key]) || '';
    $('cue-start').value = cue ? LMCore.stamp(cue.start) : '';
    $('cue-end').value = cue ? LMCore.stamp(cue.end) : '';
    $('cue-highlight-mode').value = (cue && cue.highlightMode) || 'auto';
    $('cue-position').value = cue && cue.x != null ? cue.x + ',' + cue.y : 'auto';
    timingPreview();
  }
  function timingPreview(enter = p.enterPercent, exit = p.exitPercent) {
    const hold = 100 - enter - exit,
      cue = p.cues[index],
      seconds = cue ? cue.end - cue.start : 0;
    $('enterPercent-value').textContent = enter + '%';
    $('exitPercent-value').textContent = exit + '%';
    $('timing-enter').style.width = enter + '%';
    $('timing-hold').style.width = hold + '%';
    $('timing-exit').style.width = exit + '%';
    $('timing-note').textContent =
      `静止停留 ${hold}%` +
      (cue
        ? ` · 当前一句：进场 ${((seconds * enter) / 100).toFixed(2)} 秒 / 停留 ${((seconds * hold) / 100).toFixed(2)} 秒 / 退场 ${((seconds * exit) / 100).toFixed(2)} 秒`
        : '');
  }
  function gallery() {
    $('layouts').textContent = '';
    const q = $('layout-search').value.trim().toLowerCase(),
      group = $('layout-group').value,
      list = LMCore.styles.filter(
        (s) =>
          (group === 'all' || s.group === group) &&
          (!$('layout-favorites').checked || p.favorites.includes(s.id)) &&
          (s.name + ' ' + s.desc + ' ' + s.group).toLowerCase().includes(q)
      );
    $('layout-count').textContent = `${list.length} / ${LMCore.styles.length} 个可编辑排版预设`;
    for (const style of list) {
      const card = document.createElement('div');
      card.className =
        'layout-card' + (p.cues[index] && p.cues[index].style === style.id ? ' selected' : '');
      const pick = document.createElement('button');
      pick.className = 'layout-pick';
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 203;
      const sample = Object.assign({}, p, {
        width: 1920,
        height: 1080,
        recipe: null,
        motionMode: 'auto',
        cues: [{ text: '揭开所有你留的难题', focus: '难题', style: style.id, start: 0, end: 4 }]
      });
      LMRender.render(canvas, sample, 1.6, { background: 'mist' });
      hoverPreview(pick, (t) => LMRender.render(canvas, sample, t, { background: 'mist' }));
      const label = document.createElement('span');
      label.textContent = style.name;
      const desc = document.createElement('small');
      desc.textContent = style.desc;
      pick.append(canvas, label, desc);
      pick.onclick = () => {
        if (!p.cues[index]) return;
        change((project) => {
          project.cues[index].style = style.id;
        });
        seek(p.cues[index].start + Math.min(0.9, (p.cues[index].end - p.cues[index].start) / 2));
      };
      const fav = document.createElement('button');
      fav.className = 'favorite';
      fav.textContent = p.favorites.includes(style.id) ? '★' : '☆';
      fav.title = '加入或移出收藏';
      fav.onclick = () =>
        change((project) => {
          const at = project.favorites.indexOf(style.id);
          if (at >= 0) project.favorites.splice(at, 1);
          else project.favorites.push(style.id);
        });
      card.append(pick, fav);
      $('layouts').appendChild(card);
    }
  }
  function hoverPreview(button, paintFrame) {
    let frame = 0,
      started = 0;
    function tick(now) {
      if (!button.isConnected) {
        frame = 0;
        return;
      }
      paintFrame(((now - started) / 1000) % 4.35);
      frame = requestAnimationFrame(tick);
    }
    function start() {
      if (frame) return;
      started = performance.now();
      frame = requestAnimationFrame(tick);
    }
    function stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      paintFrame(1.6);
    }
    button.addEventListener('mouseenter', start);
    button.addEventListener('focus', start);
    button.addEventListener('mouseleave', stop);
    button.addEventListener('blur', stop);
  }
  function motifGallery() {
    $('motif-gallery').textContent = '';
    for (const [id, name] of LMMotifs.list) {
      const card = document.createElement('button');
      card.className = 'layout-pick';
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 180;
      const scene = {
        duration: 4,
        width: 360,
        height: 180,
        unit: 2,
        intensity: 0.65,
        opacity: 1,
        layoutReady: true,
        items: [
          {
            type: 'path',
            name: id,
            paths: LMCore.makeOrnament(id, 2.2),
            x: 180,
            y: 85,
            fitScale: 1,
            color: p.accent,
            stroke: 2.4,
            alpha: 0.9,
            lag: 0.08
          }
        ]
      };
      const paint = (t) => {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#202835';
        ctx.fillRect(0, 0, 360, 180);
        LMRender.paintScene(ctx, scene, t);
      };
      paint(1.6);
      hoverPreview(card, paint);
      const label = document.createElement('span');
      label.textContent = name;
      card.append(canvas, label);
      card.onclick = () =>
        change((project) => {
          project.ornaments = 'motif:' + id;
          project.ornamentDensity = Math.max(1, project.ornamentDensity);
          if (project.recipe) project.recipe.ornaments = [id];
        });
      $('motif-gallery').appendChild(card);
    }
  }
  function draw() {
    index = Math.min(Math.max(0, index), Math.max(0, p.cues.length - 1));
    $('enterPercent').max = 100 - p.exitPercent;
    $('exitPercent').max = 100 - p.enterPercent;
    globals.forEach((id) => ($(id).value = p[id]));
    const profile = LMCore.songProfile(p);
    $('ornamentDensity').max = profile
      ? p.ornaments.startsWith('motif:')
        ? Math.max(1, profile.maxDecor)
        : profile.maxDecor
      : 4;
    $('intensity').max = profile ? profile.intensity : 1;
    for (const id of ['scale', 'intensity', 'opacity', 'emphasisScale'])
      $(id + '-value').textContent =
        p[id] + (id === 'opacity' ? '%' : id === 'intensity' ? '' : '×');
    $('ornament-size-value').textContent = p.ornamentSize + '×';
    $('ornament-count-value').textContent = p.ornamentDensity;
    $('audio-name').textContent = p.audioName || '未载入音乐';
    $('clear-audio').hidden = !p.audioName;
    if (LMSubtitles.sync(p)) persist();
    $('undo').disabled = !history.length || busy;
    renderCues();
    inspector();
    gallery();
    motifGallery();
    LMStylesUI.draw();
    paint();
    LMSubtitles.hydrate(p);
  }
  function validateProject(input) {
    const value = LMCore.normalize(input);
    if (value.cues.length > 1000) throw new Error('一次最多支持 1000 句');
    value.cues.forEach((c, i) => {
      if (
        !c ||
        typeof c.text !== 'string' ||
        !c.text.trim() ||
        c.text.length > 500 ||
        !Number.isFinite(+c.start) ||
        !Number.isFinite(+c.end) ||
        +c.start < 0 ||
        +c.end <= +c.start ||
        +c.end > 86400
      )
        throw new Error('方案第 ' + (i + 1) + ' 句内容或时间无效');
      c.start = +c.start;
      c.end = +c.end;
    });
    return value;
  }
  function importLyrics(text, name) {
    if (busy) return;
    const cues = LMCore.parse(text, name);
    pause();
    change((project) => {
      project.cues = cues;
    });
    index = 0;
    seek(cues[0].start + Math.min(0.8, (cues[0].end - cues[0].start) / 2));
    draw();
    toast('已保留歌词时间：' + cues.length + ' 句');
  }
  function bindFile(id, handler) {
    $(id).onchange = () =>
      run(async () => {
        if (busy) return;
        const file = $(id).files[0];
        if (file) await handler(file);
        $(id).value = '';
      });
  }
  globals.forEach(
    (id) =>
      ($(id).onchange = () =>
        change((project) => {
          project[id] = numeric.includes(id) ? +$(id).value : $(id).value;
          if (project.recipe) {
            const range =
              id === 'font'
                ? 'fonts'
                : id === 'focusFont'
                  ? 'focusFonts'
                  : id === 'highlightMode'
                    ? 'highlights'
                    : ['color', 'accent', 'highlightColor'].includes(id)
                      ? 'palettes'
                      : null;
            if (range) project.recipe[range] = [];
          }
          if (id === 'ornaments' && project.ornaments.startsWith('motif:')) {
            project.ornamentDensity = Math.max(1, project.ornamentDensity);
            if (project.recipe) project.recipe.ornaments = [project.ornaments.slice(6)];
          }
        }))
  );
  for (const id of ['enterPercent', 'exitPercent'])
    $(id).oninput = () => timingPreview(+$('enterPercent').value, +$('exitPercent').value);
  for (const key of ['text', 'note', 'focus', 'highlight', 'style', 'motion'])
    $('cue-' + key).onchange = () =>
      run(async () => {
        const value = $('cue-' + key).value.trim();
        const cue = p.cues[index];
        if (!cue) return;
        if (key === 'text' && !value) throw new Error('歌词不能为空，删除请用「删除选中句」');
        if (value.length > 500) throw new Error('每句最多 500 字符');
        if (key === 'focus' && value && !cue.text.includes(value))
          throw new Error('放大词需要出现在主歌词中');
        change((project) => {
          const c = project.cues[index];
          c[key] = value;
          if (key === 'note') {
            c.noteExplicit = true;
            delete c.noteAutomatic;
            delete c.noteSource;
            delete c.noteTarget;
          }
        });
      });
  for (const key of ['start', 'end'])
    $('cue-' + key).onchange = () =>
      run(async () => {
        const t = LMCore.time($('cue-' + key).value),
          c = p.cues[index];
        if (t < 0 || t > 86400 || (key === 'start' ? t >= c.end : t <= c.start))
          throw new Error('结束时间需晚于开始时间，且范围不超过 24 小时');
        change((project) => {
          project.cues[index][key] = t;
        });
        seek(p.cues[index].start + 0.2);
      });
  $('cue-highlight-mode').onchange = () =>
    change((project) => {
      project.cues[index].highlightMode = $('cue-highlight-mode').value;
    });
  $('cue-position').onchange = () =>
    change((project) => {
      const c = project.cues[index],
        v = $('cue-position').value;
      if (v === 'auto') {
        delete c.x;
        delete c.y;
      } else {
        [c.x, c.y] = v.split(',').map(Number);
      }
    });
  LMCore.styles.forEach((s) => {
    const o = document.createElement('option');
    o.value = s.id;
    o.textContent = s.name;
    $('cue-style').appendChild(o);
  });
  LMMotion.list.forEach(([value, label]) => {
    for (const id of ['motionMode', 'cue-motion']) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      $(id).appendChild(o);
    }
  });
  const singleMotifs = document.createElement('optgroup');
  singleMotifs.label = '指定一个动态元素';
  LMMotifs.list.forEach(([id, name]) => {
    const o = document.createElement('option');
    o.value = 'motif:' + id;
    o.textContent = name;
    singleMotifs.appendChild(o);
  });
  $('ornaments').appendChild(singleMotifs);
  [...new Set(LMCore.styles.map((s) => s.group))].forEach((group) => {
    const o = document.createElement('option');
    o.value = group;
    o.textContent = group;
    $('layout-group').appendChild(o);
  });
  $('layout-search').oninput =
    $('layout-group').onchange =
    $('layout-favorites').onchange =
      gallery;
  document.querySelectorAll('[data-tab]').forEach(
    (b) =>
      (b.onclick = () => {
        document
          .querySelectorAll('[data-tab]')
          .forEach((t) => t.setAttribute('aria-selected', t === b ? 'true' : 'false'));
        document
          .querySelectorAll('.tab-page')
          .forEach((page) => (page.hidden = page.id !== 'tab-' + b.dataset.tab));
      })
  );
  $('reroll').onclick = () =>
    change((project) => {
      project.seed = Math.floor(Math.random() * 10000000) + 1;
    });
  $('undo').onclick = () => {
    if (!history.length || busy) return;
    p = LMCore.normalize(JSON.parse(history.pop()));
    persist();
    loadAudio();
    draw();
  };
  $('play').onclick = () => run(play);
  $('seek').oninput = () => seek(+$('seek').value);
  $('background').onchange = $('guides').onchange = paint;
  $('add-cue').onclick = () => {
    change((project) => {
      const start = project.cues.length ? project.cues[project.cues.length - 1].end : 0;
      project.cues.push({ text: '新的歌词', note: '', focus: '', start, end: start + 4 });
    });
    index = p.cues.length - 1;
    seek(p.cues[index].start + 0.8);
    draw();
  };
  $('delete-cue').onclick = () =>
    change((project) => {
      project.cues.splice(index, 1);
    });
  $('paste').onclick = () => $('paste-dialog').showModal();
  $('paste-confirm').onclick = (event) => {
    event.preventDefault();
    run(async () => {
      importLyrics($('paste-text').value);
      $('paste-dialog').close();
    });
  };
  bindFile('subtitle', async (file) => importLyrics(await LMBridge.read(file), file.name));
  $('export-srt').onclick = () =>
    run(async () => {
      const file = await LMBridge.save(LMCore.toSRT(p.cues), p.title, 'srt');
      if (file) toast('SRT 已保存；开始和结束时间均保留');
    });
  $('save').onclick = () =>
    run(async () => {
      const file = await LMBridge.save(
        JSON.stringify(
          { format: 'LyricMotion', version: 1, project: p, userStyles: LMStylesUI.library },
          null,
          2
        ),
        p.title,
        'json'
      );
      if (file) toast('方案已保存（含时间、随机结果、高亮和风格集合）');
    });
  bindFile('open', async (file) => {
    const data = JSON.parse(await LMBridge.read(file));
    if (busy) return;
    if (data.format !== 'LyricMotion') throw new Error('请选择映词保存的方案文件');
    const value = validateProject(data.project);
    pause();
    checkpoint();
    p = value;
    index = 0;
    LMStylesUI.merge(data.userStyles);
    persist();
    loadAudio();
    seek(p.cues.length ? p.cues[0].start + 0.8 : 0);
    draw();
  });
  function loadAudio() {
    audio.pause();
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
      audioURL = '';
    }
    if (p.audioPath) {
      audio.src = LMBridge.fileURL(p.audioPath);
    } else {
      audio.removeAttribute('src');
      audio.load();
    }
  }
  bindFile('audio-file', async (file) => {
    pause();
    change((project) => {
      project.audioPath = file.path || '';
      project.audioName = file.name;
    });
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = URL.createObjectURL(file);
    audio.src = audioURL;
    seek(position);
    if (!file.path && LMBridge.isAE) toast('无法取得音乐路径，请在 AE 中手动导入音乐');
  });
  $('clear-audio').onclick = () => {
    pause();
    change((project) => {
      project.audioPath = '';
      project.audioName = '';
    });
    loadAudio();
  };
  bindFile('visual-file', async (file) => {
    if (visual && visual.tagName === 'VIDEO') visual.pause();
    if (visualURL) URL.revokeObjectURL(visualURL);
    visualURL = URL.createObjectURL(file);
    visual = document.createElement(file.type.startsWith('video') ? 'video' : 'img');
    if (visual.tagName === 'VIDEO') {
      visual.muted = true;
      visual.preload = 'auto';
      visual.onloadeddata = () => seek(position);
    } else visual.onload = paint;
    visual.src = visualURL;
    $('clear-visual').hidden = false;
  });
  $('clear-visual').onclick = () => {
    if (visual && visual.tagName === 'VIDEO') visual.pause();
    visual = null;
    if (visualURL) URL.revokeObjectURL(visualURL);
    visualURL = '';
    $('clear-visual').hidden = true;
    paint();
  };
  $('active-size').onclick = () =>
    run(async () => {
      const c = await LMBridge.call('active');
      change((project) => {
        project.width = c.width;
        project.height = c.height;
        project.fps = c.fps;
      });
      toast('已读取：' + c.name);
    });
  function setBusy(value) {
    outputBusy = value;
    updateBusy();
  }
  function updateBusy() {
    const value = (busy = outputBusy || LMSubtitles.busy);
    $('generate').disabled = $('prerender').disabled = $('active-size').disabled = value;
    $('cancel').hidden = !value;
    $('cancel').textContent = videoController ? '停止预渲染' : '停止生成';
    $('progress').hidden = !value;
    document.querySelector('.output').classList.toggle('busy', value);
    for (const selector of ['.library', '.settings', '.editor-grid', '.top-actions']) {
      const section = document.querySelector(selector);
      section.inert = value;
      if (value) section.setAttribute('inert', '');
      else section.removeAttribute('inert');
    }
    $('reconnect').disabled = value && !uncertain && !recovering;
  }
  function progressText(result) {
    return result.layers
      ? `已完成 ${result.count} / ${result.total} 句 · 第 ${result.line} 句：${result.layer} / ${result.layers} 个图层`
      : `已完成 ${result.count || 0} / ${result.total} 句`;
  }
  async function continueGeneration() {
    let result;
    do {
      if (stopRequested) {
        result = await LMBridge.call('cancel');
        break;
      }
      result = await LMBridge.call('step');
      $('progress').max = result.total || 1;
      $('progress').value =
        (result.count || 0) + (result.layers ? result.layer / result.layers : 0);
      $('status').textContent = progressText(result);
      await new Promise((resolve) => setTimeout(resolve, 45));
    } while (!result.done);
    $('status').textContent =
      (result.cancelled ? '生成已停止，保留已完成的 ' : '已生成：') +
      (result.name || '') +
      ' · ' +
      (result.count || 0) +
      ' 句' +
      (!result.cancelled ? '；AE 已定位到首句。' : '') +
      (result.warnings && result.warnings.length ? '\n' + result.warnings.join('\n') : '');
    return result;
  }
  $('generate').onclick = () =>
    run(async () => {
      if (busy) return;
      validateProject(p);
      pause();
      uncertain = false;
      recovering = false;
      setBusy(true);
      stopRequested = false;
      $('status').textContent = '正在检查 AE 连接…';
      $('progress').value = 0;
      let began = false;
      try {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const info = await LMBridge.connect();
        if (info.building) {
          recovering = true;
          $('resume').hidden = false;
          throw new Error('AE 中还有未完成的生成任务，请选择“继续生成”或“停止生成”。');
        }
        if (stopRequested) return;
        const subtitleWarning = await LMSubtitles.prepare(p, {
          report: (message) => ($('status').textContent = message)
        });
        if (stopRequested) return;
        $('status').textContent = '已连接 AE，正在创建透明歌词合成…';
        await new Promise((resolve) => setTimeout(resolve, 50));
        const first = await LMBridge.begin(clone(p), $('overlay').checked);
        began = true;
        $('progress').max = first.total;
        await continueGeneration();
        began = false;
        if (subtitleWarning) $('status').textContent += '\n' + subtitleWarning;
      } catch (e) {
        uncertain = !!e.uncertain;
        if (began && !uncertain)
          try {
            await LMBridge.call('cancel');
          } catch (_) {}
        throw e;
      } finally {
        setBusy(uncertain || recovering);
        draw();
      }
    });
  $('cancel').onclick = () => {
    stopRequested = true;
    if (videoController) videoController.abort();
    LMSubtitles.cancel();
    if (recovering || uncertain) {
      run(async () => {
        await LMBridge.call('cancel');
        recovering = false;
        uncertain = false;
        setBusy(false);
        $('resume').hidden = true;
        $('status').textContent = '已停止上次任务，已完成的歌词保留在 AE 项目中。';
      });
    } else $('status').textContent = '已请求停止，将在当前操作返回后结束。';
  };
  $('resume').onclick = () =>
    run(async () => {
      recovering = false;
      uncertain = false;
      stopRequested = false;
      $('resume').hidden = true;
      setBusy(true);
      try {
        await continueGeneration();
      } catch (e) {
        uncertain = !!e.uncertain;
        throw e;
      } finally {
        setBusy(uncertain);
        draw();
      }
    });
  async function reconnect() {
    $('connection').textContent = '正在连接 AE…';
    $('connection').classList.remove('connection-error');
    const info = await LMBridge.connect();
    $('connection').textContent = info.browser
      ? '独立预览 · AE 操作需在面板内使用'
      : '已连接 AE ' + info.ae + ' · ' + info.version;
    uncertain = false;
    recovering = !!info.building;
    if (!outputBusy) setBusy(recovering);
    $('resume').hidden = !recovering;
    if (recovering) {
      $('status').textContent =
        '检测到未完成的任务。' + progressText(info.progress) + '。可继续生成或停止。';
      $('progress').max = info.progress.total;
      $('progress').value = info.progress.count;
    } else if (info.lastResult) {
      const result = info.lastResult;
      $('status').textContent =
        (result.cancelled ? '上次任务已停止：' : '已确认生成完成：') +
        result.name +
        ' · ' +
        result.count +
        ' 句，结果保留在 AE 项目中。' +
        (result.warnings && result.warnings.length ? '\n' + result.warnings.join('\n') : '');
    } else if (!info.browser) $('status').textContent = '已连接 AE，可以生成可编辑文字图层。';
    return info;
  }
  $('reconnect').onclick = () => run(reconnect);
  window.addEventListener('lm:bridge', (event) => {
    const detail = event.detail;
    if (detail.late && uncertain) {
      run(reconnect);
      return;
    }
    if (detail.seconds >= 3 && busy) {
      $('status').textContent =
        `正在等待 AE 返回（${detail.seconds} 秒）。若 AE 有弹窗，请先处理弹窗。`;
    }
  });
  $('prerender').onclick = () =>
    run(async () => {
      if (busy) return;
      validateProject(p);
      $('render-name').textContent =
        p.title + ' · ' + p.width + '×' + p.height + ' · ' + p.fps + ' fps';
      $('render-audio').disabled = !p.audioPath;
      $('render-audio').checked = !!p.audioPath;
      $('render-dialog').showModal();
    });
  $('render-confirm').onclick = (event) => {
    event.preventDefault();
    run(async () => {
      if (busy) return;
      validateProject(p);
      const includeAudio = $('render-audio').checked,
        format = $('render-format').value,
        previewBackground = $('background').value,
        background = previewBackground === 'alpha' && !visual ? 'transparent' : previewBackground,
        media = visual;
      if (format === 'mp4' && background === 'transparent')
        throw new Error('当前预览为透明底。请使用 MOV，或先在预览中选择底色再导出 MP4');
      if (!p.cues.length) throw new Error('请先添加歌词');
      $('render-dialog').close();
      pause();
      stopRequested = false;
      videoController = new AbortController();
      setBusy(true);
      $('progress').value = 0;
      $('status').textContent = '正在准备面板当前歌词的视频…';
      let target = null,
        rendered = null;
      try {
        await LMBridge.connect();
        const warning = await LMSubtitles.prepare(p, {
          report: (message) => ($('status').textContent = message)
        });
        if (stopRequested) throw new Error('已取消预渲染');
        const project = clone(p),
          fps = Math.round(project.fps * 1000) / 1000;
        const first = project.cues.reduce((a, b) => (a.start <= b.start ? a : b));
        const audioBuffer = includeAudio ? await LMVideo.decodeAudio(project.audioPath) : null;
        const duration =
          Math.ceil(
            Math.max(
              ...project.cues.map((cue) => cue.end),
              audioBuffer ? audioBuffer.duration : 0
            ) * fps
          ) / fps;
        if (stopRequested) throw new Error('已取消预渲染');
        target = await LMBridge.call('prepareVideo', {
          title: project.title,
          format,
          width: project.width,
          height: project.height,
          fps,
          duration,
          previewTime: first.start + Math.min(0.9, (first.end - first.start) / 2)
        });
        rendered = await LMVideo.encode(project, {
          createMovie: (spec) =>
            format === 'mp4'
              ? LMMP4.create(
                  target.path,
                  spec,
                  audioBuffer ? Math.min(2, audioBuffer.numberOfChannels) : 0
                )
              : LMBridge.createMovie(target.path, spec),
          format,
          signal: videoController.signal,
          background,
          media,
          audio: audioBuffer,
          onProgress: (state) => {
            $('progress').max = state.frames;
            $('progress').value = state.frame;
            $('status').textContent =
              state.stage === 'video'
                ? '正在编码歌词画面：' + state.frame + ' / ' + state.frames + ' 帧'
                : '正在写入音乐…';
          }
        });
        $('cancel').hidden = true;
        $('status').textContent = '视频已生成，正在导入 AE 项目…';
        const result = await LMBridge.call('importVideo', { token: target.token });
        $('status').textContent =
          '已导入 AE 项目：' + result.name + '\n' + result.path + (warning ? '\n' + warning : '');
      } catch (e) {
        if (rendered) e.message += '\n视频已保留：' + rendered.path;
        $('status').textContent = e.message;
        throw e;
      } finally {
        if (target)
          try {
            await LMBridge.call('releaseVideo', { token: target.token });
          } catch (_) {}
        videoController = null;
        setBusy(false);
      }
    });
  };
  LMLocal.init({
    run,
    toast,
    createStyle: (records, name) => LMStylesUI.createFromLocal(records, name)
  });
  LMStylesUI.init({ run, toast, project: () => p, change });
  LMSubtitles.init({
    run,
    project: () => p,
    changed: () => {
      persist();
      inspector();
      paint();
    },
    busyChanged: updateBusy
  });
  loadAudio();
  persist();
  draw();
  reconnect().catch((e) => {
    $('connection').textContent = 'AE 连接失败';
    $('connection').classList.add('connection-error');
    $('status').textContent = e.message;
    toast(e.message);
  });
  window.addEventListener('beforeunload', persist);
})();

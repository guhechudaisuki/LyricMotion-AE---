window.LMLocal = (() => {
  const $ = (id) => document.getElementById(id);
  let extra = [],
    limit = 40,
    hooks = {},
    assetData = null,
    catalogLoaded = false,
    curatedLoaded = false;
  let groups = [],
    curatedRecords = [];
  try {
    extra = JSON.parse(localStorage.getItem('lyricmotion.local') || '[]');
  } catch (_) {}
  if (!Array.isArray(extra)) extra = [];
  extra = extra.filter(
    (r) => r && typeof r.id === 'string' && typeof r.path === 'string' && typeof r.name === 'string'
  );
  const map = new Map((window.LMCatalog || []).map((r) => [r.id, r]));
  extra.forEach((r) => map.set(r.id, r));
  let records = [...map.values()];
  const el = (tag, cls, value) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (value != null) e.textContent = value;
    return e;
  };
  const groupName = (r) => (groups.find((g) => g.id === r.group) || {}).name || '';
  const isTextTemplate = (r) => r.kind === 'aep' && r.role === 'text';
  function filtered() {
    const q = $('local-search').value.trim().toLowerCase(),
      kind = $('local-kind').value;
    const category = $('local-curation') ? $('local-curation').value : 'curated';
    return records.filter(
      (r) =>
        (category === 'all' || (category === 'curated' ? !!r.group : r.group === category)) &&
        (kind === 'all' || r.kind === kind) &&
        (r.name + ' ' + r.folder + ' ' + groupName(r) + ' ' + (r.source || ''))
          .toLowerCase()
          .includes(q)
    );
  }
  function draw() {
    const list = filtered(),
      category = $('local-curation') ? $('local-curation').value : 'curated';
    $('local-count').textContent =
      `找到 ${list.length} 项 · 精选 ${curatedRecords.length} 项 · 本地索引 ${records.length} 项`;
    const group = groups.find((g) => g.id === category);
    if ($('local-curation-note'))
      $('local-curation-note').textContent = group
        ? group.note
        : category === 'all'
          ? '完整索引含原始素材与工程。精选动态库按动作筛选，预览仅用于挑选。'
          : '精选文字遮罩、逐字运动、线条描画和几何小元素。FFX 可应用到图层，工程合集需先选择内部合成。';
    if ($('local-create-style')) {
      $('local-create-style').disabled = !list.length || typeof hooks.createStyle !== 'function';
      $('local-create-style').textContent = group
        ? `用本组建立风格（${list.length}）`
        : `用筛选结果建立风格（${list.length}）`;
    }
    $('local-list').textContent = '';
    $('local-more').hidden = list.length <= limit;
    for (const r of list.slice(0, limit)) {
      const card = el('div', 'local-card');
      if (r.preview) {
        const img = el('img');
        img.loading = 'lazy';
        img.alt = r.name;
        img.src = LMBridge.fileURL(r.preview);
        img.onerror = () => img.replaceWith(el('div', 'local-placeholder', r.kind.toUpperCase()));
        card.appendChild(img);
      } else card.appendChild(el('div', 'local-placeholder', r.kind.toUpperCase()));
      const content = el('div');
      content.appendChild(el('strong', '', r.name));
      if (r.group) {
        const phase =
          r.phase === 'in'
            ? '进入'
            : r.phase === 'out'
              ? '离开'
              : r.phase === 'mid'
                ? '持续运动'
                : '';
        content.appendChild(
          el(
            'small',
            '',
            groupName(r) +
              (phase ? ' · ' + phase : '') +
              (r.previewMode === 'collection'
                ? ` · 工程合集${r.previewCount ? ' / ' + r.previewCount + ' 个演示' : ''}`
                : '')
          )
        );
      }
      const sub = el('small', '', r.source || r.folder);
      sub.title = r.path;
      content.appendChild(sub);
      if (isTextTemplate(r))
        content.appendChild(
          el('small', 'hint', '文字模板 · 导入后在 AE 中手动替换歌词，不加入自动风格。')
        );
      if (r.dependencyNote) {
        const note = el('small', 'hint', r.dependencyNote);
        note.title = r.path;
        content.appendChild(note);
      }
      const action = el(
        'button',
        'small',
        r.kind === 'ffx'
          ? '应用到 AE 所选图层'
          : isTextTemplate(r)
            ? '导入文字模板并选择合成'
            : r.kind === 'aep'
              ? '导入工程并选择合成'
              : '导入字旁素材'
      );
      action.type = 'button';
      action.onclick = () => hooks.run(() => use(r));
      content.appendChild(action);
      card.appendChild(content);
      $('local-list').appendChild(card);
    }
  }
  async function use(record) {
    const assetPath = LMBridge.resolveResource(record.path);
    if (record.kind === 'ffx') {
      const result = await LMBridge.call('applyPreset', { path: assetPath });
      hooks.toast(`已向 ${result.count} 个图层应用预设`);
      return;
    }
    assetData = await LMBridge.call('importLocal', { path: assetPath });
    assetData.role = record.role;
    assetData.textTemplate = isTextTemplate(record);
    $('asset-comp').textContent = '';
    const choices = assetData.kind === 'project' ? assetData.comps : [assetData];
    if (!choices.length) throw new Error('该工程没有可导入的合成');
    choices.forEach((c) => {
      const o = el('option', '', c.name);
      o.value = c.id;
      $('asset-comp').appendChild(o);
    });
    const template = assetData.textTemplate;
    $('asset-add').textContent = template ? '打开文字模板' : '加入当前合成';
    $('asset-dialog').querySelector('h2').textContent = template
      ? '打开文字模板 · 手动编辑'
      : '导入的动态元素';
    $('asset-dialog').querySelector('.hint').textContent = template
      ? '选择模板内的真实合成，在 AE 中打开后手动替换歌词和调整时间。模板不会作为字旁素材缩小加入。'
      : '先在 AE 中打开目标合成。若选中一个文字层，素材将作为它的子图层放在文字旁边。';
    $('asset-screen').checked = false;
    $('asset-screen').parentElement.hidden = template;
    $('asset-dialog').showModal();
  }
  async function scan() {
    if (!LMBridge.fs) throw new Error('请在 AE 面板内扫描本地文件夹');
    const result = await LMBridge.call('folder');
    if (!result.path) return;
    const queue = [result.path],
      found = [],
      fs = LMBridge.fs,
      p = LMBridge.path;
    let visited = 0,
      skipped = 0;
    $('scan').disabled = true;
    try {
      while (queue.length) {
        const dir = queue.pop();
        let entries;
        try {
          entries = await fs.promises.readdir(dir, { withFileTypes: true });
        } catch (_) {
          skipped++;
          continue;
        }
        for (const e of entries) {
          if (e.isSymbolicLink()) continue;
          const file = p.join(dir, e.name);
          if (e.isDirectory()) {
            if (!/preview|thumbnail|node_modules|\.git/i.test(e.name)) queue.push(file);
            continue;
          }
          if (
            !e.isFile() ||
            !/\.(ffx|aep|aepx|mov|mp4|png|jpe?g|gif|webm)$/i.test(e.name) ||
            /\d{4,}\.(png|jpg|jpeg)$/i.test(e.name)
          )
            continue;
          const ext = p.extname(file),
            kind = /ffx/i.test(ext) ? 'ffx' : /aep/i.test(ext) ? 'aep' : 'media';
          found.push({
            id: 'local:' + file.toLowerCase(),
            path: file,
            name: p.basename(file, ext),
            folder: dir,
            kind,
            role: kind === 'ffx' && /text|文字|glyph|otext|字效/i.test(file) ? 'text' : 'decor',
            preview: ''
          });
        }
        if (++visited % 20 === 0) {
          $('local-count').textContent = `扫描中… ${found.length} 项`;
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      found.forEach((r) => map.set(r.id, { ...r, ...(map.get(r.id) || {}) }));
      records = [...map.values()];
      const extras = new Map(extra.map((r) => [r.id, r]));
      found.forEach((r) => extras.set(r.id, r));
      extra = [...extras.values()];
      try {
        localStorage.setItem('lyricmotion.local', JSON.stringify(extra));
      } catch (_) {
        hooks.toast('扫描完成；索引较大，请把风格集合保存到方案以便下次使用');
      }
      hooks.toast(`新增或更新 ${found.length} 项${skipped ? '；部分文件夹无法读取' : ''}`);
      limit = 40;
      draw();
    } finally {
      $('scan').disabled = false;
    }
  }
  function init(callbacks) {
    hooks = callbacks;
    if (!$('local-curation')) {
      const category = el('select');
      category.id = 'local-curation';
      category.setAttribute('aria-label', '精选动态分类');
      const option = el('option', '', '精选动态库 · 载入中');
      option.value = 'curated';
      category.appendChild(option);
      const all = el('option', '', '全部本地索引');
      all.value = 'all';
      category.appendChild(all);
      $('local-kind').before(category);
      const note = el('p', 'hint');
      note.id = 'local-curation-note';
      $('local-count').before(note);
      const create = el('button', 'small', '用本组建立风格');
      create.id = 'local-create-style';
      create.type = 'button';
      $('local-count').before(create);
      category.onchange = () => {
        limit = 40;
        draw();
      };
      create.onclick = () =>
        hooks.run(async () => {
          const list = filtered();
          if (!list.length || !hooks.createStyle) return;
          const automatic = list.filter((r) => !isTextTemplate(r));
          if (!automatic.length) {
            hooks.toast('文字模板请导入后在 AE 里替换歌词；自动风格可选 FFX、内置排版和字旁工程');
            return;
          }
          if (automatic.length < list.length)
            hooks.toast(`已排除 ${list.length - automatic.length} 个需手动替换歌词的文字模板`);
          const group = groups.find((g) => g.id === category.value);
          await hooks.createStyle(
            automatic,
            group ? group.name.replace(/^(文字|元素) · /, '') : '我的动态精选'
          );
        });
    }
    $('local-search').oninput = $('local-kind').onchange = () => {
      limit = 40;
      draw();
    };
    $('local-more').onclick = () => {
      limit += 40;
      draw();
    };
    $('scan').onclick = () => hooks.run(scan);
    $('asset-add').onclick = (event) => {
      event.preventDefault();
      hooks.run(async () => {
        const template = !!(assetData && assetData.textTemplate);
        const result = template
          ? await LMBridge.call('openLocal', { id: +$('asset-comp').value })
          : await LMBridge.call('addLocal', {
              id: +$('asset-comp').value,
              screen: $('asset-screen').checked
            });
        $('asset-dialog').close();
        hooks.toast((template ? '已打开文字模板，请在 AE 中替换歌词：' : '已加入：') + result.name);
      });
    };
    draw();
    if (!curatedLoaded) {
      const script = document.createElement('script');
      script.src = 'data/curated-motion.js';
      script.async = true;
      script.onload = () => {
        const data = window.LMCuratedMotion || {};
        groups = data.groups || [];
        curatedRecords = data.records || [];
        curatedRecords.forEach((r) => map.set(r.id, { ...(map.get(r.id) || {}), ...r }));
        records = [...map.values()];
        curatedLoaded = true;
        const category = $('local-curation'),
          selected = category.value;
        category.textContent = '';
        const curated = el('option', '', `精选动态库 · ${curatedRecords.length} 项`);
        curated.value = 'curated';
        category.appendChild(curated);
        const text = el('optgroup');
        text.label = '动态文字';
        const decor = el('optgroup');
        decor.label = '动态小元素';
        groups.forEach((g) => {
          const option = el('option', '', `${g.name}（${g.count}）`);
          option.value = g.id;
          (g.role === 'text' ? text : decor).appendChild(option);
        });
        category.append(text, decor);
        const all = el('option', '', '全部本地索引');
        all.value = 'all';
        category.appendChild(all);
        category.value = selected;
        draw();
        window.dispatchEvent(new CustomEvent('lm:catalog'));
      };
      script.onerror = () => {
        $('local-curation').value = 'all';
        draw();
        hooks.toast('精选库载入失败，已显示完整本地索引');
      };
      document.head.appendChild(script);
    }
    if (!catalogLoaded) {
      $('local-count').textContent = '正在后台载入本地索引…';
      const script = document.createElement('script');
      script.src = 'data/local-catalog.js';
      script.async = true;
      script.onload = () => {
        (window.LMCatalog || []).forEach((r) => map.set(r.id, { ...r, ...(map.get(r.id) || {}) }));
        extra.forEach((r) => map.set(r.id, { ...r, ...(map.get(r.id) || {}) }));
        records = [...map.values()];
        catalogLoaded = true;
        draw();
        window.dispatchEvent(new CustomEvent('lm:catalog'));
      };
      script.onerror = () => {
        $('local-count').textContent = '索引载入失败，可用“扫描文件夹”重建。';
      };
      document.head.appendChild(script);
    }
  }
  return {
    init,
    get records() {
      return records;
    }
  };
})();

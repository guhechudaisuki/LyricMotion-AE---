window.LMStylesUI = (() => {
  const $ = (id) => document.getElementById(id),
    clone = (v) => JSON.parse(JSON.stringify(v));
  const marks = {};
  LMMotifs.list.forEach((m) => (marks[m[0]] = m[1]));
  let hooks,
    userStyles = [],
    selected = new Map(),
    limit = 60,
    editing = null;
  const extraSources = ['exits', 'positions', 'fonts', 'focusFonts', 'palettes', 'highlights'];
  const sourceLabels = {
    layouts: '排版',
    motions: '文字动作',
    ornaments: '小元素',
    local: '本地预设',
    exits: '退出手法',
    positions: '左右位置',
    fonts: '正文字体',
    focusFonts: '关键词字体',
    palettes: '配色',
    highlights: '关键词高亮'
  };
  const emptyAdvice = {
    ornaments: '未选则不添加',
    local: '未选则不添加',
    positions: '未选则左右随机',
    exits: '未选则使用排版动作',
    fonts: '未选则使用整曲设置',
    focusFonts: '未选则使用整曲设置',
    palettes: '未选则使用整曲设置',
    highlights: '未选则使用整曲设置'
  };
  const choiceAdvice = {
    layouts: '每句从所选排版中挑选',
    motions: '控制文字成对进退动作',
    ornaments: '每句从所选小元素中挑选',
    local: '在 AE 中应用所选本地预设或素材',
    exits: '每句从所选退出手法中挑选',
    positions: '左右位置按所选范围交替',
    fonts: '从范围内为整曲选一种正文字体',
    focusFonts: '从范围内为整曲选一种关键词字体',
    palettes: '从范围内为整曲选一套颜色',
    highlights: '每句从所选高亮方式中挑选'
  };
  function choiceName(source, id) {
    const list =
      source === 'motions'
        ? LMMotion.list.map((m) => ({ id: m[0], name: m[1] }))
        : (LMCore.styleChoices && LMCore.styleChoices[source]) || [];
    const found = list.find((entry) => entry.id === id);
    return found ? found.name : id;
  }
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  };
  function persist() {
    try {
      localStorage.setItem('lyricmotion.styles', JSON.stringify(userStyles));
    } catch (_) {
      hooks.toast('风格库较大，请用「保存方案」保存到文件');
    }
  }
  function useRecipe(p, style) {
    p.recipe = clone(style.recipe);
    p.theme = style.id;
    p.songProfile = style.id;
    p.mode = 'mix';
    p.motionMode = 'auto';
    p.ornaments = style.recipe.ornaments.length ? 'auto' : 'none';
    if (style.recipe.ornaments.length && !p.ornamentDensity) p.ornamentDensity = 1;
  }
  function draw() {
    const p = hooks.project(),
      select = $('songProfile');
    select.textContent = '';
    const option = (label, value, parent = select) => {
      const o = el('option', '', label);
      o.value = value;
      parent.appendChild(o);
    };
    option('完全随机 · 无固定风格', 'free');
    const builtins = el('optgroup');
    builtins.label = '歌曲类型';
    LMCore.profiles.forEach((t) => option(t.name, t.id, builtins));
    select.appendChild(builtins);
    if (userStyles.length) {
      const own = el('optgroup');
      own.label = '我的风格';
      userStyles.forEach((t) => option(t.name, t.id, own));
      select.appendChild(own);
    }
    if (p.recipe && !userStyles.some((t) => t.id === p.songProfile))
      option('方案中保存的自选风格', p.songProfile);
    select.value = p.songProfile || 'free';
    const t = LMCore.songProfile(p),
      custom = userStyles.find((theme) => theme.id === p.songProfile);
    $('profile-note').textContent = p.recipe
      ? `自选集合：${custom ? custom.name : '方案中保存的风格'}。随机只使用选中的预设，本地动效在 AE 中查看。`
      : t
        ? t.desc + ' 随机编排保持这个分类。'
        : `完全随机使用 ${LMCore.styles.length} 个内置排版；选歌曲类型后，进出场手法、配色与装饰随分类搭配。`;
    $('randomize').textContent = select.value === 'free' ? '一键随机' : '按歌曲风格生成';
    $('user-styles').textContent = '';
    $('user-empty').hidden = userStyles.length > 0;
    for (const t of userStyles) {
      const card = el('div', 'theme-card user-style' + (p.theme === t.id ? ' selected' : ''));
      card.appendChild(el('strong', '', t.name));
      card.appendChild(
        el(
          'small',
          '',
          Object.keys(sourceLabels)
            .map((source) => `${(t.recipe[source] || []).length} ${sourceLabels[source]}`)
            .join(' / ')
        )
      );
      const del = el('button', 'delete-style', '×');
      del.title = '删除这个自定义风格';
      del.onclick = () => {
        userStyles = userStyles.filter((s) => s.id !== t.id);
        persist();
        if (p.songProfile === t.id)
          hooks.change((project) => LMCore.applySongProfile(project, 'free'));
        else draw();
      };
      card.appendChild(del);
      const edit = el('button', 'small', '编辑预设集合');
      edit.onclick = () => open(t);
      card.appendChild(edit);
      $('user-styles').appendChild(card);
    }
  }
  function apply(id) {
    hooks.change((p) => {
      const own = userStyles.find((t) => t.id === id);
      if (own) useRecipe(p, own);
      else if (!p.recipe || id !== p.songProfile) LMCore.applySongProfile(p, id);
    });
  }
  function randomize() {
    hooks.change((p) => {
      p.seed = Math.floor(Math.random() * 10000000) + 1;
      const profile = LMCore.songProfile(p);
      if (profile) LMCore.applySongProfile(p, profile.id);
      else if (!p.recipe) LMCore.applySongProfile(p, 'free');
    });
  }
  function choices() {
    const source = $('recipe-source').value,
      q = $('recipe-search').value.trim().toLowerCase();
    let list =
      source === 'layouts'
        ? LMCore.styles.map((s) => ({
            id: 'layout:' + s.id,
            key: s.id,
            name: s.name,
            desc: s.desc,
            source
          }))
        : source === 'motions'
          ? LMMotion.list.map((m) => ({
              id: 'motion:' + m[0],
              key: m[0],
              name: m[1],
              desc: '可编辑进场与退场动作',
              source
            }))
          : source === 'ornaments'
            ? Object.keys(marks).map((id) => ({
                id: 'ornament:' + id,
                key: id,
                name: marks[id],
                source
              }))
            : extraSources.includes(source)
              ? ((LMCore.styleChoices && LMCore.styleChoices[source]) || []).map((r) => ({
                  id: source + ':' + r.id,
                  key: r.id,
                  name: r.name,
                  desc: r.desc,
                  source
                }))
              : LMLocal.records.map((r) => Object.assign({}, r, { source: 'local' }));
    const rank = (r) => {
      const chosen = selected.get(r.id);
      return !chosen ? 0 : chosen.kind === 'aep' && !chosen.compName ? 2 : 1;
    };
    return list
      .filter((r) =>
        (r.name + ' ' + (r.folder || '') + ' ' + (r.desc || '')).toLowerCase().includes(q)
      )
      .sort((a, b) => rank(b) - rank(a));
  }
  function selectionSummary() {
    const counts = {};
    for (const r of selected.values()) counts[r.source] = (counts[r.source] || 0) + 1;
    $('recipe-count').textContent = `已选 ${selected.size} 项 · 不限数量`;
    $('recipe-source-count').textContent = Object.keys(sourceLabels)
      .map(
        (source) =>
          `${sourceLabels[source]} ${counts[source] || 0}${!counts[source] && emptyAdvice[source] ? '（' + emptyAdvice[source] + '）' : ''}`
      )
      .join(' · ');
    $('recipe-selected').textContent = '';
    for (const r of [...selected.values()].slice(0, 100)) {
      const tag = el('span', 'recipe-tag', r.name);
      const del = el('button', '', '×');
      del.type = 'button';
      del.onclick = () => {
        selected.delete(r.id);
        drawRecipe();
      };
      tag.appendChild(del);
      $('recipe-selected').appendChild(tag);
    }
    if (selected.size > 100)
      $('recipe-selected').appendChild(el('span', '', `另有 ${selected.size - 100} 项`));
  }
  function drawRecipe() {
    const list = choices();
    $('recipe-list').textContent = '';
    $('recipe-more').hidden = list.length <= limit;
    for (const r of list.slice(0, limit)) {
      const row = el('div', 'recipe-item'),
        check = el('input');
      check.type = 'checkbox';
      check.checked = selected.has(r.id);
      check.setAttribute('aria-label', r.name);
      const body = el('div'),
        label = el('span', '', r.name),
        desc = el('small', '', r.folder || r.desc || choiceAdvice[r.source] || '预设');
      desc.title = r.path || '';
      body.appendChild(label);
      body.appendChild(desc);
      if (r.kind === 'aep' && r.role === 'text') {
        check.disabled = true;
        body.appendChild(el('small', 'hint', '文字工程请在本地库手动导入并替换歌词'));
      }
      check.onchange = () => {
        if (check.checked) selected.set(r.id, clone(r));
        else selected.delete(r.id);
        drawRecipe();
      };
      row.appendChild(check);
      row.appendChild(body);
      if (check.checked && r.source === 'local') {
        const rec = selected.get(r.id);
        if (r.kind === 'ffx') {
          const role = el('select');
          for (const [value, text] of [
            ['text', '作用于文字'],
            ['decor', '作用于字旁形状']
          ]) {
            const option = el('option', '', text);
            option.value = value;
            role.appendChild(option);
          }
          role.value = rec.role;
          role.onchange = () => {
            rec.role = role.value;
          };
          body.appendChild(role);
        } else {
          if (r.kind === 'aep') {
            const choose = el(
              'button',
              'small',
              rec.compName ? '合成：' + rec.compName : '选择 AEP 内部合成'
            );
            choose.type = 'button';
            choose.onclick = () =>
              hooks.run(async () => {
                choose.disabled = true;
                try {
                  const data = await LMBridge.call('importLocal', {
                    path: LMBridge.resolveResource(rec.path)
                  });
                  if (!data.comps || !data.comps.length) throw new Error('工程内没有可用合成');
                  const select = el('select');
                  const placeholder = el('option', '', '请选择内部合成');
                  placeholder.value = '';
                  select.appendChild(placeholder);
                  data.comps.forEach((c) => {
                    const option = el('option', '', c.name);
                    option.value = c.name;
                    select.appendChild(option);
                  });
                  select.value = rec.compName || '';
                  select.onchange = () => {
                    rec.compName = select.value;
                  };
                  body.appendChild(select);
                  if (data.comps.length === 1) {
                    rec.compName = data.comps[0].name;
                    select.value = rec.compName;
                  }
                  choose.textContent = '已列出内部合成';
                } finally {
                  choose.disabled = false;
                }
              });
            body.appendChild(choose);
          }
          const screen = el('label', 'inline'),
            box = el('input');
          box.type = 'checkbox';
          box.checked = !!rec.screen;
          box.onchange = () => {
            rec.screen = box.checked;
          };
          screen.appendChild(box);
          screen.appendChild(document.createTextNode('黑底使用滤色'));
          body.appendChild(screen);
        }
      }
      $('recipe-list').appendChild(row);
    }
    selectionSummary();
  }
  function open(style) {
    selected = new Map();
    editing = style ? style.id : null;
    $('style-name').value = style ? style.name : '';
    if (style) {
      style.recipe.layouts.forEach((id) =>
        selected.set('layout:' + id, {
          id: 'layout:' + id,
          key: id,
          name: LMCore.findStyle(id).name,
          source: 'layouts'
        })
      );
      style.recipe.ornaments.forEach((id) =>
        selected.set('ornament:' + id, {
          id: 'ornament:' + id,
          key: id,
          name: marks[id] || id,
          source: 'ornaments'
        })
      );
      (style.recipe.motions || []).forEach((id) =>
        selected.set('motion:' + id, {
          id: 'motion:' + id,
          key: id,
          name: (LMMotion.list.find((m) => m[0] === id) || [id, id])[1],
          source: 'motions'
        })
      );
      extraSources.forEach((source) =>
        (style.recipe[source] || []).forEach((id) =>
          selected.set(source + ':' + id, {
            id: source + ':' + id,
            key: id,
            name: choiceName(source, id),
            source
          })
        )
      );
      style.recipe.local.forEach((r) =>
        selected.set(r.id, Object.assign({}, clone(r), { source: 'local' }))
      );
    }
    $('recipe-source').value = 'layouts';
    $('recipe-search').value = '';
    limit = 60;
    drawRecipe();
    $('style-dialog').showModal();
  }
  function init(callbacks) {
    hooks = callbacks;
    try {
      userStyles = JSON.parse(localStorage.getItem('lyricmotion.styles') || '[]').filter(
        (s) => s.recipe
      );
    } catch (_) {}
    $('user-empty').textContent = '点「添加风格」，从现有预设里任意多选。自定义可删除，内置保留。';
    $('songProfile').onchange = () => apply($('songProfile').value);
    $('randomize').onclick = randomize;
    window.addEventListener('lm:catalog', () => {
      if ($('style-dialog').open && $('recipe-source').value === 'local') drawRecipe();
    });
    $('add-style').onclick = () => open();
    $('recipe-source').onchange = $('recipe-search').oninput = () => {
      limit = 60;
      drawRecipe();
    };
    $('recipe-more').onclick = () => {
      limit += 60;
      drawRecipe();
    };
    $('recipe-clear').onclick = () => {
      selected.clear();
      drawRecipe();
    };
    $('recipe-all').onclick = () => {
      choices().forEach((r) => {
        if (!selected.has(r.id) && !(r.kind === 'aep' && r.role === 'text'))
          selected.set(r.id, clone(r));
      });
      drawRecipe();
    };
    $('style-confirm').onclick = (event) => {
      event.preventDefault();
      hooks.run(async () => {
        const name = $('style-name').value.trim();
        if (!name) throw new Error('请填写风格名称');
        if (!selected.size) throw new Error('请至少选择一个预设');
        const recipe = {
          layouts: [],
          motions: [],
          ornaments: [],
          local: [],
          exits: [],
          positions: [],
          fonts: [],
          focusFonts: [],
          palettes: [],
          highlights: []
        };
        for (const r of selected.values()) {
          if (r.source === 'local') {
            if (r.kind === 'aep' && r.role === 'text')
              throw new Error('文字工程请从本地库导入后替换歌词：' + r.name);
            if (r.kind === 'aep' && !r.compName)
              throw new Error('请先指定 AEP 内部合成：' + r.name);
            const record = clone(r);
            delete record.source;
            recipe.local.push(record);
          } else if (Object.prototype.hasOwnProperty.call(recipe, r.source))
            recipe[r.source].push(r.key);
        }
        const style = { id: editing || 'user:' + Date.now(), name, recipe };
        userStyles = userStyles.filter((s) => s.id !== style.id);
        userStyles.push(style);
        persist();
        $('style-dialog').close();
        hooks.change((p) => useRecipe(p, style));
        hooks.toast('已保存并启用：' + name);
      });
    };
    draw();
  }
  function merge(styles) {
    if (!Array.isArray(styles)) return;
    for (const s of styles)
      if (
        s.id &&
        String(s.id).startsWith('user:') &&
        s.name &&
        s.recipe &&
        Array.isArray(s.recipe.layouts) &&
        Array.isArray(s.recipe.ornaments) &&
        Array.isArray(s.recipe.local)
      ) {
        const index = userStyles.findIndex((x) => x.id === s.id);
        if (index >= 0) userStyles[index] = s;
        else userStyles.push(s);
      }
    persist();
    draw();
  }
  function createFromLocal(records, name) {
    const usable = records.filter((r) => !(r.kind === 'aep' && r.role === 'text'));
    if (!usable.length) {
      hooks.toast('文字工程请在本地库导入后替换歌词');
      return;
    }
    open();
    $('style-name').value = name || '本地动效集合';
    usable.forEach((r) => selected.set(r.id, Object.assign({}, clone(r), { source: 'local' })));
    $('recipe-source').value = 'local';
    drawRecipe();
  }
  return {
    init,
    draw,
    merge,
    createFromLocal,
    get library() {
      return userStyles;
    }
  };
})();

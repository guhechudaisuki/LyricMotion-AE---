/* Optional subtitle translation. Credentials stay in this panel session. */
window.LMSubtitles = (() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const storageKey = 'lyricmotion.translation.settings';
  const defaults = { enabled: false, target: 'en', endpoint: '', model: '', limit: 500 };
  let settings = { ...defaults },
    apiKey = '',
    hooks,
    active = null,
    controller = null;
  let working = false,
    hydrationKey = '',
    hydrationPending = '',
    hydrationEpoch = 0;
  const attempted = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (saved)
      settings = {
        enabled: saved.enabled === true,
        target: LMTranslation.targets.includes(saved.target) ? saved.target : 'en',
        endpoint: typeof saved.endpoint === 'string' ? saved.endpoint : '',
        model: typeof saved.model === 'string' ? saved.model : '',
        limit:
          Number.isInteger(saved.limit) && saved.limit >= 1 && saved.limit <= 10000
            ? saved.limit
            : 500
      };
  } catch (_) {
    /* A missing or damaged preference file uses the default-off setting. */
  }

  function songKey(project, target = settings.target) {
    return JSON.stringify([
      target,
      project.cues.map((cue) => String(cue.text).replace(/\r\n?/g, '\n'))
    ]);
  }
  function say(message) {
    $('translation-status').textContent = message;
  }
  function stripAutomatic(cue) {
    cue.note = '';
    delete cue.noteAutomatic;
    delete cue.noteSource;
    delete cue.noteTarget;
  }
  function eligible(project, cue, index) {
    return (
      !cue.noteExplicit && (!cue.note || cue.noteAutomatic) && LMCore.needsNote(project, cue, index)
    );
  }
  // Run after layout/text/settings changes. Manual notes are never replaced.
  function sync(project) {
    const key = songKey(project),
      available = active && active.key === key ? active.results : null;
    let changed = false;
    project.cues.forEach((cue, index) => {
      if (
        cue.noteAutomatic &&
        (!settings.enabled ||
          cue.noteExplicit ||
          cue.noteSource !== cue.text ||
          cue.noteTarget !== settings.target ||
          !LMCore.needsNote(project, cue, index))
      ) {
        stripAutomatic(cue);
        changed = true;
      }
      const result = available && available[index];
      if (settings.enabled && eligible(project, cue, index) && !cue.note && result) {
        cue.note = result.note;
        cue.noteAutomatic = true;
        cue.noteSource = cue.text;
        cue.noteTarget = settings.target;
        changed = true;
      }
    });
    return changed;
  }
  function publish(key, results) {
    if (songKey(hooks.project()) !== key) return;
    active = { key, results };
    hydrationKey = key;
    if (sync(hooks.project())) hooks.changed();
  }
  async function stats() {
    try {
      const data = await LMTranslationCache.stats();
      $('translation-cache-status').textContent =
        `本地已保存 ${data.count} / ${data.limit} 首；超限时淘汰最久未使用的歌曲。`;
    } catch (_) {
      $('translation-cache-status').textContent =
        '本地缓存不可用；翻译前会提示，不会自动重复请求。';
    }
  }
  // Loading a song or changing a layout may read local data, never send a request.
  function hydrate(project) {
    if (!settings.enabled || working || !project.cues.some((cue, i) => eligible(project, cue, i)))
      return;
    const key = songKey(project);
    if (key === hydrationKey || key === hydrationPending) return;
    const snapshot = project.cues.map((cue) => ({ text: cue.text })),
      target = settings.target,
      epoch = ++hydrationEpoch;
    hydrationPending = key;
    LMTranslationCache.get(snapshot, target)
      .then((results) => {
        if (epoch !== hydrationEpoch) return;
        hydrationKey = key;
        if (results) publish(key, results);
      })
      .catch(() => {
        if (epoch === hydrationEpoch) hydrationKey = key;
      })
      .finally(() => {
        if (epoch === hydrationEpoch) hydrationPending = '';
      });
  }
  function setWorking(value) {
    working = value;
    for (const id of [
      'translation-enabled',
      'translationTarget',
      'translation-endpoint',
      'translation-model',
      'translation-key',
      'translation-cache-limit',
      'translation-config-save',
      'translate-missing'
    ])
      $(id).disabled = value;
    $('translate-cancel').hidden = !value;
    if (hooks) hooks.busyChanged();
  }
  function cancel() {
    if (controller) controller.abort();
  }
  async function prepare(project, options = {}) {
    if (sync(project)) hooks.changed();
    if (!settings.enabled) return '';
    if (working) return '副标题正在准备，请稍后再生成。';
    const wanted = project.cues.some((cue, i) => eligible(project, cue, i));
    if (!wanted) {
      say('本次排版没有需要自动补译的副标题；手填内容已保留。');
      return '';
    }
    const key = songKey(project),
      target = settings.target;
    const cues = project.cues.map((cue) => ({ text: cue.text, note: '' }));
    let warning = '';
    const report = (message) => {
      say(message);
      if (options.report) options.report(message);
    };
    setWorking(true);
    try {
      controller = LMTranslation.createController();
      report('正在查找本地歌曲译文…');
      let results;
      try {
        results = await LMTranslationCache.get(cues, target);
      } catch (error) {
        if (active && active.key === key) results = active.results;
        else throw error;
      }
      if (controller.signal.aborted) return '已取消翻译，空白副标题保持为空。';
      if (!results && active && active.key === key) results = active.results;
      if (results) {
        publish(key, results);
        report('已复用本地译文，没有发送 API 请求。');
        return '';
      }
      const missing = project.cues.some((cue, i) => eligible(project, cue, i) && !cue.note);
      if (!missing) {
        report('当前需要的副标题已有译文。');
        return '';
      }
      if (attempted.has(key) && !options.explicit) {
        warning =
          '这首歌本次会话已尝试翻译；未自动重复请求，空白副标题保持为空。可在设置中手动重试。';
        report(warning);
        return warning;
      }
      if (!settings.endpoint.trim() || !settings.model.trim()) {
        warning = '未配置翻译接口或模型，空白副标题保持为空。';
        report(warning);
        return warning;
      }
      LMTranslation.normalizeEndpoint(settings.endpoint);
      attempted.add(key);
      report(`正在一次请求翻译整首 ${cues.length} 句歌词，已有副标题不会被覆盖…`);
      results = await LMTranslation.translateBatch(cues, {
        target,
        endpoint: settings.endpoint,
        model: settings.model,
        apiKey,
        signal: controller.signal
      });
      if (controller.signal.aborted) return '已取消翻译，空白副标题保持为空。';
      try {
        await LMTranslationCache.put(cues, target, results);
      } catch (_) {
        warning = '译文已用于本次排版，但本地缓存写入失败；本次会话仍会复用，请检查磁盘空间。';
      }
      publish(key, results);
      report(warning || '整首译文已保存到本地；仅为没有 | 且排版需要副标题的行补译。');
      return warning;
    } catch (error) {
      warning =
        error && error.name === 'AbortError'
          ? '已取消翻译，空白副标题保持为空。'
          : error.message || '翻译失败，空白副标题保持为空。';
      report(warning);
      return warning;
    } finally {
      controller = null;
      setWorking(false);
      stats();
    }
  }
  function fill() {
    $('translation-enabled').checked = settings.enabled;
    $('translationTarget').value = settings.target;
    $('translation-endpoint').value = settings.endpoint;
    $('translation-model').value = settings.model;
    $('translation-key').value = apiKey;
    $('translation-cache-limit').value = settings.limit;
    stats();
  }
  async function apply() {
    const limit = Number($('translation-cache-limit').value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
      throw new Error('本地缓存上限请填 1–10000 首的整数。');
    const next = {
      enabled: $('translation-enabled').checked,
      target: $('translationTarget').value,
      endpoint: $('translation-endpoint').value.trim(),
      model: $('translation-model').value.trim(),
      limit
    };
    // Disabling translation remains available even when browser storage is unavailable.
    let storageWarning = '';
    try {
      await LMTranslationCache.setLimit(limit);
    } catch (_) {
      storageWarning = '本地缓存设置未能写入，请检查磁盘空间。';
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (_) {
      storageWarning = '设置仅在本次会话有效，本地存储写入失败。';
    }
    settings = next;
    apiKey = $('translation-key').value.trim();
    hydrationKey = '';
    hydrationPending = '';
    hydrationEpoch++;
    if (sync(hooks.project())) hooks.changed();
    hydrate(hooks.project());
    stats();
    say(
      storageWarning ||
        (settings.enabled
          ? '已开启。生成歌词时先查本地，缺少译文才整曲请求一次。'
          : '已关闭。手填副标题保留，其余副标题为空；本地译文继续保留。')
    );
  }
  function init(callbacks) {
    hooks = callbacks;
    $('translation-config').onclick = () => {
      fill();
      $('translation-dialog').showModal();
    };
    $('translation-config-save').onclick = (event) => {
      event.preventDefault();
      hooks.run(apply);
    };
    $('translate-missing').onclick = () =>
      hooks.run(async () => {
        if (working) return;
        await apply();
        if (!settings.enabled) {
          say('请先开启自动翻译；关闭时不会发送请求。');
          return;
        }
        await prepare(hooks.project(), { explicit: true });
      });
    $('translate-cancel').onclick = cancel;
    $('translation-dialog').addEventListener('cancel', () => {
      if (working) cancel();
    });
    fill();
    sync(hooks.project());
  }
  return {
    init,
    sync,
    hydrate,
    prepare,
    cancel,
    get busy() {
      return working;
    }
  };
})();

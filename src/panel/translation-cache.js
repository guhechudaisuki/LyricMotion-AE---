/* eslint no-control-regex: off -- Deliberate control-character sanitization and ASCII bridge checks. */
/* Persistent per-song translation cache. Stores lyrics and subtitles, never API credentials. */
window.LMTranslationCache = (() => {
  'use strict';
  const databaseName = 'LyricMotion.translation-cache',
    databaseVersion = 1;
  const defaultLimit = 500,
    maxLimit = 10000,
    maxCues = 1000,
    maxSongBytes = 512000;
  let opening = null;

  function problem(message, code) {
    const error = new Error(message);
    error.code = code || 'translation-cache';
    return error;
  }
  function storageProblem(error) {
    if (error && error.code && String(error.code).startsWith('translation-cache')) return error;
    if (error && error.name === 'QuotaExceededError')
      return problem(
        '翻译缓存空间不足，请减少缓存歌曲上限或清空缓存后重试。',
        'translation-cache-quota'
      );
    return problem('无法读写本机翻译缓存，请检查面板的本地存储权限。', 'translation-cache-storage');
  }
  function normalizeLines(value) {
    return value.replace(/\r\n?/g, '\n');
  }
  function byteLength(text) {
    let length = 0;
    for (const character of text) {
      const n = character.codePointAt(0);
      length += n <= 0x7f ? 1 : n <= 0x7ff ? 2 : n <= 0xffff ? 3 : 4;
    }
    return length;
  }
  function identity(cues) {
    if (!Array.isArray(cues) || cues.length > maxCues)
      throw problem('翻译缓存需要有效的歌词列表，每首最多 1000 句。', 'translation-cache-input');
    const texts = [],
      sources = [],
      active = [];
    let bytes = 0;
    cues.forEach((cue, index) => {
      if (!cue || typeof cue.text !== 'string' || cue.text.length > 500)
        throw problem(
          '歌词格式不适合缓存：每句主歌词必须为不超过 500 字符的文字。',
          'translation-cache-input'
        );
      const text = normalizeLines(cue.text);
      sources.push(cue.text);
      texts.push(text);
      bytes += byteLength(text);
      if (text.trim()) active.push(index);
    });
    if (bytes > maxSongBytes)
      throw problem(
        '整首歌词超过本机翻译缓存的单首大小限制，请减少歌词数量。',
        'translation-cache-input'
      );
    // Exact JSON keys avoid hash collisions. Timing, title, notes and API settings never enter the identity.
    return { id: JSON.stringify(texts), texts, sources, active };
  }
  function language(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 60 || /[\x00-\x1f]/.test(text))
      throw problem('翻译缓存需要有效的目标语言。', 'translation-cache-language');
    return { key: text.toLowerCase(), display: text };
  }
  function configuredLimit(value) {
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit)
      throw problem('缓存歌曲上限必须是 1 到 10000 之间的整数。', 'translation-cache-limit');
    return limit;
  }
  function config(value) {
    const limit =
      value && Number.isInteger(value.limit) && value.limit >= 1 && value.limit <= maxLimit
        ? value.limit
        : defaultLimit;
    const clock = value && Number.isSafeInteger(value.clock) && value.clock >= 0 ? value.clock : 0;
    return { key: 'config', limit, clock };
  }
  function validateResults(results, song, lang, stored) {
    if (!Array.isArray(results) || results.length !== song.active.length)
      throw problem(
        '翻译缓存只接受整首歌词的完整译文，数量与主歌词不一致。',
        'translation-cache-results'
      );
    const byIndex = new Map(),
      expected = new Set(song.active);
    for (const result of results) {
      if (
        !result ||
        !Number.isInteger(result.index) ||
        !expected.has(result.index) ||
        byIndex.has(result.index)
      )
        throw problem('翻译缓存的歌词索引存在遗漏、重复或越界。', 'translation-cache-results');
      if (
        typeof result.source !== 'string' ||
        normalizeLines(result.source) !== song.texts[result.index]
      )
        throw problem('歌词已经改变，本批译文不能写入这首歌曲的缓存。', 'translation-cache-source');
      if (
        !stored &&
        (typeof result.target !== 'string' || result.target.trim().toLowerCase() !== lang.key)
      )
        throw problem('译文的目标语言与缓存目标不一致。', 'translation-cache-language');
      if (typeof result.note !== 'string' || !result.note.trim() || result.note.length > 500)
        throw problem(
          '翻译缓存的副标题必须为不超过 500 字符的非空文字。',
          'translation-cache-results'
        );
      const note = normalizeLines(result.note).trim();
      if (note.split('\n').length !== song.texts[result.index].trim().split('\n').length)
        throw problem('译文分行与主歌词不一致，未写入翻译缓存。', 'translation-cache-results');
      const checked = { index: result.index, source: song.texts[result.index], note };
      for (const [key, limit] of [
        ['decoration', 64],
        ['pinyin', 4000]
      ]) {
        const value = result[key];
        if (typeof value === 'string' && value.length <= limit && !/[\x00-\x1f]/.test(value))
          checked[key] = value.trim();
      }
      byIndex.set(result.index, checked);
    }
    return song.active.map((index) => byIndex.get(index));
  }
  function validEntry(entry, song) {
    return entry && entry.version === 1 && entry.id === song.id && Array.isArray(entry.targets);
  }

  function database() {
    if (opening) return opening;
    opening = new Promise((resolve, reject) => {
      const idb = window.indexedDB || window.webkitIndexedDB;
      if (!idb) {
        reject(
          problem(
            '当前面板不支持 IndexedDB，无法保存歌曲翻译缓存。',
            'translation-cache-unavailable'
          )
        );
        return;
      }
      let request,
        settled = false;
      const timer = setTimeout(
        () =>
          fail(
            problem('翻译缓存打开超时，请关闭其他旧版映词面板后重试。', 'translation-cache-blocked')
          ),
        5000
      );
      function fail(error) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(storageProblem(error));
      }
      try {
        request = idb.open(databaseName, databaseVersion);
      } catch (error) {
        fail(error);
        return;
      }
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains('songs')) {
            const store = db.createObjectStore('songs', { keyPath: 'id' });
            store.createIndex('lastUsed', 'lastUsed', { unique: false });
          }
          if (!db.objectStoreNames.contains('meta'))
            db.createObjectStore('meta', { keyPath: 'key' });
        } catch (error) {
          try {
            request.transaction.abort();
          } catch (_) {}
          fail(error);
        }
      };
      request.onerror = () => fail(request.error);
      request.onblocked = () =>
        fail(
          problem('翻译缓存被旧版面板占用，请关闭其他映词面板后重试。', 'translation-cache-blocked')
        );
      request.onsuccess = () => {
        const db = request.result;
        if (settled) {
          db.close();
          return;
        }
        settled = true;
        clearTimeout(timer);
        db.onversionchange = () => {
          db.close();
          opening = null;
        };
        db.onclose = () => {
          opening = null;
        };
        resolve(db);
      };
    }).catch((error) => {
      opening = null;
      throw storageProblem(error);
    });
    return opening;
  }
  function transaction(db, mode, work) {
    return new Promise((resolve, reject) => {
      let tx, output, failed;
      try {
        tx = db.transaction(['songs', 'meta'], mode);
      } catch (error) {
        reject(storageProblem(error));
        return;
      }
      const fail = (error) => {
        if (!failed) failed = storageProblem(error);
        try {
          tx.abort();
        } catch (_) {
          reject(failed);
        }
      };
      const read = (request, callback) => {
        request.onsuccess = () => {
          try {
            callback(request.result);
          } catch (error) {
            fail(error);
          }
        };
        return request;
      };
      tx.oncomplete = () => resolve(output);
      tx.onabort = () => reject(failed || storageProblem(tx.error));
      tx.onerror = (event) => {
        if (!failed) failed = storageProblem((event.target && event.target.error) || tx.error);
      };
      try {
        work({
          tx,
          songs: tx.objectStore('songs'),
          meta: tx.objectStore('meta'),
          read,
          setResult: (value) => {
            output = value;
          }
        });
      } catch (error) {
        fail(error);
      }
    });
  }
  function readConfig(context, done) {
    context.read(context.meta.get('config'), (value) => done(config(value)));
  }
  function evict(context, settings) {
    context.read(context.songs.count(), (count) => {
      let remove = Math.max(0, count - settings.limit);
      if (!remove) {
        context.setResult({ count, limit: settings.limit });
        return;
      }
      context.read(context.songs.index('lastUsed').openCursor(), (cursor) => {
        if (!cursor || !remove) {
          context.setResult({ count, limit: settings.limit });
          return;
        }
        cursor.delete();
        count--;
        remove--;
        if (remove) cursor.continue();
        else context.setResult({ count, limit: settings.limit });
      });
    });
  }

  async function get(cues, target) {
    const song = identity(cues),
      lang = language(target);
    if (!song.active.length) return null;
    return transaction(await database(), 'readwrite', (context) => {
      context.read(context.songs.get(song.id), (entry) => {
        if (!entry) {
          context.setResult(null);
          return;
        }
        if (!validEntry(entry, song)) {
          context.songs.delete(song.id);
          context.setResult(null);
          return;
        }
        const saved = entry.targets.find((item) => item && item.language === lang.key);
        let results = null;
        if (saved) {
          try {
            results = validateResults(saved.results, song, lang, true);
          } catch (_) {
            entry.targets = entry.targets.filter((item) => item !== saved);
          }
        }
        readConfig(context, (settings) => {
          settings.clock++;
          entry.lastUsed = settings.clock;
          context.songs.put(entry);
          context.meta.put(settings);
          context.setResult(
            results
              ? results.map((result) => ({
                  index: result.index,
                  source: song.sources[result.index],
                  note: result.note,
                  ...(result.decoration == null ? {} : { decoration: result.decoration }),
                  ...(result.pinyin == null ? {} : { pinyin: result.pinyin }),
                  target: lang.display
                }))
              : null
          );
        });
      });
    });
  }
  async function put(cues, target, results) {
    const song = identity(cues),
      lang = language(target);
    if (!song.active.length) throw problem('没有可缓存的主歌词。', 'translation-cache-input');
    const checked = validateResults(results, song, lang, false);
    return transaction(await database(), 'readwrite', (context) => {
      context.read(context.songs.get(song.id), (previous) => {
        const entry = { id: song.id, version: 1, targets: [], lastUsed: 0 };
        if (validEntry(previous, song))
          for (const item of previous.targets) {
            if (
              !item ||
              typeof item.language !== 'string' ||
              item.language === lang.key ||
              item.language.length > 60
            )
              continue;
            try {
              entry.targets.push({
                language: item.language,
                results: validateResults(item.results, song, { key: item.language }, true)
              });
            } catch (_) {}
          }
        entry.targets.push({ language: lang.key, results: checked });
        readConfig(context, (settings) => {
          settings.clock++;
          entry.lastUsed = settings.clock;
          context.songs.put(entry);
          context.meta.put(settings);
          // The write, configuration update and LRU deletions share this transaction.
          evict(context, settings);
        });
      });
    });
  }
  async function setLimit(value) {
    const limit = configuredLimit(value);
    return transaction(await database(), 'readwrite', (context) => {
      readConfig(context, (settings) => {
        settings.limit = limit;
        context.meta.put(settings);
        evict(context, settings);
      });
    });
  }
  async function stats() {
    return transaction(await database(), 'readonly', (context) => {
      readConfig(context, (settings) => {
        context.read(context.songs.count(), (count) =>
          context.setResult({ count, limit: settings.limit })
        );
      });
    });
  }
  async function clear() {
    return transaction(await database(), 'readwrite', (context) => {
      readConfig(context, (settings) => {
        settings.clock = 0;
        context.meta.put(settings);
        context.songs.clear();
        context.setResult({ count: 0, limit: settings.limit });
      });
    });
  }
  return { get, put, setLimit, stats, clear };
})();

window.LMBridge = (() => {
  const cep = window.__adobe_cep__;
  const req =
    (window.cep_node && window.cep_node.require) ||
    (typeof window.require === 'function' ? window.require : null);
  const fs = req ? req('fs') : null,
    path = req ? req('path') : null,
    os = req ? req('os') : null;
  let ready = false,
    connecting = null;
  const version = '1.5.2';
  const extensionRoot =
    cep && path
      ? decodeURI(cep.getSystemPath('extension'))
          .replace(/^file:\/\//, '')
          .replace(/^\/([A-Za-z]:)/, '$1')
      : '';
  const assets =
    req && extensionRoot
      ? req(path.join(extensionRoot, 'node', 'assets.cjs')).createResolver(extensionRoot)
      : null;
  function resolveResource(file) {
    return assets ? assets.resolveResource(file) : String(file || '');
  }
  const asciiJSON = (value) =>
    JSON.stringify(value).replace(
      /[\x7f-\uffff]/g,
      (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
    );
  const logPath = fs && path && os ? path.join(os.tmpdir(), 'LyricMotion-AE-bridge.log') : '';
  function log(operation, result, ms) {
    if (!logPath) return;
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 1048576)
        fs.writeFileSync(logPath, '', 'utf8');
      fs.appendFileSync(
        logPath,
        JSON.stringify({ time: new Date().toISOString(), version, operation, result, ms }) + '\n',
        'utf8'
      );
    } catch (_) {}
  }
  function report(detail) {
    window.dispatchEvent(new CustomEvent('lm:bridge', { detail }));
  }
  const evalScript = (code, operation, timeout = 45000) =>
    new Promise((resolve, reject) => {
      if (!cep) return reject(new Error('请在 AE 中打开映词面板'));
      const start = Date.now();
      let settled = false;
      log(operation, 'sent', 0);
      const timer = timeout
        ? setTimeout(() => {
            settled = true;
            ready = false;
            clearInterval(ticker);
            const e = new Error(
              'AE 在 ' +
                Math.round(timeout / 1000) +
                ' 秒内没有回应。请检查 AE 是否有未关闭的弹窗，再点“重新连接”。'
            );
            e.uncertain = true;
            log(operation, 'timeout', Date.now() - start);
            report({ operation, timeout: true });
            reject(e);
          }, timeout)
        : null;
      const ticker = setInterval(
        () => report({ operation, seconds: Math.floor((Date.now() - start) / 1000) }),
        1000
      );
      try {
        cep.evalScript(code, (value) => {
          clearTimeout(timer);
          clearInterval(ticker);
          log(operation, settled ? 'late' : 'returned', Date.now() - start);
          if (settled) {
            report({ operation, late: true });
            return;
          }
          settled = true;
          report({ operation, done: true });
          resolve(value);
        });
      } catch (e) {
        settled = true;
        clearTimeout(timer);
        clearInterval(ticker);
        reject(e);
      }
    });
  async function rawCall(op, args = {}) {
    const text = await evalScript(
      'LMHost.dispatch(' +
        asciiJSON(op) +
        ',' +
        asciiJSON(encodeURIComponent(asciiJSON(args))) +
        ')',
      op,
      /^(preRender|savePath|folder)$/.test(op) ? 0 : 45000
    );
    let result;
    try {
      result = JSON.parse(text);
    } catch (_) {
      throw new Error('AE 没有返回有效结果：' + String(text).slice(0, 150));
    }
    if (!result.ok) {
      log(op, String(result.error || 'AE 操作失败').slice(0, 500), 0);
      throw new Error(result.error || 'AE 操作失败');
    }
    return result;
  }
  async function connect() {
    if (!cep) return { browser: true };
    if (connecting) return connecting;
    connecting = (async () => {
      ready = false;
      let info = null;
      if ((await evalScript('typeof LMHost', 'connect')) === 'object') info = await rawCall('info');
      if (!info || info.version !== version) {
        if (info && info.building)
          throw new Error('旧版本仍在生成，请先停止或重新打开 AE 后使用新版面板');
        if (info && info.version === '1.0.0' && typeof info.building === 'undefined')
          await rawCall('cancel');
        const root = decodeURI(cep.getSystemPath('extension'))
          .replace(/^file:\/\//, '')
          .replace(/^\/([A-Za-z]:)/, '$1');
        const loaded = await evalScript(
          'var __lmLoadResult;try{$.evalFile(File(' +
            asciiJSON(root + '/jsx/host.jsx') +
            '));__lmLoadResult="loaded";}catch(e){__lmLoadResult=e.toString()+" line "+e.line;}__lmLoadResult;',
          'connect'
        );
        if (loaded !== 'loaded') throw new Error('AE 脚本加载失败：' + loaded);
        info = await rawCall('info');
      }
      if (info.version !== version) throw new Error('面板与 AE 脚本版本不一致，请关闭面板再打开');
      ready = true;
      return info;
    })();
    try {
      return await connecting;
    } finally {
      connecting = null;
    }
  }
  async function call(op, args = {}) {
    if (!ready) await connect();
    if (assets && /^(applyPreset|importLocal)$/.test(op))
      args = { ...args, path: await assets.prepare(args.path) };
    return rawCall(op, args);
  }
  async function begin(project, overlay) {
    if (assets) project = await assets.prepareProject(project);
    if (!fs) return call('begin', { project, overlay });
    const file = path.join(
      os.tmpdir(),
      'lyricmotion-' + Date.now() + '-' + Math.random().toString(16).slice(2) + '.json'
    );
    fs.writeFileSync(file, JSON.stringify(project), 'utf8');
    let uncertain = false;
    try {
      return await call('begin', { path: file, overlay });
    } catch (e) {
      uncertain = !!e.uncertain;
      throw e;
    } finally {
      if (!uncertain)
        try {
          fs.unlinkSync(file);
        } catch (_) {}
    }
  }
  async function save(text, name, ext) {
    if (cep && fs) {
      const r = await call('savePath', { name, ext });
      if (!r.path) return false;
      const dest = new RegExp('\\.' + ext + '$', 'i').test(r.path) ? r.path : r.path + '.' + ext;
      fs.writeFileSync(dest, (ext === 'srt' ? '\uFEFF' : '') + text, 'utf8');
      return dest;
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })),
      a = document.createElement('a');
    a.href = url;
    a.download = name + '.' + ext;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return name + '.' + ext;
  }
  function fileURL(file) {
    if (/^resources[\\/]/i.test(file) && !extensionRoot) {
      const base = document.querySelector('meta[name="lyricmotion-resources"]');
      return new URL(
        String(file).replace(/^resources[\\/]/i, ''),
        new URL(base ? base.content : 'resources/', document.baseURI)
      ).href;
    }
    if (req) return req('url').pathToFileURL(resolveResource(file)).href;
    return (
      'file:///' +
      String(file)
        .replace(/\\/g, '/')
        .split('/')
        .map((s, i) => (i === 0 ? s : encodeURIComponent(s)))
        .join('/')
    );
  }
  async function read(file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    let encoding =
      bytes[0] === 255 && bytes[1] === 254
        ? 'utf-16le'
        : bytes[0] === 254 && bytes[1] === 255
          ? 'utf-16be'
          : 'utf-8';
    try {
      return new TextDecoder(encoding, { fatal: true }).decode(bytes);
    } catch (_) {
      return new TextDecoder('gb18030').decode(bytes);
    }
  }
  return {
    call,
    connect,
    begin,
    save,
    read,
    fs,
    path,
    fileURL,
    resolveResource,
    isAE: !!cep,
    get ready() {
      return ready;
    }
  };
})();

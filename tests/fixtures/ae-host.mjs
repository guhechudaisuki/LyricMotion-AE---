/* eslint no-control-regex: off -- Deliberate control-character sanitization and ASCII bridge checks. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { root } from '../../config/project.mjs';
import { hostSource } from '../../scripts/lib/engine.mjs';
import { compileExtendScript } from '../../scripts/extendscript.mjs';
const host = process.env.LM_TEST_HOST
  ? fs.readFileSync(process.env.LM_TEST_HOST, 'utf8')
  : compileExtendScript(hostSource()).source;
const bridge = fs.readFileSync(path.join(root, 'src/panel/bridge.js'), 'utf8');
export function fixture(options = {}) {
  const files = new Set(),
    folders = new Set(['/documents']),
    applied = [],
    renders = [],
    imports = [],
    projects = [],
    dialogs = [],
    nativeNames = [
      '无损',
      '具有 Alpha 的高品质',
      '仅 Alpha',
      'H.264 - 匹配渲染设置 - 15 Mbps',
      'PNG 序列',
      '_HIDDEN Internal'
    ];
  let names = nativeNames.slice(),
    serial = 30,
    outputFormat = options.format || 'QuickTime',
    frameCount = 0;
  function File(p) {
    if (!(this instanceof File)) return new File(p);
    this.fsName = String(p);
    this.name = String(p).split('/').pop();
    Object.defineProperty(this, 'exists', { get: () => files.has(this.fsName) });
  }
  File.saveDialog = (name) => {
    dialogs.push(name);
    return new File('/documents/歌词方案.json');
  };
  function Folder(p) {
    if (!(this instanceof Folder)) return new Folder(p);
    this.fsName = String(p);
    Object.defineProperty(this, 'exists', { get: () => folders.has(this.fsName) });
    this.create = () => {
      if (options.folderFailure) return false;
      folders.add(this.fsName);
      return true;
    };
  }
  Folder.myDocuments = new Folder('/documents');
  function CompItem(name = '合成 1') {
    this.id = ++serial;
    this.name = name;
    this.width = 1920;
    this.height = 1080;
    this.pixelAspect = 1;
    this.duration = 65;
    this.frameRate = 23.976;
    this.parentFolder = {};
    this.layers = {
      added: [],
      add: (footage) => {
        this.layers.added.push(footage);
        return {};
      }
    };
    this.openInViewer = () => {};
  }
  const comp = new CompItem(),
    queueItems = [],
    project = { activeItem: comp, file: null };
  projects.push(comp);
  project.items = {
    addFolder(name) {
      const item = { id: ++serial, name };
      projects.push(item);
      return item;
    },
    addComp(name) {
      const item = new CompItem(name);
      projects.push(item);
      return item;
    }
  };
  project.item = (i) => projects[i - 1];
  Object.defineProperty(project, 'numItems', { get: () => projects.length });
  project.importFile = (io) => {
    if (options.importFailure) throw new Error('Import failed');
    imports.push(io.file.fsName);
    return { name: io.file.name };
  };
  const queue = (project.renderQueue = {
    rendering: false,
    items: {
      add() {
        let validModule = null;
        const rq = { status: 'QUEUED', render: true, timeSpanStart: 0, timeSpanDuration: 65 };
        function module() {
          const om = {
            templates: names.slice(),
            file: new File('/default/render.mp4'),
            getSettings() {
              if (validModule !== om) throw new Error('OutputModule object is invalid');
              if (options.settingsFailure) throw new Error('Settings unavailable');
              return { [options.localizedSettings ? '格式' : 'Format']: outputFormat };
            },
            applyTemplate(name) {
              applied.push(name);
              if (!names.includes(name) || options.rejectTemplate)
                throw new Error('After Effects错误: ' + name + ' 不是有效的模板名称。');
              outputFormat = name.includes('PNG') ? 'PNG 序列' : options.format || 'QuickTime';
              if (options.invalidateModule) validModule = module();
            }
          };
          return om;
        }
        validModule = module();
        rq.outputModule = () => validModule;
        rq.remove = () => {
          const i = queueItems.indexOf(rq);
          if (i >= 0) queueItems.splice(i, 1);
        };
        queueItems.push(rq);
        return rq;
      }
    },
    item: (i) => queueItems[i - 1],
    render() {
      renders.push(queueItems.filter((q) => q.render));
      for (const rq of queueItems.filter((q) => q.render)) {
        if (options.renderFailure) {
          rq.status = 'ERR_STOPPED';
          continue;
        }
        if (options.cancel) {
          rq.status = 'USER_STOPPED';
          continue;
        }
        if (!options.missingOutput) files.add(rq.outputModule(1).file.fsName);
        rq.status = 'DONE';
        frameCount++;
      }
    }
  });
  Object.defineProperty(queue, 'numItems', { get: () => queueItems.length });
  const app = { project, version: '25.6.4' };
  const ctx = vm.createContext({
    app,
    CompItem,
    File,
    Folder,
    ImportOptions: function (file) {
      this.file = file;
    },
    GetSettingsFormat: { STRING: 'STRING' },
    RQItemStatus: {
      DONE: 'DONE',
      QUEUED: 'QUEUED',
      RENDERING: 'RENDERING',
      USER_STOPPED: 'USER_STOPPED',
      ERR_STOPPED: 'ERR_STOPPED'
    }
  });
  if (options.lossyEval)
    ctx.eval = (code) => vm.runInContext(String(code).replace(/[^\x00-\x7f]/g, '?'), ctx);
  vm.runInContext(host, ctx, { filename: 'host.jsx' });
  const payloads = [];
  const win = {
    dispatchEvent() {},
    __adobe_cep__: {
      evalScript(code, callback) {
        let result = vm.runInContext(code, ctx);
        payloads.push({ code, result });
        if (options.lossyResponse) result = String(result).replace(/[^\x00-\x7f]/g, '?');
        callback(result);
      }
    }
  };
  const front = vm.createContext({
    window: win,
    CustomEvent: function (type, init) {
      this.type = type;
      this.detail = init.detail;
    },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval
  });
  vm.runInContext(bridge, front, { filename: 'bridge.js' });
  return {
    api: win.LMBridge,
    ctx,
    comp,
    queue,
    queueItems,
    applied,
    renders,
    imports,
    files,
    payloads,
    projects,
    app,
    dialogs,
    frameCount: () => frameCount,
    setNames: (value) => {
      names = value;
    },
    direct(op, args = {}) {
      return JSON.parse(ctx.LMHost.dispatch(op, encodeURIComponent(JSON.stringify(args))));
    }
  };
}

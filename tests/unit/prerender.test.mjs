/* eslint no-control-regex: off -- Deliberate control-character sanitization and ASCII bridge checks. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../fixtures/ae-host.mjs';

const request = (options, position = 0) => {
  const template = options.templates[position];
  return {
    id: options.id,
    selection: options.selection,
    template: typeof template === 'string' ? template : template.id
  };
};
test('Chinese RGBA template survives the native application encoding boundary', async () => {
  const f = fixture({ lossyEval: true, lossyResponse: true, lossyNative: true }),
    options = await f.api.call('renderOptions');
  const selected = options.templates.findIndex((template) => template.id === options.preferred);
  const result = await f.api.call('preRender', request(options, selected));
  assert.equal(result.ok, true);
  assert.deepEqual(f.nativeCalls, [
    { name: '具有 Alpha 的高品质', received: '具有 Alpha 的高品质', encoding: 'CP936' }
  ]);
  assert.equal(f.scripting.appEncoding, 'CP1252', 'Restore encoding used by other scripts');
  assert.equal(f.imports.length, 1);
  assert.equal(f.queue.numItems, 0);
});

test('Unicode output paths survive assignment, rendering and import with either output choice', async () => {
  for (const template of [0, 2]) {
    const f = fixture({ lossyNative: true });
    f.comp.name = '中文歌词合成';
    const options = await f.api.call('renderOptions');
    const result = await f.api.call('preRender', request(options, template));
    assert.ok(result.path.includes('LyricMotion预渲染/中文歌词合成-'));
    assert.deepEqual(f.imports, [result.path]);
    assert.deepEqual(f.renderEncodings, ['CP936']);
    assert.ok(f.nativePathCalls.every((call) => call.encoding === 'CP936'));
    assert.equal(f.scripting.appEncoding, 'CP1252');
  }
});

test('A changed output path is rejected before rendering starts', async () => {
  const f = fixture({ corruptOutputPath: true });
  const options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options, 2)), /输出路径/);
  assert.equal(f.renders.length, 0);
  assert.equal(f.imports.length, 0);
  assert.equal(f.queue.numItems, 0);
  assert.equal(f.scripting.appEncoding, 'CP1252');
});

test('AE-selected video extension is used for rendering and import when localized format is absent', async () => {
  for (const nativeExtension of ['.mov', '.avi', '.mp4']) {
    const f = fixture({ lossyNative: true, omitFormat: true, nativeExtension });
    const options = await f.api.call('renderOptions');
    const result = await f.api.call('preRender', request(options, 2));
    assert.ok(result.path.endsWith(nativeExtension), result.path);
    assert.deepEqual(f.imports, [result.path]);
    assert.equal(f.files.has(result.path), true);
    assert.equal(f.renders.length, 1);
    assert.equal(f.queue.numItems, 0);
    assert.equal(f.scripting.appEncoding, 'CP1252');
  }
});

test('Extension normalization cannot hide a changed filename, directory or unsupported output', async () => {
  for (const changes of [
    { renameOutput: true, nativeExtension: '.mov' },
    { redirectOutput: true, nativeExtension: '.mov' },
    { nativeExtension: '.png' },
    { nativeExtension: '.wav' }
  ]) {
    const f = fixture({ omitFormat: true, ...changes });
    const options = await f.api.call('renderOptions');
    await assert.rejects(f.api.call('preRender', request(options, 2)), /输出路径/);
    assert.equal(f.renders.length, 0);
    assert.equal(f.imports.length, 0);
    assert.equal(f.queue.numItems, 0);
  }
});

test('Import failure reports the actual file extension selected by AE', async () => {
  const f = fixture({ omitFormat: true, nativeExtension: '.mov', importFailure: true });
  const options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options, 2)), /文件位置：.*\.mov/);
  assert.equal(f.files.size, 1);
  assert.equal(f.queue.numItems, 0);
});

test('Render and import failures restore native encoding and existing queue state', async () => {
  for (const failure of [{ renderFailure: true }, { importFailure: true }, { cancel: true }]) {
    const f = fixture({ lossyNative: true, ...failure });
    const existing = f.queue.items.add(),
      options = await f.api.call('renderOptions');
    await assert.rejects(f.api.call('preRender', request(options, 2)));
    assert.equal(f.scripting.appEncoding, 'CP1252');
    assert.deepEqual(f.queueItems, [existing]);
    assert.equal(existing.render, true);
  }
});

test('Template application failure restores native encoding and preserves existing queue', async () => {
  const f = fixture({ lossyNative: true, rejectTemplate: true, appEncoding: 'CP936' });
  const existing = f.queue.items.add(),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options, 2)), /无法应用输出模板/);
  assert.equal(f.nativeCalls[0].encoding, 'CP936');
  assert.equal(f.scripting.appEncoding, 'CP936');
  assert.deepEqual(f.queueItems, [existing]);
  assert.equal(existing.render, true);
  assert.equal(f.renders.length, 0);
  assert.deepEqual(JSON.parse(f.payloads.at(-1).result).diagnostics, {
    stage: 'applyTemplate',
    encodingBefore: 'CP936',
    encodingUsed: 'CP936',
    encodingAfter: 'CP936'
  });
});

test('Each render uses the current native encoding and restores it after a different script changes it', async () => {
  const f = fixture({ lossyNative: true });
  for (const encoding of ['CP1252', 'CP936', 'UTF-8']) {
    f.scripting.appEncoding = encoding;
    const options = await f.api.call('renderOptions');
    await f.api.call('preRender', request(options, 2));
    assert.equal(f.scripting.appEncoding, encoding);
  }
  assert.ok(f.nativeCalls.every((call) => call.encoding === 'CP936'));
  assert.equal(f.imports.length, 3);
});

test('Recorded UTF-8-to-CP936 mojibake is reproduced by the native-boundary fixture', () => {
  const f = fixture({ lossyNative: true, appEncoding: 'UTF-8' });
  const om = f.queue.items.add().outputModule(1);
  assert.throws(() => om.applyTemplate('具有 Alpha 的高品质'), /鍏锋湁 Alpha 鐨勯珮鍝佽川/);
  assert.equal(f.nativeCalls[0].received, '鍏锋湁 Alpha 鐨勯珮鍝佽川');
});

test('Rendering follows the Windows ANSI code page, including UTF-8 systems', async () => {
  for (const nativeEncoding of ['CP1252', 'CP936', 'UTF-8']) {
    const f = fixture({ lossyNative: true, nativeEncoding });
    f.setNames(['RGBA Custom']);
    const options = await f.api.call('renderOptions');
    await f.api.call('preRender', request(options, 1));
    assert.equal(f.nativeCalls[0].encoding, nativeEncoding);
    assert.equal(f.imports.length, 1);
    assert.equal(f.scripting.appEncoding, 'CP1252');
  }
});

test('macOS uses UTF-8 without querying the Windows registry', async () => {
  const f = fixture({ lossyNative: true, nativeEncoding: 'UTF-8', fileSystem: 'Macintosh' });
  f.ctx.system.callSystem = () => {
    throw new Error('Unexpected Windows query');
  };
  const options = await f.api.call('renderOptions');
  await f.api.call('preRender', request(options, 2));
  assert.equal(f.nativeCalls[0].encoding, 'UTF-8');
  assert.equal(f.imports.length, 1);
});

test('Unreadable or unsupported native encoding does not apply a different template or render', async () => {
  for (const fault of [{ encodingQueryFailure: true }, { encodingUnavailable: true }]) {
    const f = fixture({ lossyNative: true, ...fault });
    const options = await f.api.call('renderOptions');
    await assert.rejects(f.api.call('preRender', request(options, 2)), /编码/);
    assert.equal(f.applied.length, 0);
    assert.equal(f.renders.length, 0);
    assert.equal(f.scripting.appEncoding, 'CP1252');
    assert.equal(f.queue.numItems, 0);
  }
});

test('Chinese template survives a lossy CEP response and imports the rendered video', async () => {
  const f = fixture({ lossyResponse: true }),
    options = await f.api.call('renderOptions');
  const result = await f.api.call(
    'preRender',
    request(options, typeof options.templates[0] === 'string' ? 1 : 2)
  );
  assert.equal(result.ok, true);
  assert.equal(f.applied.at(-1), '具有 Alpha 的高品质');
  assert.equal(f.imports.length, 1);
  assert.equal(f.frameCount(), 1);
});
test('Failed template application removes its temporary queue item', async () => {
  const f = fixture({ rejectTemplate: true }),
    options = await f.api.call('renderOptions');
  await assert.rejects(
    f.api.call('preRender', request(options, typeof options.templates[0] === 'string' ? 0 : 1))
  );
  assert.equal(f.queue.numItems, 0, 'Failed pre-render left a queued item');
  assert.equal(f.renders.length, 0);
});
test('OutputModule is reacquired after applying a template', async () => {
  const f = fixture({ invalidateModule: true }),
    options = await f.api.call('renderOptions');
  await f.api.call('preRender', request(options, typeof options.templates[0] === 'string' ? 0 : 1));
  assert.equal(f.imports.length, 1);
});
test('Default output settings work without applying a localized template', async () => {
  const f = fixture({ rejectTemplate: true }),
    options = await f.api.call('renderOptions');
  assert.equal(options.templates[0].id, 'current');
  await f.api.call('preRender', request(options));
  assert.equal(f.applied.length, 0);
  assert.equal(f.imports.length, 1);
});
test('Template selection expires safely after project changes', async () => {
  const f = fixture(),
    options = await f.api.call('renderOptions');
  f.app.project = { ...f.app.project };
  await assert.rejects(f.api.call('preRender', request(options, 1)));
  assert.equal(f.queue.numItems, 0);
  assert.equal(f.renders.length, 0);
});
test('Deleted templates fail before rendering and leave no queue item', async () => {
  const f = fixture(),
    options = await f.api.call('renderOptions');
  f.setNames(['Only Remaining']);
  await assert.rejects(f.api.call('preRender', request(options, 1)));
  assert.equal(f.queue.numItems, 0);
  assert.equal(f.renders.length, 0);
});
test('Cancelled renders restore the existing queue without leaving a job', async () => {
  const f = fixture({ cancel: true }),
    first = f.queue.items.add(),
    second = f.queue.items.add();
  second.render = false;
  const options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)));
  assert.deepEqual(f.queueItems, [first, second]);
  assert.equal(first.render, true);
  assert.equal(second.render, false);
  assert.equal(f.imports.length, 0);
});
test('Only the requested composition is rendered; existing queue flags are restored', async () => {
  const f = fixture(),
    first = f.queue.items.add(),
    second = f.queue.items.add();
  second.render = false;
  const options = await f.api.call('renderOptions');
  await f.api.call('preRender', request(options));
  assert.equal(f.renders[0].length, 1);
  assert.equal(first.render, true);
  assert.equal(second.render, false);
  assert.deepEqual(f.queueItems, [first, second]);
});
test('Image sequences are rejected even with an mp4 default filename', async () => {
  const f = fixture({ format: 'PNG 序列' }),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)));
  assert.equal(f.renders.length, 0);
  assert.equal(f.queue.numItems, 0);
});
test('Import failures retain the rendered file and report its location', async () => {
  const f = fixture({ importFailure: true }),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)), /文件位置/);
  assert.equal(f.files.size, 1);
  assert.equal(f.queue.numItems, 0);
});
test('No active composition produces an error without mutating the queue', async () => {
  const f = fixture();
  f.app.project.activeItem = null;
  await assert.rejects(f.api.call('renderOptions'));
  assert.equal(f.queue.numItems, 0);
});
test('Chinese arguments, escaped quotes and Unicode survive a lossy ExtendScript eval boundary', async () => {
  const f = fixture({ lossyEval: true, lossyResponse: true });
  const name = '歌词“回忆”·𠮷';
  const result = await f.api.call('savePath', { name, ext: 'json' });
  assert.equal(f.dialogs[0], '保存 ' + name);
  assert.equal(result.path, '/documents/歌词方案.json');
  for (const message of f.payloads) {
    assert.doesNotMatch(message.code, /[^\x00-\x7f]/);
    assert.doesNotMatch(message.result, /[^\x00-\x7f]/);
  }
});
test('Preferred template is RGBA, not the alpha-only matte', async () => {
  const f = fixture(),
    options = await f.api.call('renderOptions');
  const preferred = options.templates.find((t) => t.id === options.preferred);
  assert.equal(preferred.name, '具有 Alpha 的高品质');
  assert.ok(options.templates.every((t) => !t.name.startsWith('_HIDDEN')));
  assert.equal(f.queue.numItems, 0);
});
test('Stale dialog tokens and unknown IDs cannot create queue items', async () => {
  const f = fixture(),
    old = await f.api.call('renderOptions'),
    current = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(old, 1)));
  await assert.rejects(f.api.call('preRender', { ...request(current), template: 'template:999' }));
  assert.equal(f.queue.numItems, 0);
});
test('A consumed selection cannot render twice', async () => {
  const f = fixture(),
    options = await f.api.call('renderOptions'),
    args = request(options);
  await f.api.call('preRender', args);
  await assert.rejects(f.api.call('preRender', args));
  assert.equal(f.renders.length, 1);
  assert.equal(f.queue.numItems, 0);
});
test('An active render prevents temporary queue changes', async () => {
  const f = fixture();
  f.queue.rendering = true;
  await assert.rejects(f.api.call('renderOptions'));
  assert.equal(f.queue.numItems, 0);
  f.queue.rendering = false;
  const options = await f.api.call('renderOptions');
  f.queue.rendering = true;
  await assert.rejects(f.api.call('preRender', request(options)));
  assert.equal(f.queue.numItems, 0);
});
test('Output-directory failures clean up without rendering', async () => {
  const f = fixture({ folderFailure: true }),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)), /创建输出文件/);
  assert.equal(f.queue.numItems, 0);
  assert.equal(f.renders.length, 0);
});
test('Render failures restore user queue flags and do not import a file', async () => {
  const f = fixture({ renderFailure: true }),
    existing = f.queue.items.add(),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)), /渲染视频/);
  assert.deepEqual(f.queueItems, [existing]);
  assert.equal(existing.render, true);
  assert.equal(f.imports.length, 0);
});
test('DONE without an output file does not import a nonexistent video', async () => {
  const f = fixture({ missingOutput: true }),
    options = await f.api.call('renderOptions');
  await assert.rejects(f.api.call('preRender', request(options)), /没有生成视频/);
  assert.equal(f.imports.length, 0);
  assert.equal(f.queue.numItems, 0);
});
test('Localized output settings select the correct video extension', async () => {
  const f = fixture({ localizedSettings: true, format: 'H.264' }),
    options = await f.api.call('renderOptions');
  const result = await f.api.call('preRender', request(options));
  assert.ok(result.path.endsWith('.mp4'));
  assert.equal(f.imports[0], result.path);
});
test('Unsupported audio and unknown output formats are not mislabeled mp4', async () => {
  for (const format of ['AIFF', 'WAV', 'Unrecognized format']) {
    const f = fixture({ format }),
      options = await f.api.call('renderOptions');
    await assert.rejects(f.api.call('preRender', request(options)), /视频输出模块/);
    assert.equal(f.renders.length, 0);
    assert.equal(f.queue.numItems, 0);
  }
});

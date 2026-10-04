import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import { root } from '../../config/project.mjs';

function fixture(content, status = 200) {
  const calls = [];
  const context = {
    window: {},
    URL,
    AbortController,
    setTimeout,
    clearTimeout,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: status === 200,
        status,
        text: async () =>
          JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] })
      };
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'src/panel/translation.js'), 'utf8'), context);
  return { api: context.window.LMTranslation, calls };
}
const options = {
  target: 'en',
  model: 'test-model',
  endpoint: 'https://example.invalid/v1',
  apiKey: 'test-placeholder'
};
test('One translation request handles a full batch and extracts structured JSON', async () => {
  const f = fixture(
    'Here is the result:\n```json\n' +
      JSON.stringify({
        translations: [
          { id: '0', text: 'Memories' },
          { id: '1', text: 'Leave' }
        ]
      }) +
      '\n```'
  );
  const result = await f.api.translateBatch([{ text: '回忆' }, { text: '离开' }], options);
  assert.equal(f.calls.length, 1);
  assert.deepEqual(
    Array.from(result, (r) => r.note),
    ['Memories', 'Leave']
  );
  assert.equal(JSON.parse(f.calls[0].options.body).stream, false);
});
test('Duplicate model IDs are rejected without partial subtitle callbacks', async () => {
  const f = fixture(
    JSON.stringify({
      translations: [
        { id: '0', text: 'one' },
        { id: '0', text: 'two' }
      ]
    })
  );
  const delivered = [];
  await assert.rejects(() =>
    f.api.translateBatch([{ text: '甲' }, { text: '乙' }], {
      ...options,
      onResult: (r) => delivered.push(r)
    })
  );
  assert.equal(f.calls.length, 1);
  assert.equal(delivered.length, 0);
});
test('A failed API request is not retried automatically', async () => {
  const f = fixture('', 500);
  await assert.rejects(() => f.api.translateBatch([{ text: '甲' }], options));
  assert.equal(f.calls.length, 1);
});
test('Authored subtitles and empty batches do not produce translation requests', async () => {
  const f = fixture('');
  const results = await f.api.translateBatch(
    [{ text: '甲', note: 'manual' }, { text: '' }],
    options
  );
  assert.equal(results.length, 0);
  assert.equal(f.calls.length, 0);
});

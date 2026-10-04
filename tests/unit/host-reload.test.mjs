import assert from 'node:assert/strict';
import test from 'node:test';
import { fixture } from '../fixtures/ae-host.mjs';

function oldRevision(f, building = false) {
  const previous = f.ctx.LMHost;
  f.ctx.LMHost = {
    dispatch(op, args) {
      const result = JSON.parse(previous.dispatch(op, args));
      if (op === 'info') {
        result.revision = 'older-local-repair';
        result.building = building;
      }
      return JSON.stringify(result);
    }
  };
}

test('Reopening the panel reloads an old host revision even with the same version number', async () => {
  const f = fixture();
  oldRevision(f);
  const info = await f.api.connect();
  assert.equal(info.revision, 'panel-video-2');
  assert.deepEqual(f.loadedScripts, ['/extension/jsx/host.jsx']);
});

test('A current host revision keeps existing host state on reconnect', async () => {
  const f = fixture();
  await f.api.connect();
  await f.api.connect();
  assert.equal(f.loadedScripts.length, 0);
});

test('Reload does not replace a host that is still generating lyrics', async () => {
  const f = fixture();
  oldRevision(f, true);
  await assert.rejects(f.api.connect(), /仍在生成/);
  assert.equal(f.loadedScripts.length, 0);
});

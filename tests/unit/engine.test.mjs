import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEngine, hostSource } from '../../scripts/lib/engine.mjs';
import { compileExtendScript } from '../../scripts/extendscript.mjs';

test('LRC times and explicit subtitle separators survive SRT round trips', () => {
  const core = loadEngine().LMCore;
  const cues = core.parse(
    '[00:15.210]回忆|memories\n[00:19.440]归零\n[00:22.170]留白|',
    'song.lrc'
  );
  assert.equal(cues[0].start, 15.21);
  assert.equal(cues[0].end, 19.44);
  assert.equal(cues[0].note, 'memories');
  assert.equal(cues[0].noteExplicit, true);
  assert.equal(cues[1].noteExplicit, false);
  assert.equal(cues[2].noteExplicit, true);
  const back = core.parse(core.toSRT(cues), 'song.srt');
  assert.deepEqual(
    Array.from(back, (c) => [c.start, c.end]),
    Array.from(cues, (c) => [c.start, c.end])
  );
});

test('Entrance and exit each have a 25% minimum and together never exceed 100%', () => {
  const core = loadEngine().LMCore;
  for (const enter of [-50, 0, 25, 35, 75, 120, NaN])
    for (const exit of [-50, 0, 25, 30, 75, 120, NaN]) {
      const p = core.defaults();
      p.enterPercent = enter;
      p.exitPercent = exit;
      const result = core.normalize(p);
      assert.ok(result.enterPercent >= 25 && result.exitPercent >= 25);
      assert.ok(result.enterPercent + result.exitPercent <= 100);
    }
});

test('Default random layout distributes each pair of cues across both sides', () => {
  const core = loadEngine().LMCore;
  for (let seed = 1; seed <= 16; seed++) {
    const p = core.defaults();
    p.seed = seed;
    p.cues = core.parse('[00:00.000]我循着你的眼神痕迹\n[00:04.000]怎么不断提醒', 'song.lrc');
    const sides = Array.from(p.cues, (cue, i) => core.scene(p, cue, i).safeSide);
    assert.deepEqual(sides.slice().sort(), ['left', 'right']);
  }
});

test('All layouts produce finite editable scene geometry and stationary text during hold', () => {
  const ctx = loadEngine(),
    core = ctx.LMCore;
  assert.ok(core.styles.length >= 140);
  assert.equal(ctx.LMMotion.list.length, 28);
  for (const style of core.styles) {
    const p = core.defaults();
    p.mode = 'single';
    p.style = style.id;
    p.cues = core.parse('[00:00.000]我循着你的眼神痕迹', 'song.lrc');
    p.cues[0].style = style.id;
    p.cues[0].end = 6;
    const scene = core.scene(p, p.cues[0], 0);
    ctx.LMLayout.resolve(scene, ctx.LMLayout.estimate);
    assert.ok(
      scene.items.some((item) => item.type === 'text'),
      style.id
    );
    for (const item of scene.items) {
      assert.ok(Number.isFinite(item.x) && Number.isFinite(item.y), style.id);
      if (item.type !== 'text') continue;
      const clock = ctx.LMMotion.timing(scene, item);
      const start = clock.lag + clock.enterSpan,
        end = clock.exitStart;
      if (end - start > 0.05) {
        const a = ctx.LMMotion.sample(scene, item, start + (end - start) * 0.3);
        const b = ctx.LMMotion.sample(scene, item, start + (end - start) * 0.7);
        assert.equal(JSON.stringify(a), JSON.stringify(b), style.id + ' moves during hold');
      }
    }
  }
});

test('Compiled host is ES3 and ASCII across the CEP boundary', () => {
  const result = compileExtendScript(hostSource());
  assert.equal(
    result.source.split('').some((c) => c.charCodeAt(0) > 127),
    false
  );
  assert.match(compileExtendScript('var x = /[a/b]/;').source, /\[a\\\/b\]/);
});

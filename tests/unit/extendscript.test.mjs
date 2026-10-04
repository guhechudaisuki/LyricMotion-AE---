import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { parse } from 'acorn';
import { compileExtendScript } from '../../scripts/extendscript.mjs';
import { hostSource } from '../../scripts/lib/engine.mjs';

function ungroupedConsequents(source) {
  const pending = [parse(source, { ecmaVersion: 3, preserveParens: true })];
  let count = 0;
  while (pending.length) {
    const node = pending.pop();
    if (!node || typeof node.type !== 'string') continue;
    if (node.type === 'ConditionalExpression' && node.consequent.type === 'ConditionalExpression')
      count++;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return count;
}

test('ExtendScript output groups nested conditional consequents throughout the host', () => {
  const original = hostSource();
  assert.ok(ungroupedConsequents(original) > 0, 'Fixture must exercise the reported syntax error');
  assert.equal(ungroupedConsequents(compileExtendScript(original).source), 0);
});

test('Grouping preserves conditional precedence, short circuiting, regexes and Unicode', () => {
  const source =
    'var result = a ? b ? c ? "回忆" : /[a/b]/.test("/") : false : "留白";' +
    'var calls = 0; function next() { calls++; return 7; }' +
    'var side = a ? b ? next() : 2 : 3;';
  const compiled = compileExtendScript(source).source;
  assert.equal(ungroupedConsequents(compiled), 0);
  for (const a of [false, true])
    for (const b of [false, true])
      for (const c of [false, true]) {
        const expected = { a, b, c },
          actual = { a, b, c };
        vm.runInNewContext(source, expected);
        vm.runInNewContext(compiled, actual);
        for (const key of ['result', 'side', 'calls']) assert.equal(actual[key], expected[key]);
      }
  assert.equal(compileExtendScript(compiled).source, compiled, 'Compilation must be idempotent');
});

test('Existing conditional parentheses and branch comments survive compilation', () => {
  const source = 'var x = a ? /* enter */ (b ? 1 : 2) /* exit */ : c ? 3 : 4;';
  assert.equal(compileExtendScript(source).source, source);
});

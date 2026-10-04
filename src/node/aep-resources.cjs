'use strict';

// Rewrite only structured AEP file-alias chunks. Preserve unknown chunks and the
// trailing Adobe metadata verbatim; no heuristic replacement of binary bytes.
function rewriteAliases(buffer, rewrite, visitFootage) {
  if (buffer.toString('ascii', 0, 4) !== 'RIFX') throw new Error('Unsupported AEP container');
  const declaredEnd = buffer.readUInt32BE(4) + 8;
  if (declaredEnd > buffer.length || declaredEnd < 12) throw new Error('Invalid AEP length');
  function chunks(start, end, parent) {
    const output = [];
    let offset = start;
    let alias = null;
    const names = [];
    while (offset < end) {
      if (offset + 8 > end) throw new Error('Truncated AEP chunk header');
      const id = buffer.toString('ascii', offset, offset + 4);
      const length = buffer.readUInt32BE(offset + 4);
      const next = Math.min(end, offset + 8 + length + (length % 2));
      if (offset + 8 + length > end)
        throw new Error(
          `Truncated AEP chunk ${parent}/${id} at ${offset}: ${length} exceeds ${end}`
        );
      let body = buffer.subarray(offset + 8, offset + 8 + length);
      if (id === 'LIST') {
        if (length < 4) throw new Error('Invalid AEP list');
        const kind = body.toString('ascii', 0, 4);
        if (parent === 'Pin ' && kind === 'Als2') {
          const innerLength = body.readUInt32BE(8);
          if (body.toString('ascii', 4, 8) === 'alas')
            alias = JSON.parse(body.toString('utf8', 12, 12 + innerLength));
        }
        if (['Fold', 'Item', 'Sfdr', 'Pin ', 'Als2'].includes(kind)) {
          body = Buffer.concat([
            body.subarray(0, 4),
            chunks(offset + 12, offset + 8 + length, kind)
          ]);
        }
      } else if (id === 'alas') {
        const value = JSON.parse(body.toString('utf8'));
        const changed = rewrite(value);
        if (changed) body = Buffer.from(JSON.stringify(changed), 'utf8');
      } else if (id === 'Utf8' && parent === 'Pin ') {
        names.push(body.toString('utf8').replace(/\0+$/, ''));
      }
      if (body.length === length && body.equals(buffer.subarray(offset + 8, offset + 8 + length))) {
        output.push(buffer.subarray(offset, next));
      } else {
        const header = Buffer.alloc(8);
        header.write(id, 0, 4, 'ascii');
        header.writeUInt32BE(body.length, 4);
        output.push(header, body);
        if (body.length % 2) output.push(Buffer.alloc(1));
      }
      offset = next;
    }
    if (parent === 'Pin ' && alias && visitFootage) visitFootage(alias, names.filter(Boolean));
    return Buffer.concat(output);
  }
  const body = chunks(12, declaredEnd, 'Egg!');
  const header = Buffer.from(buffer.subarray(0, 12));
  header.writeUInt32BE(body.length + 4, 4);
  return Buffer.concat([header, body, buffer.subarray(declaredEnd)]);
}

module.exports = { rewriteAliases };

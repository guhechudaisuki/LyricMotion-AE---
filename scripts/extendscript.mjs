import { parse, tokenizer } from 'acorn';

// Adobe's ExtendScript lexer rejects a raw slash inside regex character classes,
// although the same literal is accepted by standard ES3 JavaScript parsers.
export function compileExtendScript(source) {
  parse(source, { ecmaVersion: 3 });
  const tokens = tokenizer(source, { ecmaVersion: 3 });
  let token,
    result = '',
    cursor = 0,
    escapedClasses = 0;
  while ((token = tokens.getToken()).type.label !== 'eof') {
    if (token.type.label !== 'regexp') continue;
    const pattern = token.value.pattern;
    let fixed = '',
      inClass = false,
      escaped = false;
    for (const ch of pattern) {
      if (escaped) {
        fixed += ch;
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        fixed += ch;
        escaped = true;
        continue;
      }
      if (ch === '[') inClass = true;
      if (ch === ']') inClass = false;
      if (ch === '/' && inClass) {
        fixed += '\\/';
        escapedClasses++;
      } else fixed += ch;
    }
    result += source.slice(cursor, token.start) + '/' + fixed + '/' + token.value.flags;
    cursor = token.end;
  }
  result += source.slice(cursor);
  result = result.replace(
    /[\u007f-\uffff]/g,
    (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0')
  );
  parse(result, { ecmaVersion: 3 });
  return { source: result, escapedClasses };
}

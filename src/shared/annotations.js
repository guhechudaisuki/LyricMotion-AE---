/* exported LMAnnotations */
/* Optional lyric accents; one short reading OR translated phrase, never both. ES3. */
var LMAnnotations = (function () {
  function permits(project, value) {
    var choices = project.recipe && project.recipe.annotations;
    if (!(choices instanceof Array)) return true;
    for (var i = 0; i < choices.length; i++) if (choices[i] === value) return true;
    return false;
  }
  function kind(project, cue, index, style, random) {
    if (cue.noteExplicit || (cue.note && !cue.noteAutomatic)) return 'none';
    if (style.kind === 'bilingual' || style.family === 'sidenote')
      return permits(project, 'translation') ? 'subtitle' : 'none';
    var count = String(cue.text || '').replace(/\s/g, '').length;
    if (!count || count > 24) return 'none';
    // One optional accent per three cues, stable across preview, export and AE.
    if (index % 3 !== Math.floor(random(project.seed, Math.floor(index / 3), 941) * 3))
      return 'none';
    var translation = permits(project, 'translation'),
      pinyin = permits(project, 'pinyin') && /[\u3400-\u9fff]/.test(cue.text);
    if (pinyin && (!translation || random(project.seed, index, 947) < 0.5)) return 'pinyin';
    return translation ? 'translation' : 'none';
  }
  function reading(source, value, focus) {
    if (typeof value !== 'string' || value.length > 4000) return '';
    var syllables = value
        .toLowerCase()
        .replace(/^\s+|\s+$/g, '')
        .split(/\s+/),
      han = String(source).match(/[\u3400-\u9fff]/g) || [],
      i;
    if (syllables.length !== han.length || !han.length) return '';
    for (i = 0; i < syllables.length; i++)
      if (!/^[a-züāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜńňǹ]{1,8}$/.test(syllables[i])) return '';
    var at = String(source).indexOf(focus),
      letters = String(focus || '').match(/[\u3400-\u9fff]/g) || [];
    if (at >= 0 && letters.length && letters.length <= 6) {
      var before =
        String(source)
          .slice(0, at)
          .match(/[\u3400-\u9fff]/g) || [];
      return syllables.slice(before.length, before.length + letters.length).join(' ');
    }
    return syllables.length <= 6 ? syllables.join(' ') : '';
  }
  function phrase(cue) {
    if (typeof cue.decoration !== 'string') return '';
    var value = cue.decoration.replace(/^\s+|\s+$/g, '');
    if (
      value.length > 40 ||
      value.split(/\s+/).length > 4 ||
      (/[\u3040-\u9fff\uac00-\ud7af]/.test(value) && value.length > 12)
    )
      return '';
    return value;
  }
  function append(project, cue, index, style, focus, text, noteY, wrap, random) {
    var mode = kind(project, cue, index, style, random),
      manual = cue.note && (!cue.noteAutomatic || cue.noteExplicit),
      value = '',
      full = false;
    if (manual || (mode === 'subtitle' && cue.note)) {
      value = cue.note;
      full = true;
    } else if (mode !== 'none' && mode !== 'subtitle') {
      if (mode === 'pinyin') value = reading(cue.text, cue.pinyin, focus);
      if (!value && permits(project, 'translation')) value = phrase(cue);
    }
    if (!value) return;
    text(wrap(value, full ? 30 : 22).join('\n'), 0, noteY, full ? 19 : 17, full ? 420 : 250, 0.18, {
      note: true,
      alpha: full ? 0.76 : 0.58,
      font: /[A-Za-z]/.test(value) ? 'Georgia' : project.font,
      motion: 'mask-up',
      tracking: full ? 15 : 45
    });
  }
  return { kind: kind, append: append };
})();

// Delimiter positions are cached within a case so native string searches scan
// each line ending once. Unchanged field contents remain source slices.
export function run(input) {
  const text = String(input.text), header = input.header === true;
  const n = text.length, rows = [], errors = [];
  let columns = null, width = -1, line = 1;
  let p = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let lf = text.indexOf('\n', p), cr = text.indexOf('\r', p);
  let quote = text.indexOf('"', p);
  if (quote < 0) quote = n;
  if (lf < 0) lf = n;
  if (cr < 0) cr = n;
  while (p < n) {
    const first = text.charCodeAt(p);
    if (first === 10 || (first === 13 && text.charCodeAt(p + 1) === 10)) {
      p += first === 10 ? 1 : 2;
      line++;
      continue;
    }
    const recordLine = line, recordRow = header && columns === null ? null : rows.length;
    if (lf < p) { lf = text.indexOf('\n', p); if (lf < 0) lf = n; }
    if (cr < p) { cr = text.indexOf('\r', p); if (cr < 0) cr = n; }
    if (quote < p) { quote = text.indexOf('"', p); if (quote < 0) quote = n; }
    let fields;
    let more = true, quoted = false;
    const plainEnd = cr + 1 === lf && lf < n ? cr : lf;
    if (quote >= plainEnd && cr >= plainEnd) {
      fields = text.slice(p, plainEnd).split(',');
      p = lf < n ? lf + 1 : n;
      if (lf < n) line++;
      more = false;
    } else fields = [];
    while (more) {
      quoted = text.charCodeAt(p) === 34;
      let value = '', junk = false;
      if (quoted) {
        const open = p;
        let close = text.indexOf('"', p + 1), escaped = false;
        while (close >= 0 && text.charCodeAt(close + 1) === 34) {
          escaped = true;
          close = text.indexOf('"', close + 2);
        }
        if (close < 0) {
          errors.push({ code: 'unterminated_quote', line: recordLine, row: recordRow });
          value = '"';
          p++;
        } else {
          value = text.slice(open + 1, close);
          if (escaped) value = value.replaceAll('""', '"');
          if (lf < open) { lf = text.indexOf('\n', open); if (lf < 0) lf = n; }
          if (cr < open) { cr = text.indexOf('\r', open); if (cr < 0) cr = n; }
          if (cr < close) value = value.replace(/\r\n?/g, '\n');
          while (lf < close) {
            line++;
            lf = text.indexOf('\n', lf + 1);
            if (lf < 0) lf = n;
          }
          while (cr < close) {
            if (text.charCodeAt(cr + 1) !== 10) line++;
            cr = text.indexOf('\r', cr + 1);
            if (cr < 0) cr = n;
          }
          p = close + 1;
          junk = true;
        }
      }
      if (lf < p) { lf = text.indexOf('\n', p); if (lf < 0) lf = n; }
      if (cr < p) { cr = text.indexOf('\r', p); if (cr < 0) cr = n; }
      let comma = text.indexOf(',', p);
      if (comma < 0) comma = n;
      const boundary = Math.min(comma, lf);
      let added = 0;
      while (cr < boundary && (cr + 1 !== lf || lf === n)) {
        value += text.slice(p, cr);
        added += cr - p;
        p = cr + 1;
        errors.push({ code: 'stray_cr', line: recordLine, row: recordRow });
        cr = text.indexOf('\r', p);
        if (cr < 0) cr = n;
      }
      const end = Math.min(boundary, cr);
      value += text.slice(p, end);
      added += end - p;
      if (junk && added) errors.push({ code: 'quote_junk', line: recordLine, row: recordRow });
      fields.push(value);
      more = end === comma && end < n;
      if (more) p = end + 1;
      else {
        p = end < n ? lf + 1 : n;
        if (end < n) line++;
      }
    }
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    if (width < 0) width = fields.length;
    if (header && columns === null) columns = fields;
    else {
      if (fields.length < width) {
        errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
        while (fields.length < width) fields.push('');
      } else if (fields.length > width) {
        errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
      }
      rows.push(fields);
    }
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}

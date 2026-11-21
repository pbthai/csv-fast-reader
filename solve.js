import { run as fallback } from './fallback.js';

// Emit JSON bytes directly, preserving UTF-8 and escaping JSON controls.
// The public interface returns values; the driver requests the encoded form.
export function run(input, encoded = false) {
  const bytes = encoded && Buffer.isBuffer(input.text);
  const text = bytes ? null : String(input.text);
  if (!bytes && !text.isWellFormed()) {
    const value = fallback(input);
    return encoded ? Buffer.from(JSON.stringify(value)) : value;
  }
  const source = bytes ? input.text : Buffer.from(text);
  const n = source.length, header = input.header === true;
  let out = Buffer.allocUnsafe(n * 6 + 1024), w = 0;
  let p = n >= 3 && source[0] === 239 && source[1] === 187 && source[2] === 191 ? 3 : 0;
  let line = 1, row = 0, width = -1, haveHeader = false;
  const errors = [];
  w = out.write(header ? '{"columns":' : '{"columns":null,"rows":[');
  while (p < n) {
    if (source[p] === 10 || (source[p] === 13 && source[p + 1] === 10)) {
      p += source[p] === 10 ? 1 : 2; line++; continue;
    }
    const recordLine = line, recordRow = header && !haveHeader ? null : row;
    // Reserve for all remaining input escapes and this record's padding. This
    // also handles inputs whose width makes padding larger than the CSV itself.
    const needed = w + (n - p) * 6 + Math.max(0, width) * 3 + 32;
    if (needed > out.length) {
      const grown = Buffer.allocUnsafe(Math.max(out.length * 2, needed));
      out.copy(grown, 0, 0, w); out = grown;
    }
    const recordStart = w;
    if (recordRow !== null && row) out[w++] = 44;
    out[w++] = 91;
    let fields = 0, more = true, quoted = false, empty = true, extraStart = -1;
    while (more) {
      if (fields) out[w++] = 44;
      if (width >= 0 && fields === width) extraStart = w;
      out[w++] = 34;
      quoted = source[p] === 34;
      empty = true;
      let junk = false;
      if (quoted) {
        let close = source.indexOf(34, p + 1);
        while (close >= 0 && source[close + 1] === 34) close = source.indexOf(34, close + 2);
        if (close < 0) { errors.push(error('unterminated_quote', recordLine, recordRow)); w = escape(out, w, 34); p++; empty = false; }
        else {
          p++;
          while (p < close) {
            const c = source[p];
            if (c === 34 || c === 92 || c < 32) {
              if (c === 13) { w = escape(out, w, 10); line++; p += source[p + 1] === 10 ? 2 : 1; }
              else { w = escape(out, w, c); if (c === 10) line++; p += c === 34 ? 2 : 1; }
            } else { const end = copyQuoted(source, p, close, out, w); w += end - p; p = end; }
          }
          empty = false; p++; junk = true;
        }
      }
      let start = p, added = false;
      for (;;) {
        const c = p < n ? source[p] : -1;
        if (c === -1 || c === 44 || c === 10 || (c === 13 && source[p + 1] === 10)) {
          if (p > start) { empty = false; added = true; }
          more = c === 44;
          if (c !== -1) { p += c === 13 ? 2 : 1; if (!more) line++; }
          break;
        }
        if (c === 13 || c === 34 || c === 92 || c < 32) {
          if (p > start) { empty = false; added = true; }
          if (c === 13) errors.push(error('stray_cr', recordLine, recordRow));
          else { w = escape(out, w, c); empty = false; added = true; }
          p++; start = p;
        } else { const end = copyBare(source, p, n, out, w); w += end - p; p = end; }
      }
      if (junk && added) errors.push(error('quote_junk', recordLine, recordRow));
      out[w++] = 34; fields++;
    }
    if (fields === 1 && empty && !quoted) { w = recordStart; continue; }
    if (width < 0) width = fields;
    if (recordRow !== null) {
      if (fields < width) {
        errors.push(error('short_row', recordLine, recordRow, ',"fields":' + fields));
        for (let i = fields; i < width; i++) { out[w++] = 44; out[w++] = 34; out[w++] = 34; }
      } else if (fields > width) {
        errors.push(error('long_row', recordLine, recordRow, ',"extra":[' + out.toString('utf8', extraStart, w) + ']'));
        w = extraStart - 1;
      }
    }
    out[w++] = 93;
    if (recordRow === null) { haveHeader = true; w += out.write(',"rows":[', w); }
    else row++;
  }
  if (header && !haveHeader) w += out.write('[],"rows":[', w);
  const tail = Buffer.from('],"errors":[' + errors.join(',') + ']}');
  const result = Buffer.concat([out.subarray(0, w), tail]);
  return encoded ? result : JSON.parse(result.toString('utf8'));
}

function escape(out, w, c) {
  out[w++] = 92;
  if (c === 34 || c === 92) out[w++] = c;
  else if (c === 10) out[w++] = 110;
  else if (c === 13) out[w++] = 114;
  else if (c === 9) out[w++] = 116;
  else if (c === 8) out[w++] = 98;
  else if (c === 12) out[w++] = 102;
  else {
    out[w++] = 117; out[w++] = 48; out[w++] = 48;
    out[w++] = 48 + (c >> 4); const low = c & 15;
    out[w++] = low < 10 ? 48 + low : 87 + low;
  }
  return w;
}

function error(code, line, row, extra = '') {
  return '{"code":"' + code + '","line":' + line + ',"row":' + row + extra + '}';
}

function copyBare(source, p, n, out, w) {
  while (p < n) {
    const c = source[p];
    if (c < 32 || c === 34 || c === 44 || c === 92) break;
    out[w++] = c; p++;
  }
  return p;
}
function copyQuoted(source, p, end, out, w) {
  while (p < end) {
    const c = source[p];
    if (c < 32 || c === 34 || c === 92) break;
    out[w++] = c; p++;
  }
  return p;
}

// Parse the JSON envelope while decoding text strings to UTF-8 in place. JSON
// Unicode escapes use the native decoder to preserve every UTF-16 code unit.
export function readCases(data) {
  let p = 0;
  function space() { while (data[p] === 32 || data[p] === 10 || data[p] === 13 || data[p] === 9) p++; }
  function value(bytes = false) {
    space();
    const c = data[p];
    if (c === 34) { const result = string(data, p, bytes); p = result[0]; return result[1]; }
    if (c === 91) {
      p++; space(); const result = [];
      if (data[p] !== 93) for (;;) { result.push(value()); space(); if (data[p] !== 44) break; p++; }
      p++; return result;
    }
    if (c === 123) {
      p++; space(); const result = {};
      if (data[p] !== 125) for (;;) {
        space(); const pair = string(data, p, false); p = pair[0]; const key = pair[1]; space(); p++;
        Object.defineProperty(result, key, { value: value(key === 'text'), enumerable: true, writable: true, configurable: true }); space(); if (data[p] !== 44) break; p++;
      }
      p++; return result;
    }
    const begin = p;
    while (p < data.length && data[p] !== 44 && data[p] !== 93 && data[p] !== 125 && data[p] > 32) p++;
    return JSON.parse(data.toString('utf8', begin, p));
  }
  return value();
}
function string(data, p, bytes) {
  const begin = p++;
  let w = p;
  if (!bytes) {
    while (data[p] !== 34) { if (data[p] === 92) p++; p++; }
    return [++p, JSON.parse(data.toString('utf8', begin, p))];
  }
  // Native decoding preserves every UTF-16 code unit for Unicode escapes.
  // The usual JSON text spelling can be decoded in place in a single pass.
  if (data.indexOf('\\u', p) >= 0) {
    while (data[p] !== 34) { if (data[p] === 92) p++; p++; }
    return [++p, JSON.parse(data.toString('utf8', begin, p))];
  }
  while (data[p] !== 34) {
    let c = data[p++];
    if (c !== 92) { data[w++] = c; continue; }
    c = data[p++];
    data[w++] = c === 110 ? 10 : c === 114 ? 13 : c === 116 ? 9 : c === 98 ? 8 : c === 102 ? 12 : c;
  }
  p++;
  return [p, data.subarray(begin + 1, w)];
}

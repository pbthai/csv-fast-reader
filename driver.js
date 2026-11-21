import { readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { readCases } from './input.js';
setFlagsFromString('--no-incremental-marking');
const { run } = await import('./solve.js');
const cases = readCases(readFileSync(`${process.env.MAKEFUN_INPUT_DIR ?? '/input'}/cases.json`));
const output = openSync(`${process.env.MAKEFUN_OUTPUT_DIR ?? '/output'}/answers.json`, 'w');
writeSync(output, '[');
for (let i = 0; i < cases.length; i++) {
  if (i) writeSync(output, ',');
  writeSync(output, run(cases[i].input, true));
  cases[i] = null;
}
writeSync(output, ']');
closeSync(output);

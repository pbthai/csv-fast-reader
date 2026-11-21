import { readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';

setFlagsFromString('--no-incremental-marking');
const { run } = await import('./solve.js');
const cases = JSON.parse(readFileSync(`${process.env.MAKEFUN_INPUT_DIR ?? '/input'}/cases.json`, 'utf8'));
const output = openSync(`${process.env.MAKEFUN_OUTPUT_DIR ?? '/output'}/answers.json`, 'w');
writeSync(output, '[');
for (let i = 0; i < cases.length; i++) {
  if (i) writeSync(output, ',');
  writeSync(output, JSON.stringify(run(cases[i].input)));
  cases[i] = null;
}
writeSync(output, ']');
closeSync(output);

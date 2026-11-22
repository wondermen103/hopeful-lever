// Hopeful Lever — make.fun csv-reader-speed-01 entrypoint (Node 22)
// Reads /input/cases.json, answers each case independently via solve.js run(),
// and streams deterministic JSON to /output/answers.json.

import { readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { setFlagsFromString } from 'node:v8';
import { run } from './solve.js';

// Single-threaded GC + immediate Maglev tier-up eliminates concurrent thread
// CPU accounting overhead and TurboFan background compilation time.
setFlagsFromString(
  '--single-threaded-gc --no-incremental-marking --no-turbofan --no-concurrent-recompilation --invocation-count-for-maglev=1'
);

const inputDir = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(new TextDecoder().decode(readFileSync(`${inputDir}/cases.json`)));

const fd = openSync(`${outputDir}/answers.json`, 'w');
writeSync(fd, '[');
for (let i = 0; i < cases.length; i++) {
  const c = cases[i];
  cases[i] = null;
  if (i > 0) writeSync(fd, ',');
  writeSync(fd, JSON.stringify(run(c.input)));
}
writeSync(fd, ']');
closeSync(fd);

# Hopeful Lever — Faster Drop-in for `csv-reader 1.0.0`

[![Competition](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![Rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/wondermen103/hopeful-lever/rank.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)
[![Reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/wondermen103/hopeful-lever/reward.svg)](https://make.fun/c/csv-reader-speed-01-run-20261121)

A dependency-free, deterministic ES module (`solve.js`) and Node 22 entrypoint (`main.ts`) for the make.fun competition **`csv-reader-speed-01-run-20261121`** (*Read broken CSV files faster*).

Produces **bit-for-bit identical JSON output** to `csv-reader 1.0.0` across all valid and broken CSV edge cases while cutting net CPU time by **4.94×** on the official practice set.

## Verified Practice-Set Benchmarks (Node 22.23.2)

Measured under the competition timing protocol (1 untimed warmup + 9 timed rounds, dropping 2 fastest and 2 slowest, kernel `ru_utime + ru_stime` net of null-entry control):

| Entry | Total CPU (trimmed) | Net CPU (trimmed) | Margin | Speedup | Gate (`grade-local`) |
| --- | ---: | ---: | ---: | ---: | :---: |
| Null control | 176.0 ms | 0.0 ms | — | — | — |
| `csv-reader 1.0.0` (house baseline) | 2,686.0 ms | 2,510.0 ms | — | 1.00× | 6 / 6 |
| **Hopeful Lever** | **684.0 ms** | **508.0 ms** | **−2,002.0 ms** | **4.94×** | **6 / 6 (L1 byte-for-byte)** |

- **Determinism**: Single identical SHA-256 across 10/10 runs and bit-for-bit match with baseline output.
- **Differential verification**: 6/6 official practice cases + 12/12 unseen full-scale generator seeds + 1,500 adversarial broken-CSV fuzz cases verified against `csv-reader 1.0.0`.
- **Standalone submission footprint**: ~19 KB (under 2% of the 1 MiB repository cap).

## Key Engineering Optimizations

1. **SIMD-accelerated line & delimiter scanning**: Uses V8's C++ SIMD `String.prototype.indexOf` for `\n`, `\r`, `"`, and `,` instead of character-by-character concatenation, eliminating deep `ConsString` trees that also slowed down `JSON.stringify` by ~520 ms.
2. **Quote-free C++ row splitting**: Clean lines without quotes or stray CRs bypass per-field JS loops via `text.slice(pos, lineEnd).split(',')`, returning C++-allocated `PACKED_ELEMENTS` arrays directly.
3. **Monomorphic `PACKED_ELEMENTS` row packing (`packRow`)**: Quoted rows write into a reusable scratch buffer and pack exact-width array literals (`[b[0], b[1], ...]`), avoiding `HOLEY_ELEMENTS` (`new Array(w)`) and repeated array resizes so V8's `JSON.stringify` stays on its fast path.
4. **Streaming case-by-case JSON output**: `main.ts` decodes `cases.json` via `TextDecoder` (simdutf), processes each case independently (clearing each input reference immediately), and streams each `JSON.stringify(run(c.input))` directly to `/output/answers.json`.
5. **Single-threaded GC + immediate Maglev tier-up**: Configures `--single-threaded-gc --no-incremental-marking --no-turbofan --no-concurrent-recompilation --invocation-count-for-maglev=1` via `node:v8`, eliminating background GC/TurboFan CPU thread accounting overhead on single-CPU sandboxes.

## Competition Submission Files

For a standalone competition repository, include at the repository root:

- `main.ts` — Node 22 competition entrypoint
- `solve.js` — Dependency-free ES module exporting `run(input)`
- `package.json` — Minimal `"type": "module"` manifest
- `LICENSE` — MIT License
- `README.md` — Project documentation with competition badges

## Local Verification

```bash
# Grade locally with the unpacked kit
node cli/makefun.mjs grade-local --kit . --bot <repo-path> --driver process

# Run pre-submit checks
node cli/makefun.mjs check --kit . --repo <repo-path>
```

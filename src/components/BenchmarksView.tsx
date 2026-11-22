import { useState } from 'react';
import { Play, CheckCircle2, Gauge, Cpu, ShieldCheck, HardDrive } from 'lucide-react';
import { run } from '../../solve.js';
import { readCsvReference } from '../utils/referenceCsv';
import { generateBenchmarkCsv, type WorkloadProfile } from '../utils/sampleDatasets';

interface LiveRunResult {
  rowsCount: number;
  profile: WorkloadProfile;
  bytes: number;
  refMs: number;
  optMs: number;
  speedup: number;
  refMbPerSec: number;
  optMbPerSec: number;
  parsedRows: number;
  errorCount: number;
  identical: boolean;
}

const NODE_BENCHMARKS = [
  {
    name: 'Hopeful Lever (solve.js + main.ts)',
    tag: 'Final entry',
    totalCpuMs: 684.0,
    netCpuMs: 508.0,
    wallMs: 685.6,
    speedup: '4.94×',
    gate: '6 / 6',
    accent: true,
    runs: [660, 670, 680, 680, 680, 690, 690, 700, 700],
  },
  {
    name: 'v9_packlit (monomorphic PACKED_ELEMENTS)',
    tag: 'Milestone',
    totalCpuMs: 736.7,
    netCpuMs: 560.7,
    wallMs: 742.0,
    speedup: '4.48×',
    gate: '6 / 6',
    accent: false,
    runs: [720, 720, 740, 750, 780],
  },
  {
    name: 'v4 (charCodeAt scanner + V8 flags)',
    tag: 'Milestone',
    totalCpuMs: 853.3,
    netCpuMs: 677.3,
    wallMs: 851.0,
    speedup: '3.71×',
    gate: '6 / 6',
    accent: false,
    runs: [830, 840, 850, 870, 890],
  },
  {
    name: 'csv-reader 1.0.0 (house baseline)',
    tag: 'Baseline',
    totalCpuMs: 2686.0,
    netCpuMs: 2510.0,
    wallMs: 1450.6,
    speedup: '1.00×',
    gate: '6 / 6',
    accent: false,
    runs: [2540, 2600, 2600, 2650, 2680, 2680, 2820, 3070, 3110],
  },
];

const PIPELINE_STAGES = [
  { label: 'Node 22 startup (null control)', ms: 176, share: 25.7, color: 'bg-slate-300' },
  { label: 'readFileSync + TextDecoder + JSON.parse', ms: 151, share: 22.1, color: 'bg-slate-500' },
  { label: 'solve.js run() (10.2M CSV chars)', ms: 207, share: 30.3, color: 'bg-blue-600' },
  { label: 'Streaming JSON.stringify + writeSync', ms: 150, share: 21.9, color: 'bg-emerald-600' },
];

const OPTIMIZATIONS = [
  {
    step: '01',
    technique: 'SIMD indexOf + slice scanning',
    impact: 'Eliminates per-char string concatenation and deep V8 ConsString trees (~520 ms saved in JSON.stringify alone).',
  },
  {
    step: '02',
    technique: 'Quote-free C++ split fast path',
    impact: 'Clean lines without quotes or stray CRs call text.slice(pos, lineEnd).split(",") directly in C++.',
  },
  {
    step: '03',
    technique: 'Monomorphic PACKED_ELEMENTS packRow',
    impact: 'Returns exact-width array literals [b[0], ...] instead of HOLEY new Array(w), doubling serializer throughput.',
  },
  {
    step: '04',
    technique: 'Streaming writeSync + TextDecoder',
    impact: 'Decodes 11 MB cases.json via simdutf TextDecoder and streams case-by-case JSON while releasing input refs.',
  },
  {
    step: '05',
    technique: 'Single-threaded GC + immediate Maglev',
    impact: '--single-threaded-gc --no-turbofan --invocation-count-for-maglev=1 avoids concurrent CPU thread burn.',
  },
];

export function BenchmarksView() {
  const [rowCount, setRowCount] = useState<number>(5000);
  const [profile, setProfile] = useState<WorkloadProfile>('mixed');
  const [running, setRunning] = useState(false);
  const [liveResult, setLiveResult] = useState<LiveRunResult | null>(null);

  const runLiveBenchmark = () => {
    setRunning(true);
    window.setTimeout(() => {
      const input = generateBenchmarkCsv(rowCount, profile);
      const bytes = new TextEncoder().encode(input.text).length;

      // Warmup 1 pass each
      run(input);
      readCsvReference(input);

      const iterations = rowCount <= 5000 ? 5 : 3;
      const optTimes: number[] = [];
      const refTimes: number[] = [];
      let optOut = run(input);
      let refOut = readCsvReference(input);

      for (let i = 0; i < iterations; i++) {
        const t0 = performance.now();
        optOut = run(input);
        optTimes.push(performance.now() - t0);

        const t1 = performance.now();
        refOut = readCsvReference(input);
        refTimes.push(performance.now() - t1);
      }

      optTimes.sort((a, b) => a - b);
      refTimes.sort((a, b) => a - b);
      const optMs = optTimes[Math.floor(optTimes.length / 2)];
      const refMs = refTimes[Math.floor(refTimes.length / 2)];
      const identical = JSON.stringify(optOut) === JSON.stringify(refOut);

      const mb = bytes / (1024 * 1024);
      setLiveResult({
        rowsCount: rowCount,
        profile,
        bytes,
        refMs,
        optMs,
        speedup: refMs / Math.max(optMs, 0.01),
        refMbPerSec: mb / (refMs / 1000),
        optMbPerSec: mb / (optMs / 1000),
        parsedRows: optOut.rows.length,
        errorCount: optOut.errors.length,
        identical,
      });
      setRunning(false);
    }, 16);
  };

  return (
    <div className="space-y-6">
      {/* KPI Strip */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Net CPU Time (Node 22)</span>
            <Cpu className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-slate-900">
              508.0 ms
            </span>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-medium">
              −2,002 ms
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            684.0 ms total · 176.0 ms null control
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Speedup vs csv-reader</span>
            <Gauge className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-blue-600">
              4.94×
            </span>
            <span className="text-xs text-slate-500">trimmed mean</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            9 timed rounds · trim 2+2 · 10.2M chars
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Correctness Gate</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-slate-900">
              6 / 6
            </span>
            <span className="text-xs font-medium text-emerald-700">L1 byte-for-byte</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            + 12 unseen seeds · + 1,500 fuzz cases
          </p>
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Submission Footprint</span>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight font-mono tabular-nums text-slate-900">
              22.9 KB
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">2.2% of cap</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            5 files · zero deps · 1 MiB limit
          </p>
        </div>
      </section>

      {/* Main 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Verified Practice-Set Comparison */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">
                Practice-Set Kernel CPU Time (Node 22.23.2)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Official practice instance (drand round 34140941, 6 cases, 11.06 MB JSON) · net of 176.0 ms null control
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0 pt-0.5">
              lower is faster
            </span>
          </div>

          <div className="mt-4 space-y-4">
            {NODE_BENCHMARKS.map((entry) => {
              const pct = Math.max(4, (entry.netCpuMs / 2510.0) * 100);
              return (
                <div key={entry.name} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-4 text-xs">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className={entry.accent ? 'font-semibold text-slate-900 truncate' : 'font-medium text-slate-700 truncate'}>
                        {entry.name}
                      </span>
                      <span className="text-slate-400 shrink-0">· {entry.tag}</span>
                    </div>
                    <div className="flex items-baseline gap-3 shrink-0 font-mono tabular-nums">
                      <span className={entry.accent ? 'font-semibold text-blue-600' : 'text-slate-600'}>
                        {entry.speedup}
                      </span>
                      <span className={entry.accent ? 'font-semibold text-slate-900 w-20 text-right' : 'text-slate-700 w-20 text-right'}>
                        {entry.netCpuMs.toFixed(1)} ms
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                    <div
                      className={`h-full rounded-sm transition-all ${entry.accent ? 'bg-blue-600' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stage Breakdown Bar */}
          <div className="mt-6 pt-5 border-t border-slate-200">
            <div className="flex items-baseline justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-900">
                Total Process CPU Breakdown (684.0 ms)
              </h3>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                wall: 685.6 ms · 1.00 CPU util
              </span>
            </div>
            <div className="h-3 w-full flex rounded-sm overflow-hidden gap-px bg-white">
              {PIPELINE_STAGES.map((stage) => (
                <div
                  key={stage.label}
                  className={stage.color}
                  style={{ width: `${stage.share}%` }}
                  title={`${stage.label}: ${stage.ms} ms`}
                />
              ))}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {PIPELINE_STAGES.map((stage) => (
                <div key={stage.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-xs shrink-0 ${stage.color}`} />
                    <span className="text-slate-600 truncate">{stage.label}</span>
                  </div>
                  <span className="font-mono tabular-nums text-slate-800 font-medium ml-2">
                    {stage.ms} ms
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Live In-Browser Benchmark Runner */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col">
          <div className="pb-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Live In-Browser Race
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Runs root <code className="font-mono text-slate-700">solve.js</code> head-to-head against <code className="font-mono text-slate-700">csv-reader 1.0.0</code> right in your browser engine.
            </p>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Workload Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[2000, 5000, 15000].map((count) => (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setRowCount(count)}
                    className={`px-3 py-1.5 text-xs font-mono tabular-nums rounded-md border transition-colors cursor-pointer ${
                      rowCount === count
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {count.toLocaleString()} rows
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                CSV Profile
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    ['mixed', 'Mixed Broken'],
                    ['crlf', 'CRLF Ledger'],
                    ['quoted', 'Quote-Heavy'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setProfile(key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                      profile === key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={runLiveBenchmark}
              disabled={running}
              className="w-full mt-1 inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-md transition-colors cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {running ? 'Running live benchmark...' : 'Run Live Benchmark'}
            </button>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-200 flex-1 flex flex-col justify-center">
            {!liveResult ? (
              <p className="text-xs text-slate-500 text-center py-6">
                Select a workload size and run a live head-to-head race to measure real parse latency, throughput, and exact JSON parity.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-slate-500">Observed Speedup</div>
                    <div className="text-2xl font-semibold font-mono tabular-nums text-blue-600">
                      {liveResult.speedup.toFixed(2)}×
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {liveResult.identical ? 'Exact JSON Parity' : 'Parity Mismatch'}
                    </div>
                    <div className="text-xs font-mono tabular-nums text-slate-500 mt-0.5">
                      {(liveResult.bytes / 1024).toFixed(0)} KB · {liveResult.parsedRows.toLocaleString()} rows · {liveResult.errorCount} errs
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="font-medium text-slate-900">Hopeful Lever (solve.js)</span>
                      <span className="font-mono tabular-nums text-slate-900">
                        {liveResult.optMs.toFixed(2)} ms · {liveResult.optMbPerSec.toFixed(1)} MB/s
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-sm"
                        style={{ width: `${Math.max(4, (liveResult.optMs / liveResult.refMs) * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">csv-reader 1.0.0 (reference)</span>
                      <span className="font-mono tabular-nums text-slate-600">
                        {liveResult.refMs.toFixed(2)} ms · {liveResult.refMbPerSec.toFixed(1)} MB/s
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                      <div className="h-full bg-slate-400 rounded-sm w-full" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Optimization Engineering Architecture Table */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-slate-900">
            Key Systems Optimizations
          </h2>
          <span className="text-xs text-slate-500">
            Pure JS/TS · Zero native addons · Zero external dependencies
          </span>
        </div>
        <div className="divide-y divide-slate-200">
          {OPTIMIZATIONS.map((item) => (
            <div key={item.step} className="px-5 py-3 grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 text-xs items-baseline">
              <div className="md:col-span-4 flex items-baseline gap-3">
                <span className="font-mono tabular-nums text-slate-400 font-medium">{item.step}</span>
                <span className="font-semibold text-slate-900">{item.technique}</span>
              </div>
              <div className="md:col-span-8 text-slate-600 leading-relaxed">
                {item.impact}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

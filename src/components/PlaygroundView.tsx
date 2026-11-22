import { useMemo, useState } from 'react';
import { CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { run } from '../../solve.js';
import { readCsvReference } from '../utils/referenceCsv';
import { CSV_PRESETS } from '../utils/sampleDatasets';

function visualizeControls(text: string): string {
  return text.replace(/\uFEFF|\r\n|\r|\n/g, (m) => {
    if (m === '\uFEFF') return '⟨BOM⟩';
    if (m === '\r\n') return '⟨CRLF⟩\n';
    if (m === '\r') return '⟨CR⟩';
    return '⟨LF⟩\n';
  });
}

export function PlaygroundView() {
  const [activePreset, setActivePreset] = useState(CSV_PRESETS[0].id);
  const [csvText, setCsvText] = useState(CSV_PRESETS[0].text);
  const [header, setHeader] = useState(CSV_PRESETS[0].header);
  const [showInvisibles, setShowInvisibles] = useState(false);

  const analysis = useMemo(() => {
    const optimized = run({ text: csvText, header });
    const reference = readCsvReference({ text: csvText, header });
    const optJson = JSON.stringify(optimized);
    const refJson = JSON.stringify(reference);
    const identical = optJson === refJson;
    return { optimized, reference, jsonBytes: optJson.length, identical };
  }, [csvText, header]);

  const handleSelectPreset = (id: string) => {
    const preset = CSV_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setActivePreset(preset.id);
    setCsvText(preset.text);
    setHeader(preset.header);
  };

  const colCount =
    analysis.optimized.columns !== null
      ? analysis.optimized.columns.length
      : analysis.optimized.rows[0]?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Preset selector bar */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Broken-CSV Differential Verifier
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Edit any input below to compare <code className="font-mono text-slate-700">solve.js</code> against <code className="font-mono text-slate-700">csv-reader 1.0.0</code> code unit for code unit.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={header}
                onChange={(e) => setHeader(e.target.checked)}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="font-medium text-slate-700">header: {header ? 'true' : 'false'}</span>
            </label>

            <button
              type="button"
              onClick={() => setShowInvisibles((v) => !v)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
            >
              {showInvisibles ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showInvisibles ? 'Hide Control Chars' : 'Show CR/LF/BOM'}
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CSV_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors cursor-pointer ${
                activePreset === preset.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </section>

      {/* Editor + Live Status */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs bg-slate-50/70">
            <span className="font-semibold text-slate-800">Raw CSV Input</span>
            <span className="font-mono tabular-nums text-slate-500">
              {csvText.length} chars · {analysis.optimized.rows.length} rows
            </span>
          </div>

          <textarea
            value={csvText}
            onChange={(e) => {
              setActivePreset('custom');
              setCsvText(e.target.value);
            }}
            spellCheck={false}
            rows={10}
            aria-label="Raw CSV input"
            className="w-full p-4 font-mono text-xs leading-relaxed text-slate-900 bg-white focus:outline-none resize-y"
          />

          {showInvisibles && (
            <div className="border-t border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] font-semibold text-slate-600 mb-1.5">
                Control Character Map
              </div>
              <pre className="font-mono text-[11px] leading-relaxed text-slate-700 whitespace-pre-wrap break-all">
                {visualizeControls(csvText)}
              </pre>
            </div>
          )}

          {/* Differential Parity Footer */}
          <div className="mt-auto px-4 py-3 border-t border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2 text-xs">
            {analysis.identical ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                Identical to csv-reader 1.0.0
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-semibold text-rose-700">
                <AlertTriangle className="w-4 h-4" />
                Diff detected against reference
              </span>
            )}
            <span className="font-mono tabular-nums text-slate-500">
              {analysis.jsonBytes.toLocaleString()} B JSON · {analysis.optimized.errors.length} errors
            </span>
          </div>
        </section>

        {/* Parsed Output Table + Errors */}
        <section className="lg:col-span-7 space-y-6">
          {/* Parsed Records */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs bg-slate-50/70">
              <span className="font-semibold text-slate-800">
                Parsed Records ({analysis.optimized.rows.length})
              </span>
              <span className="font-mono tabular-nums text-slate-500">
                width: {colCount} · columns: {analysis.optimized.columns === null ? 'null' : `[${analysis.optimized.columns.length}]`}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/50 text-slate-600">
                    <th className="py-2 px-3 font-mono font-medium w-10 text-slate-400">#</th>
                    {analysis.optimized.columns !== null
                      ? analysis.optimized.columns.map((col, idx) => (
                          <th key={idx} className="py-2 px-3 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {col === '' ? <span className="text-slate-400 italic">empty</span> : col}
                          </th>
                        ))
                      : Array.from({ length: colCount }, (_, idx) => (
                          <th key={idx} className="py-2 px-3 font-mono font-medium text-slate-500 whitespace-nowrap">
                            col_{idx}
                          </th>
                        ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {analysis.optimized.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1, colCount + 1)} className="py-6 text-center text-slate-400 font-sans">
                        No data rows parsed.
                      </td>
                    </tr>
                  ) : (
                    analysis.optimized.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50/80">
                        <td className="py-2 px-3 text-slate-400 tabular-nums align-top">{rIdx}</td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="py-2 px-3 text-slate-800 whitespace-pre-wrap break-words align-top">
                            {cell === '' ? <span className="text-slate-300">""</span> : cell}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Structured Errors Table */}
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs bg-slate-50/70">
              <span className="font-semibold text-slate-800">
                Policy Errors ({analysis.optimized.errors.length})
              </span>
              <span className="text-slate-500">
                Exact order, 1-based record line &amp; 0-based row index
              </span>
            </div>

            {analysis.optimized.errors.length === 0 ? (
              <div className="px-4 py-5 text-xs text-slate-500 text-center">
                No broken-CSV errors detected in this input.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 bg-slate-50/40">
                      <th className="py-2 px-3 font-medium">code</th>
                      <th className="py-2 px-3 font-medium">line</th>
                      <th className="py-2 px-3 font-medium">row</th>
                      <th className="py-2 px-3 font-medium">detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {analysis.optimized.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className="py-2 px-3 font-semibold text-amber-700">{err.code}</td>
                        <td className="py-2 px-3 tabular-nums text-slate-700">{err.line}</td>
                        <td className="py-2 px-3 tabular-nums text-slate-700">
                          {err.row === null ? 'null (header)' : err.row}
                        </td>
                        <td className="py-2 px-3 text-slate-600">
                          {err.fields !== undefined
                            ? `fields: ${err.fields}`
                            : err.extra !== undefined
                              ? `extra: ${JSON.stringify(err.extra)}`
                              : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

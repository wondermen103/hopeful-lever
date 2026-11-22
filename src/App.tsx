import { useState } from 'react';
import { Gauge, FileSearch2, PackageCheck, Zap } from 'lucide-react';
import { BenchmarksView } from './components/BenchmarksView';
import { PlaygroundView } from './components/PlaygroundView';
import { SubmissionKitView } from './components/SubmissionKitView';

type TabId = 'benchmarks' | 'playground' | 'kit';

const TABS: Array<{ id: TabId; label: string; icon: typeof Gauge }> = [
  { id: 'benchmarks', label: 'Benchmarks', icon: Gauge },
  { id: 'playground', label: 'CSV Playground', icon: FileSearch2 },
  { id: 'kit', label: 'Submission Kit', icon: PackageCheck },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('benchmarks');

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-20 h-14 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Brand & Context */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div className="flex items-baseline gap-2 min-w-0">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 truncate">
                Hopeful Lever
              </h1>
              <span className="hidden md:inline text-xs font-mono text-slate-400 truncate">
                csv-reader-speed-01
              </span>
            </div>
          </div>

          {/* Zone 2: Navigation Tabs */}
          <nav aria-label="Primary views" className="flex items-center h-full gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative h-full px-3 inline-flex items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {isActive && (
                    <span className="absolute inset-x-2 bottom-0 h-0.5 bg-blue-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'kit' ? 'benchmarks' : 'kit')}
              className="px-3 py-1.5 text-xs font-semibold rounded-md bg-slate-900 text-white hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {activeTab === 'kit' ? 'View Benchmarks' : 'Save to GitHub'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'benchmarks' && <BenchmarksView />}
        {activeTab === 'playground' && <PlaygroundView />}
        {activeTab === 'kit' && <SubmissionKitView />}
      </main>

      {/* Minimal Metadata Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Hopeful Lever · Drop-in replacement for make.fun csv-reader 1.0.0 · MIT License
          </span>
          <span className="font-mono tabular-nums">
            508.0 ms net CPU · 4.94× baseline · 6/6 gate · 22.9 KB
          </span>
        </div>
      </footer>
    </div>
  );
}

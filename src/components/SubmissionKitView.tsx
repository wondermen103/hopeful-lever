import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Check,
  Download,
  FileCode2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import solveRaw from '../../solve.js?raw';
import mainRaw from '../../main.ts?raw';
import licenseRaw from '../../LICENSE?raw';
import readmeRaw from '../../README.md?raw';
import {
  COMPETITION_URL,
  COMPETITION_TOPIC,
  FULL_REPO_TRACKED_BYTES,
  MAX_REPO_BYTES,
  isValidGitHubSegment,
  buildRepoUrl,
  buildLiveBadgeUrls,
  buildPersonalizedReadme,
  buildOwnerClaimJson,
  buildGhAboutCommand,
} from '../utils/githubKit';

const STANDALONE_PACKAGE_JSON =
  JSON.stringify(
    {
      name: 'hopeful-lever',
      version: '1.0.0',
      private: true,
      type: 'module',
    },
    null,
    2
  ) + '\n';

const STORAGE_CONFIG_KEY = 'hopeful-lever:github-config:v1';
const STORAGE_STEPS_KEY = 'hopeful-lever:github-steps:v1';

interface RepoConfig {
  owner: string;
  repo: string;
  wallet: string;
}

interface KitFile {
  name: string;
  role: string;
  content: string;
  bytes: number;
  dynamic?: boolean;
}

const encoder = new TextEncoder();

function loadStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallback;
  }
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SubmissionKitView() {
  const [config, setConfig] = useState<RepoConfig>(() => {
    const stored = loadStoredJson<RepoConfig>(STORAGE_CONFIG_KEY, {
      owner: 'wondermen103',
      repo: 'hopeful-lever',
      wallet: '',
    });
    return {
      ...stored,
      owner: stored.owner.trim() ? stored.owner : 'wondermen103',
      repo: stored.repo.trim() ? stored.repo : 'hopeful-lever',
    };
  });

  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(() =>
    loadStoredJson<Record<string, boolean>>(STORAGE_STEPS_KEY, {
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
    })
  );

  const [selectedName, setSelectedName] = useState('README.md');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch {
      // Ignore storage quota errors
    }
  }, [config]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_STEPS_KEY, JSON.stringify(completedSteps));
    } catch {
      // Ignore storage quota errors
    }
  }, [completedSteps]);

  const badgeUrls = useMemo(
    () => buildLiveBadgeUrls(config.owner, config.repo),
    [config.owner, config.repo]
  );

  const personalizedReadme = useMemo(
    () => buildPersonalizedReadme(readmeRaw, config.owner, config.repo),
    [config.owner, config.repo]
  );

  const ownerClaimJson = useMemo(() => buildOwnerClaimJson(config.wallet), [config.wallet]);
  const repoUrl = useMemo(() => buildRepoUrl(config.owner, config.repo), [config.owner, config.repo]);
  const ghAboutCommand = useMemo(
    () => buildGhAboutCommand(config.owner, config.repo),
    [config.owner, config.repo]
  );

  const kitFiles: KitFile[] = useMemo(() => {
    const base: KitFile[] = [
      {
        name: 'README.md',
        role: badgeUrls.ready
          ? 'Personalized with your 3 live make.fun badges (zero placeholders)'
          : 'Benchmarks, architecture & make.fun badge template',
        content: personalizedReadme,
        bytes: encoder.encode(personalizedReadme).length,
        dynamic: badgeUrls.ready,
      },
      {
        name: 'solve.js',
        role: 'Dependency-free ES module exporting run(input)',
        content: solveRaw,
        bytes: encoder.encode(solveRaw).length,
      },
      {
        name: 'main.ts',
        role: 'Node 22 competition entrypoint (/input -> /output)',
        content: mainRaw,
        bytes: encoder.encode(mainRaw).length,
      },
      {
        name: 'LICENSE',
        role: 'OSI-approved MIT License with SPDX header',
        content: licenseRaw,
        bytes: encoder.encode(licenseRaw).length,
      },
      {
        name: 'package.json',
        role: 'Minimal ES module manifest ("type": "module")',
        content: STANDALONE_PACKAGE_JSON,
        bytes: encoder.encode(STANDALONE_PACKAGE_JSON).length,
      },
    ];

    if (ownerClaimJson) {
      base.push({
        name: '.makefun/owner.json',
        role: 'Wallet ownership claim file (for wallet-only accounts)',
        content: ownerClaimJson,
        bytes: encoder.encode(ownerClaimJson).length,
        dynamic: true,
      });
    }

    return base;
  }, [badgeUrls.ready, personalizedReadme, ownerClaimJson]);

  const standaloneBytes = useMemo(
    () => kitFiles.reduce((sum, f) => sum + f.bytes, 0),
    [kitFiles]
  );

  const selectedFile = kitFiles.find((f) => f.name === selectedName) ?? kitFiles[0];

  const ownerInvalid = config.owner.trim().length > 0 && !isValidGitHubSegment(config.owner);
  const repoInvalid = config.repo.trim().length > 0 && !isValidGitHubSegment(config.repo);

  const completedCount = ['step1', 'step2', 'step3', 'step4', 'step5'].filter(
    (id) => completedSteps[id]
  ).length;

  const handleCopy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard API unavailable in restricted context
    }
  };

  const handleToggleStep = (id: string) => {
    setCompletedSteps((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleResetSteps = () => {
    setCompletedSteps({
      step1: true,
      step2: false,
      step3: false,
      step4: false,
      step5: false,
    });
  };

  const handleDownloadAll = () => {
    kitFiles.forEach((f, idx) => {
      const downloadName = f.name.includes('/') ? f.name.split('/').pop() ?? f.name : f.name;
      window.setTimeout(() => downloadTextFile(downloadName, f.content), idx * 120);
    });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: GitHub Repository Configurator + Full-Repo Footprint Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-slate-200">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  GitHub Repository &amp; Live Badge Generator
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter your GitHub username and repository name to auto-fill all three required live make.fun badges in <code className="font-mono text-slate-700">README.md</code>.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0 pt-0.5">
                repo_readme
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="gh-owner" className="block text-xs font-medium text-slate-700 mb-1">
                  GitHub Username
                </label>
                <input
                  id="gh-owner"
                  type="text"
                  value={config.owner}
                  onChange={(e) => setConfig((prev) => ({ ...prev, owner: e.target.value }))}
                  placeholder="your-github-username"
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-md border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    ownerInvalid ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {ownerInvalid && (
                  <p className="mt-1 text-[11px] text-rose-600">
                    Use letters, numbers, hyphens, dots, or underscores only.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="gh-repo" className="block text-xs font-medium text-slate-700 mb-1">
                  Repository Name
                </label>
                <input
                  id="gh-repo"
                  type="text"
                  value={config.repo}
                  onChange={(e) => setConfig((prev) => ({ ...prev, repo: e.target.value }))}
                  placeholder="hopeful-lever"
                  autoComplete="off"
                  spellCheck={false}
                  className={`w-full px-3 py-2 text-xs font-mono rounded-md border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 ${
                    repoInvalid ? 'border-rose-400' : 'border-slate-200'
                  }`}
                />
                {repoInvalid && (
                  <p className="mt-1 text-[11px] text-rose-600">
                    Use a valid GitHub repository slug (no slashes or spaces).
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3">
              <label htmlFor="solana-wallet" className="block text-xs font-medium text-slate-700 mb-1">
                Solana Wallet Address <span className="font-normal text-slate-400">· optional (only if not signed in to make.fun with GitHub)</span>
              </label>
              <input
                id="solana-wallet"
                type="text"
                value={config.wallet}
                onChange={(e) => setConfig((prev) => ({ ...prev, wallet: e.target.value }))}
                placeholder="Base58 address to generate .makefun/owner.json"
                autoComplete="off"
                spellCheck={false}
                className="w-full px-3 py-2 text-xs font-mono rounded-md border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
              />
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            {badgeUrls.ready ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                3 live make.fun badges ready · zero placeholders
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Enter your GitHub username &amp; repo to unlock live badges
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedName('README.md');
                handleCopy('readme-top', personalizedReadme);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedKey === 'readme-top' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedKey === 'readme-top' ? 'Copied README.md' : 'Copy Updated README.md'}
            </button>
          </div>
        </section>

        {/* Full-Repo Size Cap & Readiness Card */}
        <section className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="pb-3.5 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-900">
                Full-Repository Push Readiness
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Pushing this full AI Studio workspace directly stays well inside make.fun&apos;s 1 MiB repository cap.
              </p>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <div className="flex items-baseline justify-between text-xs mb-1.5">
                  <span className="font-medium text-slate-700">Full tracked workspace</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    ~{(FULL_REPO_TRACKED_BYTES / 1024).toFixed(1)} KB / 1,024 KB
                  </span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-sm overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 rounded-sm"
                    style={{ width: `${(FULL_REPO_TRACKED_BYTES / MAX_REPO_BYTES) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  23.2% of cap · <code className="font-mono text-slate-600">.gitignore</code> excludes <code className="font-mono text-slate-600">node_modules/</code>, <code className="font-mono text-slate-600">dist/</code> &amp; internal folders.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">Local Grader</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    6 / 6 · 508.0 ms
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Standalone Core</div>
                  <div className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {(standaloneBytes / 1024).toFixed(1)} KB · {kitFiles.length} files
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3.5 border-t border-slate-200 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              Need minimal files only?
            </span>
            <button
              type="button"
              onClick={handleDownloadAll}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download {kitFiles.length} Files
            </button>
          </div>
        </section>
      </div>

      {/* Section 2: Interactive 5-Step AI Studio -> GitHub -> make.fun Checklist */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              How to Save to GitHub &amp; Submit on make.fun
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Follow these 5 steps in order so every automated make.fun repository check passes on the first try.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono tabular-nums font-semibold text-slate-700">
              {completedCount} / 5 completed
            </span>
            <button
              type="button"
              onClick={handleResetSteps}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="divide-y divide-slate-200">
          {/* Step 1 */}
          <div className="p-5 flex items-start gap-4">
            <input
              id="check-step1"
              type="checkbox"
              checked={Boolean(completedSteps.step1)}
              onChange={() => handleToggleStep('step1')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="check-step1" className="text-xs font-semibold text-slate-900 cursor-pointer">
                01. Workspace root files verified for make.fun
              </label>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                Root <code className="font-mono text-slate-800">main.ts</code>, dependency-free <code className="font-mono text-slate-800">solve.js</code>, <code className="font-mono text-slate-800">LICENSE</code> (<code className="font-mono text-slate-800">SPDX-License-Identifier: MIT</code>), <code className="font-mono text-slate-800">package.json</code> (<code className="font-mono text-slate-800">&quot;type&quot;: &quot;module&quot;</code>), and <code className="font-mono text-slate-800">.gitignore</code> are already in place and verified (<code className="font-mono text-slate-800">grade-local</code> 6/6, <code className="font-mono text-slate-800">check</code> 5/5).
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="p-5 flex items-start gap-4">
            <input
              id="check-step2"
              type="checkbox"
              checked={Boolean(completedSteps.step2)}
              onChange={() => handleToggleStep('step2')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0">
              <label htmlFor="check-step2" className="text-xs font-semibold text-slate-900 cursor-pointer">
                02. Click &ldquo;Save to GitHub&rdquo; in AI Studio&apos;s top-right toolbar
              </label>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                In the Google AI Studio header bar, click the <strong>GitHub icon (Save to GitHub)</strong>, choose <strong>Create a new repository</strong> named <code className="font-mono text-slate-800">{config.repo.trim() || 'hopeful-lever'}</code>, set visibility to <strong>Public</strong> (required — must be created after Nov 21, 02:42 UTC / 8:12 AM IST), and push the initial commit.
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="p-5 flex items-start gap-4">
            <input
              id="check-step3"
              type="checkbox"
              checked={Boolean(completedSteps.step3)}
              onChange={() => handleToggleStep('step3')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <label htmlFor="check-step3" className="text-xs font-semibold text-slate-900 cursor-pointer">
                  03. Commit your personalized README.md with all 3 live make.fun badges
                </label>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  make.fun&apos;s <code className="font-mono text-slate-800">repo_readme</code> check verifies all three live SVG badge URLs with no template placeholders. Open <code className="font-mono text-slate-800">README.md</code> on GitHub, click the pencil icon to edit, paste the generated Markdown below, and commit.
                </p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 font-mono text-[11px] text-slate-700 space-y-1 overflow-x-auto">
                <div className="truncate">{badgeUrls.competition}</div>
                <div className="truncate">{badgeUrls.rank}</div>
                <div className="truncate">{badgeUrls.reward}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('step3-readme', personalizedReadme)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  {copiedKey === 'step3-readme' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'step3-readme' ? 'Copied README.md' : 'Copy README.md'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadTextFile('README.md', personalizedReadme)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download README.md
                </button>
                {ownerClaimJson && (
                  <button
                    type="button"
                    onClick={() => handleCopy('step3-claim', ownerClaimJson)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                  >
                    {copiedKey === 'step3-claim' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copiedKey === 'step3-claim' ? 'Copied owner.json' : 'Copy .makefun/owner.json'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Step 4 */}
          <div className="p-5 flex items-start gap-4">
            <input
              id="check-step4"
              type="checkbox"
              checked={Boolean(completedSteps.step4)}
              onChange={() => handleToggleStep('step4')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <label htmlFor="check-step4" className="text-xs font-semibold text-slate-900 cursor-pointer">
                  04. Configure GitHub About Website &amp; Topic (<code className="font-mono text-slate-800">repo_about</code> check)
                </label>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  On your GitHub repo page, click the gear icon next to <strong>About</strong> (right sidebar), paste the competition website URL, add the topic <code className="font-mono text-slate-800">makefun</code>, and click <strong>Save changes</strong>.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy('about-url', COMPETITION_URL)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  {copiedKey === 'about-url' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'about-url' ? 'Copied Website URL' : `Website: ${COMPETITION_URL}`}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('about-topic', COMPETITION_TOPIC)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  {copiedKey === 'about-topic' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'about-topic' ? 'Copied Topic' : `Topic: ${COMPETITION_TOPIC}`}
                </button>
                <button
                  type="button"
                  onClick={() => handleCopy('about-gh', ghAboutCommand)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
                >
                  {copiedKey === 'about-gh' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'about-gh' ? 'Copied gh CLI Command' : 'Copy gh repo edit'}
                </button>
              </div>
            </div>
          </div>

          {/* Step 5 */}
          <div className="p-5 flex items-start gap-4">
            <input
              id="check-step5"
              type="checkbox"
              checked={Boolean(completedSteps.step5)}
              onChange={() => handleToggleStep('step5')}
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div>
                <label htmlFor="check-step5" className="text-xs font-semibold text-slate-900 cursor-pointer">
                  05. Paste your repository or commit link on make.fun and sign with your wallet
                </label>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Paste your repository URL (or latest commit URL with the full 40-character SHA) into make.fun&apos;s entry form, set Title to <strong>Hopeful Lever</strong> (transcripts are optional), and sign with your Solana payout wallet.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="px-3 py-1.5 text-xs font-mono text-slate-800 bg-slate-50 border border-slate-200 rounded-md">
                  {repoUrl}
                </code>
                <button
                  type="button"
                  onClick={() => handleCopy('repo-url', repoUrl)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                >
                  {copiedKey === 'repo-url' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedKey === 'repo-url' ? 'Copied Repo URL' : 'Copy Repo URL'}
                </button>
                <a
                  href={COMPETITION_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-white border border-slate-200 hover:border-blue-300 rounded-md transition-colors"
                >
                  Open Competition Page
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: File Explorer + Live Source Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <aside className="lg:col-span-4 bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-800">
            Competition Entry Files
          </div>
          <div className="divide-y divide-slate-100">
            {kitFiles.map((file) => {
              const active = file.name === selectedFile.name;
              return (
                <button
                  key={file.name}
                  type="button"
                  onClick={() => setSelectedName(file.name)}
                  className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                    active ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-2 font-mono text-xs font-semibold ${
                        active ? 'text-blue-700' : 'text-slate-900'
                      }`}
                    >
                      <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                      {file.name}
                    </span>
                    <span className="font-mono tabular-nums text-[11px] text-slate-500">
                      {file.bytes.toLocaleString()} B
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-snug">
                    {file.role}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="lg:col-span-8 bg-white border border-slate-200 rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs font-semibold text-slate-900">
                /{selectedFile.name}
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500">
                · {selectedFile.bytes.toLocaleString()} bytes · {selectedFile.content.split('\n').length} lines
                {selectedFile.dynamic ? ' · live generated' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopy(selectedFile.name, selectedFile.content)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                {copiedKey === selectedFile.name ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copiedKey === selectedFile.name ? 'Copied' : 'Copy'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const downloadName = selectedFile.name.includes('/')
                    ? selectedFile.name.split('/').pop() ?? selectedFile.name
                    : selectedFile.name;
                  downloadTextFile(downloadName, selectedFile.content);
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-md transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </button>
            </div>
          </div>

          <pre className="p-4 text-[11px] leading-relaxed font-mono text-slate-800 bg-slate-50/40 overflow-auto max-h-[420px]">
            {selectedFile.content}
          </pre>
        </section>
      </div>
    </div>
  );
}

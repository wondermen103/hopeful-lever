export const COMPETITION_SLUG = 'csv-reader-speed-01-run-20261121';
export const COMPETITION_URL = `https://make.fun/c/${COMPETITION_SLUG}`;
export const COMPETITION_TOPIC = 'makefun';
export const MAX_REPO_BYTES = 1048576;
export const FULL_REPO_TRACKED_BYTES = 243500;

const GITHUB_SEGMENT_RE = /^[A-Za-z0-9_.-]+$/;

export function sanitizeGitHubSegment(value: string): string {
  return value.trim().replace(/^\/+|\/+$/g, '');
}

export function isValidGitHubSegment(value: string): boolean {
  const clean = sanitizeGitHubSegment(value);
  return clean.length > 0 && clean.length <= 100 && GITHUB_SEGMENT_RE.test(clean);
}

export function buildRepoUrl(owner: string, repo: string): string {
  const o = sanitizeGitHubSegment(owner);
  const r = sanitizeGitHubSegment(repo);
  if (!isValidGitHubSegment(o) || !isValidGitHubSegment(r)) {
    return 'https://github.com/<owner>/<repo>';
  }
  return `https://github.com/${o}/${r}`;
}

export function buildLiveBadgeUrls(owner: string, repo: string) {
  const o = sanitizeGitHubSegment(owner);
  const r = sanitizeGitHubSegment(repo);
  const ready = isValidGitHubSegment(o) && isValidGitHubSegment(r);
  const ownerPart = ready ? o : '<owner>';
  const repoPart = ready ? r : '<repo>';

  return {
    ready,
    competition: `https://make.fun/badge/${COMPETITION_SLUG}.svg`,
    rank: `https://make.fun/badge/${COMPETITION_SLUG}/${ownerPart}/${repoPart}/rank.svg`,
    reward: `https://make.fun/badge/${COMPETITION_SLUG}/${ownerPart}/${repoPart}/reward.svg`,
  };
}

export function buildLiveBadgesMarkdown(owner: string, repo: string): string {
  const urls = buildLiveBadgeUrls(owner, repo);
  return [
    `[![Competition](${urls.competition})](${COMPETITION_URL})`,
    `[![Rank](${urls.rank})](${COMPETITION_URL})`,
    `[![Reward](${urls.reward})](${COMPETITION_URL})`,
  ].join('\n');
}

export function buildPersonalizedReadme(baseReadme: string, owner: string, repo: string): string {
  const urls = buildLiveBadgeUrls(owner, repo);
  if (!urls.ready) {
    return baseReadme;
  }

  const badgeBlock = buildLiveBadgesMarkdown(owner, repo);
  const existingBadgeBlockRe = new RegExp(
    `(?:\\[!\\[[^\\]]+\\]\\(https:\\/\\/make\\.fun\\/badge\\/${COMPETITION_SLUG}[^)]*\\)\\]\\(${COMPETITION_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\)\\n?)+`
  );

  let updated = existingBadgeBlockRe.test(baseReadme)
    ? baseReadme.replace(existingBadgeBlockRe, `${badgeBlock}\n`)
    : `${badgeBlock}\n\n${baseReadme}`;

  // Remove any template placeholder reminder note once real owner/repo badges are populated
  updated = updated.replace(/\n?> Note: Before submitting a GitHub repository entry,[\s\S]*$/m, '\n');

  return updated.trimEnd() + '\n';
}

export function buildOwnerClaimJson(wallet: string): string | null {
  const clean = wallet.trim();
  if (!clean) return null;
  return JSON.stringify({ wallet: clean }, null, 2) + '\n';
}

export function buildGhAboutCommand(owner: string, repo: string): string {
  const o = sanitizeGitHubSegment(owner);
  const r = sanitizeGitHubSegment(repo);
  const target = isValidGitHubSegment(o) && isValidGitHubSegment(r) ? `${o}/${r}` : '<owner>/<repo>';
  return `gh repo edit ${target} --homepage ${COMPETITION_URL} --add-topic ${COMPETITION_TOPIC}`;
}

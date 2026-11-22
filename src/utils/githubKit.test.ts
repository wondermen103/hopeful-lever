import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COMPETITION_SLUG,
  COMPETITION_URL,
  isValidGitHubSegment,
  buildRepoUrl,
  buildLiveBadgeUrls,
  buildPersonalizedReadme,
  buildOwnerClaimJson,
  buildGhAboutCommand,
} from './githubKit.ts';

test('validates GitHub owner and repository segments', () => {
  assert.equal(isValidGitHubSegment('octocat'), true);
  assert.equal(isValidGitHubSegment('hopeful-lever_01.js'), true);
  assert.equal(isValidGitHubSegment(''), false);
  assert.equal(isValidGitHubSegment('   '), false);
  assert.equal(isValidGitHubSegment('owner/repo'), false);
  assert.equal(isValidGitHubSegment('has spaces'), false);
});

test('generates live make.fun README with all three badges and zero placeholders', () => {
  const base =
    `# Hopeful Lever\n\n` +
    `[![Competition](https://make.fun/badge/${COMPETITION_SLUG}.svg)](${COMPETITION_URL})\n\n` +
    `Fast drop-in.\n\n` +
    `> Note: Before submitting a GitHub repository entry, update your README.\n`;

  const result = buildPersonalizedReadme(base, 'sumanth-dev', 'hopeful-lever');

  assert.ok(result.includes(`https://make.fun/badge/${COMPETITION_SLUG}.svg`));
  assert.ok(result.includes(`https://make.fun/badge/${COMPETITION_SLUG}/sumanth-dev/hopeful-lever/rank.svg`));
  assert.ok(result.includes(`https://make.fun/badge/${COMPETITION_SLUG}/sumanth-dev/hopeful-lever/reward.svg`));
  assert.equal(result.includes('<owner>'), false);
  assert.equal(result.includes('{owner}'), false);
  assert.equal(result.includes('Before submitting a GitHub repository entry'), false);
});

test('returns base README unchanged when owner or repo is missing', () => {
  const base = '# Hopeful Lever\n';
  assert.equal(buildPersonalizedReadme(base, '', 'hopeful-lever'), base);
  assert.equal(buildRepoUrl('', 'hopeful-lever'), 'https://github.com/<owner>/<repo>');
  assert.equal(buildLiveBadgeUrls('alice', '').ready, false);
});

test('builds repo URL, optional owner claim JSON, and gh repo edit command', () => {
  assert.equal(buildRepoUrl('alice', 'csv-fast'), 'https://github.com/alice/csv-fast');
  assert.equal(buildOwnerClaimJson(''), null);
  assert.equal(
    buildOwnerClaimJson('7ycv2To2epAXAzyskv9KpXMS3Bez42q3oH9iMJk9ZRMY'),
    '{\n  "wallet": "7ycv2To2epAXAzyskv9KpXMS3Bez42q3oH9iMJk9ZRMY"\n}\n'
  );
  assert.equal(
    buildGhAboutCommand('alice', 'csv-fast'),
    `gh repo edit alice/csv-fast --homepage ${COMPETITION_URL} --add-topic makefun`
  );
});

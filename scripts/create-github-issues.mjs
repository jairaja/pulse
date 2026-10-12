import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const repoIndex = args.indexOf('--repo');
const explicitRepo = repoIndex >= 0 ? args[repoIndex + 1] : undefined;

function gh(commandArgs, options = {}) {
  const result = spawnSync('gh', commandArgs, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `gh ${commandArgs.join(' ')} failed`);
  }
  return result.stdout.trim();
}

function resolveRepo() {
  if (explicitRepo) return explicitRepo;
  return gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner']);
}

if (apply) gh(['auth', 'status']);

const repo = explicitRepo ?? (apply ? resolveRepo() : 'OWNER/REPO');
const issues = JSON.parse(readFileSync('docs/github-issues.json', 'utf8'));

for (const issue of issues) {
  const marker = `<!-- pulse-issue-id: ${issue.id} -->`;
  const body = `${marker}\n\n${issue.body.trim()}\n`;

  if (!apply) {
    console.log(`[preview] ${issue.id}: ${issue.title}`);
    continue;
  }

  const existing = gh([
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'all',
    '--search',
    `"pulse-issue-id: ${issue.id}" in:body`,
    '--json',
    'number',
    '--jq',
    '.[0].number // empty',
    '--limit',
    '1'
  ]);

  if (existing) {
    console.log(`[skip] ${issue.id}: already exists as #${existing}`);
    continue;
  }

  const url = gh([
    'issue',
    'create',
    '--repo',
    repo,
    '--title',
    issue.title,
    '--body',
    body
  ]);
  console.log(`[created] ${issue.id}: ${url}`);
}

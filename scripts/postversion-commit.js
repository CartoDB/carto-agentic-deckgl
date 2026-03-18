#!/usr/bin/env node

/**
 * Post-version commit script.
 *
 * When run on the `main` branch, this script:
 *   1. Creates a release branch: release/vX.Y.Z
 *   2. Stages all changes (package.json, package-lock.json)
 *   3. Creates a commit: chore(release): vX.Y.Z
 *   4. Creates an annotated git tag: vX.Y.Z
 *
 * When run on any other branch, it commits and tags in place.
 *
 * This mirrors the release workflow used in @carto/api-client.
 */

import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = `v${pkg.version}`;

function run(cmd) {
  console.log(`> ${cmd}`);
  return execSync(cmd, { stdio: 'inherit' });
}

const branch = execSync('git rev-parse --abbrev-ref HEAD', {
  encoding: 'utf-8',
}).trim();

if (branch === 'main') {
  console.log(`Creating release branch: chore/release-${version}`);
  run(`git checkout -b chore/release-${version}`);
}

run('git add -A');
run(`git commit -m "chore(release): ${version}"`);
run(`git tag -a ${version} -m "${version}"`);

console.log(`\nRelease ${version} prepared on branch: ${branch === 'main' ? `chore/release-${version}` : branch}`);
console.log('Next steps:');
console.log('  git push --set-upstream origin HEAD');
console.log('  git push --tags');
console.log('  Open a PR to main');

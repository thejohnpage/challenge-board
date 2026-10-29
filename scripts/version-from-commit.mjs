import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Husky commit-msg hook: conventional commit type selects the next semver.
// package.json remains the source of truth; package-lock and Angular metadata are derived.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const msgFile = process.argv[2];
if (!msgFile) { console.error('Expected Git commit message path'); process.exit(1); }
const message = readFileSync(msgFile, 'utf8').trim();
const header = message.split('\n')[0];
if (/^(Merge |Revert |fixup! |squash! )/.test(header)) process.exit(0);
const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: root, encoding: 'utf8' }).trim();
if (!staged) process.exit(0);
if (staged.split('\n').every(x => /^(README|FIREBASE_SETUP|docs\/|\.github\/)/.test(x))) process.exit(0);
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(pkg.version);
if (!match) { console.error('Expected numeric semver in package.json'); process.exit(1); }
let [major, minor, patch] = match.slice(1).map(Number);
if (/^[a-z]+(?:\([^)]*\))?!:/.test(header) || /BREAKING CHANGE:/m.test(message)) { major++; minor=0; patch=0; }
else if (/^feat(?:\([^)]*\))?:/.test(header)) { minor++; patch=0; }
else patch++;
pkg.version = [major, minor, patch].join('.');
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
const lockPath = resolve(root, 'package-lock.json');
if (existsSync(lockPath)) {
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
  lock.version = pkg.version;
  if (lock.packages?.['']) lock.packages[''].version = pkg.version;
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
}
execFileSync(process.execPath, [resolve(root, 'scripts/generate-version.mjs')], { cwd: root, stdio: 'inherit' });
execFileSync('git', ['add', 'package.json', 'src/app/generated/app-version.ts'], { cwd: root });
if (existsSync(lockPath)) execFileSync('git', ['add', 'package-lock.json'], { cwd: root });
console.log('Challenge Board version bumped to ' + pkg.version);

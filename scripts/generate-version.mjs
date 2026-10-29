import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error('package.json version must be semantic version X.Y.Z');
const folder = resolve(root, 'src/app/generated');
mkdirSync(folder, { recursive: true });
writeFileSync(resolve(folder, 'app-version.ts'),
  '// Generated from package.json. Do not edit manually.\n' +
  'export const APP_VERSION = ' + JSON.stringify(version) + ';\n');

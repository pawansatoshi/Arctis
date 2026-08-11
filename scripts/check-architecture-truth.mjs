import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const sourceRoots = ['src'];
const forbidden = [
  'moonshot/kimi-k1-5-32k',
  'kimi-k1-5-32k',
  'deepseek-chat',
  'qwen-2.5-72b-instruct',
  'gpt-4o-mini',
  'gemma-3-27b-it',
];

const allow = new Set([
  'src/config/ai.ts',
  'src/config/billing.ts',
]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const stat = statSync(path);
    if (stat.isDirectory()) out.push(...walk(path));
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(path);
  }
  return out;
}

const findings = [];
for (const rootDir of sourceRoots) {
  for (const file of walk(join(root, rootDir))) {
    const relative = file.slice(root.length + 1).replaceAll('\\', '/');
    if (allow.has(relative)) continue;
    const text = readFileSync(file, 'utf8');
    for (const value of forbidden) {
      if (text.includes(value)) findings.push(`${relative}: stale backend model literal "${value}"`);
    }
  }
}

if (findings.length) {
  console.error('Architecture truth check failed:\n' + findings.join('\n'));
  process.exit(1);
}

console.log('Architecture truth check passed.');

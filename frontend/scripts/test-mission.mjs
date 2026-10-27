// Vite already provides esbuild. Bundle aliases and import.meta.env for Node's test runner.
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const directory = await mkdtemp(join(tmpdir(), 'guatec-tests-'));
const tests = ['language', 'mission01-engineering', 'mission01-tasks', 'mission01-progression', 'mission01-field', 'apollo-state', 'apollo-audio', 'apollo-instruments', 'apollo-locale', 'apollo-bonus', 'apollo-stands', 'apollo-models'];
try {
  await build({ entryPoints: tests.map(name => `tests/${name}.test.ts`), outdir: directory,
    bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' },
    tsconfig: resolve('tsconfig.json'), define: { 'import.meta.env': '{}' } });
  const result = spawnSync(process.execPath, ['--test', ...tests.map(name => join(directory, `${name}.test.mjs`))], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally {
  await rm(directory, { recursive: true, force: true });
}

import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
const temp = await mkdtemp(join(tmpdir(), 'learn8-neuro-tests-'));
try {
  const output = join(temp, 'source.test.cjs');
  await build({ entryPoints: [join(here, 'source.test.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs' });
  const result = spawnSync(process.execPath, ['--test', output], { stdio: 'inherit' });
  process.exitCode = result.status ?? 1;
} finally { await rm(temp, { recursive: true, force: true }); }

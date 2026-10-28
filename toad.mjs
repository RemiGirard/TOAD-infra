#!/usr/bin/env node
/** Repository launcher; works from the app directory without a global install. */
import { createRequire } from 'node:module';
const require = createRequire(new URL('./openstackV3/package.json', import.meta.url));
try {
  const { tsImport } = await import(require.resolve('tsx/esm/api'));
  await tsImport(new URL('./openstackV3/scripts/index.ts', import.meta.url).href, import.meta.url);
} catch {
  console.error('TOAD could not start. Install Node.js 22+ and run pnpm install --frozen-lockfile in openstackV3.');
  process.exitCode = 1;
}

#!/usr/bin/env npx tsx
/**
 * OpenStack CLI passthrough.
 *
 * Runs any openstack command with credentials from clouds.yaml.
 * Eliminates the need to source environment variables manually.
 *
 * Usage:
 *   pnpm run os -- stack list
 *   pnpm run os -- server list
 *   pnpm run os -- image list --limit 5
 *   pnpm run os -- floating ip list
 */

import { openstackStream } from '../../infrastructure/openstack.js';

export async function run(args: string[]): Promise<void> {
  const filtered = args.filter(arg => arg !== '--');

  if (filtered.length === 0) {
    console.log('Usage: pnpm run os -- <openstack command>');
    console.log('');
    console.log('Examples:');
    console.log('  pnpm run os -- stack list');
    console.log('  pnpm run os -- server list');
    console.log('  pnpm run os -- flavor list');
    process.exit(0);
  }

  const code = await openstackStream(filtered);
  process.exit(code);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2));
}

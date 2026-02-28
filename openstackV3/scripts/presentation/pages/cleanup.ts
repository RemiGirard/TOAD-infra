#!/usr/bin/env npx tsx
/**
 * Delete a deployed Heat stack.
 *
 * Removes all resources created by the stack:
 * - VMs, ports, security groups
 * - Networks, subnets, routers
 * - Floating IPs, load balancers
 *
 * Optionally removes the SSH keypair from OpenStack
 * (local key in credentials/ is kept for reuse).
 *
 * Usage:
 *   pnpm run destroy              # Interactive
 *   pnpm run destroy my-stack     # Direct deletion
 */

import { banner, section, ask, success, error, warning, closeReadline } from '../../infrastructure/cli.js';
import { openstack } from '../../infrastructure/openstack.js';
import { openstackStackRepository } from '../../infrastructure/repositories/openstack-stack-repository.js';
import { listStacks } from '../../domain/usecases/list-stacks.js';
import { deleteStack } from '../../domain/usecases/delete-stack.js';

export async function run(args: string[]): Promise<void> {
  const forceYes = args.includes('-y') || args.includes('--yes');
  const filteredArgs = args.filter(a => a !== '-y' && a !== '--yes');

  banner('TOAD Stack Cleanup');

  // List existing stacks
  console.log('Existing stacks:');
  section('', 40);

  const stacks = listStacks(openstackStackRepository);

  if (stacks.length === 0) {
    console.log('(no stacks found)\n');
    closeReadline();
    process.exit(0);
  }

  for (const stack of stacks) {
    console.log(`  ${stack.name.padEnd(25)} ${stack.status}`);
  }

  // Get stack name
  const stackName = filteredArgs[0] || await ask('\nStack name to delete');

  if (!stackName) {
    console.log('No stack specified.');
    closeReadline();
    process.exit(0);
  }

  // Confirm deletion
  if (!forceYes) {
    const confirm = await ask(`\nDelete stack "${stackName}"? This cannot be undone. (y/N)`, 'n');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      closeReadline();
      process.exit(0);
    }
  }

  // Ask about keypair (skip if -y flag)
  let deleteKeypairConfirm = 'n';
  if (!forceYes) {
    deleteKeypairConfirm = await ask('Also delete SSH keypair "toad-key" from OpenStack? (y/N)', 'n');
  }

  closeReadline();

  // Delete stack using use case
  console.log('\nDeleting stack...\n');

  const result = await deleteStack(openstackStackRepository, stackName);

  if (!result.success) {
    error(result.error || 'Deletion failed');
    process.exit(1);
  }

  success('Stack deleted');

  // Delete keypair if requested
  if (deleteKeypairConfirm.toLowerCase() === 'y') {
    try {
      openstack(['keypair', 'delete', 'toad-key']);
      success('Keypair deleted from OpenStack');
      console.log('   Note: Local key in credentials/ is kept for reuse');
    } catch {
      warning('Keypair not found or already deleted');
    }
  }

  console.log('\nDone!\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((e) => {
    error(`Cleanup failed: ${e instanceof Error ? e.message : e}`);
    closeReadline();
    process.exit(1);
  });
}

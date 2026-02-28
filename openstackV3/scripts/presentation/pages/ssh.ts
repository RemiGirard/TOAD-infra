#!/usr/bin/env npx tsx
/**
 * SSH connection helper for stack nodes.
 *
 * Provides easy SSH access to any node in a deployed stack:
 * - Lists available stacks and nodes
 * - Handles jump host (bastion/gateway) automatically
 * - Uses the correct SSH key from credentials/
 *
 * For nodes without floating IPs, connections go through the
 * jump host using SSH ProxyJump (-J flag).
 *
 * Usage:
 *   pnpm run ssh              # Interactive selection
 *   pnpm run ssh my-stack     # Specify stack name
 */

import { spawn } from 'child_process';
import { banner, section, ask, error, closeReadline } from '../../infrastructure/cli.js';
import { SSH_KEY_PATH } from '../../infrastructure/paths.js';
import { sshKeyExists } from '../../infrastructure/openstack.js';
import { openstackStackRepository } from '../../infrastructure/repositories/openstack-stack-repository.js';
import { listStacks } from '../../domain/usecases/list-stacks.js';
import { getStackNodes, findJumpHost } from '../../domain/usecases/get-stack-nodes.js';

async function selectStack(providedName?: string): Promise<string> {
  if (providedName) return providedName;

  const stacks = listStacks(openstackStackRepository);

  if (stacks.length === 0) {
    error('No stacks found. Deploy first: pnpm run deploy');
    closeReadline();
    process.exit(1);
  }

  if (stacks.length === 1) {
    return stacks[0].name;
  }

  console.log('Available stacks:');
  stacks.forEach((s, i) => console.log(`  ${i + 1}) ${s.name}`));
  const choice = await ask('\nSelect stack', '1');
  return stacks[parseInt(choice) - 1]?.name || stacks[0].name;
}

export async function run(args: string[]): Promise<void> {

  banner('TOAD SSH Connection');

  // Prerequisites
  if (!sshKeyExists()) {
    error('SSH key not found. Run: pnpm run setup');
    process.exit(1);
  }

  // Select stack
  const stackArg = args[0]?.startsWith('-') ? undefined : args[0];
  const stackName = await selectStack(stackArg);

  // Get nodes using use case
  const nodes = getStackNodes(openstackStackRepository, stackName);

  if (nodes.length === 0) {
    error('No nodes found in stack.');
    closeReadline();
    process.exit(1);
  }

  // Show nodes
  console.log(`Stack: ${stackName}\n`);
  console.log('Available nodes:');
  section('', 50);

  nodes.forEach((node, i) => {
    const access = node.floatingIp
      ? `${node.floatingIp} (direct)`
      : `${node.privateIp} (via jump)`;
    console.log(`  ${i + 1}) ${node.name.padEnd(15)} ${node.role.padEnd(10)} ${access}`);
  });

  // Select node
  const choice = await ask('\nSelect node', '1');
  const selectedNode = nodes[parseInt(choice) - 1] || nodes[0];

  closeReadline();

  // Build SSH command
  const sshArgs: string[] = [
    '-i', SSH_KEY_PATH,
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'UserKnownHostsFile=/dev/null',
  ];

  if (selectedNode.floatingIp) {
    sshArgs.push(`ubuntu@${selectedNode.floatingIp}`);
  } else {
    const jumpHost = findJumpHost(nodes);
    if (!jumpHost) {
      error('No jump host available');
      process.exit(1);
    }
    sshArgs.push('-J', `ubuntu@${jumpHost.floatingIp}`);
    sshArgs.push(`ubuntu@${selectedNode.privateIp}`);
  }

  // Connect
  console.log(`\nConnecting to ${selectedNode.name}...\n`);
  console.log(`   ssh ${sshArgs.join(' ')}\n`);

  const ssh = spawn('ssh', sshArgs, { stdio: 'inherit' });
  ssh.on('close', (code) => process.exit(code || 0));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((e) => {
    error(`SSH failed: ${e instanceof Error ? e.message : e}`);
    closeReadline();
    process.exit(1);
  });
}

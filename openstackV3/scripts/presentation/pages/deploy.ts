#!/usr/bin/env npx tsx
/**
 * Deploy a Heat stack to OpenStack.
 *
 * Creates infrastructure based on the selected level (0-5):
 * - Prompts for level, stack name, and environment file
 * - Validates template and env file exist
 * - Deploys stack with --wait for completion
 * - Displays stack outputs (IPs, access info)
 *
 * Usage:
 *   pnpm run deploy                           # Interactive
 *   pnpm run deploy 4 my-stack                # Level 4, default env
 *   pnpm run deploy 5 prod heat/env/prod.yaml # Full args
 */

import { existsSync } from 'fs';
import { join } from 'path';
import { banner, section, ask, success, error, closeReadline } from '../../infrastructure/cli.js';
import { ROOT_DIR } from '../../infrastructure/paths.js';
import { sshKeyExists } from '../../infrastructure/openstack.js';
import { openstackStackRepository } from '../../infrastructure/repositories/openstack-stack-repository.js';
import { LEVELS, isValidLevel } from '../../domain/entities/level.js';
import { deployStack } from '../../domain/usecases/deploy-stack.js';

function listLevels(): void {
  for (const [level, info] of Object.entries(LEVELS)) {
    console.log(`  ${level}) ${info.description}`);
    console.log(`     Nodes: ${info.nodes}, Floating IPs: ${info.fips}`);
  }
}

export async function run(args: string[]): Promise<void> {

  banner('TOAD Stack Deployment');

  // Prerequisites
  if (!sshKeyExists()) {
    error('SSH key not found. Run: pnpm run setup');
    process.exit(1);
  }

  // Show available levels
  console.log('Available levels:');
  section('', 60);
  listLevels();
  console.log('');

  // Get deployment parameters
  const level = args[0] && !isNaN(parseInt(args[0]))
    ? parseInt(args[0])
    : parseInt(await ask('Select profile (1 or 5)', '1'));

  if (!isValidLevel(level)) {
    error(`Invalid level: ${level}`);
    closeReadline();
    process.exit(1);
  }

  const levelInfo = LEVELS[level]!;
  const stackName = args[1] || await ask('Stack name', `toad-level${level}`);
  const envFile = args[2] || await ask('Environment file', 'heat/env/example.yaml');

  // Validate paths
  const templatePath = join('heat', levelInfo.template);
  const fullTemplatePath = join(ROOT_DIR, templatePath);
  const fullEnvPath = join(ROOT_DIR, envFile);

  if (!existsSync(fullTemplatePath)) {
    error(`Template not found: ${templatePath}`);
    closeReadline();
    process.exit(1);
  }

  if (!existsSync(fullEnvPath)) {
    error(`Environment file not found: ${envFile}`);
    closeReadline();
    process.exit(1);
  }

  // Show summary
  console.log('\nDeployment Summary');
  section('', 40);
  console.log(`Level:      ${level} - ${levelInfo.description}`);
  console.log(`Stack:      ${stackName}`);
  console.log(`Template:   ${templatePath}`);
  console.log(`Env:        ${envFile}`);
  console.log(`Nodes:      ${levelInfo.nodes}`);
  console.log(`Float IPs:  ${levelInfo.fips}`);
  console.log('');

  // Confirm
  const confirm = await ask('Deploy? (Y/n)', 'y');
  if (confirm.toLowerCase() === 'n') {
    console.log('Cancelled.');
    closeReadline();
    process.exit(0);
  }

  closeReadline();

  // Deploy using use case
  console.log('\nDeploying stack...\n');

  const result = await deployStack(openstackStackRepository, {
    level,
    stackName,
    envFile,
  });

  if (!result.success) {
    error(result.error || 'Deployment failed');
    process.exit(1);
  }

  success('Deployment complete!\n');

  // Show outputs
  console.log('Stack Outputs');
  section('', 40);

  try {
    const outputs = openstackStackRepository.getOutputs(stackName);
    for (const [key, value] of Object.entries(outputs)) {
      console.log(`${key}: ${value}`);
    }
  } catch {
    console.log('(failed to get outputs)');
  }

  console.log('\nNext steps:');
  console.log('  pnpm run status     # Check status');
  console.log('  pnpm run ssh        # SSH to nodes');
  console.log('  pnpm run inventory  # Generate Ansible inventory');
  console.log('  pnpm run destroy    # Delete stack\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((e) => {
    error(`Deployment failed: ${e instanceof Error ? e.message : e}`);
    closeReadline();
    process.exit(1);
  });
}

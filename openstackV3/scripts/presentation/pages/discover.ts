#!/usr/bin/env npx tsx
/**
 * Discover available OpenStack resources.
 *
 * Displays what's available in your OpenStack project:
 * - Flavors: Instance sizes (vCPUs, RAM, disk)
 * - Images: OS images (Ubuntu, etc.)
 * - Networks: Available networks for connectivity
 * - Keypairs: SSH keys uploaded to OpenStack
 * - Quotas: Resource limits for your project
 *
 * Useful for choosing parameters in heat/env/*.yaml files.
 *
 * Usage: pnpm run discover
 */

import { banner, section } from '../../infrastructure/cli.js';
import { openstack } from '../../infrastructure/openstack.js';

function showFlavors(): void {
  console.log('Flavors (Instance Types)');
  section('', 50);

  try {
    const flavors = openstack(['flavor', 'list', '-f', 'value', '-c', 'Name', '-c', 'VCPUs', '-c', 'RAM', '-c', 'Disk']);
    const lines = flavors.trim().split('\n').slice(0, 10);
    console.log('Name                      vCPUs  RAM(MB)  Disk(GB)');
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 4) {
        console.log(`${parts[0].padEnd(25)} ${parts[1].padStart(5)}  ${parts[2].padStart(7)}  ${parts[3].padStart(8)}`);
      }
    }
    console.log('... (run: pnpm run os -- flavor list for full list)\n');
  } catch {
    console.log('Failed to list flavors\n');
  }
}

function showImages(): void {
  console.log('Images');
  section('', 50);

  try {
    const images = openstack(['image', 'list', '-f', 'value', '-c', 'Name', '--limit', '10']);
    console.log(images);
  } catch {
    console.log('Failed to list images\n');
  }
}

function showNetworks(): void {
  console.log('Networks');
  section('', 50);

  try {
    const networks = openstack(['network', 'list', '-f', 'value', '-c', 'Name']);
    console.log(networks);
  } catch {
    console.log('Failed to list networks\n');
  }
}

function showKeypairs(): void {
  console.log('Keypairs');
  section('', 50);

  try {
    const keypairs = openstack(['keypair', 'list', '-f', 'value', '-c', 'Name']);
    console.log(keypairs || '(none)\n');
  } catch {
    console.log('Failed to list keypairs\n');
  }
}

function showQuotas(): void {
  console.log('Quotas');
  section('', 50);

  try {
    const quotas = openstack(['quota', 'show', '-f', 'value', '-c', 'cores', '-c', 'instances', '-c', 'ram']);
    const lines = quotas.trim().split('\n');
    console.log(`Cores: ${lines[0]}, Instances: ${lines[1]}, RAM: ${lines[2]} MB\n`);
  } catch {
    console.log('Failed to get quotas\n');
  }
}

export async function run(_args: string[]): Promise<void> {
  banner('Infomaniak OpenCloud Resources');
  showFlavors();
  showImages();
  showNetworks();
  showKeypairs();
  showQuotas();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2));
}

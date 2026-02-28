#!/usr/bin/env tsx
/**
 * Display current infrastructure status.
 *
 * Shows an overview of all OpenStack resources:
 * - Stacks: Heat stacks and their status
 * - Servers: VM instances and their IPs
 * - Floating IPs: Public IPs and assignments
 * - Load Balancers: Octavia LBs (if any)
 *
 * Usage: pnpm run status
 */

import { banner, section, statusIcon } from '../../infrastructure/cli.js';
import { openstackStackRepository } from '../../infrastructure/repositories/openstack-stack-repository.js';
import { openstackResourceRepository } from '../../infrastructure/repositories/openstack-resource-repository.js';

async function showStacks(): Promise<void> {
  console.log('Stacks');
  section('', 60);

  try {
    const stacks = await openstackStackRepository.listAsync();
    if (stacks.length > 0) {
      for (const stack of stacks) {
        console.log(`${statusIcon(stack.status)} ${stack.name.padEnd(25)} ${stack.status.padEnd(20)} ${stack.creationTime}`);
      }
    } else {
      console.log('(no stacks found)');
    }
  } catch {
    console.log('(failed to list stacks)');
  }
  console.log('');
}

async function showServers(): Promise<void> {
  console.log('Servers');
  section('', 60);

  try {
    const servers = await openstackResourceRepository.listServersAsync();
    if (servers.length > 0) {
      for (const server of servers) {
        const ips = server.ips.length > 0 ? server.ips.join(', ') : '-';
        console.log(`${statusIcon(server.status)} ${server.name.padEnd(20)} ${server.status.padEnd(10)} ${ips}`);
      }
    } else {
      console.log('(no servers found)');
    }
  } catch {
    console.log('(failed to list servers)');
  }
  console.log('');
}

async function showFloatingIps(): Promise<void> {
  console.log('Floating IPs');
  section('', 60);

  try {
    const fips = await openstackResourceRepository.listFloatingIpsAsync();
    if (fips.length > 0) {
      for (const fip of fips) {
        console.log(`${statusIcon(fip.status)} ${fip.address.padEnd(18)} -> ${(fip.fixedIp || '-').padEnd(15)} ${fip.status}`);
      }
    } else {
      console.log('(no floating IPs)');
    }
  } catch {
    console.log('(failed to list floating IPs)');
  }
  console.log('');
}

async function showLoadBalancers(): Promise<void> {
  console.log('Load Balancers');
  section('', 60);

  try {
    const lbs = await openstackResourceRepository.listLoadBalancersAsync();
    if (lbs.length > 0) {
      for (const lb of lbs) {
        console.log(`${statusIcon(lb.status)} ${lb.name.padEnd(20)} ${lb.status.padEnd(10)} VIP: ${lb.vip}`);
      }
    } else {
      console.log('(no load balancers)');
    }
  } catch {
    console.log('(no load balancers)');
  }
  console.log('');
}

export async function run(_args: string[]): Promise<void> {
  banner('TOAD Stack Status');
  await showStacks();
  await showServers();
  await showFloatingIps();
  await showLoadBalancers();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2));
}

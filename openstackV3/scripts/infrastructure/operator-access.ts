/** Discover and reconcile the operator's narrow SSH ingress CIDR. */

import { isIP } from 'node:net';
import { openstackStream } from './openstack.js';

const ADDRESS_SERVICE = 'https://api.ipify.org';

export function ipv4HostCidr(address: string): string {
  const normalized = address.trim();
  if (isIP(normalized) !== 4) throw new Error('Public address discovery did not return an IPv4 address.');
  return `${normalized}/32`;
}

export async function discoverOperatorCidr(): Promise<string> {
  const response = await fetch(ADDRESS_SERVICE, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Public IPv4 discovery failed with HTTP ${response.status}.`);
  return ipv4HostCidr(await response.text());
}

export async function refreshStackSshAccess(stackName: string): Promise<void> {
  const cidr = await discoverOperatorCidr();
  const exitCode = await openstackStream([
    'stack', 'update', '--existing', '--parameter', `ssh_allowed_cidr=${cidr}`, '--wait', stackName,
  ]);
  if (exitCode !== 0) throw new Error(`Heat SSH access update failed with exit code ${exitCode}.`);
}

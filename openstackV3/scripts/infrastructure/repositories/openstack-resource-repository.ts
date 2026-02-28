/**
 * OpenStack implementation of ResourceRepository.
 *
 * Uses the OpenStack CLI to query resources.
 */

import type { Server } from '../../domain/entities/server.js';
import type { FloatingIp, LoadBalancer } from '../../domain/entities/network.js';
import type { ResourceRepository } from '../../domain/ports/resource-repository.js';
import { openstack, openstackAsync } from '../openstack.js';

export const openstackResourceRepository: ResourceRepository = {
  listServers(): Server[] {
    const output = openstack(['server', 'list', '-f', 'json']);
    const servers = JSON.parse(output || '[]');

    return servers.map((s: Record<string, unknown>) => {
      const networks = s['Networks'];
      let ips: string[] = [];

      if (typeof networks === 'string') {
        const matches = networks.match(/(\d+\.\d+\.\d+\.\d+)/g);
        ips = matches || [];
      } else if (networks && typeof networks === 'object') {
        for (const netIps of Object.values(networks as Record<string, string[]>)) {
          if (Array.isArray(netIps)) {
            ips.push(...netIps);
          }
        }
      }

      return {
        name: s['Name'] as string,
        status: s['Status'] as string,
        ips,
      };
    });
  },

  listFloatingIps(): FloatingIp[] {
    const output = openstack(['floating', 'ip', 'list', '-f', 'json']);
    const fips = JSON.parse(output || '[]');

    return fips.map((f: Record<string, string>) => ({
      address: f['Floating IP Address'],
      fixedIp: f['Fixed IP Address'] || undefined,
      status: f['Status'] || 'UNKNOWN',
    }));
  },

  listLoadBalancers(): LoadBalancer[] {
    const output = openstack(['loadbalancer', 'list', '-f', 'json'], { showOutput: false });
    const lbs = JSON.parse(output || '[]');

    return lbs.map((lb: Record<string, string>) => ({
      name: lb['name'],
      status: lb['operating_status'],
      vip: lb['vip_address'] || '-',
    }));
  },

  // Async versions with spinners
  async listServersAsync(): Promise<Server[]> {
    const output = await openstackAsync(['server', 'list', '-f', 'json'], { showOutput: false, spinner: 'Loading servers' });
    const servers = JSON.parse(output || '[]');

    return servers.map((s: Record<string, unknown>) => {
      const networks = s['Networks'];
      let ips: string[] = [];

      if (typeof networks === 'string') {
        const matches = networks.match(/(\d+\.\d+\.\d+\.\d+)/g);
        ips = matches || [];
      } else if (networks && typeof networks === 'object') {
        for (const netIps of Object.values(networks as Record<string, string[]>)) {
          if (Array.isArray(netIps)) {
            ips.push(...netIps);
          }
        }
      }

      return {
        name: s['Name'] as string,
        status: s['Status'] as string,
        ips,
      };
    });
  },

  async listFloatingIpsAsync(): Promise<FloatingIp[]> {
    const output = await openstackAsync(['floating', 'ip', 'list', '-f', 'json'], { showOutput: false, spinner: 'Loading floating IPs' });
    const fips = JSON.parse(output || '[]');

    return fips.map((f: Record<string, string>) => ({
      address: f['Floating IP Address'],
      fixedIp: f['Fixed IP Address'] || undefined,
      status: f['Status'] || 'UNKNOWN',
    }));
  },

  async listLoadBalancersAsync(): Promise<LoadBalancer[]> {
    const output = await openstackAsync(['loadbalancer', 'list', '-f', 'json'], { showOutput: false, spinner: 'Loading load balancers' });
    const lbs = JSON.parse(output || '[]');

    return lbs.map((lb: Record<string, string>) => ({
      name: lb['name'],
      status: lb['operating_status'],
      vip: lb['vip_address'] || '-',
    }));
  },
};

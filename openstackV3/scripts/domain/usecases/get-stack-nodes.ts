/**
 * Use case: Get nodes from a deployed stack.
 *
 * Business rules:
 * - Parses stack outputs to extract node information
 * - Determines node roles based on output keys
 * - Identifies jump hosts (nodes with floating IPs)
 */

import type { Node } from '../entities/node.js';
import type { StackRepository } from '../ports/stack-repository.js';

/**
 * Parse IP list from stack outputs.
 * Handles both comma-separated strings and JSON arrays.
 */
function parseIpList(value: string): string[] {
  if (!value) return [];

  // Try JSON array first (e.g., ["10.0.0.1", "10.0.0.2"])
  if (value.startsWith('[')) {
    try {
      return JSON.parse(value.replace(/'/g, '"'));
    } catch { /* fall through */ }
  }

  // Otherwise treat as comma-separated
  return value.split(',').map(ip => ip.trim()).filter(Boolean);
}

export function getStackNodes(repo: StackRepository, stackName: string): Node[] {
  const nodes: Node[] = [];
  const outputs = repo.getOutputs(stackName);

  // Level 0/1: Single node with direct floating IP
  if (outputs.floating_ip && outputs.private_ip) {
    nodes.push({
      name: outputs.server_name || 'node',
      floatingIp: outputs.floating_ip,
      privateIp: outputs.private_ip,
      role: 'node',
    });
    return nodes;
  }

  // Level 4: single gateway with floating IP
  if (outputs.gateway_floating_ip) {
    nodes.push({
      name: 'gateway',
      floatingIp: outputs.gateway_floating_ip,
      privateIp: outputs.gateway_private_ip || '10.0.0.10',
      role: 'gateway',
    });
  }

  // Level 5: bastion with floating IP
  if (outputs.bastion_floating_ip) {
    nodes.push({
      name: 'bastion',
      floatingIp: outputs.bastion_floating_ip,
      privateIp: outputs.bastion_private_ip || '10.0.0.5',
      role: 'bastion',
    });
  }

  // Level 5: multiple gateways (private only)
  if (outputs.gateway_private_ips) {
    const ips = parseIpList(outputs.gateway_private_ips);
    ips.forEach((ip: string, i: number) => {
      nodes.push({
        name: `gateway-${i + 1}`,
        privateIp: ip,
        role: 'gateway',
      });
    });
  }

  // Swarm nodes
  if (outputs.swarm_private_ips) {
    const ips = parseIpList(outputs.swarm_private_ips);
    ips.forEach((ip: string, i: number) => {
      nodes.push({
        name: `swarm-${i + 1}`,
        privateIp: ip,
        role: i === 0 ? 'manager' : 'worker',
      });
    });
  }

  return nodes;
}

/**
 * Find the first node that can be used as a jump host.
 */
export function findJumpHost(nodes: Node[]): Node | undefined {
  return nodes.find(n => n.floatingIp);
}

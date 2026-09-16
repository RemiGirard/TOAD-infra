/**
 * Node entity - represents a VM instance in the infrastructure.
 *
 * A node can be a bastion, gateway, or swarm node (manager/worker).
 * Nodes may have a floating IP for direct access, or only a private IP
 * requiring access through a jump host.
 */

export type NodeRole = 'node' | 'bastion' | 'gateway' | 'manager' | 'worker';

export interface Node {
  name: string;
  floatingIp?: string;
  privateIp: string;
  role: NodeRole;
}

export function isDirectlyAccessible(node: Node): boolean {
  return !!node.floatingIp;
}

export function isJumpHost(node: Node): boolean {
  return !!node.floatingIp && (node.role === 'bastion' || node.role === 'gateway');
}

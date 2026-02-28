/**
 * Level entity - defines infrastructure topology options.
 *
 * Each level represents a different deployment scale:
 * - Level 0-1: Single node (dev/test)
 * - Level 2-3: Multi-node Swarm
 * - Level 4: Gateway + Swarm (standard production)
 * - Level 5: HA with bastion, LB, and redundant gateways
 */

export interface Level {
  template: string;
  description: string;
  nodes: number;
  fips: number;
}

export const LEVELS: Record<number, Level> = {
  0: {
    template: 'level0-single-node.yaml',
    description: 'Single node (SSH, HTTP, HTTPS)',
    nodes: 1,
    fips: 1,
  },
  1: {
    template: 'level1-swarm-single.yaml',
    description: 'Single node + Swarm ports',
    nodes: 1,
    fips: 1,
  },
  2: {
    template: 'level2-swarm-duo.yaml',
    description: '2-node Swarm cluster',
    nodes: 2,
    fips: 2,
  },
  3: {
    template: 'level3-swarm-trio.yaml',
    description: '3-node Swarm (HA)',
    nodes: 3,
    fips: 3,
  },
  4: {
    template: 'level4-swarm-network.yaml',
    description: 'Gateway + 3 Swarm (Standard)',
    nodes: 4,
    fips: 1,
  },
  5: {
    template: 'level5-production.yaml',
    description: 'Bastion + LB + Gateways + Swarm (HA)',
    nodes: 6,
    fips: 2,
  },
};

export function getLevel(level: number): Level | undefined {
  return LEVELS[level];
}

export function isValidLevel(level: number): boolean {
  return level in LEVELS;
}

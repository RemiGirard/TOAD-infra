/**
 * Level entity - defines infrastructure topology options.
 *
 * Stable profiles are deliberately few: a single-node installation and a
 * production installation with three managers. Older experimental templates
 * remain in heat/ for reference but are not exposed by the CLI.
 */

export interface Level {
  template: string;
  description: string;
  nodes: number;
  fips: number;
}

export const LEVELS: Record<number, Level> = {
  1: {
    template: 'level1-swarm-single.yaml',
    description: 'Single Swarm manager (development/small workloads)',
    nodes: 1,
    fips: 1,
  },
  5: {
    template: 'level5-production.yaml',
    description: 'Octavia + 3 Swarm managers (production HA)',
    nodes: 3,
    fips: 2,
  },
};

export function getLevel(level: number): Level | undefined {
  return LEVELS[level];
}

export function isValidLevel(level: number): boolean {
  return level in LEVELS;
}

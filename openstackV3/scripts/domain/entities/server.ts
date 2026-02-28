/**
 * Server entity - represents an OpenStack compute instance.
 */

export interface Server {
  name: string;
  status: ServerStatus;
  ips: string[];
}

export type ServerStatus = 'ACTIVE' | 'BUILD' | 'SHUTOFF' | 'ERROR' | 'DELETED';

export function isServerActive(server: Server): boolean {
  return server.status === 'ACTIVE';
}

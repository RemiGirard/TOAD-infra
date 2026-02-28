/**
 * Port: Resource Repository
 *
 * Abstraction for OpenStack resource queries.
 * Infrastructure layer provides the concrete implementation.
 */

import type { Server } from '../entities/server.js';
import type { FloatingIp, LoadBalancer } from '../entities/network.js';

export interface ResourceRepository {
  listServers(): Server[];
  listServersAsync(): Promise<Server[]>;
  listFloatingIps(): FloatingIp[];
  listFloatingIpsAsync(): Promise<FloatingIp[]>;
  listLoadBalancers(): LoadBalancer[];
  listLoadBalancersAsync(): Promise<LoadBalancer[]>;
}

/**
 * Use case: List OpenStack resources.
 *
 * Pure delegation to repository - no business rules needed.
 */

import type { Server } from '../entities/server.js';
import type { FloatingIp, LoadBalancer } from '../entities/network.js';
import type { ResourceRepository } from '../ports/resource-repository.js';

export function listServers(repo: ResourceRepository): Server[] {
  return repo.listServers();
}

export function listFloatingIps(repo: ResourceRepository): FloatingIp[] {
  return repo.listFloatingIps();
}

export function listLoadBalancers(repo: ResourceRepository): LoadBalancer[] {
  return repo.listLoadBalancers();
}

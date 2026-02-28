/**
 * Network entities - floating IPs and load balancers.
 */

export interface FloatingIp {
  address: string;
  fixedIp?: string;
  status: 'ACTIVE' | 'DOWN' | 'ERROR';
}

export interface LoadBalancer {
  name: string;
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';
  vip: string;
}

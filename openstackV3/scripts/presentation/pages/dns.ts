/** Synchronize the Infomaniak parent-zone records with the current Heat load balancer. */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { banner, success } from '../../infrastructure/cli.js';
import { syncParentDns, waitForParentDns } from '../../infrastructure/infomaniak-dns.js';
import { ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import { openstackStackRepository } from '../../infrastructure/repositories/openstack-stack-repository.js';

interface RouterConfig { root_domain?: string }

export async function run(args: string[]): Promise<void> {
  const stackName = args[0] ?? 'toad-prod';
  const config = parseYaml(readFileSync(ROUTER_CONFIG_PATH, 'utf8')) as RouterConfig;
  if (!config.root_domain) throw new Error('router/config.yaml must define root_domain.');
  const outputs = openstackStackRepository.getOutputs(stackName);
  const ipv4 = outputs.lb_floating_ip;
  if (!ipv4) throw new Error(`Heat stack ${stackName} has no lb_floating_ip output.`);

  banner('TOAD Parent DNS');
  for (const change of await syncParentDns(config.root_domain, ipv4)) {
    console.log(`${change.action.padEnd(18)} ${change.name}.${config.root_domain} -> ${change.target}`);
  }
  await waitForParentDns(config.root_domain, ipv4);
  success(`Parent apex and wildcard resolve to ${ipv4}.`);
}

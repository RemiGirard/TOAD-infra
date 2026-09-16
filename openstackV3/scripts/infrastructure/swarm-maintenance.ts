/** Quorum-aware Docker Swarm inspection and rolling maintenance. */

import { resolve } from 'node:path';
import { managerSshArgs } from './app-secrets.js';
import { INVENTORY_PATH, ROOT_DIR } from './paths.js';
import { runProgram, runProgramStream } from './shell.js';

export interface SwarmNode {
  id: string;
  hostname: string;
  role: 'manager' | 'worker';
  availability: string;
  state: string;
  reachability: string;
  leader: boolean;
}

interface NodeInspect {
  ID?: string;
  Spec?: { Role?: 'manager' | 'worker'; Availability?: string };
  Description?: { Hostname?: string };
  Status?: { State?: string };
  ManagerStatus?: { Reachability?: string; Leader?: boolean };
}

const ANSIBLE_DIR = resolve(ROOT_DIR, '..', 'ansible');
const ANSIBLE = resolve(ANSIBLE_DIR, 'venv', 'bin', 'ansible');
const INVENTORY = INVENTORY_PATH;

function ssh(args: string[], showCommand = false): string {
  return runProgram('ssh', [...managerSshArgs(), 'sudo', 'docker', ...args], {
    showCommand,
    showOutput: false,
  });
}

export function inspectSwarm(): SwarmNode[] {
  const ids = ssh(['node', 'ls', '--quiet']).split('\n').map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) throw new Error('The Swarm has no nodes.');
  const raw = JSON.parse(ssh(['node', 'inspect', ...ids])) as NodeInspect[];
  return raw.map((node) => ({
    id: node.ID ?? '',
    hostname: node.Description?.Hostname ?? 'unknown',
    role: node.Spec?.Role ?? 'worker',
    availability: node.Spec?.Availability ?? 'unknown',
    state: node.Status?.State ?? 'unknown',
    reachability: node.ManagerStatus?.Reachability ?? '-',
    leader: node.ManagerStatus?.Leader === true,
  }));
}

export function assertSafeManagerMaintenance(nodes: SwarmNode[]): void {
  const managers = nodes.filter((node) => node.role === 'manager');
  const healthy = managers.filter((node) => node.state === 'ready' && node.reachability === 'reachable');
  const quorum = Math.floor(managers.length / 2) + 1;
  if (managers.length < 3) throw new Error(`Rolling manager maintenance requires at least 3 managers; found ${managers.length}.`);
  if (healthy.length !== managers.length) {
    throw new Error(`Every manager must be ready and reachable before maintenance; ${healthy.length}/${managers.length} are healthy.`);
  }
  if (healthy.length - 1 < quorum) throw new Error(`Taking one manager down would violate quorum (${quorum}).`);
}

function findNode(nodes: SwarmNode[], name: string): SwarmNode {
  const matches = nodes.filter((node) => node.hostname === name || node.id === name || node.id.startsWith(name));
  if (matches.length !== 1) throw new Error(`Node "${name}" did not resolve uniquely.`);
  return matches[0]!;
}

export function setAvailability(name: string, availability: 'active' | 'drain'): SwarmNode {
  const nodes = inspectSwarm();
  assertSafeManagerMaintenance(nodes);
  const node = findNode(nodes, name);
  ssh(['node', 'update', '--availability', availability, node.id], true);
  return node;
}

export async function rebootNode(name: string): Promise<void> {
  const nodes = inspectSwarm();
  assertSafeManagerMaintenance(nodes);
  const node = findNode(nodes, name);
  if (node.role !== 'manager') throw new Error('The maintained production profile currently rolls manager nodes only.');
  if (node.availability !== 'drain') ssh(['node', 'update', '--availability', 'drain', node.id], true);

  const code = await runProgramStream(ANSIBLE, [
    '-i', INVENTORY,
    node.hostname,
    '--become',
    '-m', 'ansible.builtin.reboot',
    '-a', 'reboot_timeout=600 connect_timeout=10 post_reboot_delay=10',
  ], { cwd: ANSIBLE_DIR });
  if (code !== 0) throw new Error(`Reboot failed for ${node.hostname}. It remains drained.`);

  let lastDetail = '';
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    try {
      const current = inspectSwarm();
      const refreshed = findNode(current, node.id);
      const managers = current.filter((candidate) => candidate.role === 'manager');
      const healthy = managers.filter((candidate) => candidate.state === 'ready' && candidate.reachability === 'reachable');
      lastDetail = `${healthy.length}/${managers.length} managers ready/reachable`;
      if (refreshed.state === 'ready' && refreshed.reachability === 'reachable' && healthy.length === managers.length) {
        ssh(['node', 'update', '--availability', 'active', node.id], true);
        return;
      }
    } catch (cause) {
      lastDetail = cause instanceof Error ? cause.message : String(cause);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 10_000));
  }
  throw new Error(`${node.hostname} did not safely rejoin after reboot (${lastDetail}). It remains drained.`);
}

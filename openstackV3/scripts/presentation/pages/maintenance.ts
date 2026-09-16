/** Operator interface for quorum-aware Swarm maintenance. */

import { ask, banner, closeReadline, error, success } from '../../infrastructure/cli.js';
import { inspectSwarm, rebootNode, setAvailability, SwarmNode } from '../../infrastructure/swarm-maintenance.js';
import { refreshStackSshAccess } from '../../infrastructure/operator-access.js';

function print(nodes: SwarmNode[], json: boolean): void {
  if (json) {
    console.log(JSON.stringify({ ok: true, nodes }, null, 2));
    return;
  }
  console.log('HOSTNAME                 ROLE      STATE    REACHABILITY  AVAILABILITY  LEADER');
  for (const node of nodes) {
    console.log([
      node.hostname.padEnd(24),
      node.role.padEnd(9),
      node.state.padEnd(8),
      node.reachability.padEnd(13),
      node.availability.padEnd(13),
      node.leader ? 'yes' : 'no',
    ].join(' '));
  }
}

function help(): void {
  console.log(`Usage: pnpm run maintenance -- <command>

Commands:
  status [--json]             Inspect readiness, reachability, and quorum
  drain <node>                Drain one node after a quorum guard
  activate <node>             Reactivate one node after a quorum guard
  reboot <node> [--yes]       Drain, reboot, wait for rejoin, then reactivate
  rolling-reboot [--yes]      Reboot non-leaders first and the leader last
  refresh-ssh-access [stack]  Allow this workstation's current IPv4 /32`);
}

async function confirm(action: string, force: boolean): Promise<boolean> {
  if (force) return true;
  const answer = await ask(`Type "${action}" to continue`);
  closeReadline();
  return answer === action;
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const json = command === 'status' && args.includes('--json');
  if (!json) banner('TOAD Swarm Maintenance');
  const force = args.includes('--yes');
  const node = args.find((arg, index) => index > 0 && !arg.startsWith('--'));
  try {
    if (command === 'status') {
      print(inspectSwarm(), json);
      return;
    }
    if (command === 'refresh-ssh-access') {
      const stackName = node ?? 'toad-prod';
      if (!await confirm(`refresh-ssh-access ${stackName}`, force)) { console.log('Cancelled.'); return; }
      await refreshStackSshAccess(stackName);
      success(`SSH access refreshed for ${stackName} using the current operator IPv4 /32.`);
      return;
    }
    if (command === 'drain' || command === 'activate') {
      if (!node) throw new Error(`${command} requires a node hostname or ID.`);
      const changed = setAvailability(node, command === 'drain' ? 'drain' : 'active');
      success(`${changed.hostname} is now ${command === 'drain' ? 'drained' : 'active'}.`);
      return;
    }
    if (command === 'reboot') {
      if (!node) throw new Error('reboot requires a node hostname or ID.');
      if (!await confirm(`reboot ${node}`, force)) { console.log('Cancelled.'); return; }
      await rebootNode(node);
      success(`${node} rebooted, rejoined, and was reactivated.`);
      return;
    }
    if (command === 'rolling-reboot') {
      if (!await confirm('rolling-reboot', force)) { console.log('Cancelled.'); return; }
      const ordered = inspectSwarm()
        .filter((candidate) => candidate.role === 'manager')
        .sort((left, right) => Number(left.leader) - Number(right.leader));
      for (const candidate of ordered) {
        console.log(`\nMaintaining ${candidate.hostname}${candidate.leader ? ' (leader last)' : ''}...`);
        await rebootNode(candidate.hostname);
      }
      success(`Rolling reboot completed for ${ordered.length} managers.`);
      return;
    }
    help();
    if (command) process.exitCode = 1;
  } catch (cause) {
    closeReadline();
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}

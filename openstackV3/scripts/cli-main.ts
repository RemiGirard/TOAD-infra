#!/usr/bin/env npx tsx
/**
 * TOAD CLI entry point.
 *
 * Usage:
 *   pnpm run cli <command> [args...]
 */

import { run as setup } from './presentation/pages/setup.js';
import { run as discover } from './presentation/pages/discover.js';
import { run as deploy } from './presentation/pages/deploy.js';
import { run as destroy } from './presentation/pages/cleanup.js';
import { run as status } from './presentation/pages/status.js';
import { run as ssh } from './presentation/pages/ssh.js';
import { run as inventory } from './presentation/pages/inventory.js';
import { run as os } from './presentation/pages/os.js';
import { run as doctor } from './presentation/pages/doctor.js';
import { run as apply } from './presentation/pages/apply.js';
import { run as verify } from './presentation/pages/verify.js';
import { run as adminPki } from './presentation/pages/admin-pki.js';
import { run as dns } from './presentation/pages/dns.js';
import { run as dnsToken } from './presentation/pages/dns-token.js';
import { run as app, validateAppArguments, showAppHelp } from './presentation/pages/app.js';
import { run as maintenance } from './presentation/pages/maintenance.js';
import { run as probe } from './presentation/pages/probe.js';
import { run as platform } from './presentation/pages/platform.js';
import { run as context } from './presentation/pages/context.js';
import { run as backupJob } from './presentation/pages/backup-job.js';
import { ACTIVE_CONTEXT } from './infrastructure/paths.js';
import { run as cloud } from './presentation/pages/cloud.js';
import { run as observe } from './presentation/pages/observe.js';
import { run as operation } from './presentation/pages/operation.js';
import { run as init } from './presentation/pages/project.js';
import { validateCommandArguments } from './infrastructure/command-arguments.js';
import { withOperationLock } from './infrastructure/operation-lock.js';

interface Command {
  description: string;
  handler: (args: string[]) => Promise<void>;
}

const commands: Record<string, Command> = {
  cloud: { description: 'Guide, plan, provision and resume cloud setup', handler: cloud },
  init: { description: 'Initialize delivery in an existing app repository', handler: init },
  observe: { description: 'Collect private topology, releases, metrics and operation history', handler: observe },
  operation: { description: 'Inspect operations and acknowledge interrupted work', handler: operation },
  capabilities: { description: 'Discover the human and agent command contract', handler: async () => console.log(JSON.stringify({ version: 1, ok: true, contexts: '--context NAME', projects: '--project DIR', readOnly: ['doctor', 'cloud plan', 'observe', 'operation status', 'app status', 'app diagnose', 'app logs'], mutations: ['cloud apply', 'cloud resume', 'app release', 'app deploy', 'app rollback'], guarantees: ['unknown options rejected', 'immutable release verification', 'durable operation history', 'interrupted operations require reconciliation'], humanAuthorization: ['cloud resources and exact DNS ownership', 'destroy', 'restore', 'node reboot', 'CA rotation'], documentation: 'docs/AGENT-RUNBOOK.md' }, null, 2)) },
  setup:     { description: 'Initial setup (venv, credentials, SSH key)', handler: setup },
  discover:  { description: 'Show available OpenStack resources',         handler: discover },
  deploy:    { description: 'Advanced: Heat resources only (no platform configuration)', handler: deploy },
  destroy:   { description: 'Delete a Heat stack',                        handler: destroy },
  status:    { description: 'Show infrastructure status',                 handler: status },
  ssh:       { description: 'SSH to a stack node',                        handler: ssh },
  inventory: { description: 'Generate Ansible inventory',                 handler: inventory },
  os:        { description: 'OpenStack CLI passthrough',                  handler: os },
  doctor:    { description: 'Diagnose local setup (supports --json)',     handler: doctor },
  apply:     { description: 'Apply and verify the complete production stack', handler: apply },
  verify:    { description: 'Run read-only production checks (--json)',   handler: verify },
  'admin-pki': { description: 'Issue an admin mTLS client certificate',   handler: adminPki },
  dns:        { description: 'Synchronize Infomaniak parent DNS',         handler: dns },
  'dns-token': { description: 'Securely store the Infomaniak DNS token',  handler: dnsToken },
  app:          { description: 'Publish and deploy apps to an existing platform', handler: app },
  maintenance:  { description: 'Quorum-aware Swarm node maintenance',       handler: maintenance },
  probe:        { description: 'Credential-free external HTTPS checks',     handler: probe },
  platform:     { description: 'Encrypted platform backup and restore',     handler: platform },
  context:      { description: 'Manage isolated client operator contexts',  handler: context },
  'backup-job': { description: 'Verify and send encrypted platform backups offsite', handler: backupJob },
};

function mutatesState(command: string, args: string[]): boolean {
  if (command === 'cloud') return ['apply', 'resume', 'configure'].includes(args[0] ?? '');
  if (['apply', 'deploy', 'destroy', 'setup', 'inventory', 'admin-pki', 'dns', 'dns-token', 'os'].includes(command)) return true;
  if (command === 'maintenance') return args[0] !== 'status';
  if (command === 'platform') return !['list', 'verify'].includes(args[0] ?? '');
  if (command === 'app') {
    return !['list', 'validate', 'status', 'diagnose', 'verify', 'logs'].includes(args[0] ?? '');
  }
  return false;
}

const usage: Record<string, string> = {
  cloud: 'cloud init NAME; cloud configure; cloud plan [STACK] [--json]; cloud apply STACK; cloud resume STACK\n  Use --context NAME. Plan is a read-only configuration review; apply creates billable resources and changes parent DNS. Resume completes DNS/verification after recorded delegation waiting.',
  init: 'init NAME --image REGISTRY/OWNER/APP:TAG [--port 3000] [--files Dockerfile,server.mjs] --project DIR\n  Existing immutable images can be deployed without a build.',
  observe: 'observe [--app NAME] [--json | --output PRIVATE.html [--watch]]\n  Read-only snapshot of quorum, exact releases, metrics, alerts, and agent operation history. Unknown evidence stays unknown; keep exports private.',
  operation: 'operation status [--json] | history [--json] | reconcile --acknowledge-interrupted\n  Reconciliation requires workers to be gone and the operator to inspect remote state. It does not undo or resume work.',
  doctor: 'doctor [--for workstation|cloud-apply|app-publish|app-deploy] [--cloud] [--json]\n  Default checks the workstation only; action-specific modes enforce prerequisites.',
  verify: 'verify [STACK] [--json]\n  Read-only cloud, quorum, DNS, TLS, metrics and admin checks. Missing evidence fails verification.',
  setup: 'pnpm run setup\n  Prepare the selected operator context; then configure its Heat/router files, store the DNS token, and run apply.',
  apply: 'pnpm run apply -- STACK [ENV]\n  Provision and configure the production cloud, then verify it.\n  Omit ENV to use the selected context\'s production configuration. Creates billable resources and updates platform DNS.',
  deploy: 'pnpm run deploy -- [1|5] [STACK] [ENV]\n  Advanced Heat-only command; does not configure Docker, Swarm, or HTTPS.\n  For a usable app platform, follow ../docs/QUICKSTART.md and run apply.',
  app: 'pnpm run app -- <command> NAME [options]\n\n  After cloud apply and verification:\n  pnpm run app -- create my-app --template node-web\n  pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1\n  pnpm run app -- validate my-app\n  pnpm run app -- deploy my-app\n  pnpm run app -- diagnose my-app --json\n\n  Also: status, verify, logs, rollback, backup, restore, remove, secret.\n  Complete app workflow: ../docs/FIRST-APP.md',
  context: 'pnpm run context -- create NAME --use\n  Scaffold and select isolated cloud configuration and operator state.\n  Also: current [--json], list [--json], use NAME, clear.',
};

function showHelp(name?: string): void {
  if (name && commands[name]) {
    console.log(`TOAD / ${name}: ${commands[name].description}\n`);
    console.log(usage[name] ?? `pnpm run ${name} -- <arguments>\nSee README.md and ../docs/AGENT-RUNBOOK.md for command details.`);
    return;
  }
  console.log('TOAD - OpenStack Infrastructure CLI\n');
  console.log('Usage: node /path/to/TOAD-infra/toad.mjs <command> [args...] [--context NAME] [--project DIR]\n');
  console.log('Start here: cloud first, then applications.');
  console.log('  1. context create NAME --use; add that cloud\'s credentials');
  console.log('  2. setup; discover; configure the context; dns-token');
  console.log('  3. check; apply STACK; complete DNS delegation; verify STACK --json');
  console.log('  4. app create / publish / validate / deploy / diagnose');
  console.log('  Guided commands: ../docs/QUICKSTART.md\n');
  console.log('Commands:');

  const maxLen = Math.max(...Object.keys(commands).map(k => k.length));
  for (const [name, cmd] of Object.entries(commands)) {
    console.log(`  ${name.padEnd(maxLen + 2)} ${cmd.description}`);
  }
}

async function main(): Promise<void> {
  const input = process.argv[2];
  const args = process.argv.slice(3).filter(arg => arg !== '--');

  if (!input || input === 'help' || input === '--help' || input === '-h') {
    showHelp(input === 'help' ? args[0] : undefined);
    process.exit(0);
  }

  const command = commands[input];

  if (!command) {
    if (args.includes('--json')) { console.log(JSON.stringify({ version: 1, ok: false, context: ACTIVE_CONTEXT ?? 'legacy', operationId: null, error: { code: 'INVALID_ARGUMENTS', message: 'Unknown TOAD command. Run capabilities --json or --help.' } })); process.exitCode = 1; return; }
    console.error(`Unknown command: ${input}`);
    console.error('Run with --help to see available commands');
    process.exit(1);
  }

  // Help must never enter a mutating handler or acquire an operator lock.
  if (args.includes('--help') || args.includes('-h')) {
    if (input === 'app') showAppHelp(args[0]); else showHelp(input);
    return;
  }

  try { if (input === 'app') validateAppArguments(args); else validateCommandArguments(input, args); }
  catch (cause) {
    if (!args.includes('--json')) throw cause;
    console.log(JSON.stringify({ version: 1, ok: false, context: ACTIVE_CONTEXT ?? 'legacy', operationId: null, error: { code: 'INVALID_ARGUMENTS', message: cause instanceof Error ? cause.message : 'Invalid arguments.' }, nextAction: `Run ${input} ${args[0] ?? ''} --help.` })); process.exitCode = 1; return;
  }
  const json = args.includes('--json');
  const execute = async () => {
    if (mutatesState(input, args)) {
      const target = [input, ...args.slice(0, input === 'cloud' || input === 'app' ? 2 : 1).filter(value => /^[a-z0-9-]+$/.test(value))].join(' ');
      if (!json) console.error(`Target context: ${ACTIVE_CONTEXT ?? 'legacy'}; command: ${target}`);
      await withOperationLock(target, () => command.handler(args));
    } else await command.handler(args);
  };
  if (!json || input === 'app') { await execute(); return; }
  const originalLog = console.log; const originalError = console.error;
  let result: unknown;
  console.log = (...items: unknown[]) => { if (items.length === 1 && typeof items[0] === 'string') { try { result = JSON.parse(items[0]); } catch { /* human progress stays off structured stdout */ } } };
  console.error = () => undefined;
  try { await execute(); }
  finally { console.log = originalLog; console.error = originalError; }
  const structured = result && typeof result === 'object' && !['apply', 'resume'].includes(args[0] ?? '');
  console.log(JSON.stringify(structured ? { version: 1, context: ACTIVE_CONTEXT ?? 'legacy', ...(result as Record<string, unknown>) } : { version: 1, ok: !process.exitCode, context: ACTIVE_CONTEXT ?? 'legacy', command: input, result: result ?? null }, null, 2));

}

main().catch((e) => {
  if (process.env.TOAD_JSON === '1') console.log(JSON.stringify({ version: 1, ok: false, error: { code: 'COMMAND_FAILED', message: 'Command could not complete. Check arguments, context readiness and protected operator diagnostics.' } }));
  else console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});

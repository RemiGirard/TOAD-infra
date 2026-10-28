/** Reject unsupported options before locks, state writes or remote connections. */
interface Spec { flags?: string[]; values?: string[]; min: number; max: number }
const specs: Record<string, Spec> = {
  setup: { min: 0, max: 0 }, discover: { min: 0, max: 0 }, status: { min: 0, max: 1 }, inventory: { min: 1, max: 1 },
  apply: { min: 0, max: 2 }, deploy: { min: 0, max: 3 }, destroy: { min: 1, max: 1, flags: ['--yes', '-y'] },
  verify: { min: 0, max: 1, flags: ['--json'] }, doctor: { min: 0, max: 0, flags: ['--json', '--cloud'], values: ['--for'] },
  dns: { min: 0, max: 1 }, 'dns-token': { min: 0, max: 0 }, 'admin-pki': { min: 2, max: 3, flags: ['--force'] },
  context: { min: 1, max: 2, flags: ['--json', '--use'] }, maintenance: { min: 1, max: 2, flags: ['--json', '--yes'] },
  platform: { min: 1, max: 2, flags: ['--json', '--yes'], values: ['--from'] },
  probe: { min: 0, max: 0, flags: ['--json', '--notify', '--notify-always'], values: ['--url', '--expect'] },
  'backup-job': { min: 1, max: 1, flags: ['--accept-service-interruptions'], values: ['--policy'] },
  operation: { min: 0, max: 1, flags: ['--json', '--acknowledge-interrupted'] },
  observe: { min: 0, max: 0, flags: ['--json', '--watch'], values: ['--app', '--output'] },
  cloud: { min: 1, max: 2, flags: ['--json'] },
  init: { min: 1, max: 1, flags: ['--json'], values: ['--image', '--port', '--files'] },
  capabilities: { min: 0, max: 0, flags: ['--json'] },
};
export function validateCommandArguments(command: string, args: string[]): void {
  if (command === 'os' || command === 'ssh') return;
  const spec = specs[command]; if (!spec) return;
  const seen = new Set<string>(); let count = 0;
  for (let at = 0; at < args.length; at += 1) {
    const arg = args[at]!;
    if (!arg.startsWith('-')) { count += 1; continue; }
    if (seen.has(arg)) throw new Error('Duplicate option.'); seen.add(arg);
    if (spec.flags?.includes(arg)) continue;
    if (spec.values?.includes(arg)) { const value = args[++at]; if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value.`); continue; }
    throw new Error(`Unsupported option for ${command}. Run ${command} --help.`);
  }
  if (count < spec.min || count > spec.max) throw new Error(`Invalid arguments for ${command}. Run ${command} --help.`);
  if (command === 'cloud' && !['init', 'configure', 'plan', 'apply', 'resume'].includes(args[0] ?? '')) throw new Error('Unknown cloud command.');
  if (command === 'cloud') {
    if (['apply', 'resume'].includes(args[0] ?? '') && count !== 2) throw new Error('cloud apply and resume require an explicit STACK matching your reviewed plan.');
    if (args[0] === 'configure' && (count !== 1 || args.includes('--json'))) throw new Error('cloud configure is interactive; agents should edit generated templates and run cloud plan --json.');
    if (args[0] === 'init' && count !== 2) throw new Error('cloud init requires exactly one context name.');
  }
  if (command === 'operation' && args.includes('--acknowledge-interrupted') && args[0] !== 'reconcile') throw new Error('--acknowledge-interrupted is only valid with operation reconcile.');
}

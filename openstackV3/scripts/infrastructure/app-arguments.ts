/** Strict application command arguments, validated before acquiring operator locks. */
interface CommandSpec { min: number; max: number; flags?: string[]; values?: string[]; }
const releaseValues = ['--image', '--service', '--platform'];
const commands: Record<string, CommandSpec> = {
  list: { min: 0, max: 0, flags: ['--json'] },
  create: { min: 1, max: 1, flags: ['--json'], values: ['--template'] },
  publish: { min: 1, max: 1, flags: ['--json'], values: releaseValues },
  release: { min: 1, max: 1, flags: ['--json'], values: releaseValues },
  validate: { min: 0, max: 1, flags: ['--all', '--json'] },
  deploy: { min: 1, max: 1, flags: ['--json'] },
  verify: { min: 1, max: 1, flags: ['--json'] },
  status: { min: 1, max: 1, flags: ['--json'] },
  diagnose: { min: 1, max: 1, flags: ['--json'] },
  logs: { min: 1, max: 2, flags: ['--follow'], values: ['--since', '--tail'] },
  rollback: { min: 1, max: 2, flags: ['--json'], values: ['--output'] },
  backup: { min: 2, max: 2, values: ['--output'] },
  restore: { min: 2, max: 2, flags: ['--yes'], values: ['--from'] },
  remove: { min: 1, max: 1, flags: ['--yes'] },
  'secret init': { min: 0, max: 0 },
  'secret recipient': { min: 0, max: 0 },
  'secret encrypt': { min: 2, max: 2, values: ['--from-file'] },
};

export function parseAppArguments(args: string[]) {
  const command = args[0] ?? '';
  const key = command === 'secret' ? `secret ${args[1] ?? ''}` : command;
  const help = args.includes('--help') || args.includes('-h') || command === 'help' || !command;
  if (help) return { command, key, positional: [] as string[], options: {} as Record<string, string | true>, json: false, help: true };
  const spec = commands[key];
  if (!spec) throw new Error('Unknown app command. Run app --help.');
  const positional: string[] = [];
  const options: Record<string, string | true> = {};
  for (let index = command === 'secret' ? 2 : 1; index < args.length; index += 1) {
    const arg = args[index]!;
    if (!arg.startsWith('-')) { positional.push(arg); continue; }
    if (options[arg] !== undefined) throw new Error(`Duplicate option: ${arg}.`);
    if (spec.flags?.includes(arg)) { options[arg] = true; continue; }
    if (spec.values?.includes(arg)) {
      const value = args[++index];
      if (!value || value.startsWith('-')) throw new Error(`${arg} requires a value.`);
      options[arg] = value;
      continue;
    }
    const flag = /^--?[a-z][a-z0-9-]*$/i.test(arg) ? ` ${arg}` : '';
    throw new Error(`Unknown option${flag} for app ${key}. Run app ${key} --help.`);
  }
  if (positional.length < spec.min || positional.length > spec.max) throw new Error(`app ${key} requires ${spec.min === spec.max ? spec.min : `${spec.min}-${spec.max}`} positional argument(s). Run app ${key} --help.`);
  if (options['--all'] && positional.length > 0) throw new Error('Choose an app name or --all, not both.');
  if (key === 'logs' && options['--tail'] && !/^(?:all|\d+)$/.test(String(options['--tail']))) throw new Error('--tail must be a nonnegative integer or all.');
  if (key === 'logs' && options['--since'] && !/^[0-9A-Za-z:.+\-]+$/.test(String(options['--since']))) throw new Error('--since must be a Docker duration or timestamp.');
  if (key === 'restore' && !options['--from']) throw new Error('restore requires --from ARCHIVE.');
  if (key === 'secret encrypt' && !options['--from-file']) throw new Error('secret encrypt requires --from-file PATH.');
  return { command, key, positional, options, json: options['--json'] === true, help: false };
}

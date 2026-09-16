/** Process execution without an intermediary shell. */

import { spawn, spawnSync } from 'node:child_process';

const MAX_OUTPUT_LINES = 3;
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

interface ProcessOptions {
  showOutput?: boolean | undefined;
  showCommand?: boolean | undefined;
  cwd?: string | undefined;
  env?: NodeJS.ProcessEnv | undefined;
  displayCommand?: string | undefined;
  spinner?: string | undefined;
}

function printable(program: string, args: readonly string[]): string {
  return [program, ...args].map((part) => JSON.stringify(part)).join(' ');
}

function showCommand(program: string, args: readonly string[], displayCommand?: string): void {
  console.log(`${DIM}$ ${displayCommand ?? printable(program, args)}${RESET}`);
}

function showOutput(output: string): void {
  if (!output.trim()) return;
  const lines = output.trim().split('\n');
  for (const line of lines.slice(0, MAX_OUTPUT_LINES)) {
    console.log(`${DIM}> ${line}${RESET}`);
  }
  if (lines.length > MAX_OUTPUT_LINES) {
    console.log(`${DIM}> ... (${lines.length - MAX_OUTPUT_LINES} more lines)${RESET}`);
  }
}

export function runProgram(
  program: string,
  args: readonly string[],
  options: ProcessOptions = {},
): string {
  if (options.showCommand !== false) showCommand(program, args, options.displayCommand);
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = result.stderr.trim() || `${program} exited with status ${result.status}`;
    throw new Error(message);
  }
  if (options.showOutput !== false) showOutput(result.stdout);
  return result.stdout;
}

export function runProgramInput(
  program: string,
  args: readonly string[],
  input: string | Buffer,
  options: ProcessOptions = {},
): string {
  if (options.showCommand !== false) showCommand(program, args, options.displayCommand);
  const result = spawnSync(program, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = result.stderr.trim() || `${program} exited with status ${result.status}`;
    throw new Error(message);
  }
  if (options.showOutput !== false) showOutput(result.stdout);
  return result.stdout;
}

export function runProgramCheck(program: string, args: readonly string[] = []): boolean {
  const result = spawnSync(program, args, { stdio: 'ignore' });
  return !result.error && result.status === 0;
}

export function programExists(program: string): boolean {
  const result = spawnSync(program, ['--version'], { stdio: 'ignore' });
  return !result.error;
}

export function runProgramStream(
  program: string,
  args: readonly string[],
  options: Pick<ProcessOptions, 'cwd' | 'env' | 'displayCommand' | 'showCommand'> = {},
): Promise<number> {
  if (options.showCommand !== false) showCommand(program, args, options.displayCommand);
  return new Promise((resolve, reject) => {
    const child = spawn(program, args, { cwd: options.cwd, env: options.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
}

export function runProgramAsync(
  program: string,
  args: readonly string[],
  options: ProcessOptions = {},
): Promise<string> {
  if (options.showCommand !== false) showCommand(program, args, options.displayCommand);
  let frame = 0;
  const spinnerText = options.spinner ?? 'Running';
  const spinnerInterval = process.stdout.isTTY
    ? setInterval(() => {
        process.stdout.write(`\r${DIM}${SPINNER[frame]} ${spinnerText}...${RESET}`);
        frame = (frame + 1) % SPINNER.length;
      }, 80)
    : undefined;

  return new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { stdout += chunk; });
    child.stderr.on('data', (chunk: string) => { stderr += chunk; });
    child.once('error', (error) => {
      if (spinnerInterval) clearInterval(spinnerInterval);
      reject(error);
    });
    child.once('close', (code) => {
      if (spinnerInterval) {
        clearInterval(spinnerInterval);
        process.stdout.write('\r\x1b[K');
      }
      if (code !== 0) {
        reject(new Error(stderr.trim() || `${program} exited with status ${code}`));
        return;
      }
      if (options.showOutput !== false) showOutput(stdout);
      resolve(stdout);
    });
  });
}

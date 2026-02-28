/**
 * Shell command execution with verbose output.
 *
 * Single function to run commands, show them, and display results.
 */

import { execSync, spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const MAX_OUTPUT_LINES = 3;
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

export function run(cmd: string, options: { showOutput?: boolean; cwd?: string; env?: Record<string, string>; actualCmd?: string } = {}): string {
  // Show command (display cmd, but run actualCmd if provided)
  console.log(`${DIM}$ ${cmd}${RESET}`);

  const toRun = options.actualCmd || cmd;

  try {
    const result = execSync(toRun, {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: options.cwd,
      env: options.env,
    });

    // Show output (first N lines)
    if (options.showOutput !== false && result.trim()) {
      const lines = result.trim().split('\n');
      const shown = lines.slice(0, MAX_OUTPUT_LINES);
      for (const line of shown) {
        console.log(`${DIM}> ${line}${RESET}`);
      }
      if (lines.length > MAX_OUTPUT_LINES) {
        console.log(`${DIM}> ... (${lines.length - MAX_OUTPUT_LINES} more lines)${RESET}`);
      }
    }

    return result;
  } catch (error: unknown) {
    // Command failed - return empty or rethrow based on context
    const err = error as { status?: number; stderr?: string };
    if (err.stderr?.trim()) {
      console.log(`${DIM}> ${err.stderr.trim().split('\n')[0]}${RESET}`);
    }
    throw error;
  }
}

export function runStream(cmd: string, args: string[], options: { cwd?: string } = {}): Promise<number> {
  console.log(`${DIM}$ ${cmd} ${args.join(' ')}${RESET}`);

  return new Promise((resolve) => {
    const proc = spawn(cmd, args, {
      stdio: 'inherit',
      cwd: options.cwd,
    });

    proc.on('close', (code) => {
      resolve(code || 0);
    });
  });
}

export function runCheck(cmd: string, options: { actualCmd?: string } = {}): boolean {
  console.log(`${DIM}$ ${cmd}${RESET}`);

  const toRun = options.actualCmd || cmd;

  try {
    const result = execSync(toRun, {
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    if (result.trim()) {
      const lines = result.trim().split('\n');
      const shown = lines.slice(0, MAX_OUTPUT_LINES);
      for (const line of shown) {
        console.log(`${DIM}> ${line}${RESET}`);
      }
    }

    return true;
  } catch {
    console.log(`${DIM}> (not found)${RESET}`);
    return false;
  }
}

// Spinner frames
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export async function runAsync(
  cmd: string,
  options: { showOutput?: boolean; cwd?: string; env?: Record<string, string>; actualCmd?: string; spinner?: string } = {}
): Promise<string> {
  const displayCmd = cmd;
  const toRun = options.actualCmd || cmd;

  // Start spinner
  let frame = 0;
  const spinnerText = options.spinner || 'Running';
  process.stdout.write(`${DIM}$ ${displayCmd}${RESET}\n`);

  const spinnerInterval = setInterval(() => {
    process.stdout.write(`\r${DIM}${SPINNER[frame]} ${spinnerText}...${RESET}`);
    frame = (frame + 1) % SPINNER.length;
  }, 80);

  try {
    const { stdout } = await execAsync(toRun, {
      cwd: options.cwd,
      env: options.env,
    });

    clearInterval(spinnerInterval);
    process.stdout.write(`\r\x1b[K`); // Clear spinner line

    if (options.showOutput !== false && stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const shown = lines.slice(0, MAX_OUTPUT_LINES);
      for (const line of shown) {
        console.log(`${DIM}> ${line}${RESET}`);
      }
      if (lines.length > MAX_OUTPUT_LINES) {
        console.log(`${DIM}> ... (${lines.length - MAX_OUTPUT_LINES} more lines)${RESET}`);
      }
    }

    return stdout;
  } catch (error: unknown) {
    clearInterval(spinnerInterval);
    process.stdout.write(`\r\x1b[K`);

    const err = error as { stderr?: string };
    if (err.stderr?.trim()) {
      console.log(`${DIM}> ${err.stderr.trim().split('\n')[0]}${RESET}`);
    }
    throw error;
  }
}

/**
 * Simple CLI spinner for long operations.
 */

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

let interval: ReturnType<typeof setInterval> | null = null;
let frameIndex = 0;

export function startSpinner(message: string): void {
  if (interval) return;

  frameIndex = 0;
  process.stdout.write(`${DIM}${FRAMES[frameIndex]} ${message}${RESET}`);

  interval = setInterval(() => {
    frameIndex = (frameIndex + 1) % FRAMES.length;
    process.stdout.write(`\r${DIM}${FRAMES[frameIndex]} ${message}${RESET}`);
  }, 80);
}

export function stopSpinner(success = true): void {
  if (!interval) return;

  clearInterval(interval);
  interval = null;

  const icon = success ? '✓' : '✗';
  process.stdout.write(`\r${DIM}${icon}${RESET}\n`);
}

export function clearSpinner(): void {
  if (!interval) return;

  clearInterval(interval);
  interval = null;

  process.stdout.write('\r\x1b[K'); // Clear line
}

export async function withSpinner<T>(message: string, fn: () => Promise<T>): Promise<T> {
  startSpinner(message);
  try {
    const result = await fn();
    stopSpinner(true);
    return result;
  } catch (error) {
    stopSpinner(false);
    throw error;
  }
}

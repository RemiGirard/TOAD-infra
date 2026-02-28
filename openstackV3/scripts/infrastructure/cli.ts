/**
 * CLI utilities for user interaction and terminal output.
 *
 * Provides:
 * - ask(): Prompt user for input with optional default
 * - banner()/section(): Formatted output headers
 * - success()/error()/warning()/info(): Status messages
 * - statusIcon(): Map status strings to emoji indicators
 *
 * Centralizes all terminal I/O to keep main scripts focused on workflow.
 */

import { createInterface, Interface } from 'readline';

let rl: Interface | null = null;

export function getReadline(): Interface {
  if (!rl) {
    rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }
  return rl;
}

export function closeReadline(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}

export function ask(question: string, defaultValue?: string): Promise<string> {
  const prompt = defaultValue ? `${question} [${defaultValue}]: ` : `${question}: `;
  return new Promise((resolve) => {
    getReadline().question(prompt, (answer) => {
      resolve(answer.trim() || defaultValue || '');
    });
  });
}

export function banner(title: string): void {
  const width = 42;
  const padding = Math.floor((width - title.length - 2) / 2);
  const line = '═'.repeat(width);

  console.log(`╔${line}╗`);
  console.log(`║${' '.repeat(padding)}${title}${' '.repeat(width - padding - title.length)}║`);
  console.log(`╚${line}╝\n`);
}

export function section(title: string, width = 60): void {
  console.log(title);
  console.log('─'.repeat(width));
}

export function success(message: string): void {
  console.log(`✅ ${message}`);
}

export function error(message: string): void {
  console.error(`❌ ${message}`);
}

export function warning(message: string): void {
  console.log(`⚠️  ${message}`);
}

export function info(message: string): void {
  console.log(`   ${message}`);
}

export function statusIcon(status: string): string {
  const icons: Record<string, string> = {
    'CREATE_COMPLETE': '✅',
    'CREATE_IN_PROGRESS': '🔄',
    'DELETE_IN_PROGRESS': '🗑️',
    'ACTIVE': '🟢',
    'BUILD': '🔵',
    'SHUTOFF': '🔴',
    'ONLINE': '🟢',
    'ERROR': '🔴',
  };

  if (status.includes('FAILED')) return '❌';
  return icons[status] || '🟡';
}

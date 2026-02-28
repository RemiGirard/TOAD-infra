/**
 * Credentials management.
 *
 * Handles loading OpenStack credentials from:
 * - clouds.yaml: Standard OpenStack config (from Infomaniak dashboard)
 * - password: Separate file for the password (for security)
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { CREDENTIALS_DIR, PASSWORD_FILE } from './paths.js';
import { runCheck } from './shell.js';

let cachedCloudsYaml: string | null | undefined = undefined;

export function findCloudsYaml(): string | null {
  if (cachedCloudsYaml !== undefined) return cachedCloudsYaml;

  if (!existsSync(CREDENTIALS_DIR)) {
    cachedCloudsYaml = null;
    return null;
  }

  const files = readdirSync(CREDENTIALS_DIR);
  const cloudsFile = files.find(f => f.endsWith('-clouds.yaml') || f === 'clouds.yaml');
  cachedCloudsYaml = cloudsFile ? join(CREDENTIALS_DIR, cloudsFile) : null;
  return cachedCloudsYaml;
}

export function getDefaultCloud(): string | null {
  const cloudsFile = findCloudsYaml();
  if (!cloudsFile) return null;

  const content = readFileSync(cloudsFile, 'utf-8');
  const config = parseYaml(content) as { clouds: Record<string, unknown> };

  const clouds = Object.keys(config.clouds || {});
  return clouds[0] || null;
}

export function loadPassword(): string {
  if (!existsSync(PASSWORD_FILE)) {
    throw new Error('credentials/password not found. Run: pnpm run setup');
  }
  return readFileSync(PASSWORD_FILE, 'utf-8').trim();
}

export function cloudsYamlExists(): boolean {
  return runCheck(`ls credentials/*clouds.yaml`, { actualCmd: `ls ${CREDENTIALS_DIR}/*clouds.yaml 2>/dev/null` });
}

export function passwordExists(): boolean {
  return runCheck(`test -f credentials/password && echo "ok"`, { actualCmd: `test -f ${PASSWORD_FILE} && echo "ok"` });
}

export function credentialsExist(): boolean {
  return cloudsYamlExists() && passwordExists();
}

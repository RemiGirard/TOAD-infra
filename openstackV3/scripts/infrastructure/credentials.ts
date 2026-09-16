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

let cachedCloudsYaml: string | null | undefined = undefined;

interface CloudConfig {
  auth_type?: string;
  auth?: {
    application_credential_id?: string;
    application_credential_secret?: string;
    password?: string;
  };
}

interface CloudsConfig {
  clouds?: Record<string, CloudConfig>;
}

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
  const config = parseYaml(content) as CloudsConfig;

  const clouds = Object.keys(config.clouds || {});
  return clouds[0] || null;
}

function getDefaultCloudConfig(): CloudConfig | undefined {
  const cloudsFile = findCloudsYaml();
  const cloudName = getDefaultCloud();
  if (!cloudsFile || !cloudName) return undefined;
  const config = parseYaml(readFileSync(cloudsFile, 'utf8')) as CloudsConfig;
  return config.clouds?.[cloudName];
}

export function usesApplicationCredential(): boolean {
  const cloud = getDefaultCloudConfig();
  return Boolean(
    cloud?.auth_type?.toLowerCase().includes('applicationcredential') ||
    (cloud?.auth?.application_credential_id && cloud.auth.application_credential_secret),
  );
}

export function usesInlinePassword(): boolean {
  return Boolean(getDefaultCloudConfig()?.auth?.password);
}

export function loadPassword(): string | undefined {
  if (!existsSync(PASSWORD_FILE)) return undefined;
  return readFileSync(PASSWORD_FILE, 'utf-8').trim() || undefined;
}

export function cloudsYamlExists(): boolean {
  return findCloudsYaml() !== null;
}

export function passwordExists(): boolean {
  return existsSync(PASSWORD_FILE);
}

export function credentialsExist(): boolean {
  return cloudsYamlExists() && (usesApplicationCredential() || usesInlinePassword() || passwordExists());
}

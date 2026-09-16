/**
 * Path constants for the project.
 *
 * Centralizes all file system paths used across the application.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = join(__dirname, '..', '..');
export const CONTEXTS_DIR = process.env.TOAD_CONTEXTS_DIR
  ? resolve(process.env.TOAD_CONTEXTS_DIR)
  : join(ROOT_DIR, 'contexts');
export const ACTIVE_CONTEXT_FILE = join(ROOT_DIR, '.toad-context');

function selectedContext(): string | undefined {
  const selected = process.env.TOAD_CONTEXT
    ?? (existsSync(ACTIVE_CONTEXT_FILE) ? readFileSync(ACTIVE_CONTEXT_FILE, 'utf8').trim() : undefined);
  if (!selected) return undefined;
  if (!/^[a-z][a-z0-9-]{1,31}$/.test(selected)) {
    throw new Error(`Invalid TOAD context name "${selected}".`);
  }
  return selected;
}

export const ACTIVE_CONTEXT = selectedContext();
export const STATE_DIR = process.env.TOAD_STATE_DIR
  ? resolve(process.env.TOAD_STATE_DIR)
  : ACTIVE_CONTEXT ? join(CONTEXTS_DIR, ACTIVE_CONTEXT) : ROOT_DIR;
export const INVENTORY_PATH = join(STATE_DIR, 'inventory.yaml');
export const CREDENTIALS_DIR = ACTIVE_CONTEXT ? join(STATE_DIR, 'credentials') : join(ROOT_DIR, 'credentials');
export const ROUTER_CONFIG_PATH = ACTIVE_CONTEXT
  ? join(STATE_DIR, 'router', 'config.yaml')
  : resolve(ROOT_DIR, '..', 'router', 'config.yaml');
export const PRODUCTION_ENV_PATH = ACTIVE_CONTEXT
  ? join(STATE_DIR, 'heat', 'production.yaml')
  : join(ROOT_DIR, 'heat', 'env', 'production.yaml');
export const OPERATION_LOCK_PATH = join(STATE_DIR, '.operation.lock');
export const VENV_DIR = join(ROOT_DIR, 'openstack_cli');
export const PASSWORD_FILE = join(CREDENTIALS_DIR, 'password');
export const SSH_KEY_PATH = join(CREDENTIALS_DIR, 'toad-key');
export const SSH_KEY_PUB_PATH = join(CREDENTIALS_DIR, 'toad-key.pub');
export const ADMIN_PKI_DIR = join(CREDENTIALS_DIR, 'admin-pki');
export const ADMIN_CA_KEY_PATH = join(ADMIN_PKI_DIR, 'ca.key');
export const ADMIN_CA_CERT_PATH = join(ADMIN_PKI_DIR, 'ca.crt');
export const ADMIN_OPERATOR_NAME = 'operator';
export const INFOMANIAK_DNS_TOKEN_PATH = join(CREDENTIALS_DIR, 'infomaniak-dns-token');
export const APP_AGE_IDENTITY_PATH = join(CREDENTIALS_DIR, 'toad-app-secrets.agekey');
export const EXTERNAL_MONITORING_WEBHOOK_PATH = join(CREDENTIALS_DIR, 'monitoring-webhook-url');

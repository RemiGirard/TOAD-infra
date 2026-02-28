/**
 * Path constants for the project.
 *
 * Centralizes all file system paths used across the application.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = join(__dirname, '..', '..');
export const CREDENTIALS_DIR = join(ROOT_DIR, 'credentials');
export const VENV_DIR = join(ROOT_DIR, 'openstack_cli');
export const PASSWORD_FILE = join(CREDENTIALS_DIR, 'password');
export const SSH_KEY_PATH = join(CREDENTIALS_DIR, 'toad-key');
export const SSH_KEY_PUB_PATH = join(CREDENTIALS_DIR, 'toad-key.pub');

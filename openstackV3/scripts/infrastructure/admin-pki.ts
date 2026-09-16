/** Minimal offline CA management for the mTLS-protected TOAD admin plane. */

import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import {
  ADMIN_CA_CERT_PATH,
  ADMIN_CA_KEY_PATH,
  ADMIN_OPERATOR_NAME,
  ADMIN_PKI_DIR,
  ROOT_DIR,
} from './paths.js';
import { runProgram } from './shell.js';

const CLIENT_EXTENSIONS_PATH = join(ROOT_DIR, 'pki', 'client-ext.cnf');
const SAFE_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/;

export interface ClientCertificatePaths {
  certificate: string;
  key: string;
  pkcs12: string;
  pkcs12Password: string;
}

function clientPaths(name: string): ClientCertificatePaths & { request: string } {
  if (!SAFE_NAME.test(name)) {
    throw new Error('Certificate name must be 1-64 letters, digits, dots, underscores, or dashes.');
  }
  return {
    certificate: join(ADMIN_PKI_DIR, `${name}.crt`),
    key: join(ADMIN_PKI_DIR, `${name}.key`),
    pkcs12: join(ADMIN_PKI_DIR, `${name}.p12`),
    pkcs12Password: join(ADMIN_PKI_DIR, `${name}.p12-password`),
    request: join(ADMIN_PKI_DIR, `${name}.csr`),
  };
}

function initializeCa(): void {
  const hasKey = existsSync(ADMIN_CA_KEY_PATH);
  const hasCertificate = existsSync(ADMIN_CA_CERT_PATH);
  if (hasKey !== hasCertificate) {
    throw new Error('Admin CA is incomplete; restore both ca.key and ca.crt from backup.');
  }
  if (hasKey) return;

  mkdirSync(ADMIN_PKI_DIR, { recursive: true, mode: 0o700 });
  runProgram('openssl', ['genpkey', '-algorithm', 'ED25519', '-out', ADMIN_CA_KEY_PATH], {
    showOutput: false,
  });
  runProgram('openssl', [
    'req', '-x509', '-new', '-key', ADMIN_CA_KEY_PATH,
    '-out', ADMIN_CA_CERT_PATH,
    '-days', '3650',
    '-subj', '/CN=TOAD Admin Root CA',
    '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-addext', 'subjectKeyIdentifier=hash',
  ], { showOutput: false });
  chmodSync(ADMIN_CA_KEY_PATH, 0o600);
  chmodSync(ADMIN_CA_CERT_PATH, 0o644);
}

export function issueClientCertificate(
  name: string,
  days = 90,
  force = false,
): ClientCertificatePaths {
  if (!Number.isInteger(days) || days < 1 || days > 397) {
    throw new Error('Client certificate lifetime must be between 1 and 397 days.');
  }
  initializeCa();
  const paths = clientPaths(name);
  const clientFiles = [paths.certificate, paths.key, paths.pkcs12, paths.pkcs12Password];
  const existing = clientFiles.filter(existsSync);
  if (existing.length > 0 && !force) {
    if (existing.length === clientFiles.length) return paths;
    throw new Error(`Client certificate ${name} is incomplete; reissue it with --force.`);
  }
  if (force) {
    for (const path of [...clientFiles, paths.request]) {
      rmSync(path, { force: true });
    }
  }

  // RSA remains the most portable client-key type across browser and operating
  // system PKCS#12 importers, including NSS-backed Chrome on Linux.
  runProgram('openssl', [
    'genpkey', '-algorithm', 'RSA',
    '-pkeyopt', 'rsa_keygen_bits:3072',
    '-out', paths.key,
  ], {
    showOutput: false,
  });
  runProgram('openssl', [
    'req', '-new', '-key', paths.key, '-out', paths.request, '-subj', `/CN=${name}`,
  ], { showOutput: false });

  const serialPath = join(ADMIN_PKI_DIR, 'ca.srl');
  const serialArgs = existsSync(serialPath) ? ['-CAserial', serialPath] : ['-CAcreateserial'];
  runProgram('openssl', [
    'x509', '-req', '-in', paths.request,
    '-CA', ADMIN_CA_CERT_PATH,
    '-CAkey', ADMIN_CA_KEY_PATH,
    ...serialArgs,
    '-out', paths.certificate,
    '-days', String(days),
    '-extfile', CLIENT_EXTENSIONS_PATH,
  ], { showOutput: false });
  rmSync(paths.request, { force: true });

  writeFileSync(paths.pkcs12Password, randomBytes(24).toString('base64url'), {
    mode: 0o600,
  });

  runProgram('openssl', [
    'pkcs12', '-export',
    // The random import password protects this local compatibility envelope.
    // 3DES/SHA-1 are used only for PKCS#12 wrapping, never for TLS or signing.
    '-legacy', '-descert', '-macalg', 'sha1',
    '-out', paths.pkcs12,
    '-inkey', paths.key,
    '-in', paths.certificate,
    '-certfile', ADMIN_CA_CERT_PATH,
    '-name', `TOAD ${name}`,
    '-passout', `file:${paths.pkcs12Password}`,
  ], { showOutput: false });

  chmodSync(paths.key, 0o600);
  chmodSync(paths.certificate, 0o644);
  chmodSync(paths.pkcs12, 0o600);
  chmodSync(paths.pkcs12Password, 0o600);
  return paths;
}

export function ensureAdminPki(): ClientCertificatePaths {
  return issueClientCertificate(ADMIN_OPERATOR_NAME);
}

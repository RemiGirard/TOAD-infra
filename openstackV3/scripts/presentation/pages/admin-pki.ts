/** Issue local client certificates for mTLS-protected admin services. */

import { banner, error, success } from '../../infrastructure/cli.js';
import { ADMIN_CA_CERT_PATH, ADMIN_CA_KEY_PATH } from '../../infrastructure/paths.js';
import { issueClientCertificate } from '../../infrastructure/admin-pki.js';

export async function run(args: string[]): Promise<void> {
  banner('TOAD Admin mTLS PKI');
  const action = args[0] ?? 'issue';
  const name = args[1] ?? 'operator';
  const days = Number.parseInt(args[2] ?? '90', 10);
  const force = args.includes('--force');

  if (action !== 'issue') {
    error('Usage: pnpm run admin-pki -- issue NAME [DAYS] [--force]');
    process.exitCode = 1;
    return;
  }

  try {
    const paths = issueClientCertificate(name, days, force);
    success(`Client certificate ready for ${name}.`);
    console.log(`Browser bundle: ${paths.pkcs12}`);
    console.log(`One-time bundle import password: ${paths.pkcs12Password}`);
    console.log(`Agent certificate: ${paths.certificate}`);
    console.log(`Agent private key: ${paths.key}`);
    console.log(`Public CA certificate: ${ADMIN_CA_CERT_PATH}`);
    console.log(`Offline CA key (back up securely; never deploy): ${ADMIN_CA_KEY_PATH}`);
  } catch (cause) {
    error(cause instanceof Error ? cause.message : String(cause));
    process.exitCode = 1;
  }
}

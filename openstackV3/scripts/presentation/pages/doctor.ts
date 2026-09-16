import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { banner } from '../../infrastructure/cli.js';
import { credentialsExist, findCloudsYaml } from '../../infrastructure/credentials.js';
import {
  ADMIN_CA_CERT_PATH,
  ADMIN_CA_KEY_PATH,
  ADMIN_OPERATOR_NAME,
  ADMIN_PKI_DIR,
  ROOT_DIR,
  PASSWORD_FILE,
  SSH_KEY_PATH,
  INFOMANIAK_DNS_TOKEN_PATH,
} from '../../infrastructure/paths.js';
import { programExists } from '../../infrastructure/shell.js';
import { testConnection, venvExists } from '../../infrastructure/openstack.js';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface Check {
  id: string;
  status: CheckStatus;
  message: string;
  fix?: string;
}

function add(
  checks: Check[],
  id: string,
  status: CheckStatus,
  message: string,
  fix?: string,
): void {
  checks.push(fix && status !== 'pass' ? { id, status, message, fix } : { id, status, message });
}

function passwordMode(): number | undefined {
  if (!existsSync(PASSWORD_FILE)) return undefined;
  return statSync(PASSWORD_FILE).mode & 0o777;
}

function fileMode(path: string | null): number | undefined {
  if (!path || !existsSync(path)) return undefined;
  return statSync(path).mode & 0o777;
}

function collectChecks(checkCloud: boolean): Check[] {
  const checks: Check[] = [];
  const nodeMajor = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  add(
    checks,
    'node',
    nodeMajor >= 20 ? 'pass' : 'fail',
    `Node.js ${process.versions.node}`,
    nodeMajor >= 20 ? undefined : 'Install Node.js 20 or newer.',
  );

  const cloudsMode = fileMode(findCloudsYaml());
  if (cloudsMode !== undefined) {
    add(
      checks,
      'clouds-permissions',
      cloudsMode === 0o600 ? 'pass' : 'fail',
      `clouds.yaml mode is ${cloudsMode.toString(8)}`,
      'Run: chmod 600 credentials/clouds.yaml',
    );
  }

  for (const command of ['python3', 'ssh', 'ssh-keygen', 'openssl', 'curl']) {
    const found = programExists(command);
    add(checks, command, found ? 'pass' : 'fail', found ? `${command} is available` : `${command} is missing`);
  }
  for (const [command, fix] of [
    ['age', 'Install the age package or run TOAD through the operator OCI image.'],
    ['tar', 'Install a POSIX tar implementation or run TOAD through the operator OCI image.'],
  ] as const) {
    const found = programExists(command);
    add(checks, command, found ? 'pass' : 'warn', found ? `${command} is available` : `${command} is missing; backup commands require it`, found ? undefined : fix);
  }

  const dependenciesInstalled = existsSync(join(ROOT_DIR, 'node_modules', '.bin', 'tsx'));
  add(
    checks,
    'dependencies',
    dependenciesInstalled ? 'pass' : 'fail',
    dependenciesInstalled ? 'Node dependencies are installed' : 'Node dependencies are not installed',
    dependenciesInstalled ? undefined : 'Run: pnpm install --frozen-lockfile',
  );
  const operatorCertificate = join(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.crt`);
  const operatorKey = join(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.key`);
  const adminPkiReady = [ADMIN_CA_CERT_PATH, ADMIN_CA_KEY_PATH, operatorCertificate, operatorKey].every(existsSync);
  add(
    checks,
    'admin-mtls-pki',
    adminPkiReady ? 'pass' : 'warn',
    adminPkiReady ? 'Admin mTLS PKI is ready' : 'Admin mTLS PKI has not been initialized',
    'Run: pnpm run admin-pki -- issue operator',
  );
  const dnsTokenMode = fileMode(INFOMANIAK_DNS_TOKEN_PATH);
  add(
    checks,
    'infomaniak-dns-token',
    dnsTokenMode === 0o600 ? 'pass' : 'warn',
    dnsTokenMode === 0o600 ? 'Infomaniak DNS token is ready' : 'Infomaniak DNS token is missing or not mode 0600',
    `Create a dns:read + dns:write token at https://manager.infomaniak.com/v3/ng/accounts/token/list, save it to ${INFOMANIAK_DNS_TOKEN_PATH}, and chmod 600 it.`,
  );
  add(
    checks,
    'openstack-cli',
    venvExists() ? 'pass' : 'warn',
    venvExists() ? 'OpenStack CLI environment is ready' : 'OpenStack CLI environment is not set up',
    'Run: pnpm run setup after adding credentials/clouds.yaml.',
  );
  add(
    checks,
    'credentials',
    credentialsExist() ? 'pass' : 'warn',
    credentialsExist() ? `Credentials found (${findCloudsYaml()})` : 'OpenStack credentials are incomplete',
    'Place the downloaded clouds.yaml in credentials/ and run: pnpm run setup.',
  );
  add(
    checks,
    'ssh-key',
    existsSync(SSH_KEY_PATH) ? 'pass' : 'warn',
    existsSync(SSH_KEY_PATH) ? 'Project SSH key exists' : 'Project SSH key has not been generated',
    'Run: pnpm run setup.',
  );

  const mode = passwordMode();
  if (mode !== undefined) {
    add(
      checks,
      'password-permissions',
      mode === 0o600 ? 'pass' : 'fail',
      `credentials/password mode is ${mode.toString(8)}`,
      'Run: chmod 600 credentials/password',
    );
  }

  for (const template of ['heat/level1-swarm-single.yaml', 'heat/level5-production.yaml', 'heat/env/example.yaml']) {
    const found = existsSync(join(ROOT_DIR, template));
    add(checks, `file:${template}`, found ? 'pass' : 'fail', found ? `${template} exists` : `${template} is missing`);
  }

  if (checkCloud) {
    const connected = credentialsExist() && venvExists() && testConnection();
    add(
      checks,
      'cloud-connection',
      connected ? 'pass' : 'fail',
      connected ? 'OpenStack authentication succeeded' : 'OpenStack authentication failed',
      'Verify clouds.yaml, credentials/password, project access, and application roles.',
    );
  }
  return checks;
}

export async function run(args: string[]): Promise<void> {
  const json = args.includes('--json');
  const checkCloud = args.includes('--cloud');
  const checks = collectChecks(checkCloud);
  const summary = {
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failed: checks.filter((check) => check.status === 'fail').length,
  };

  if (json) {
    console.log(JSON.stringify({ version: 1, ok: summary.failed === 0, summary, checks }, null, 2));
  } else {
    banner('TOAD Doctor');
    for (const check of checks) {
      const icon = check.status === 'pass' ? '✅' : check.status === 'warn' ? '⚠️ ' : '❌';
      console.log(`${icon} ${check.message}`);
      if (check.status !== 'pass' && check.fix) console.log(`   Fix: ${check.fix}`);
    }
    console.log(`\n${summary.passed} passed, ${summary.warnings} warnings, ${summary.failed} failed`);
  }

  if (summary.failed > 0) process.exitCode = 1;
}

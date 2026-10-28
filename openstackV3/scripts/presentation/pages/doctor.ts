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
import { programExists, runProgramCheck } from '../../infrastructure/shell.js';
import { ACTIVE_CONTEXT, CREDENTIALS_DIR, INVENTORY_PATH, PRODUCTION_ENV_PATH, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
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
    nodeMajor >= 22 ? 'pass' : 'fail',
    `Node.js ${process.versions.node}`,
    nodeMajor >= 22 ? undefined : 'Install Node.js 22 or newer.',
  );

  const cloudsMode = fileMode(findCloudsYaml());
  if (cloudsMode !== undefined) {
    add(
      checks,
      'clouds-permissions',
      cloudsMode === 0o600 ? 'pass' : 'fail',
      `clouds.yaml mode is ${cloudsMode.toString(8)}`,
      `Run: chmod 600 ${findCloudsYaml()}`,
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
    'For a new platform, apply initializes the PKI. For an existing platform, restore its original CA and operator bundle from escrow; do not replace trust.',
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
    `Run: pnpm run setup after adding ${CREDENTIALS_DIR}/clouds.yaml.`,
  );
  add(
    checks,
    'credentials',
    credentialsExist() ? 'pass' : 'warn',
    credentialsExist() ? `Credentials found (${findCloudsYaml()})` : 'OpenStack credentials are incomplete',
    `Place the downloaded clouds.yaml in ${CREDENTIALS_DIR}/ and run: pnpm run setup.`,
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
      `Run: chmod 600 ${PASSWORD_FILE}`,
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
  const forIndex = args.indexOf('--for');
  const purpose = forIndex >= 0 ? args[forIndex + 1] : 'workstation';
  if (!['workstation', 'cloud-apply', 'app-publish', 'app-deploy'].includes(purpose ?? '')) throw new Error('--for must be workstation, cloud-apply, app-publish, or app-deploy.');
  if (purpose === 'app-publish') {
    for (let index = checks.length - 1; index >= 0; index -= 1) if (!['node', 'dependencies'].includes(checks[index]!.id)) checks.splice(index, 1);
    const dockerReady = runProgramCheck('docker', ['info']);
    add(checks, 'docker-daemon', dockerReady ? 'pass' : 'fail', dockerReady ? 'Docker is ready' : 'Docker daemon is unavailable', 'Start Docker.');
    const buildxReady = runProgramCheck('docker', ['buildx', 'version']);
    add(checks, 'docker-buildx', buildxReady ? 'pass' : 'fail', buildxReady ? 'Docker Buildx is ready' : 'Docker Buildx is unavailable', 'Install Docker with Buildx.');
  }
  if (purpose === 'cloud-apply') {
    for (const id of ['credentials', 'ssh-key', 'openstack-cli', 'infomaniak-dns-token']) {
      const check = checks.find(value => value.id === id); if (check && check.status !== 'pass') check.status = 'fail';
    }
    for (const [id, path] of [['production-config', PRODUCTION_ENV_PATH], ['router-config', ROUTER_CONFIG_PATH]]) {
      const ready = existsSync(path!); add(checks, id!, ready ? 'pass' : 'fail', ready ? `${id} exists` : `${id} is missing`, 'Run cloud init and cloud configure in the selected context.');
    }
    const legacy = runProgramCheck('openssl', ['list', '-providers', '-provider', 'legacy']);
    add(checks, 'openssl-legacy', legacy ? 'pass' : 'fail', legacy ? 'OpenSSL legacy provider is available' : 'OpenSSL legacy provider is unavailable', 'Use OpenSSL 3 with its legacy provider.');
  }
  if (purpose === 'app-deploy') {
    add(checks, 'platform-inventory', existsSync(INVENTORY_PATH) ? 'pass' : 'fail', existsSync(INVENTORY_PATH) ? 'Platform inventory exists' : 'Platform inventory is missing', 'Provision the cloud platform first.');
    add(checks, 'ansible-runtime', existsSync(join(ROOT_DIR, '..', 'ansible', 'venv', 'bin', 'ansible-playbook')) ? 'pass' : 'fail', 'Application deployment requires the Ansible runtime', 'Run cloud setup using the supported operator runtime.');
    const key = checks.find(value => value.id === 'ssh-key'); if (key && key.status !== 'pass') key.status = 'fail';
  }
  const summary = {
    passed: checks.filter((check) => check.status === 'pass').length,
    warnings: checks.filter((check) => check.status === 'warn').length,
    failed: checks.filter((check) => check.status === 'fail').length,
  };

  if (json) {
    console.log(JSON.stringify({ version: 1, ok: summary.failed === 0, purpose, context: ACTIVE_CONTEXT ?? 'legacy', readiness: purpose === 'workstation' ? 'workstation-only' : summary.failed === 0 ? 'ready' : 'blocked', summary, checks }, null, 2));
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

/** Fast, credential-free validation for CI and agent diagnostics. */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseDocument } from 'yaml';
import { ROOT_DIR } from './infrastructure/paths.js';
import { listAppNames, loadApp } from './infrastructure/app-manifest.js';

const yamlFiles = [
  'heat/level1-swarm-single.yaml',
  'heat/level5-production.yaml',
  'heat/env/example.yaml',
  '../router/docker-compose.yaml',
  '../router/dynamic.yaml',
  '../ansible/playbooks/installDocker.yaml',
  '../ansible/playbooks/hardenHosts.yaml',
  '../ansible/playbooks/initJoinSwarm.yaml',
  '../ansible/playbooks/deployTraefik.yaml',
  '../ansible/playbooks/deployRoot.yaml',
  '../ansible/playbooks/deployMonitoring.yaml',
  '../ansible/playbooks/deployHello.yaml',
  '../ansible/playbooks/deployApp.yaml',
  '../apps/hello/docker-compose.yaml',
  '../apps/root/docker-compose.yaml',
  '../apps/stateful-example/docker-compose.yaml',
  '../monitoring/docker-compose.yaml',
  '../monitoring/alerts.yml',
  '../monitoring/alertmanager.yml',
  '../monitoring/blackbox.yml',
  '../monitoring/loki-config.yml',
  '../monitoring/external-endpoints.yaml',
  '../monitoring/grafana/provisioning/datasources/prometheus.yml',
  '../monitoring/grafana/provisioning/dashboards/toad.yml',
];

const sourceOnlyYamlFiles = [
  '../.github/dependabot.yml',
  '../.github/workflows/ci.yaml',
  '../.github/workflows/probe.yaml',
  '../.github/workflows/release.yaml',
  '../.github/workflows/release-please.yaml',
];

const availableYamlFiles = [
  ...yamlFiles,
  ...sourceOnlyYamlFiles.filter((file) => existsSync(join(ROOT_DIR, file))),
];

function read(relativePath: string): string {
  return readFileSync(join(ROOT_DIR, relativePath), 'utf8');
}

const packageMetadata = JSON.parse(read('package.json')) as { license?: string; version?: string };
if (packageMetadata.license !== 'AGPL-3.0-or-later') {
  throw new Error('package.json must declare the AGPL-3.0-or-later SPDX license identifier.');
}

const releaseVersion = read('../version.txt').trim();
const releaseManifest = JSON.parse(read('../.release-please-manifest.json')) as Record<string, string>;
if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)
  || packageMetadata.version !== releaseVersion
  || releaseManifest['.'] !== releaseVersion) {
  throw new Error('version.txt, package.json, and the release manifest must contain the same SemVer.');
}
const releaseConfig = JSON.parse(read('../release-please-config.json')) as {
  'release-type'?: string;
  packages?: Record<string, unknown>;
};
if (releaseConfig['release-type'] !== 'simple' || !releaseConfig.packages?.['.']) {
  throw new Error('Release Please must manage the repository as one simple SemVer component.');
}
const releaseAutomationPath = join(ROOT_DIR, '../.github/workflows/release-please.yaml');
if (existsSync(releaseAutomationPath)) {
  const releaseAutomation = read('../.github/workflows/release-please.yaml');
  if (!releaseAutomation.includes('googleapis/release-please-action@45996ed1f6d02564a971a2fa1b5860e934307cf7')) {
    throw new Error('Release Please must remain pinned to the reviewed action commit.');
  }
}

const license = read('../LICENSE');
for (const required of ['GNU AFFERO GENERAL PUBLIC LICENSE', 'Version 3, 19 November 2007', 'END OF TERMS AND CONDITIONS']) {
  if (!license.includes(required)) throw new Error(`LICENSE is missing canonical AGPLv3 text: ${required}`);
}

for (const file of availableYamlFiles) {
  const document = parseDocument(read(file));
  if (document.errors.length > 0) {
    throw new Error(`${file}: ${document.errors.map((error) => error.message).join('; ')}`);
  }
}

const production = read('heat/level5-production.yaml');
for (const required of ['manager1:', 'manager2:', 'manager3:', 'loadbalancer:', 'manager1_floating_ip:']) {
  if (!production.includes(required)) throw new Error(`Production topology is missing ${required}`);
}
if (/gateway\d*:/m.test(production)) throw new Error('Production topology must not contain disconnected gateway servers.');
if (/^  bastion:/m.test(production)) throw new Error('The three-node production topology must not create a fourth bastion VM.');
if (production.includes('remote_ip_prefix: 0.0.0.0/0\n          protocol: udp\n          port_range_min: 4789')) {
  throw new Error('Swarm overlay port 4789 must never be public.');
}

const traefik = read('../router/docker-compose.yaml');
if (traefik.includes('--providers.docker=true')) throw new Error('Traefik must not enable both Docker and Swarm providers.');
if (!traefik.includes('--api.dashboard=true')) throw new Error('The mTLS-protected Traefik dashboard must be enabled.');
if (!traefik.includes('admin-mtls@file')) throw new Error('The Traefik dashboard must reference the mTLS TLS option.');
if (!traefik.includes('--metrics.prometheus=true')) throw new Error('Traefik must expose internal Prometheus metrics.');
if (!traefik.includes('--certificatesresolvers.infomaniak.acme.dnschallenge.provider=infomaniak')) {
  throw new Error('Traefik must use Infomaniak DNS-01 for parent wildcard certificates.');
}
if (!traefik.includes('INFOMANIAK_ACCESS_TOKEN_FILE')) throw new Error('The DNS API token must be mounted through a secret file.');
if (!traefik.includes('replicas: 1')) throw new Error('Exactly one Traefik replica must own local ACME state.');

const dynamicTraefik = read('../router/dynamic.yaml');
if (!dynamicTraefik.includes('RequireAndVerifyClientCert')) {
  throw new Error('The admin TLS option must require and verify client certificates.');
}

const monitoring = read('../monitoring/docker-compose.yaml');
for (const required of ['prometheus:', 'alertmanager:', 'grafana:', 'loki:', 'alloy:', 'blackbox-exporter:', 'node-exporter:', 'cadvisor:']) {
  if (!monitoring.includes(required)) throw new Error(`Monitoring profile is missing ${required}`);
}
if ((monitoring.match(/admin-mtls@file/g) ?? []).length !== 3) {
  throw new Error('Every public monitoring interface must require admin mTLS.');
}
if (!monitoring.includes('TOAD_CONFIG_HASH: ${PROMETHEUS_CONFIG_HASH}')) {
  throw new Error('Prometheus configuration changes must trigger a Swarm service update.');
}
if (!monitoring.includes('grafana/loki:3.7.0') || !monitoring.includes('grafana/alloy:v1.18.0')) {
  throw new Error('Central logging images must be pinned.');
}

for (const [name, compose] of [['Traefik', traefik], ['monitoring', monitoring]] as const) {
  const images = [...compose.matchAll(/^\s*image:\s*([^\s#]+)/gm)].map((match) => match[1] ?? '');
  if (images.length === 0 || images.some((image) => !/@sha256:[a-f0-9]{64}$/.test(image))) {
    throw new Error(`${name} images must use immutable SHA-256 digests.`);
  }
}

const rootApp = read('../apps/root/docker-compose.yaml');
for (const required of ['certresolver=infomaniak', 'tls.domains[0].main', 'tls.domains[0].sans=*.']) {
  if (!rootApp.includes(required)) throw new Error(`Parent-domain stack is missing ${required}`);
}

const appNames = listAppNames();
if (appNames.length === 0) throw new Error('At least one manifest-driven application is required.');
for (const appName of appNames) loadApp(appName);

console.log(`Validated ${availableYamlFiles.length} YAML files, ${appNames.length} app manifests, and production invariants.`);

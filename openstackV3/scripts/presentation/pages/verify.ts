/** Read-only end-to-end verification for agents and operators. */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Resolver, resolve4, resolveNs } from 'node:dns/promises';
import { parse as parseYaml } from 'yaml';
import { banner, error } from '../../infrastructure/cli.js';
import { INVENTORY_PATH, ROOT_DIR, ROUTER_CONFIG_PATH } from '../../infrastructure/paths.js';
import {
  ADMIN_OPERATOR_NAME,
  ADMIN_PKI_DIR,
} from '../../infrastructure/paths.js';
import { openstack } from '../../infrastructure/openstack.js';
import { managerSshArgs } from '../../infrastructure/app-secrets.js';
import { runProgram } from '../../infrastructure/shell.js';

interface RouterConfig {
  base_domain?: string;
  root_domain?: string;
}

interface Check {
  id: string;
  ok: boolean;
  detail: string;
}

interface PrometheusTargetsResponse {
  data?: {
    activeTargets?: Array<{ health?: string }>;
  };
}

interface PrometheusQueryResponse {
  data?: {
    result?: Array<{ value?: [number, string] }>;
  };
}

interface PrometheusRulesResponse {
  data?: {
    groups?: Array<{ rules?: Array<{ health?: string }> }>;
  };
}

interface GrafanaSearchResult {
  uid?: string;
}

interface GrafanaDatasourceHealth {
  status?: string;
  message?: string;
}

interface LokiLabelsResponse {
  data?: string[];
}

interface DockerServiceInspect {
  Spec?: {
    Name?: string;
    TaskTemplate?: { ContainerSpec?: { Image?: string } };
  };
}

async function fetchWhenReady(url: string, redirect: RequestRedirect): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      return await fetch(url, { redirect, signal: AbortSignal.timeout(5_000) });
    } catch (cause) {
      lastError = cause;
      if (attempt < 18) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }
  throw lastError;
}

async function endpointCheck(host: string): Promise<Check[]> {
  try {
    const http = await fetchWhenReady(`http://${host}`, 'manual');
    const https = await fetchWhenReady(`https://${host}`, 'follow');
    return [
      { id: `${host}:http-redirect`, ok: http.status >= 300 && http.status < 400, detail: `HTTP ${http.status}` },
      { id: `${host}:https`, ok: https.status === 200, detail: `HTTP ${https.status}; TLS verified` },
    ];
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return [
      { id: `${host}:http-redirect`, ok: false, detail },
      { id: `${host}:https`, ok: false, detail },
    ];
  }
}

function endpointCheckAtIp(host: string, ipv4: string, showCommand: boolean): Check[] {
  try {
    const httpStatus = runProgram('curl', [
      '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code}',
      '--max-time', '15', '--resolve', `${host}:80:${ipv4}`, `http://${host}/`,
    ], { showOutput: false, showCommand }).trim();
    const httpsStatus = runProgram('curl', [
      '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code}',
      '--max-time', '15', '--resolve', `${host}:443:${ipv4}`, `https://${host}/`,
    ], { showOutput: false, showCommand }).trim();
    return [
      { id: `${host}:http-redirect`, ok: /^3\d\d$/.test(httpStatus), detail: `HTTP ${httpStatus}; connected to ${ipv4}` },
      { id: `${host}:https`, ok: httpsStatus === '200', detail: `HTTP ${httpsStatus}; TLS verified at ${ipv4}` },
    ];
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return [
      { id: `${host}:http-redirect`, ok: false, detail },
      { id: `${host}:https`, ok: false, detail },
    ];
  }
}

async function authoritativeResolve4(name: string): Promise<string[]> {
  const serverNames = ['ns11.infomaniak.ch', 'ns12.infomaniak.ch'];
  const serverAddresses = await Promise.all(serverNames.map(async (server) => (await resolve4(server))[0]!));
  const answers = await Promise.all(serverAddresses.map(async (server) => {
    const resolver = new Resolver();
    resolver.setServers([server]);
    return resolver.resolve4(name);
  }));
  return [...new Set(answers.flat())];
}

async function adminMtlsChecks(host: string, path: string, showCommand: boolean): Promise<Check[]> {
  const certificate = resolve(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.crt`);
  const key = resolve(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.key`);
  if (!existsSync(certificate) || !existsSync(key)) {
    return [{ id: `${host}:mtls-files`, ok: false, detail: 'operator certificate or key is missing' }];
  }

  let rejectedWithoutCertificate = false;
  try {
    runProgram('curl', [
      '--silent', '--show-error', '--output', '/dev/null', '--max-time', '10',
      `https://${host}${path}`,
    ], { showOutput: false, showCommand });
  } catch {
    rejectedWithoutCertificate = true;
  }

  let authorizedStatus = '';
  let lastError: unknown;
  for (let attempt = 1; attempt <= 18; attempt += 1) {
    try {
      authorizedStatus = runProgram('curl', [
        '--silent', '--show-error', '--output', '/dev/null', '--write-out', '%{http_code}',
        '--max-time', '10', '--cert', certificate, '--key', key,
        `https://${host}${path}`,
      ], { showOutput: false, showCommand }).trim();
      if (authorizedStatus === '200') break;
      lastError = new Error(`HTTP ${authorizedStatus}`);
      if (attempt < 18) await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
    } catch (cause) {
      lastError = cause;
      if (attempt < 18) await new Promise((resolveDelay) => setTimeout(resolveDelay, 5_000));
    }
  }

  return [
    {
      id: `${host}:mtls-required`,
      ok: rejectedWithoutCertificate,
      detail: rejectedWithoutCertificate ? 'client without certificate rejected' : 'unexpectedly accessible without certificate',
    },
    {
      id: `${host}:mtls-authorized`,
      ok: authorizedStatus === '200',
      detail: authorizedStatus ? `HTTP ${authorizedStatus}` : (lastError instanceof Error ? lastError.message : 'request failed'),
    },
  ];
}

function authenticatedJson(url: string, showCommand: boolean): unknown {
  const certificate = resolve(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.crt`);
  const key = resolve(ADMIN_PKI_DIR, `${ADMIN_OPERATOR_NAME}.key`);
  return JSON.parse(runProgram('curl', [
    '--silent', '--show-error', '--fail', '--max-time', '10',
    '--cert', certificate, '--key', key, url,
  ], { showOutput: false, showCommand }));
}

function monitoringApiChecks(baseDomain: string, showCommand: boolean): Check[] {
  try {
    const prometheusBase = `https://prometheus.${baseDomain}`;
    const targets = authenticatedJson(
      `${prometheusBase}/api/v1/targets?state=active`, showCommand,
    ) as PrometheusTargetsResponse;
    const activeTargets = targets.data?.activeTargets ?? [];
    const healthyTargets = activeTargets.filter((target) => target.health === 'up').length;

    const probes = authenticatedJson(
      `${prometheusBase}/api/v1/query?query=${encodeURIComponent('sum(probe_success{job="public-https"})')}`,
      showCommand,
    ) as PrometheusQueryResponse;
    const successfulProbes = Number(probes.data?.result?.[0]?.value?.[1] ?? 0);

    const rules = authenticatedJson(`${prometheusBase}/api/v1/rules`, showCommand) as PrometheusRulesResponse;
    const alertRules = (rules.data?.groups ?? []).flatMap((group) => group.rules ?? []);
    const healthyRules = alertRules.filter((rule) => rule.health === 'ok').length;

    const dashboards = authenticatedJson(
      `https://grafana.${baseDomain}/api/search?query=TOAD`, showCommand,
    ) as GrafanaSearchResult[];
    const dashboardReady = dashboards.some((dashboard) => dashboard.uid === 'toad-overview');
    const lokiHealth = authenticatedJson(
      `https://grafana.${baseDomain}/api/datasources/uid/loki/health`, showCommand,
    ) as GrafanaDatasourceHealth;
    const lokiLabels = authenticatedJson(
      `https://grafana.${baseDomain}/api/datasources/proxy/uid/loki/loki/api/v1/labels`, showCommand,
    ) as LokiLabelsResponse;

    return [
      {
        id: 'monitoring-targets',
        ok: activeTargets.length >= 18 && healthyTargets === activeTargets.length,
        detail: `${healthyTargets}/${activeTargets.length} up`,
      },
      {
        id: 'monitoring-public-probes',
        ok: successfulProbes === 4,
        detail: `${successfulProbes}/4 successful`,
      },
      {
        id: 'monitoring-alert-rules',
        ok: alertRules.length === 7 && healthyRules === alertRules.length,
        detail: `${healthyRules}/${alertRules.length} healthy`,
      },
      {
        id: 'monitoring-dashboard',
        ok: dashboardReady,
        detail: dashboardReady ? 'TOAD Overview provisioned' : 'TOAD Overview missing',
      },
      {
        id: 'monitoring-loki',
        ok: lokiHealth.status === 'OK' && ['collector', 'container', 'service', 'stack'].every((label) => lokiLabels.data?.includes(label)),
        detail: `${lokiHealth.message ?? lokiHealth.status ?? 'health unavailable'}; labels: ${(lokiLabels.data ?? []).join(', ')}`,
      },
    ];
  } catch (cause) {
    return [{
      id: 'monitoring-api',
      ok: false,
      detail: cause instanceof Error ? cause.message : String(cause),
    }];
  }
}

export async function run(args: string[]): Promise<void> {
  const stackName = args.find((arg) => !arg.startsWith('--')) ?? 'toad-prod';
  const json = args.includes('--json');
  const configPath = ROUTER_CONFIG_PATH;
  const config = parseYaml(readFileSync(configPath, 'utf8')) as RouterConfig;
  if (!config.base_domain) throw new Error('router/config.yaml must define base_domain.');
  if (!config.root_domain) throw new Error('router/config.yaml must define root_domain.');

  const checks: Check[] = [];
  try {
    const status = openstack(['stack', 'show', stackName, '-f', 'value', '-c', 'stack_status'], {
      showOutput: false,
      showCommand: !json,
    }).trim();
    checks.push({ id: 'heat-stack', ok: status.endsWith('_COMPLETE'), detail: status });

    const loadBalancer = JSON.parse(openstack(
      ['loadbalancer', 'show', `${stackName}-ingress`, '-f', 'json'],
      { showOutput: false, showCommand: !json },
    )) as { operating_status?: string; provisioning_status?: string };
    checks.push({
      id: 'octavia-load-balancer',
      ok: loadBalancer.operating_status === 'ONLINE' && loadBalancer.provisioning_status === 'ACTIVE',
      detail: `${loadBalancer.provisioning_status ?? 'unknown'}/${loadBalancer.operating_status ?? 'unknown'}`,
    });

    let onlineMembers = 0;
    for (const poolName of ['http_pool', 'https_pool']) {
      const poolId = openstack(
        ['stack', 'resource', 'show', stackName, poolName, '-f', 'value', '-c', 'physical_resource_id'],
        { showOutput: false, showCommand: !json },
      ).trim();
      const members = JSON.parse(openstack(
        ['loadbalancer', 'member', 'list', poolId, '-f', 'json'],
        { showOutput: false, showCommand: !json },
      )) as Array<{ operating_status?: string; provisioning_status?: string }>;
      onlineMembers += members.filter((member) => (
        member.operating_status === 'ONLINE' && member.provisioning_status === 'ACTIVE'
      )).length;
    }
    checks.push({ id: 'octavia-members', ok: onlineMembers === 6, detail: `${onlineMembers}/6 online` });

    const addresses = await resolve4(`hello.${config.base_domain}`);
    checks.push({ id: 'dns-a', ok: addresses.length > 0, detail: addresses.join(', ') });
    const nameservers = await resolveNs(config.base_domain);
    checks.push({ id: 'dns-ns', ok: nameservers.length >= 2, detail: nameservers.join(', ') });

    const loadBalancerIp = openstack(
      ['stack', 'output', 'show', stackName, 'lb_floating_ip', '-f', 'value', '-c', 'output_value'],
      { showOutput: false, showCommand: !json },
    ).trim().replace(/^"|"$/g, '');
    const rootAddresses = await authoritativeResolve4(config.root_domain);
    const wildcardHost = `toad-verify-${Date.now()}.${config.root_domain}`;
    const wildcardAddresses = await authoritativeResolve4(wildcardHost);
    checks.push({
      id: 'parent-dns-apex',
      ok: rootAddresses.includes(loadBalancerIp),
      detail: `${rootAddresses.join(', ')} (Infomaniak authoritative)`,
    });
    checks.push({
      id: 'parent-dns-wildcard',
      ok: wildcardAddresses.includes(loadBalancerIp),
      detail: `${wildcardHost} -> ${wildcardAddresses.join(', ')}`,
    });

    checks.push(...endpointCheckAtIp(config.root_domain, loadBalancerIp, !json));
    checks.push(...endpointCheckAtIp(`www.${config.root_domain}`, loadBalancerIp, !json));
    checks.push(...endpointCheckAtIp(wildcardHost, loadBalancerIp, !json));
    checks.push(...await endpointCheck(`hello.${config.base_domain}`));
    checks.push(...await endpointCheck(`whoami.${config.base_domain}`));
    for (const [host, path] of [
      [`traefik.${config.base_domain}`, '/dashboard/'],
      [`grafana.${config.base_domain}`, '/api/health'],
      [`prometheus.${config.base_domain}`, '/-/ready'],
      [`alerts.${config.base_domain}`, '/-/ready'],
    ] as const) {
      checks.push(...await adminMtlsChecks(host, path, !json));
    }
    checks.push(...monitoringApiChecks(config.base_domain, !json));

    const ansible = resolve(ROOT_DIR, '..', 'ansible', 'venv', 'bin', 'ansible');
    const inventory = INVENTORY_PATH;
    const swarm = runProgram(ansible, [
      'managers[0]', '-i', inventory, '-b', '-m', 'command', '-a', 'docker node ls',
    ], { showOutput: false, showCommand: !json });
    const readyManagers = swarm.split('\n').filter((line) => line.includes(' Ready ') && /(Leader|Reachable)/.test(line)).length;
    checks.push({ id: 'swarm-managers', ok: readyManagers === 3, detail: `${readyManagers}/3 ready` });

    const networks = runProgram(ansible, [
      'managers[0]', '-i', inventory, '-b', '-m', 'command',
      '-a', 'docker network inspect ingress traefik-public',
    ], { showOutput: false, showCommand: !json });
    const isolatedPools = networks.includes('"Subnet": "10.20.0.0/24"')
      && networks.includes('"Subnet": "10.20.1.0/24"');
    checks.push({
      id: 'swarm-address-pools',
      ok: isolatedPools,
      detail: isolatedPools ? 'ingress 10.20.0.0/24; apps 10.20.1.0/24' : 'unexpected overlay subnet',
    });

    const services = runProgram(ansible, [
      'managers[0]', '-i', inventory, '-b', '-m', 'command', '-a', 'docker service ls',
    ], { showOutput: false, showCommand: !json });
    const serviceLines = services.split('\n').filter((line) => /\d+\/\d+/.test(line));
    const replicaIs = (name: string, replicas: string): boolean => (
      serviceLines.some((line) => line.includes(name) && line.includes(replicas))
    );
    checks.push({
      id: 'swarm-services',
      ok: replicaIs('traefik_traefik', '1/1')
        && replicaIs('root_landing', '2/2')
        && replicaIs('hello_hello', '2/2')
        && replicaIs('hello_whoami', '2/2')
        && replicaIs('monitoring_prometheus', '1/1')
        && replicaIs('monitoring_alertmanager', '1/1')
        && replicaIs('monitoring_grafana', '1/1')
        && replicaIs('monitoring_blackbox-exporter', '1/1')
        && replicaIs('monitoring_node-exporter', '3/3')
        && replicaIs('monitoring_cadvisor', '3/3')
        && replicaIs('monitoring_loki', '1/1')
        && replicaIs('monitoring_alloy', '3/3'),
      detail: serviceLines.join(' | '),
    });

    const serviceIds = runProgram('ssh', [
      ...managerSshArgs(), 'sudo', 'docker', 'service', 'ls', '--quiet',
    ], { showOutput: false, showCommand: !json })
      .split('\n').map((id) => id.trim()).filter(Boolean);
    const serviceSpecs = serviceIds.length === 0
      ? []
      : JSON.parse(runProgram('ssh', [
        ...managerSshArgs(), 'sudo', 'docker', 'service', 'inspect', ...serviceIds,
      ], { showOutput: false, showCommand: !json })) as DockerServiceInspect[];
    const mutableImages = serviceSpecs
      .map((service) => ({
        name: service.Spec?.Name ?? 'unknown',
        image: service.Spec?.TaskTemplate?.ContainerSpec?.Image ?? '',
      }))
      .filter((service) => !/@sha256:[a-f0-9]{64}$/.test(service.image));
    checks.push({
      id: 'swarm-image-digests',
      ok: serviceSpecs.length >= 12 && mutableImages.length === 0,
      detail: mutableImages.length === 0
        ? `${serviceSpecs.length}/${serviceSpecs.length} services use immutable digests`
        : `mutable image specs: ${mutableImages.map((service) => service.name).join(', ')}`,
    });
  } catch (cause) {
    checks.push({ id: 'verification-runtime', ok: false, detail: cause instanceof Error ? cause.message : String(cause) });
  }

  const result = { version: 1, ok: checks.every((check) => check.ok), checks };
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    banner('TOAD Production Verify');
    for (const check of checks) console.log(`${check.ok ? '✅' : '❌'} ${check.id}: ${check.detail}`);
  }
  if (!result.ok) {
    error('One or more production checks failed.');
    process.exitCode = 1;
  }
}

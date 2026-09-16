# TOAD infra

TOAD is a small, open infrastructure stack for Infomaniak Public Cloud:

- **T**raefik for label-driven HTTPS routing
- **O**penStack Heat and Designate for infrastructure and DNS as code
- **A**nsible for the thin host-configuration layer
- **D**ocker Swarm for application orchestration

Terraform is not used. TypeScript owns the operator CLI; Python exists only in
project-local virtual environments for the official OpenStack CLI and Ansible.

## Supported profiles

| Profile | Purpose | Compute nodes | Public IPs |
|---|---|---:|---:|
| `1` | Development / small installation | 1 manager | 1 |
| `5` | Production-shaped HA | 3 managers | 2 (SSH bootstrap + Octavia) |

The old experimental templates remain in `openstackV3/heat/`, but the CLI does
not offer them. Three managers are the smallest Swarm control plane that can
lose one manager and retain quorum.

## Production traffic path

```text
Internet
   |
   +-- SSH (restricted CIDR) --> manager 1 --> managers 2/3
   |
   +-- HTTP/HTTPS --> Octavia TCP load balancer
                            |
              +-------------+-------------+
              |             |             |
          manager 1     manager 2     manager 3
              \_____________|_____________/
                       Swarm routing mesh
                              |
                      Traefik (1 replica)
                              |
                 application overlay services
```

`toad.remigirard.dev` is a delegated child zone managed by OpenStack Designate.
Heat creates its apex and wildcard A records from the Octavia floating IP. The
TypeScript operator also keeps the Infomaniak parent-zone apex and wildcard A
records synchronized with that IP. Mail records and the `toad` NS delegation
are deliberately outside its ownership.

## Prerequisites

- Node.js 20+ and pnpm
- Python 3 with `venv` support
- OpenSSH client
- [`age`](https://age-encryption.org/) and `age-keygen` when applications use encrypted secrets
- A dedicated Infomaniak Public Cloud service user with password authentication.
  Infomaniak Heat creates a Keystone trust, which cannot be created from an
  application-credential token. Do not use your personal account password.
- `toad.remigirard.dev` delegated to the Designate nameservers returned after
  the first stack creation
- An Infomaniak API token limited to `dns:read` and `dns:write`

Use a public `/32` CIDR for SSH. Do not use `0.0.0.0/0` for a client or
production installation.

## Install and diagnose

```sh
cd openstackV3
pnpm install --frozen-lockfile
pnpm run check
pnpm run doctor -- --json
```

Store the service-user `clouds.yaml` in `openstackV3/credentials/clouds.yaml`.
The password can be in that file or, preferably, in
`openstackV3/credentials/password`. Both are ignored by Git and forced to mode
`0600` by setup. Then:

```sh
pnpm run setup
pnpm run doctor -- --cloud
pnpm run discover
```

Create a restricted token at
<https://manager.infomaniak.com/v3/ng/accounts/token/list>, then save its value
with `pnpm run dns-token` (the prompt does not echo it). This creates
`openstackV3/credentials/infomaniak-dns-token` with mode `0600`. This
ignored local file is used both by the parent-DNS TypeScript client and as the
source of a versioned Docker secret; the token is never copied into a remote
deployment directory or Compose environment file.

The setup creates `openstackV3/openstack_cli/`; it never installs Python
packages globally. See [credentials and recovery](docs/OPERATIONS.md).

## Reproducible operator image

The Node, Python, OpenStack, Ansible, SSH, and age tooling is also packaged in a
credential-free operator image. Exact pnpm and Python dependency locks are used,
and the base image is digest-pinned. Build and validate it locally with:

```sh
docker build --tag toad-operator:test .
docker run --rm toad-operator:test --help
```

Environment-specific and secret files are intentionally excluded from the
image. A published image is used by mounting only operator state and inputs:

```sh
docker run --rm -it \
  --volume toad-state:/state \
  --volume "$PWD/backups:/backups" \
  --volume "$PWD/openstackV3/credentials:/opt/toad/openstackV3/credentials" \
  --volume "$PWD/openstackV3/heat/env/production.yaml:/opt/toad/openstackV3/heat/env/production.yaml:ro" \
  --volume "$PWD/router/config.yaml:/opt/toad/router/config.yaml:ro" \
  --volume "$PWD/apps:/opt/toad/apps:ro" \
  ghcr.io/remigirard/toad-infra:VERSION verify toad-prod --json
```

Use a host backup directory rather than an anonymous `/backups` volume. Mount
`apps` read-write only when deliberately using `app create`. Release tags build
the OCI image with an SBOM and provenance in GitHub Actions, publish it to GHCR,
and keyless-sign its immutable digest with Sigstore Cosign. Verify the selected
release digest before giving it client credentials.

## One-command production apply

Copy the local settings and set the flavor, immutable OpenStack image UUID,
public network, domain, and email. Use the ID printed by
`pnpm run discover`, not an image display name that the provider may retarget:

```sh
cp openstackV3/heat/env/example.yaml openstackV3/heat/env/production.yaml
cp router/config.example.yaml router/config.yaml
cd openstackV3
pnpm run apply -- toad-prod heat/env/production.yaml
```

`apply` discovers the operator workstation's public IPv4 and restricts SSH to
that `/32`; it then validates Heat, creates or updates networks, security groups, three
instances, two floating IPs, Octavia, and Designate; it then generates the
inventory, installs Docker, creates the Swarm, deploys Traefik, monitoring, and
the test services, initializes the local admin mTLS PKI, synchronizes the
parent apex/wildcard DNS only after ingress is ready, and runs the end-to-end
checks. Re-running the same command is the normal idempotent maintenance path.
If the workstation address changes, refresh only that Heat-managed rule with
`pnpm run maintenance -- refresh-ssh-access toad-prod --yes`.

For agents and monitoring, the read-only result is machine-readable:

```sh
pnpm run verify -- toad-prod --json
```

The first deployment needs a one-time parent-zone delegation. Add two `NS`
records named `toad` in the Infomaniak DNS zone for `remigirard.dev`, pointing
to `ns1.pub2.infomaniak.cloud.` and `ns2.pub2.infomaniak.cloud.`. This delegation
is outside the OpenStack project and intentionally survives stack destruction.
The parent apex and wildcard A records are not a manual step: `apply` manages
them using the restricted Infomaniak token.

Traefik uses two automatic ACME paths. Routes in the delegated `toad` zone keep
HTTP-01 issuance, while `remigirard.dev` and `*.remigirard.dev` use Infomaniak
DNS-01. The latter produces one wildcard certificate and renews it without
opening another port or requiring a manual DNS record.

## Manual layer-by-layer path

## Configure Swarm and ingress

Use this path when debugging a specific layer:

```sh
cd ansible
python3 -m venv venv
venv/bin/pip install -r requirements.lock.txt
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/installDocker.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/initJoinSwarm.yaml
```

Deploy Traefik and the two public test services:

```sh
ansible/venv/bin/ansible-playbook -i openstackV3/inventory.yaml ansible/playbooks/deployTraefik.yaml
ansible/venv/bin/ansible-playbook -i openstackV3/inventory.yaml ansible/playbooks/deployRoot.yaml
ansible/venv/bin/ansible-playbook -i openstackV3/inventory.yaml ansible/playbooks/deployMonitoring.yaml
ansible/venv/bin/ansible-playbook -i openstackV3/inventory.yaml ansible/playbooks/deployHello.yaml
```

After parent-zone delegation has propagated, verify:

```sh
curl --fail --show-error https://hello.toad.remigirard.dev
curl --fail --show-error https://whoami.toad.remigirard.dev
curl --fail --show-error https://remigirard.dev
curl --fail --show-error https://anything.remigirard.dev
```

The Traefik dashboard is available at
`https://traefik.toad.remigirard.dev/dashboard/`, but its TLS handshake requires
a client certificate. `apply` creates the initial browser bundle at
`openstackV3/credentials/admin-pki/operator.p12` and its local import password
file. Import the bundle into the operator's browser or OS certificate store;
keep both files private. Issue a separate, short-lived identity for each person
or device with:

```sh
cd openstackV3
pnpm run admin-pki -- issue alice-laptop 90
```

The same certificate opens the mTLS-protected Grafana, Prometheus, and
Alertmanager interfaces at `grafana`, `prometheus`, and `alerts` under the base
domain. Only the public CA certificate is deployed to Traefik. The CA key and
all client keys remain in the ignored local credentials directory. See
[admin access and certificate recovery](docs/OPERATIONS.md#admin-mtls) and the
[monitoring profile](monitoring/README.md).

## Deploy an application

Applications live in `apps/APP/` and declare their deployment contract in
`toad.yaml`. The manifest is deliberately small: stack and service names, an
allow-list of files that may leave the workstation, HTTPS acceptance checks,
and optional encrypted secrets. Create a safe Traefik/Swarm starter and deploy
it with:

```sh
cd openstackV3
pnpm run app -- create my-service
# Edit ../apps/my-service/docker-compose.yaml and ../apps/my-service/toad.yaml
pnpm run app -- validate my-service
pnpm run app -- deploy my-service
pnpm run app -- status my-service
pnpm run app -- diagnose my-service --json
pnpm run app -- logs my-service
```

The generated route is `https://my-service.toad.remigirard.dev`. Images must
include an immutable SHA-256 digest, published host ports are rejected, and
every service must use Swarm's automatic rollback policy. Traefik-enabled
services must join the external `traefik-public` overlay and declare their
container port. `deploy` copies only manifest-declared files, runs `docker
stack config`, deploys with `--prune`, shows replica state, and performs every
declared HTTPS check.

`diagnose --json` is the preferred agent entry point for one application. It
returns valid JSON containing the validated manifest identity, desired and
running replicas, immutable image references, endpoint latency/status, recent
failed Swarm task errors, and focused next-step hints. It is read-only and exits
non-zero when the application or an endpoint is unhealthy.

Routine lifecycle commands are:

```sh
pnpm run app -- list
pnpm run app -- verify my-service
pnpm run app -- logs my-service api
pnpm run app -- rollback my-service api
pnpm run app -- remove my-service       # exact stack-name confirmation
```

For a secret, declare it in `toad.yaml` and as an external Compose secret whose
name is an environment reference. For example:

```yaml
# apps/my-service/toad.yaml
secrets:
  - name: api-token
    source: secrets/api-token.age
    environment: API_TOKEN_SECRET
```

```yaml
# apps/my-service/docker-compose.yaml
secrets:
  api-token:
    external: true
    name: ${API_TOKEN_SECRET}
```

Initialize the local encryption identity and encrypt a file:

```sh
pnpm run app -- secret init
pnpm run app -- secret recipient
pnpm run app -- secret encrypt my-service api-token --from-file /secure/input
```

Commit the `.age` ciphertext, never the input. Back up the ignored
`openstackV3/credentials/toad-app-secrets.agekey` in a real secret manager.
During deployment the TypeScript CLI decrypts in memory, sends plaintext to
`docker secret create` over SSH stdin, and injects only the content-addressed
secret name into Compose. No plaintext secret file is created on a node.

Platform-owned state uses the same encrypted streaming path. Back up every
Traefik and monitoring volume, or one selected dataset, with:

```sh
pnpm run platform -- list
pnpm run platform -- backup
pnpm run platform -- backup traefik-certificates
```

The command briefly quiesces only the owning service and writes an ignored,
age-encrypted archive on the operator host. Guarded restore syntax and failure
semantics are documented in
[operations and recovery](docs/OPERATIONS.md#encrypted-platform-recovery).

## Destroy and rebuild test

The compute/DNS stack is deleted with:

```sh
cd openstackV3
pnpm run destroy -- toad-prod
```

Confirm `pnpm run status` shows no managed stack resources, then repeat the
`apply` command above. The parent `NS` delegation and restricted DNS token are
the only persistent bootstrap state. `apply` updates the parent apex/wildcard
to the newly allocated Octavia IP after every rebuild.

## Repository map

```text
openstackV3/   TypeScript CLI and Heat templates
ansible/       Docker, Swarm, Traefik, and test-app configuration
router/        Pinned Traefik Swarm stack
apps/hello/    Public end-to-end verification services
apps/root/     Parent-domain and wildcard landing service
apps/stateful-example/  Opt-in pinned-volume and encrypted-backup example
monitoring/    Prometheus, Grafana, alerts, probes, and provisioned dashboards
docs/          Architecture and operating procedures
SECURITY.md    Supported-version, disclosure, and trust-boundary guidance
CONTRIBUTING.md  Validation and pull-request workflow
AGENTS.md      Guardrails for coding and operations agents
```

Provider and upstream references: [Infomaniak Heat](https://docs.infomaniak.cloud/orchestration/heat/),
[Infomaniak Octavia](https://docs.infomaniak.cloud/network/loadbalancers/),
[Infomaniak application credentials](https://docs.infomaniak.cloud/identity/applications_credentials/),
[Docker Swarm manager quorum](https://docs.docker.com/engine/swarm/admin_guide/),
[Docker routing mesh](https://docs.docker.com/engine/swarm/ingress/), and
[Traefik's Swarm provider](https://doc.traefik.io/traefik/v3.7/providers/swarm/)
and [mTLS client authentication](https://doc.traefik.io/traefik/v3.7/reference/routing-configuration/http/tls/tls-options/#client-authentication-mtls).

## Current boundaries

- The project is Swarm-first. Kubernetes should be a separate provider/profile,
  not conditionals throughout the Swarm implementation.
- Swarm is the default because the operational surface is small and Traefik's
  service-label integration is excellent. Choose Kubernetes only when a client
  actually needs its ecosystem, scheduling primitives, or managed-control-plane
  integrations; three small self-managed Kubernetes control-plane nodes are
  materially heavier to operate.
- Traefik OSS runs one replica because its local ACME file cannot safely have
  multiple writers. Swarm reschedules it; a cross-node move can reissue
  certificates. Use the encrypted platform backup before maintenance.

## License

Copyright (C) 2026 Remi Girard.

TOAD is free software licensed under the
[GNU Affero General Public License, version 3 or later](LICENSE)
(`AGPL-3.0-or-later`). You may use, study, modify, and redistribute it under
those terms. If you run a modified version as a network service, section 13
requires offering its users the corresponding source code.

For agent-assisted operation, start with the
[agent runbook](docs/AGENT-RUNBOOK.md). It separates read-only diagnosis from
actions that require exact human authorization and defines the evidence an
agent must return after a change.

For persistence and recovery decisions, use the
[stateful storage profiles](docs/STATEFUL-STORAGE.md) and the
[disaster-recovery proof](docs/DISASTER-RECOVERY.md).
Contributors and maintainers should follow the
[Conventional Commit release workflow](docs/RELEASING.md).

# TOAD

**Deploy and operate your apps on infrastructure you control.**

TOAD is an open-source deployment toolkit for independent developers and small
teams who want their own Infomaniak Public Cloud. It provisions the servers,
configures Docker Swarm, routes HTTPS, and gives you one CLI for applications,
diagnosis, updates, and recovery. Its JSON diagnostics work well with an AI
coding assistant; manifests keep deployment reproducible and reviewable.

[Project site](https://toad.remigirard.dev) ·
[Try it locally](docs/QUICKSTART.md) · [Deploy your first app](docs/FIRST-APP.md) ·
[Provision production](docs/DEPLOYMENT.md)

## Start with your app

Try the frontend + Node API starter without a cloud account or Docker:

~~~sh
git clone https://github.com/RemiGirard/TOAD-infra.git
cd TOAD-infra
HOST=127.0.0.1 node examples/node-web/server.mjs
# Open http://127.0.0.1:3000
~~~

When a TOAD platform is available, scaffold and publish your own copy:

~~~sh
cd openstackV3
pnpm install --frozen-lockfile
pnpm run doctor -- --json
pnpm run app -- create my-app --template node-web
# Authenticate Docker to your registry using its credential manager.
pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
~~~

Publishing builds only the source files declared in build.yaml, pushes the
image, and pins the returned SHA-256 digest in Compose. It does not deploy.
See the [complete recipe](docs/FIRST-APP.md) for registry access, secrets,
updates, rollback, and CI.

## Choose your starting point

| You want to… | Start here | Requirements |
|---|---|---|
| Try the example on your machine | [Local quickstart](docs/QUICKSTART.md) | Node.js 22; no cloud spend |
| Ship an app to an existing platform | [First app](docs/FIRST-APP.md) | Docker, registry and operator access |
| Explore one cloud manager | [Evaluation](docs/EVALUATION.md) | Infomaniak account; billable resources |
| Run the maintained production topology | [Deployment](docs/DEPLOYMENT.md) | Three managers, load balancer and domain |

## What TOAD handles

- **Infrastructure:** OpenStack Heat and Ansible; no Terraform.
- **App delivery:** allow-listed files, immutable images, bounded resources,
  HTTPS checks, rolling updates, and rollback.
- **Operator access:** short-lived mTLS identities for admin interfaces.
- **Operations:** JSON diagnostics, metrics, logs, external probes, encrypted
  secrets and volume archives, and quorum-aware maintenance.
- **Client separation:** independent contexts and mutation locks.

The maintained production path uses three Swarm managers with Octavia,
Designate, Traefik, Prometheus, Grafana, Alertmanager, Loki, and Alloy.

## Costs and expectations

TOAD is AGPL-3.0-or-later software. You pay cloud and registry providers directly.
The [cost worksheet](docs/COSTS.md) separates evaluation and production
resources, includes dated estimates, and links to current provider prices.

This is an operator toolkit. Initial cloud setup requires service credentials
and DNS configuration. Stateful local volumes are single-node state; three
managers do not replicate application data. Traefik runs one replica to protect
its local certificate store. See [storage profiles](docs/STATEFUL-STORAGE.md).

## Evidence and operations

The repository records a real Infomaniak destroy/rebuild and subsequent
production verification, plus a Loki volume restore. A fresh-cluster service
recovery drill is still pending; it is not presented as completed.

- [Validation record and launch status](docs/LAUNCH-READINESS.md)
- [Recorded production acceptance](docs/OPERATIONS.md#acceptance-record)
- [Backup and disaster recovery](docs/DISASTER-RECOVERY.md)
- [Agent runbook](docs/AGENT-RUNBOOK.md)
- [Security policy](SECURITY.md) · [Contributing](CONTRIBUTING.md)

## Repository

| Directory | Purpose |
|---|---|
| openstackV3/ | TypeScript operator CLI and Heat templates |
| ansible/ | Host, Swarm, routing, and monitoring playbooks |
| apps/ | Manifest-driven deployments |
| examples/node-web/ | Frontend + Node API starter |
| website/ | Public project site and documentation build |
| docs/ | Deployment, app delivery, operations, and recovery |

TOAD is licensed under [GNU AGPL version 3 or later](LICENSE).

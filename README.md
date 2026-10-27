# TOAD

**Deploy and operate your apps on infrastructure you control.**

TOAD is an open-source deployment toolkit for independent developers and small
teams who want their own Infomaniak Public Cloud. It provisions the servers,
configures Docker Swarm, routes HTTPS, and gives you one CLI for applications,
diagnosis, updates, and recovery. Its JSON diagnostics work well with an AI
coding assistant; manifests keep deployment reproducible and reviewable.

[Project site](https://toad.remigirard.dev) ·
[Get started](docs/QUICKSTART.md) · [Cloud setup details](docs/DEPLOYMENT.md) ·
[Deploy an app](docs/FIRST-APP.md)

## 1. Provision your cloud platform

Start with [Get started](docs/QUICKSTART.md). Create an isolated operator
context, add your Infomaniak credentials, choose resources, configure domains,
and store the restricted DNS token. Then, from `openstackV3`:

~~~sh
pnpm run context -- current --json
pnpm run check
pnpm run doctor -- --cloud
pnpm run apply -- my-cloud
# On first deployment, complete the documented child DNS delegation and rerun apply.
pnpm run verify -- my-cloud --json
~~~

`apply` provisions and configures the cloud, Docker Swarm, HTTPS, and
monitoring. It uses the selected context's environment by default. It creates
billable resources and updates the configured parent apex/wildcard DNS.
Review [costs](docs/COSTS.md) and [DNS ownership](docs/DEPLOYMENT.md) first.

## 2. Publish and deploy your app

After platform verification passes, authenticate Docker to your registry,
create an app, and customize its source:

~~~sh
pnpm run app -- create my-app --template node-web
pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1
pnpm run check
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
~~~

Publishing builds only allow-listed source and pins the returned image digest
in Compose. Deploying runs the app on your existing platform. Repeat this app
workflow for updates; use `apply` for platform changes. See the
[complete app recipe](docs/FIRST-APP.md) for registry access, secrets, and rollback.

## Choose your starting point

| You want to… | Start here | Requirements |
|---|---|---|
| Create a cloud platform and ship your first app | [Get started](docs/QUICKSTART.md) | Infomaniak project, domain and operator tooling |
| Ship an app to an existing verified platform | [First app](docs/FIRST-APP.md) | Docker, registry and operator access |
| Understand the architecture | [Visual guide](docs/ARCHITECTURE.md) | No account required |
| Preview the example frontend and API locally | [Optional local starter](docs/LOCAL-STARTER.md) | Node.js 22; no cloud spend |
| Explore a one-VM Heat profile | [Evaluation](docs/EVALUATION.md) | Billable resources; not the complete platform |

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

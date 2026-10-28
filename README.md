# TOAD

**Your cloud account. Your platform defined in code. One open-source CLI to deploy and operate it.**

TOAD is an MIT-licensed infrastructure and orchestration toolkit for developers
and small teams who want control of their app platform. Heat templates declare
cloud resources, Ansible configures the servers, and Compose/manifests declare
applications. The CLI coordinates provisioning, releases, diagnosis and recovery
from your operator machine or automation. Your app source can stay in its own
repository; you choose the registry and hold the cloud account.

Infomaniak Public Cloud is the verified production path on TOAD's OpenStack
foundation. Other providers need adaptation and validation. For people and
coding agents, versioned JSON, explicit targets, strict commands, exact release
checks and a private visual operation view keep actions understandable and reviewable.

[Project site](https://toad.remigirard.dev) ·
[Get started](docs/QUICKSTART.md) · [Cloud setup details](docs/DEPLOYMENT.md) ·
[Deploy an app](docs/FIRST-APP.md) · [Use with an agent](docs/AGENT-RUNBOOK.md) ·
[Understand operations](docs/OBSERVABILITY.md)

New to cloud, domains or containers? [See your app explained visually](docs/UNDERSTAND.md)
and compare the responsibilities of a hosted platform, Coolify and TOAD before
creating resources.
Follow the [complete Infomaniak example](docs/INFOMANIAK-EXAMPLE.md) for account
setup, DNS/IP choices, a published app and its private monitoring interface.

## What stays in your hands

| You control | How TOAD supports it |
|---|---|
| Provider project and access | Resources are created in your cloud account; you pay the provider directly. |
| Infrastructure and configuration | Heat templates, Ansible playbooks and app manifests are files you can inspect, version and change. |
| Delivery and operations | One local CLI coordinates platform setup, app releases, observations and recovery workflows. Your agent uses the same commands. |
| Use and modification of TOAD | The current MIT-licensed distribution can be inspected, forked and adapted, retaining the required notices. See [licensing scope](LICENSING.md). |

TOAD has no subscription fee. Cloud resources, domains, registries and backup
services have their own costs. You rent the underlying hardware and retain
responsibility for capacity, security, upkeep and recovery. Account setup and
the first child DNS delegation still need human steps; the
[complete example](docs/INFOMANIAK-EXAMPLE.md) makes those hand-offs explicit.

## 1. Provision your cloud platform

Start with [Account and access](docs/CLOUD-ACCOUNT.md) if you do not have a cloud
account or project access yet. Then follow [Get started](docs/QUICKSTART.md).
Create an isolated operator
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
| Follow one complete Infomaniak deployment | [Worked example](docs/INFOMANIAK-EXAMPLE.md) | A dedicated domain and a reviewed cloud budget |
| Understand what runs where and compare hosting approaches | [Your app explained](docs/UNDERSTAND.md) | No account or infrastructure vocabulary required |
| Create an account and prepare cloud access | [Account and access](docs/CLOUD-ACCOUNT.md) | Your email and provider billing decisions; an agent can guide the steps |
| Create a cloud platform and ship your first app | [Get started](docs/QUICKSTART.md) | Infomaniak project, domain and operator tooling |
| Ship an app to an existing verified platform | [First app](docs/FIRST-APP.md) | Docker, registry and operator access |
| Understand the architecture | [Visual guide](docs/ARCHITECTURE.md) | No account required |
| Inspect exact network paths, trust and failure boundaries | [Expert implementation](docs/IMPLEMENTATION.md) | Source-level detail; no account required |
| Preview the example frontend and API locally | [Optional local starter](docs/LOCAL-STARTER.md) | Node.js 22; no cloud spend |
| Explore a one-VM Heat profile | [Evaluation](docs/EVALUATION.md) | Billable resources; not the complete platform |

## Work in your existing application repository

Keep application source in its own repository. Initialize TOAD metadata with
an explicit file allow-list, then repeat one release command:

~~~sh
node /path/to/TOAD-infra/toad.mjs init my-app --project . --image ghcr.io/YOUR-OWNER/my-app:v1 --port 3000 --files Dockerfile,server.mjs
node /path/to/TOAD-infra/toad.mjs app release my-app --project . --context my-cloud
node /path/to/TOAD-infra/toad.mjs observe --app my-app --project . --context my-cloud --output /private/path/toad-view.html --watch
~~~

Review generated files before publishing. An existing immutable image can be
initialized and deployed without a local build. The [first-app guide](docs/FIRST-APP.md)
also documents explicit build/deploy phases for CI and review.

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
Its DNS updates and certificate automation use Infomaniak. Other OpenStack
clouds require [compatibility review and adaptation](docs/CLOUD-ACCOUNT.md#using-another-openstack-cloud);
TOAD does not claim that every OpenStack provider works unchanged.

## Costs and expectations

TOAD is MIT-licensed software. You pay cloud and registry providers directly.
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

TOAD is licensed under the [MIT license](LICENSE), allowing commercial and
proprietary reuse while requiring preservation of its copyright and permission
notice. See [licensing scope](LICENSING.md) for earlier revisions and
separately licensed components.

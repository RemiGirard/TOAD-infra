# Get started: cloud first, then your app

TOAD first creates and configures your cloud platform. You then publish and
deploy applications onto it. Provision the platform once; repeat the app
workflow for each app and update.

Already operate a verified TOAD platform? Go to [First app](FIRST-APP.md).
For an optional frontend/API preview, [run the example locally](LOCAL-STARTER.md).

The homepage uses the repository launcher `./toad` from the checkout root.
After installing dependencies below, try `./toad --help` from that root.
`node toad.mjs` is equivalent on platforms without executable symlinks.
The commands below use package scripts from `openstackV3`; both reach the same CLI.

## 0. Get cloud account and project access

No cloud account yet? Follow [Account and access](CLOUD-ACCOUNT.md) first:
create or reuse your customer account, activate Public Cloud, prepare a project
and dedicated OpenStack user, then download its access configuration. The
guide links the official Infomaniak steps and explains the billing checks.

Your agent can guide the browser flow and prepare local setup. You complete
passwords, provider verification, payment, final account agreements and new
access approvals, then the agent resumes. No credentials need to enter chat.

TOAD is **OpenStack-based, with Infomaniak as the verified production path**.
The current DNS and certificate integrations also use Infomaniak. Other
OpenStack providers need [compatibility review and adaptation](CLOUD-ACCOUNT.md#using-another-openstack-cloud);
they are not verified drop-in targets.

## 1. Prepare your operator context

You need Node.js 22, pnpm, Git, Python 3 with `venv`, OpenSSH, OpenSSL 3 with
its legacy provider (for browser certificate bundles), Docker with Buildx,
and `age`. After the account/access guide, you should have an Infomaniak
Public Cloud project and a dedicated service user with a password.
You also need a domain you control, hosted in Infomaniak DNS.
Review the [cost worksheet](COSTS.md) before creating billable resources.

```sh
git clone https://github.com/RemiGirard/TOAD-infra.git
cd TOAD-infra/openstackV3
pnpm install --frozen-lockfile
pnpm run doctor -- --json
pnpm run cloud -- init my-cloud
```

The context command creates isolated configuration templates and selects them.
Use a different name for each client or cloud environment. From `openstackV3`:

- Save the service user's downloaded cloud configuration at
  `contexts/my-cloud/credentials/clouds.yaml`.
- Run `pnpm run setup` to install the OpenStack CLI, authenticate, and verify
  that the cloud SSH keypair matches your local key. A missing password is
  requested without echoing it.
- Run `pnpm run discover`, then use `pnpm run cloud -- configure` for guided
  configuration, or fill in
  `contexts/my-cloud/heat/production.yaml` with your resource choices.
- Set your domains and certificate email in
  `contexts/my-cloud/router/config.yaml`.
- Run `pnpm run dns-token` to store a restricted `dns:read` / `dns:write` token.

Keep credential values in the ignored context files. The
[production setup guide](DEPLOYMENT.md#2-create-the-cloud-service-user)
explains account permissions, configuration fields, and DNS ownership.

## 2. Provision and verify the platform

The maintained production profile creates three managers, an Octavia load
balancer, networking, and a delegated DNS zone. Ansible configures Docker Swarm,
Traefik HTTPS, monitoring, and the platform test services.

```sh
pnpm run context -- current --json
pnpm run check
pnpm run doctor -- --for cloud-apply --cloud
pnpm run cloud -- plan my-cloud
pnpm run cloud -- apply my-cloud
```

Review the selected context, domain ownership, and target stack before `apply`:
it creates or updates billable resources and the parent apex/wildcard DNS
records. Omitting an environment argument selects this context's configuration.
Keep using the same stack name for this cloud.

On the first run, setup reports `waiting_for_dns` while the child zone awaits manual
delegation. It retains the existing resources and prints the required records. Read its nameservers:

```sh
pnpm run os -- recordset list YOUR-PLATFORM-DOMAIN.
```

Create the matching child `NS` records in your parent DNS zone, using the
[one-time delegation instructions](DEPLOYMENT.md#6-delegate-the-platform-child-zone-once).
Keep the existing stack and resume the DNS/verification stage:

```sh
pnpm run cloud -- resume my-cloud
pnpm run verify -- my-cloud --json
```

Continue when verification passes. The lower-level `deploy` command creates
Heat resources only; it does not replace this platform setup.

## 3. Publish and deploy your app

Authenticate Docker to a registry you control. For the simplest first
deployment, make the image publicly pullable; private images require pull
authentication on the Swarm nodes.

```sh
pnpm run app -- create my-app --template node-web
# Edit ../apps/my-app/source/ and its build allow-list.
pnpm run app -- publish my-app --image ghcr.io/YOUR-OWNER/my-app:v1
pnpm run check
pnpm run app -- validate my-app
pnpm run app -- deploy my-app
pnpm run app -- diagnose my-app --json
```

Publishing pins the registry image digest in Compose. Deployment updates the
app on the existing platform. Open `https://my-app.YOUR-PLATFORM-DOMAIN/` and
check its page and API. The [first-app guide](FIRST-APP.md) covers the registry,
customization, secrets, updates, and rollback.

## 4. Operate and update

```sh
pnpm run app -- diagnose my-app --json
pnpm run maintenance -- status --json
```

For an app update, publish a new version, validate, deploy, and diagnose again.
Run `apply` when changing the platform configuration. Follow
[operations](OPERATIONS.md) and [recovery](DISASTER-RECOVERY.md) for stateful
data and backups. Complete backup and restore validation before relying on
the platform for important data.

Use [TOAD with your coding agent](AGENT-RUNBOOK.md), and open the
[private operation view](OBSERVABILITY.md) to understand its current stage.

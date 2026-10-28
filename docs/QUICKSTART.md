# Put your app online, and see how it works

You have an app on your computer. You want a link other people can open,
even when your computer is off. TOAD sets up rented cloud servers in your
account, then runs your app on them behind HTTPS.

We will use one example throughout: an app called **my-app**, reachable at
**`https://my-app.platform.example.com`**. Replace the example domain with a
dedicated domain you control. The names and IPs in the diagrams are examples,
not values to copy into your configuration.

[Go straight to setup](#0-get-cloud-account-and-project-access) ·
[Already have a verified platform? Deploy an app](FIRST-APP.md)

<!-- TOAD_LESSON: visit -->

## The path from your laptop to a public link

1. **Get access:** an Infomaniak account and a Public Cloud project.
2. **Connect TOAD:** a private local context tells it which project to use.
3. **Create the platform:** servers, networking, HTTPS and monitoring.
4. **Connect the name:** DNS tells visitors how to find the app entrance.
5. **Release my-app:** package the app, run it on the servers, then check it.

Create the platform once. Reuse it for more apps and repeat the release step
for updates. The complete workflow below currently creates **three servers**;
the [smaller one-server IPv6 design](INFOMANIAK-EXAMPLE.md#the-minimum-ipv6-design)
still needs implementation and validation in TOAD.

For one complete worked example with account access, IPs, DNS records, app URL
and monitoring, follow [Infomaniak: from account to monitored app](INFOMANIAK-EXAMPLE.md).

For an optional frontend/API preview, [run the example locally](LOCAL-STARTER.md).
For more definitions and a comparison of what different hosting options
manage for you, see [Your app explained](UNDERSTAND.md).

You can work through the commands yourself, or ask your coding agent:

```text
Use TOAD-infra to put this app online.
https://github.com/RemiGirard/TOAD-infra
```

The repository's agent instructions supply the operating workflow. The same
diagrams below help you understand and review the agent's plan.

The homepage uses the repository launcher `./toad` from the checkout root.
After installing dependencies below, try `./toad --help` from that root.
`node toad.mjs` is equivalent on platforms without executable symlinks.
The commands below use package scripts from `openstackV3`; both reach the same CLI.

## 0. Get cloud account and project access

<!-- TOAD_LESSON: access -->

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

<!-- TOAD_LESSON: context -->

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

<!-- TOAD_LESSON: cloud -->

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

<!-- TOAD_LESSON: dns -->

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

**Checkpoint:** the platform is verified and your domain points to its app
entrance. The servers are ready; the sample named `my-app` has not been deployed yet.

## 3. Publish and deploy your app

<!-- TOAD_LESSON: release -->

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
app on the existing platform. With `platform.example.com` replaced by your
configured child domain, open `https://my-app.platform.example.com/` and
check its page and API. The [first-app guide](FIRST-APP.md) covers the registry,
customization, secrets, updates, and rollback.

## 4. Operate and update

<!-- TOAD_LESSON: evidence -->

```sh
pnpm run observe -- --context my-cloud --app my-app --watch
```

Open the private HTML path the command prints. It shows your selected cloud's
observations, with evidence freshness and gaps. Keep the terminal running to
refresh it. For terminal or agent-readable results:

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

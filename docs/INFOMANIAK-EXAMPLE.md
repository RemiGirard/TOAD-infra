# A complete Infomaniak example: from account to monitored app

We will put a small app named **hello** at **https://hello.platform.example.com**.
You will see where its name, IP addresses, servers, HTTPS and running copies
come from, then open the same monitoring interface shown on TOAD's site.

This recipe follows **TOAD's current complete three-manager workflow**.
Infomaniak also supports a much smaller one-server IPv6 architecture; see
[the minimum IPv6 design](#the-minimum-ipv6-design). That TOAD profile still
needs implementation and validation. Do not apply the three-manager command
expecting it to create one server.

All names and addresses below are examples. Use a dedicated domain you control;
`example.com`, `198.51.100.0/24`, `203.0.113.0/24` and `2001:db8::/32` are
documentation values, not deployed resources. Commands run in `openstackV3`.

## 1. Decide what you are building

![DNS returns the public entry address; HTTPS passes through Octavia to Traefik and the hello app. Stored data is a separate choice.](../website/app-map.svg)

| Name or address | In this example | What it does |
|---|---|---|
| Provider project / TOAD context / Heat stack | `my-cloud` | Provider resources / isolated local operator setup / the declared resource group. These names happen to match; they are distinct things. |
| Domain you own | `example.com` | A name and its DNS zone, not a server. Use a dedicated domain for this recipe. |
| Platform child domain | `platform.example.com` | A delegated zone managed by OpenStack Designate. |
| App URL | `https://hello.platform.example.com` | The link your visitor opens. The app name chooses a route, not another VM. |
| App entry IPv4 | `198.51.100.30` | Octavia's floating IP. App DNS points here. |
| Operator entry IPv4 | `198.51.100.20` | Restricted SSH access through manager 1. App DNS does not point here. |
| Router gateway IPv4 | `198.51.100.40` | Outbound networking for private servers; also billable. It is not the app URL. |
| Server addresses | `10.0.0.20`, `.21`, `.22` | Internal addresses of the three managers. Visitors do not connect to these. |
| App internal port | `3000` for this Node example | Traefik forwards to this container port. You do not open it publicly. |

One visit works like this:

1. The browser asks DNS for `hello.platform.example.com` and gets the app entry IP.
2. It connects to that IP on HTTPS port 443. DNS is a lookup, not a traffic proxy.
3. Octavia passes the connection through Swarm to Traefik. TLS terminates at
   Traefik, which chooses the `hello` service from the hostname/path.
4. A running app copy returns a page or API result. This sample needs no database.

The maintained platform has three managers, one Traefik replica and explicit
local-data availability limits. See [architecture](ARCHITECTURE.md).

## 2. Create account and project access

1. Create or reuse an [Infomaniak customer account](https://www.infomaniak.com/en/support/faq/2232/create-an-infomaniak-account).
   Verify your email and select the organization that should own the resources.
2. Activate Public Cloud using the **Sign Up** link in
   [the official getting-started guide](https://docs.infomaniak.cloud/getting_started/).
   Review billing, payment and terms yourself. An agent can guide the screens;
   you complete passwords, verification, payment and final account agreements.
3. [Create or reuse a project](https://docs.infomaniak.cloud/getting_started/first_project/create_a_project/).
   Projects span regions; choose the deployment region when downloading access
   and creating resources. Keep it consistent throughout the recipe.
4. Create a dedicated OpenStack user. Its generated `PCU-…` login is separate
   from your customer login. The current Heat trust workflow needs a
   password-authenticated service user.
5. [Download that user's cloud configuration](https://docs.infomaniak.cloud/getting_started/first_project/connect_project/)
   for the intended region. Keep it private; never paste it into chat.

The [account guide](CLOUD-ACCOUNT.md) explains the current billing checks and
the difference between customer accounts, service users and local contexts.
Creating access does not create TOAD servers.

## 3. Prepare the operator machine

Install the [quickstart prerequisites](QUICKSTART.md#1-prepare-your-operator-context),
including Node 22, pnpm, Python/venv, Docker Buildx, OpenSSH, OpenSSL and age.

```sh
git clone https://github.com/RemiGirard/TOAD-infra.git
cd TOAD-infra/openstackV3
pnpm install --frozen-lockfile
pnpm run doctor -- --json
pnpm run cloud -- init my-cloud
```

Place the downloaded configuration in
`contexts/my-cloud/credentials/clouds.yaml`, restricted to your operator user.
Then run:

```sh
pnpm run setup
pnpm run doctor -- --cloud --json
pnpm run discover
pnpm run os -- availability zone list --compute
```

`setup` requests a missing service-user password without echoing it.
`discover` lists resource choices and compute quota; review network, load-balancer
and DNS quotas separately. Authentication alone does not establish readiness.

## 4. Choose capacity, domain ownership and credentials

Use the [provider calculator](https://www.infomaniak.com/en/hosting/public-cloud/calculator)
and [cost worksheet](COSTS.md). Three managers do not require the large instance
used by older price examples. Smaller sizes need workload and monitoring tests;
there is no measured minimum full-stack flavor yet.

Run the guided configuration:

```sh
pnpm run cloud -- configure
```

Supply these decisions from the actual project:

| Prompt | Example / choice |
|---|---|
| Flavor | A capacity-reviewed flavor from `discover`; `a2-ram4-disk20-perf1` is a smaller candidate, not a validated minimum. |
| Immutable image | The actual Ubuntu image UUID returned by your project, not a mutable image display name. |
| Public network | `ext-floating1` for this maintained IPv4 profile. |
| Manager availability zones | Actual available zones, commonly `az-1`, `az-2`, `az-3`; verify them in the chosen region. |
| Platform child domain | `platform.example.com` |
| Parent domain | `example.com`, dedicated to this platform |
| Certificate and DNS email | An email you control |

**Review DNS ownership before applying.** Current TOAD updates the parent
domain's apex `@` and wildcard `*` A records as well as its child zone.
That can move an existing website. This example assumes a dedicated domain;
do not aim it at an active domain without reviewing those exact changes.
Mail and unrelated records are preserved. The one-time child NS delegation
is manual.

Create an Infomaniak API token restricted to `dns:read` and `dns:write`, then
enter it in the private, non-echoing prompt:

```sh
pnpm run dns-token
pnpm run context -- current --json
pnpm run check
pnpm run doctor -- --for cloud-apply --cloud --json
pnpm run cloud -- plan my-cloud --json
```

Review the selected context, three managers, load balancer, domain ownership,
costs and target stack with the human. The plan changes nothing and is not a
provider quote. Continue only after approval of the actual resource/DNS plan.

## 5. Create the platform and finish DNS

```sh
pnpm run cloud -- apply my-cloud
```

This creates billable resources. It provisions networking, servers, the public
entry and child DNS zone, then configures Swarm, Traefik, certificates and
monitoring. The operator SSH rule is restricted to the workstation's public
IPv4 `/32`. It does not open SSH to everybody.

On a first run, a DNS-waiting result is expected while delegation is missing.
Keep the stack; do not deploy another one to retry. Read the child nameservers:

```sh
pnpm run os -- recordset list platform.example.com.
```

In **Infomaniak Manager → domain → DNS zone**, add NS records named `platform`
using the **actual Designate nameservers** printed for your child zone. This
tells DNS where to look up names below `platform.example.com`.
Then resume and verify:

```sh
pnpm run cloud -- resume my-cloud
pnpm run verify -- my-cloud --json
pnpm run os -- stack output show my-cloud lb_floating_ip -f json
pnpm run os -- stack output show my-cloud ssh_floating_ip -f json
```

Those outputs supply your actual entry addresses. The example `198.51.100.30`
is not a value to copy into DNS. The child apex/wildcard A records point to
the load balancer; a new app normally uses that wildcard rather than needing
another public IP. Continue when platform verification passes.

For an existing platform, preserve its original admin CA and operator bundle.
Missing access must be restored from escrow, not solved by replacing trust.

## 6. Publish hello and open its URL

Authenticate Docker to a registry you control using its normal credential
manager. The first image should be publicly pullable, or node-side private
registry access must already be configured. Replace `YOUR-OWNER` below.

```sh
pnpm run app -- create hello --template node-web
# Edit ../apps/hello/source/ and its build allow-list.
pnpm run app -- publish hello --image ghcr.io/YOUR-OWNER/hello:v1
pnpm run check
pnpm run app -- validate hello
pnpm run app -- deploy hello
pnpm run app -- diagnose hello --json
```

Open `https://hello.platform.example.com` and test the app's page and API.
Publishing packages the app into an image and pins its digest; deploying runs
that image on the existing servers. The diagnosis should show the requested
image running, converged copies and passing declared HTTPS checks. These do
not replace application-specific tests.

For your own existing repository, use the [existing-app recipe](FIRST-APP.md#bring-an-existing-app)
instead of substituting this sample. An app needing uploads or a database
must declare storage and backup/recovery policy before deployment.

## 7. Open the control room and follow an update

```sh
pnpm run observe -- --context my-cloud --app hello --watch
```

Open the private HTML path printed by the command. Keep this terminal running
to refresh observations. It is the same interface as the website's example,
now filled from your selected context:

- **Overview:** reachable managers, running copies, endpoint checks, server details.
- **Applications:** requested versus running image, rollout state and HTTPS results.
- **Signals:** monitoring targets, alerts, gaps and protected dashboard links.
- **Agent activity:** the local operation and its recorded stages.

The route drawing explains the architecture; it does not discover every DNS
record, public IP, gateway or placement edge. Server details show Swarm's
advertised addresses. Missing evidence stays unknown, and snapshots expire
after one minute. Keep the export private. Outbound alerts and offsite backups
still need a destination and an actual delivery/restore test.

For an app update, publish a new version, validate, deploy and diagnose again.
If it rolls back, a healthy old version is recovery, not successful delivery
of the requested new one. Inspect Applications and logs before another action.

## The minimum IPv6 design

Infomaniak's [network guide](https://docs.infomaniak.cloud/network/network_setup_guide/)
documents `ext-v6only1` with free public IPv6. A VM connected directly to it
can avoid the private router, floating IPv4 and Octavia resources above.
The [configured calculator estimate](https://www.infomaniak.com/en/hosting/public-cloud/calculator?uuid=e28f426f-242e-4ce6-8242-09d9ba3fe754)
quotes **€4.21/month**, excluding VAT, for one Linux VM with 1 vCPU, 2 GB RAM
and 20 GB disk at 730 hours, with no optional storage, IPv4 or load balancer.
This is a provider estimate, not a measured TOAD bill.

The intended simple route is **app name → AAAA lookup → the server's IPv6 →
HTTPS gateway → app**. It has one failure point. Operators and visitors need
IPv6 reachability; IPv4-only visitors need an additional dual-stack edge or IPv4.

**TOAD does not yet implement or validate that complete profile.** Required work
includes IPv6 Heat/security rules and SSH bootstrap, AAAA DNS, Docker ingress
and outbound dependency checks, lighter monitoring, one-node verification and
restart/recovery acceptance. Do not relabel the current IPv4 Heat-only
experiment as this profile. See [costs and growth](COSTS.md).

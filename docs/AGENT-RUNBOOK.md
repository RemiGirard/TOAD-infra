# Agent runbook

TOAD is designed to be operated by a person and their coding agent together.
The agent inspects structured evidence, proposes a bounded action, uses the
human's authorization, verifies the actual result, and explains what changed.
Commands run from `openstackV3` unless stated otherwise.

## Start from the app you are building

Open your application's repository and give your coding agent a short
[request](../website/agent-prompt.txt), also available as
[plain text on the project site](https://toad.remigirard.dev/agent-prompt.txt).
It names TOAD-infra and links its repository, so the agent can read the current
instructions instead of assuming it already knows the tool. The workflow is
defined by TOAD's `AGENTS.md` and this runbook; the user does not need to copy
those instructions into their request.

Inspect the actual app, reuse existing operator setup where available, and
explain requirements and costs if a new platform is needed. Use the
[complete Infomaniak example](INFOMANIAK-EXAMPLE.md) to connect the project,
DNS, public/private addresses, app URL and observation interface.
The user does not need to invent app or context names before
starting the conversation. Keep application source in your existing repository;
the [first-app guide](FIRST-APP.md) covers adding TOAD metadata there.

## Guide account setup, then resume

Do not assume the user knows infrastructure terms. Use
[Your app explained](UNDERSTAND.md) to sketch their proposed browser-to-app
route, explain the address people will open, and show the result of each
setup stage. Separate DNS lookup from website traffic, and planned topology
from observed checks. Explain the ongoing ownership and hosted-platform
alternative before a user commits to operating servers.

For a user without cloud access, start with [Account and access](CLOUD-ACCOUNT.md).
Check for an existing customer account, organization and suitable project
before creating anything. Explain the difference between the customer login,
OpenStack service user and local TOAD context.

With authorized browser access, navigate official provider pages and help
prepare ordinary form fields. Hand over passwords, provider-required
verification, payment, final account agreements and approval of new access to
the human. Without browser access, provide the precise links and instructions.
After the hand-off, check the resulting state and resume the local setup;
missing evidence is not proof of account activation or project access.

TOAD currently automates infrastructure after account access is prepared; it
does not provide account registration or billing integration. OpenStack is
the underlying API family, while Infomaniak is the verified production path.
Use the [compatibility checklist](CLOUD-ACCOUNT.md#using-another-openstack-cloud)
for another provider and disclose unverified assumptions before provisioning.

## Give your agent a concrete job

Use the agent's terminal and file access to your local TOAD checkout and
operator context. Keep credentials in that environment. The same CLI and
private operation view provide evidence for you and your assistant.

| Your goal | Copyable prompt | Expected result |
|---|---|---|
| Put the app online | [Deployment](../website/agent-prompt.txt) | Inspect the app, review setup and costs, then verify the approved deployment. |
| Check an existing deployment | [Health check](../website/agent-health-prompt.txt) | A read-only report on images, replicas, HTTPS and evidence freshness. |
| Understand a failed release | [Debugging](../website/agent-debug-prompt.txt) | Read-only investigation, supporting evidence and a proposed fix for review. |

The health and debugging prompts do not authorize production changes. A
passing endpoint or recovered old image does not prove a new release shipped.

## Discover commands and make the target explicit

```sh
pnpm run capabilities -- --json
pnpm run doctor -- --for app-deploy --context my-cloud --json
pnpm run operation -- status --context my-cloud --json
pnpm run observe -- --context my-cloud --app my-app --json
```

`--context NAME` selects only this invocation and never changes the saved
context. `--project DIR` selects an existing application repository. You can
also invoke `node /path/to/TOAD-infra/toad.mjs` from that repository, without
moving source into TOAD. Read `COMMAND --help` for supported options. Unknown
options fail before a lock, state write or remote operation; there is no
implicit `--dry-run` mode.

For the person supervising an agent, [open the private operation view](OBSERVABILITY.md).
It combines topology, exact releases, checks, metrics and local operation
stages. The public site contains examples, not private live infrastructure.

The default doctor checks workstation health only. Use `--for cloud-apply`,
`app-publish`, or `app-deploy` when deciding whether that action is ready.
`cloud plan --json` is a read-only configuration review, not a provider-side
Heat change-set or a price quote.

JSON output is versioned and failures set a nonzero exit code. Sensitive
remote failure text stays outside structured output. Use local trusted logs
when diagnosis identifies a failure that requires deeper inspection.
Missing monitoring access remains an evidence gap. Do not infer permission,
health, or successful recovery from missing data.

## Diagnose before changing anything

```sh
pnpm run doctor -- --json
pnpm run maintenance -- status --json
pnpm run verify -- toad-prod --json
pnpm run app -- diagnose APP --json
```

These commands are read-only and produce parseable JSON. Do not ask for or
display credential contents when a check reports that a credential file is
missing. A useful diagnostic report contains the failed check ID, service,
desired/running replicas, endpoint status, task error, and proposed next action.

## Deploy a new service

```sh
pnpm run app -- create APP
pnpm run app -- validate APP
pnpm run app -- deploy APP
pnpm run app -- diagnose APP --json
```

Before deployment, review the generated `apps/APP/toad.yaml` and Compose file.
Use an immutable image digest. The validator must continue to
enforce Traefik-only ingress, rollback, memory limits, `no-new-privileges`, and
the restricted stateful-volume contract. A deployment is complete only when the service spec and running-task image
digests match the requested release, replicas converge, update state permits
success, and every declared HTTPS check passes. An automatic rollback to an
old healthy version is reported as a failed delivery of the new release.

## Investigate an unhealthy application

1. Run `app diagnose APP --json`.
2. If replicas are missing, use `app logs APP [SERVICE]` and the reported
   failed-task error. Fix the manifest or image before redeploying.
3. If replicas are healthy but HTTPS fails, inspect the host rule, declared
   container port, `traefik-public` network membership, DNS, and certificate
   resolver.
4. If a new update is bad and the prior service spec is known-good, request
   `app rollback APP [SERVICE]`. Verify the recovered result and review the
   generated Compose patch before the next deployment.
5. Re-run both app diagnosis and the platform verifier.

Do not use `docker service update` for ordinary configuration changes: that
creates runtime state the repository cannot reproduce.

## Stateful services

Before changing a stateful service, identify every manifest volume and its
`backup` policy. Capture required application data with `app backup`; capture
Traefik and monitoring state with `platform backup`. Copy encrypted archives
and the age identity to independent storage. Restore is destructive and must
name exactly one volume, so it requires explicit human authorization.

## Platform maintenance

Use `maintenance status --json` before touching a manager. A rolling reboot is
permitted only with three healthy, reachable managers and processes followers
before the leader. A failure intentionally leaves the affected node drained.
Never improvise a second simultaneous manager outage.

The complete reconcile path is:

```sh
pnpm run apply -- toad-prod
```

It may create or update billable cloud resources and DNS, so confirm the stack
and environment file with the human first. `destroy`, volume restore, PKI
rotation, and parent-DNS changes always require exact, explicit authorization.

## Acceptance evidence

For a normal application change, retain `check`, application diagnosis, and
endpoint results. For platform work, also retain Heat status, Octavia member
health, Swarm manager readiness, monitoring target/rule counts, public TLS
checks, and proof that unauthenticated admin requests are rejected. Redact host
identifiers when the report will leave the client organization.

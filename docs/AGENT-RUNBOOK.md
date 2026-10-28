# Agent runbook

TOAD is designed to be operated by a person and their coding agent together.
The agent inspects structured evidence, proposes a bounded action, uses the
human's authorization, verifies the actual result, and explains what changed.
Commands run from `openstackV3` unless stated otherwise.

## Start from the app you are building

Open your application's repository in your coding agent and paste the
[starter prompt](../website/agent-prompt.txt), also available as
[plain text on the project site](https://toad.remigirard.dev/agent-prompt.txt).
It names TOAD-infra and links its repository, so the agent can read the current
instructions instead of assuming it already knows the tool.

The prompt asks the agent to inspect your actual app, reuse existing operator
setup where available, and explain the requirements and costs if you need a
new Infomaniak platform. You do not need to invent app or context names before
starting the conversation. Keep application source in your existing repository;
the [first-app guide](FIRST-APP.md) covers adding TOAD metadata there.

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

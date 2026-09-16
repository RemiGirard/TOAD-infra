# Agent runbook

This runbook gives a person or automation a safe, evidence-first path through
TOAD. Commands run from `openstackV3` unless stated otherwise.

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
the restricted stateful-volume contract. A deployment is complete only when
the service converges and every declared HTTPS check passes.

## Investigate an unhealthy application

1. Run `app diagnose APP --json`.
2. If replicas are missing, use `app logs APP [SERVICE]` and the reported
   failed-task error. Fix the manifest or image before redeploying.
3. If replicas are healthy but HTTPS fails, inspect the host rule, declared
   container port, `traefik-public` network membership, DNS, and certificate
   resolver.
4. If a new update is bad and the prior service spec is known-good, request
   `app rollback APP [SERVICE]`.
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
pnpm run apply -- toad-prod heat/env/production.yaml
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

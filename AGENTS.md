# Agent operating contract

TOAD is a TypeScript-operated, Heat-provisioned, Ansible-configured Docker
Swarm platform for Infomaniak Public Cloud. Terraform is intentionally outside
scope. Read `README.md`, `SECURITY.md`, and `docs/AGENT-RUNBOOK.md` before making
infrastructure changes.

## Start from a short request

A user may ask only “Use TOAD-infra to put this app online” and supply the
repository URL. The operating context belongs here, not in a long user prompt.
Read `README.md` and `docs/AGENT-RUNBOOK.md`, inspect the user's app, and reuse
an existing checkout, operator context and verified platform when suitable.
Keep the user's application source in its own repository.

For a first deployment, follow `docs/INFOMANIAK-EXAMPLE.md`. Explain the plan
using the user's app name, URL, DNS lookup, public/private IPs, running app and
monitoring view. Identify account/tooling gaps, costs and persistent data.
Guide missing account access through `docs/CLOUD-ACCOUNT.md`; credentials stay
in private provider/local interfaces. Show the target and resource/DNS changes
and obtain the human's approval before provisioning, publishing or deploying.
Existing explicit authorization remains valid for its stated scope.

Treat health-check and failed-release investigation requests as read-only.
Use diagnostics and the private operation view, report evidence freshness and
gaps, and propose a repair before changing the deployment. After an approved
release, verify the requested image, replicas and declared HTTPS checks;
an automatic rollback to an old version does not count as shipping the new one.

## Safety

- Never print, summarize, upload, or commit anything under a `credentials/`
  directory, `router/config.yaml`, `heat/env/production.yaml`, generated
  inventories, private keys, passwords, tokens, or decrypted secret content.
- Treat Docker socket access and Swarm manager access as root-equivalent.
- Do not destroy a Heat stack, restore a volume, reboot a node, rotate a CA, or
  change parent DNS unless the human explicitly requested that exact action and
  target. Resolve targets with read-only commands first.
- Preserve unrelated worktree changes. Do not stage, commit, or push unless the
  human asks.
- Prefer the TypeScript CLI. Do not add shell or Python orchestration when the
  operation can be expressed safely with argument-array process execution.

## Required workflow

1. Run `pnpm run doctor -- --json` from `openstackV3` for local diagnostics.
2. Run `pnpm run check` before any deployment.
3. For applications, run `pnpm run app -- validate NAME`, then deploy, then
   `pnpm run app -- diagnose NAME --json`.
4. For platform changes, use the narrowest playbook or the full declarative
   `apply` path, followed by `pnpm run verify -- STACK --json`.
5. Report exact checks and replica counts without including secrets.

Application manifests are the source of truth. Do not bypass their file
allow-list, immutable secret naming, resource constraints, rollback policy, or
stateful-volume backup declaration to make a deployment pass.

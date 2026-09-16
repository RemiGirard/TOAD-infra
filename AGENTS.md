# Agent operating contract

TOAD is a TypeScript-operated, Heat-provisioned, Ansible-configured Docker
Swarm platform for Infomaniak Public Cloud. Terraform is intentionally outside
scope. Read `README.md`, `SECURITY.md`, and `docs/AGENT-RUNBOOK.md` before making
infrastructure changes.

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

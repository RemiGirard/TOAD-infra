# TOAD OpenStack CLI

The TypeScript CLI manages Infomaniak Public Cloud through the official
OpenStack clients installed in a project-local Python virtual environment. It
does not use Terraform and does not install global Python packages.

## Setup

```sh
pnpm install --frozen-lockfile
cp heat/env/example.yaml heat/env/production.yaml
pnpm run setup
pnpm run doctor -- --cloud
pnpm run discover
```

The production environment file is intentionally ignored because it contains
operator- and client-specific values such as the SSH source CIDR. Credentials,
the generated SSH key, and `inventory.yaml` are also ignored.

## Commands

| Command | Purpose |
|---|---|
| `pnpm run apply -- STACK ENV` | Create/update Heat, configure Swarm, deploy, verify |
| `pnpm run verify -- STACK --json` | Read-only machine-readable production checks |
| `pnpm run doctor -- --json` | Diagnose local prerequisites without cloud access |
| `pnpm run doctor -- --cloud` | Diagnose and authenticate to the project |
| `pnpm run admin-pki -- issue NAME [DAYS]` | Issue an admin mTLS client identity |
| `pnpm run app -- create NAME` | Scaffold a manifest-driven Swarm service |
| `pnpm run app -- deploy NAME` | Validate, deploy, show status, and check HTTPS |
| `pnpm run app -- status NAME` | Show the application's current replicas |
| `pnpm run app -- diagnose NAME --json` | Return structured health, checks, task failures, and hints |
| `pnpm run app -- logs NAME [SERVICE]` | Read recent service logs |
| `pnpm run app -- rollback NAME [SERVICE]` | Roll back one or all app services |
| `pnpm run app -- remove NAME` | Confirm and remove only the app stack |
| `pnpm run app -- secret ...` | Manage age-encrypted application secrets |
| `pnpm run maintenance -- status --json` | Inspect Swarm readiness and quorum |
| `pnpm run maintenance -- rolling-reboot` | Guard, drain, reboot, and rejoin managers one at a time |
| `pnpm run maintenance -- refresh-ssh-access STACK` | Restrict manager SSH to the current operator IPv4 `/32` |
| `pnpm run context -- create NAME` | Scaffold isolated state for another client |
| `pnpm run context -- use NAME` | Select a client context for later commands |
| `pnpm run probe -- --json` | Run public TLS/HTTP checks without cloud credentials |
| `pnpm run platform -- backup [DATASET]` | Stream an age-encrypted platform-volume backup off the manager |
| `pnpm run platform -- verify --from INDEX --json` | Verify backup checksums, decryption, and archive structure offline |
| `pnpm run platform -- restore DATASET --from FILE` | Guard and restore exactly one platform volume |
| `pnpm run deploy -- 5 STACK ENV` | Heat-only interactive deployment |
| `pnpm run inventory -- STACK` | Regenerate Ansible inventory from Heat outputs |
| `pnpm run status` | List stack/server/network status |
| `pnpm run ssh` | Connect to a node |
| `pnpm run destroy -- STACK` | Confirm and delete exactly one Heat stack |
| `pnpm run os -- ARGS...` | Safe argv passthrough to the local OpenStack CLI |

Supported infrastructure profiles are `1` (one development manager) and `5`
(three managers, Octavia, and Designate). Profile 5 is the maintained production
path. See [SETUP.md](SETUP.md) and [operations](../docs/OPERATIONS.md).

## Client contexts

The existing repository-local files remain the `legacy` context, so enabling
this feature does not move or reinterpret a working installation. Scaffold a
new client without copying another client's secrets:

```sh
pnpm run context -- create acme-prod
pnpm run context -- use acme-prod
pnpm run context -- current --json
```

Customize `contexts/acme-prod/router/config.yaml` and
`contexts/acme-prod/heat/production.yaml`, then add only that client's files to
`contexts/acme-prod/credentials/`. Inventory and backups are written inside the
same ignored context directory. `context clear` returns to the legacy paths.

Every state-changing command obtains `.operation.lock` inside the selected
context. A second local process or agent is refused while the first mutation is
running; read-only status, verification, logs, and backup verification remain
available. In automation, set `TOAD_CONTEXT` explicitly instead of relying on
the active-context file. Never share one context between unrelated OpenStack
projects or clients.

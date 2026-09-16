# Contributing

TOAD keeps cloud resources in Heat, machine configuration in Ansible, workload
contracts in Compose plus `toad.yaml`, and operator behavior in TypeScript.
Avoid adding a second source of truth or committing generated credentials,
inventories, environment files, backups, or browser certificates.

By submitting a contribution, you certify that you have the right to provide
it and agree that it is licensed under the project's
GNU AGPL-3.0-or-later license. No additional contributor agreement is required.

Before opening a pull request:

```sh
cd openstackV3
pnpm install --frozen-lockfile
pnpm run check
pnpm run check:ansible
cd ..
docker build --tag toad-operator:test .
```

Run Ansible syntax checking for every changed playbook. Infrastructure changes
should include a machine-readable `verify --json` check where practical.
Application examples must pass `pnpm run app -- validate NAME`, pin immutable
image digests, declare rollback and resources, and document whether each volume
requires backup.

Never use live customer infrastructure as an unannounced test target. For
changes that affect creation or destruction, record the exact stack name,
review the Heat resource list, exercise a disposable stack, and preserve the
acceptance output without secrets. Keep commits narrow enough that an operator
can understand and reverse the change.

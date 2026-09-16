# Disaster-recovery proof

TOAD treats reproducible infrastructure, credentials, and workload data as
three separate recovery inputs. Heat plus Ansible rebuild the infrastructure;
the encrypted operator escrow restores identities and tokens; application and
platform archives restore state. A Swarm Raft snapshot is optional acceleration,
not the primary recovery mechanism.

## What “proved” means

A backup is not proved merely because a command produced a file. Evidence must
cover four progressively stronger claims:

1. **Integrity:** the encrypted file still matches the recorded SHA-256.
2. **Decryptability:** the escrowed age identity can decrypt it.
3. **Archive validity:** the decrypted tar stream can be enumerated without
   writing its contents to disk.
4. **Service recovery:** a fresh, isolated cluster serves the restored data and
   passes application-specific checks.

The first three are safe to automate on every backup:

```sh
cd openstackV3
pnpm run platform -- backup --yes
pnpm run platform -- verify --from ../backups/platform/TIMESTAMP/index.json --json
```

The verification command is offline and non-destructive. It checks the index,
prevents archive path traversal, recalculates every encrypted checksum, decrypts
each stream, and asks `tar` to inspect its structure. It never restores a volume.

## Disposable recovery drill

Run the service-recovery proof quarterly and before claiming a new backup path
is production-ready. It must use a named disposable context, a dedicated Heat
stack, an isolated DNS zone, and either a separate OpenStack project or clearly
prefixed resources. Never reuse the production root domain.

The drill is:

1. Record the target RPO and RTO and the exact backup index being tested.
2. Create and select a context dedicated to the drill.
3. Rebuild three nodes, Swarm, Traefik, and the application manifests using the
   ordinary `apply` path.
4. Verify the empty cluster before introducing recovered data.
5. Restore one exact dataset while its owning service is stopped.
6. Run the normal production verifier plus application-specific assertions.
   For a database this includes logical queries, not merely an HTTP 200.
7. Record timestamps, archive hashes, version identifiers, replica counts, and
   any manual action. Do not record credentials or decrypted content.
8. Destroy only the explicitly named drill stack after human authorization.

The live `toad-prod` stack is not a valid drill target. Restoring over it proves
that production can be damaged, not that disaster recovery works.

## Recovery objectives

Each client profile should declare:

- **RPO:** maximum acceptable age of recovered data;
- **RTO:** maximum acceptable time until service is usable;
- backup schedule and retention;
- archive destination and independent failure domain;
- application-consistency method;
- responsible person and escalation path.

TOAD's volume tar stream is appropriate for services that can be quiesced. A
database should normally use its logical or physical backup protocol (for
example a PostgreSQL dump or WAL workflow), then encrypt that output. Copying a
live database volume is not automatically application-consistent.

## Optional cold Raft backup

A cold backup of `/var/lib/docker/swarm` can preserve Swarm control-plane state,
but it requires stopping Docker and preserving the unlock key and compatible
Docker version. It is therefore a secondary recovery option. TOAD should add it
only after a disposable restore has demonstrated the complete stopped-manager,
version-compatibility, and quorum procedure. Manifests plus a clean Swarm rebuild
remain easier to audit and more portable.

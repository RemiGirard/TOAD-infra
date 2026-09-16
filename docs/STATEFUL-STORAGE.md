# Stateful storage profiles

Swarm scheduling and storage durability are different concerns. A replica can
be rescheduled automatically, but its data is available only if the replacement
node can reach the same storage or restore a backup.

## Decision table

| Profile | Suitable for | Node loss | Availability | Complexity |
|---|---|---|---|---|
| Local pinned volume + encrypted backup | Small sites, caches, low-change internal tools | Restore latest archive to a replacement node | Single service instance; recovery downtime | Low |
| Cinder block volume + app-consistent backup | Important single-writer filesystems and databases | Reattach the surviving volume or restore its backup | Storage survives VM replacement; service still has attach/failover time | Medium |
| Object storage | Uploads, documents, media, artifacts, backup archives | Application reconnects to the object endpoint | Decoupled from Swarm nodes | Medium; application must support object APIs |
| External database | Business-critical relational data | Database topology handles persistence/failover | Independent of Swarm application nodes | Medium to high; another service to operate or purchase |
| Shared filesystem | Legacy applications requiring a shared POSIX tree | Depends on shared-filesystem backend | Multiple nodes can mount the same namespace | High; locking, latency, and failure semantics require testing |
| Self-hosted distributed storage | Large dedicated clusters with storage expertise | Replication across storage nodes | Potentially high | Very high; not appropriate for three minimal managers |

## Recommended tiers

### Tier 0: stateless

Keep all durable data outside the container. Run multiple replicas freely.
This remains TOAD's preferred application shape.

### Tier 1: simple recoverable state

Use the existing local-volume contract: one replica, an explicit node label,
resource limits, encrypted backups, and a tested restore. It is inexpensive and
honest about downtime. Choose it when the declared RPO/RTO permits rebuilding a
node and streaming an archive back.

### Tier 2: durable single-writer state

Use an OpenStack Cinder volume managed by Heat, format and mount it by stable
volume ID, constrain the Swarm service to its attached node, and retain a
separate application-consistent backup. Cinder removes dependence on a VM's
local filesystem, but it does not make a single-writer service magically
active-active. Failover still requires fencing, detach/attach, mount, and health
verification. Snapshots are useful, but should not be the only backup copy.

### Tier 3: highly available business state

Move state outside the three minimal managers: use a dedicated database
topology or service and object storage for blobs. Keep the Swarm tier disposable.
This costs more but is the clearest boundary for client data with strict RPO/RTO.

## Planned implementation order

1. Add a manifest field such as `persistence.profile` with `local`, `cinder`,
   `object`, or `external` rather than guessing from Compose.
2. Implement Cinder as a separate Heat-backed profile with volume ID, filesystem,
   mount point, node constraint, backup policy, and explicit detach/attach guards.
3. Add application-specific backup hooks so databases can quiesce or emit a
   logical backup instead of archiving live files.
4. Exercise node-loss and fresh-cluster restoration on a disposable stack.
5. Promote a profile to supported only after documenting measured RPO/RTO and
   failure behavior.

Do not install Ceph, Longhorn, or another distributed storage control plane on
the existing three small Swarm managers merely to remove a documented restore
step. That would combine quorum, compute, and storage failures in the same
minimal nodes and materially increase the maintenance burden.

# Disposable recovery drill awaiting authorization

No drill resources have been created. A read-only OpenStack lookup on
2026-10-27 confirmed that `toad-drill-source` and `toad-drill-recovery` do not
already exist.

## Exact proposed scope

- Two separate operator contexts and Heat stacks: `toad-drill-source` and
  `toad-drill-recovery`, each using the maintained three-manager profile.
- A synthetic application named `proof`, with only stack-owned volume
  `proof_data`. It contains generated demonstration records, no client data.
- Dedicated drill DNS below `drill.toad.remigirard.dev`; any necessary NS
  delegation must be reviewed and authorized by exact record before creation.
- Capture and verify an encrypted backup on the source stack. Restore only
  `proof_data` on the fresh recovery stack, then verify the known record count
  and checksum through the application.
- Record cloud/image versions, hashes, replicas, required manual actions,
  actual data age, and elapsed recovery time. Run the ordinary verifier.
- Delete only those two drill stacks after their exact deletion is authorized.
  Never restore to or destroy `toad-prod`.

## Before running

Confirm the temporary cloud budget and quota, selected flavor, domains, isolated
contexts, backup/identity escrow, and cleanup authorization. Two production-shaped
stacks temporarily use six managers, two load balancers, and four reserved IPv4s.
The [cost worksheet](COSTS.md) is illustrative, not the drill's final quotation.

The exact destructive permissions needed are volume restore on the recovery
stack and deletion of both named drill stacks. Parent-zone changes also require
the exact record approval. This plan grants none of those permissions itself.

Until the drill is actually completed, the launch record continues to mark
fresh-cluster service recovery as pending.

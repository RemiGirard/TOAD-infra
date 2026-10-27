# Offsite backup and notifications

The backup job is prepared, not automatically enabled. Its destination and
notification endpoint must belong to the intended client. No offsite destination
or webhook was configured in the reviewed operator checkout on 2026-10-27.
Related application deployment records also reference local encrypted archives;
they do not establish an independent storage destination or alert receiver.

## Configure the operator host

Use an independent, always-on operator host with the intended TOAD context,
Node.js, installed operator dependencies, age, OpenSSH, tar, and rclone.
Do not copy a client's runtime state into a shared client context. The job
calls the configured operator CLI, so its existing SSH access mode is retained.

Copy `ops/backup-policy.example.json` to a protected operator location. Set an
explicit context (or `legacy` for the existing repository-local context), an
encrypted-output directory, an rclone configuration, an independent-storage
remote, and an HTTPS JSON-webhook file. Keep the rclone and webhook files mode
0600 and out of Git. Configure rclone using its own secret input workflow.

```sh
pnpm run backup-job -- plan --policy /etc/toad/backup-policy.json
pnpm run backup-job -- notify-test --policy /etc/toad/backup-policy.json
```

The test sends a small delivery-test event to the configured endpoint. Confirm
receipt at the intended destination before enabling the schedule. A generic
webhook must accept JSON; provider-specific email/chat formats need a compatible
receiver or adapter.

## Run and verify

```sh
pnpm run backup-job -- run --policy /etc/toad/backup-policy.json --accept-service-interruptions
```

The job requires three ready managers and working offsite access before capture.
It briefly quiesces each platform service, captures age-encrypted archives,
checks local hashes/decryption/archive structure, transfers only ciphertext and
its index, and downloads the remote objects for comparison. It sends a success
or failure event and retains local results. Overlapping jobs are refused. No
remote or local retention deletion is performed.

This covers platform datasets. Application databases need their own consistent
backup method and schedule; a live volume tar is not a database-consistency
guarantee. A copy/check result does not prove fresh-cluster service recovery.

## Schedule after the first verified run

`ops/toad-backup.service` and `.timer` are Linux systemd examples. Adjust the
operator user, Node path, working directory, and protected policy path. Install
and enable them only on the intended operator host after reviewing the daily
03:00 UTC maintenance window and verifying a complete run. Do not put the only
offsite job inside the same Swarm failure domain. A sleeping laptop is not a
reliable scheduled-backup host.

The timer does not run a missed job at host startup. The service deliberately
has no forced runtime/stop timeout: a stop request lets an in-progress capture
finish and restore service replicas before exiting. Keep its `KillMode=mixed`
and signal handling together; forced termination or loss of the operator host
during capture still requires checking and restoring the affected service.

Document storage retention, access policy, the independent age-identity escrow,
RPO/RTO objectives, and the person receiving alerts. Exercise the separate
[recovery drill](DISASTER-RECOVERY.md) before claiming application recovery.

# Launch validation record

Updated 2026-10-28. This page separates implementation, local checks, recorded
production acceptance, and outstanding live work. No outside-user onboarding
or adoption study has been performed.

## Implemented

- Frontend + Node API starter and cloud-free trial.
- Allow-listed source publication with a returned immutable image digest.
- First-app, update, rollback, encrypted-secret, and CI recipes.
- Separate evaluation/production paths and a dated cost worksheet.
- Public project site with versioned documentation and an illustrative workflow.
- Explicit-URL external probe, response marker, and final HTTPS verification.
- Offsite backup job with local verification, immutable transfer, remote
  download verification, failure notification, and a systemd timer example.

The backup job is not scheduled yet: the operator must choose an independent
storage destination, notification endpoint, and always-on operator host. See
[backup automation](BACKUP-AUTOMATION.md).

## Recorded production evidence

The [operations acceptance record](OPERATIONS.md#acceptance-record) describes
the September 2026 Infomaniak destroy/rebuild, three-manager quorum, public TLS,
monitoring, and Loki volume backup/restore. These are historical results, not
a claim that all services are healthy now.

## New validation

Verified on 2026-10-27:

- Main checkout: TypeScript, 30 YAML files, five manifests, and 35 unit tests passed.
- Configured operator checkout: its required check passed, including 33 tests.
- Starter container built for linux/amd64, ran as `node`, and reported healthy.
- Three Swarm managers were ready and reachable.
- `toad-landing`: 2/2 replicas; site and first-app guide HTTPS checks returned 200.
- `toad-demo`: 2/2 replicas; frontend and API HTTPS checks returned 200.
- Published version 1.1.0 through the new source/image workflow. A deliberately
  failing health-check update on this demo reached `rollback_completed`; the
  known-good manifest was restored and redeployed.
- The external site probe passed with the TOAD-specific body marker over HTTPS.
- Chrome verified the live site and starter, documentation, and the cost
  calculator; the landing layout was also checked at 390 CSS pixels.

These results do not establish fresh-cluster recovery or outside-user onboarding.

## Broader platform verification is incomplete

The full read-only verifier passed 21 checks but could not complete five admin
and monitoring checks because the operator mTLS certificate/key bundle is absent.
No existing bundle was found in the bounded local deployment/worktree search.
Recover the original operator bundle from escrow and verify its CA against the
deployed public client CA. If that cannot be recovered, replacing the trusted
client CA is a separate exact-target authorization; it invalidates existing
admin client identities. No CA was generated or rotated during this launch.

The tracked CLI, workflows, and guides are the source of truth for this launch.
The scheduled GitHub probe checks the public project URL and requires its
TOAD-specific response marker. Consult GitHub Actions for its latest run result.

## Remaining recovery gate

Review the [concrete drill plan](RECOVERY-DRILL-PLAN.md), then run the
[disposable recovery drill](DISASTER-RECOVERY.md) with an isolated
context, stack, project/zone, and exact dataset approved by the operator.
Record a real application data assertion, measured RPO/RTO, offsite backup
verification, and a test notification to the intended operator destination.

The live production stack is not a recovery-drill target. Destruction,
volume restore, CA rotation, node reboot, and parent-DNS changes need exact
target authorization. A published landing page does not satisfy this gate.

## Agent operation and DX validation

Verified locally on 2026-10-28: TypeScript, 30 YAML files, five application
manifests and 50 tests passed. Ansible syntax checks passed for application
transfer and monitoring deployment. Existing-repository initialization preserved
source; validation passed; unsupported deployment flags were rejected before
mutation. The public agent scenarios were checked in the browser, including
rollback, missing evidence, and mobile reflow.

The CLI now checks exact release/task digests, records private operation stages
and worker ownership, retains interrupted locks, generates rollback patches,
and supports guided cloud configuration and DNS resume bound to the original
stack identity and domains. The private operation view exposes evidence gaps
and expiry. Public scenarios contain explicitly labelled example data.

These checks do not establish a new-provider onboarding run, a fresh cloud
provisioning/recovery drill, admin identity recovery, or outbound notification
delivery. The existing recovery and operator-identity gates above still apply.

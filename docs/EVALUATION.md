# Evaluate before committing to production

The normal TOAD workflow is [cloud setup, then app deployment](QUICKSTART.md).
For an optional preview of the example frontend/API, use the
[local starter](LOCAL-STARTER.md); it creates no cloud resources.

## One-manager cloud experiment

Profile `1` creates one manager, a private network/router, and one floating IP.
It is a Heat-only evaluation profile: no production quorum, Octavia,
delegated DNS, monitoring, or complete production `apply` path. The production
verifier expects profile `5` and cannot certify this experiment.

Use a separate context and experiment name. Follow the
[service-user setup](DEPLOYMENT.md), then choose a flavor and immutable image
from `discover`. Set the SSH CIDR to your workstation's public IPv4 `/32`.

```sh
cd openstackV3
pnpm run context -- create toad-eval --use
pnpm run setup
pnpm run doctor -- --cloud
pnpm run discover
pnpm run deploy -- 1 toad-eval PATH-TO-YOUR-EVALUATION-ENV.yaml
```

The environment needs only profile `1` parameters: `flavor`, `image`,
`keypair_name`, `public_network`, and `ssh_allowed_cidr`. Use a dedicated local
environment file, not profile `5`'s DNS/availability-zone parameters. Never
reuse another client's configuration.

This creates billable resources after the deployment confirmation. It does
not change parent DNS. Inspect the exact `toad-eval` stack before requesting
deletion. Stopping a VM does not necessarily stop storage and IPv4 billing.

## Budget and time

The [cost worksheet](COSTS.md) separates one-node and production resources.
Prices depend on your selected flavor and services. Time to first public
deployment has not been measured with outside users; there is no promised
five-minute production setup.

For public app delivery, use the maintained
[production guide](DEPLOYMENT.md), then [First app](FIRST-APP.md).

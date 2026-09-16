# Security policy

## Supported versions

Security fixes are made on the current `main` branch and published as versioned
releases. Production deployments should pin a reviewed release image by digest
and apply updates only after `pnpm run check` and a staging verification pass.

## Reporting a vulnerability

Do not publish credentials, private keys, tenant identifiers, customer data,
or a working exploit in a public issue. Use GitHub's private vulnerability
reporting for this repository when available; otherwise contact the repository
owner privately and share only the minimum reproduction needed. Rotate any
credential that may have been disclosed before sending a report.

Include the affected commit, deployment profile, impact, reproduction steps,
and whether the issue is remotely reachable. The maintainer should acknowledge
the report, coordinate a fix and disclosure date, and publish remediation and
rotation instructions.

## Trust boundaries

- The operator workstation holds OpenStack, DNS, SSH, age, and admin-PKI
  credentials. The OCI image contains none of them; they are mounted at run
  time.
- The cluster receives only public client-CA material and content-addressed
  Docker secrets. It does not receive the admin CA key, age identity, or
  OpenStack credentials.
- A Swarm manager and any process with Docker socket access are root-equivalent.
  Alloy is the only application container allowed that socket by the bundled
  profile and is not routed publicly.
- Admin HTTP interfaces require a short-lived mTLS client certificate. Public
  application routes do not inherit this policy unless their labels explicitly
  select the admin TLS option.
- Named local volumes are single-node state. Their availability is bounded by
  that node; encrypted backups and tested restore procedures provide recovery,
  not synchronous replication.
- GitHub Actions release permissions are minimal, but a published image should
  still be consumed by immutable digest and its keyless signature verified.

Dependabot is configured for pnpm, Python, the operator Dockerfile, every
Compose directory, and GitHub Actions. Dependency pull requests must pass the
same policy tests and should be deployed to a disposable or staging stack
before production reconciliation; digest updates are never auto-deployed.

The application validator rejects privileged containers, host networking,
host PID/IPC, added Linux capabilities, Docker socket mounts, missing
`no-new-privileges`, missing memory limits, images without immutable digests,
and direct published ports. Every application image must include a SHA-256
digest. These checks reduce accidental exposure; they are not a
container sandbox or a substitute for reviewing third-party images.

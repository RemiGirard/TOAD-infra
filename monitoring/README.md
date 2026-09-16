# TOAD monitoring profile

The production apply path deploys a small, fully open-source monitoring stack:

| Component | Purpose | Placement |
|---|---|---|
| Prometheus 3.5 LTS | Metrics, rules, and seven-day local retention | One pinned manager |
| Grafana 13.2 | Read-only, provisioned TOAD dashboard | One pinned manager |
| Alertmanager 0.33 | Alert grouping and silences | One pinned manager |
| Blackbox Exporter 0.28 | Public HTTPS probes | One pinned manager |
| Node Exporter 1.12 | Host CPU, memory, disk, and network | Global |
| cAdvisor 0.60 | Container resource metrics | Global |
| Loki 3.7 | Central log storage with seven-day local retention | One pinned manager |
| Alloy 1.18 | Docker discovery and log shipping | Global |

The public admin interfaces are:

- `https://grafana.<base_domain>/`
- `https://prometheus.<base_domain>/`
- `https://alerts.<base_domain>/`

All three require the same client certificate as the Traefik dashboard. Their
application ports are not published. Grafana permits only anonymous `Viewer`
access behind the mTLS boundary; dashboards and data sources are provisioned
from this directory and cannot be changed in the UI.

Prometheus scrapes eighteen targets in the three-manager profile: itself,
Alertmanager, Blackbox Exporter, Traefik, Loki, three Alloy collectors, three
Node Exporters, three cAdvisor tasks, and four public HTTPS endpoints. Alert rules cover scrape failures,
public endpoint failures, host memory/disk/CPU pressure, unavailable Traefik
backends, and certificate expiry.

Grafana provisions Loki alongside Prometheus. The TOAD Overview dashboard has a
recent-log panel; Explore can filter by `stack`, `service`, `container`, or
`collector`. Alloy discovers containers on every manager and forwards logs over
the private monitoring overlay. Its Docker socket access is a privileged trust
boundary, so only the pinned upstream Alloy image receives that mount and no
Alloy interface is routed publicly.

Alertmanager initially uses a `dashboard-only` receiver. This makes firing
alerts and silences functional without placing an SMTP password or webhook
secret in Git, but it does not send notifications. Add a secret-backed receiver
only after choosing the client-specific destination.

## Operations

The normal deployment and verification commands are:

```sh
cd openstackV3
pnpm run apply -- toad-prod heat/env/production.yaml
pnpm run verify -- toad-prod --json
```

For a monitoring-only redeploy:

```sh
ansible/venv/bin/ansible-playbook \
  -i openstackV3/inventory.yaml \
  ansible/playbooks/deployMonitoring.yaml
```

Prometheus retains at most seven days or 5 GB, whichever is reached first.
Prometheus, Grafana, Loki, and Alertmanager use local Docker volumes and are pinned to
the manager carrying `toad.monitoring-state=true`. They are intentionally
single-replica in this small profile. Back up their volumes before replacing
that manager with `pnpm run platform -- backup`; see
[`docs/OPERATIONS.md`](../docs/OPERATIONS.md#encrypted-platform-recovery).

Monitoring inside the Swarm cannot report a total Swarm or cloud outage. Run
the credential-free probe from another provider or site:

```sh
cd openstackV3
pnpm install --frozen-lockfile
pnpm run probe -- --json
```

The endpoint list is `monitoring/external-endpoints.yaml`. To notify a generic
JSON webhook on failure, store its URL in the ignored, mode-`0600`
`openstackV3/credentials/monitoring-webhook-url` and add `--notify`. Add
`--notify-always` for heartbeat-style receivers. Schedule this TypeScript
command with the external host's native timer; it needs no OpenStack, SSH, DNS,
or mTLS credential. The bundled `External availability probe` GitHub Actions
workflow runs it every fifteen minutes from outside Infomaniak after the
workflow reaches the default branch. A failing probe fails the workflow, so
standard GitHub Actions notifications work without a webhook secret.

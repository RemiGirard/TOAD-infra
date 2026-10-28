# Start small, understand the bill, grow deliberately

TOAD has no hosted-service subscription. You pay your providers directly.
The older €-equivalent/CHF64.98 headline used a large comparison instance;
it was neither a minimum nor this project's measured invoice.

## A one-server IPv6 architecture: €4.21/month in the provider calculator

On **28 October 2026**, the [configured Infomaniak estimate](https://www.infomaniak.com/en/hosting/public-cloud/calculator?uuid=e28f426f-242e-4ce6-8242-09d9ba3fe754)
showed **€4.21/month excluding VAT** with these inputs:

| Input | Selection |
|---|---|
| Instance | 1 × a1_ram2_disk20_perf1, Linux |
| Capacity | 1 vCPU, 2 GB RAM, 20 GB included disk |
| Operating time | 100% = 730 hours/month |
| Extra block/object storage | None |
| Paid IPv4 addresses | None |
| Load balancers | None |

The displayed compute rate was €0.00577/hour; 730 ×0.00577 =€4.2121 before
rounding. The calculator creates an estimate, not cloud resources.
Infomaniak's [network guide](https://docs.infomaniak.cloud/network/network_setup_guide/)
documents free public IPv6 through **ext-v6only1**. A directly attached server
can avoid an IPv4 router, floating IP and Octavia load balancer.

**This is the minimum provider architecture to target, not an implemented or
validated TOAD starter profile.** Current cloud apply still creates the
three-manager IPv4 platform. The existing one-node Heat experiment is also
IPv4 and is not a complete app platform. The current full monitoring stack
has no measured minimum flavor and must not be presented as tested on 2 GB.

For an IPv6-only app, the operator and visitors need IPv6 reachability.
An IPv4-only visitor needs an additional dual-stack edge/proxy or IPv4,
which changes the architecture and potentially the bill. Container ingress,
ACME/DNS calls, registries, outbound APIs and recovery all need acceptance
checks before the proposed starter becomes supported.

## Current complete TOAD topology

The current full workflow provisions three managers, one load balancer, a
private router and two explicit floating IPs. The router's external gateway
also allocates a billable public IPv4, as the provider's
[billing note](https://docs.infomaniak.cloud/network/create_and_assign_a_floating_ip/#important-billing-note-when-creating-a-router-gateway)
explains. Count **three paid IPv4s**, not just the two explicit floating IPs.

The calculator's EUR rates checked on the same date were:

| Item | Hourly rate | Quantity | At 730 hours |
|---|---:|---:|---:|
| 2 vCPU / 4 GB / 20 GB instance candidate | €0.00939 | 3 | €20.56 |
| Public IPv4, including router gateway | €0.00411 | 3 | €9.00 |
| Standard load balancer | €0.01234 | 1 | €9.01 |
| Resource subtotal | | | **€38.57** |

This is calculated from published inputs, not a configured full-platform
quote or a capacity benchmark. The smaller instance is a candidate to test,
not a guaranteed minimum for your app and monitoring. Use the
[official calculator](https://www.infomaniak.com/en/hosting/public-cloud/calculator)
with the actual region, flavor and services. Currency and rates can change.

Include VAT, domain/DNS services, image registry, offsite backup storage and
requests, extra volumes/snapshots, chargeable traffic and operator time.
Storage and reserved IPs can remain billable after a VM is stopped.
The homepage's hourly estimator assumes every listed resource exists for
the selected hours; it does not predict an invoice or perform a resize.

## What scaling actually means

| Step | What changes | Current TOAD support |
|---|---|---|
| Learn locally | Run the sample on your machine. No cloud account, VM or public IP is created. | Available; [local example](LOCAL-STARTER.md). |
| One small server + IPv6 | Direct public IPv6, app gateway and an appropriately small monitoring budget. | Provider architecture available; TOAD profile still needs implementation and validation. |
| More copies of a stateless app | Change the service's replicas in Compose, validate, deploy and diagnose. | Available when the existing platform has capacity. No extra public IP per copy is required. |
| Bigger servers | More CPU/RAM/disk. Provider resize is an offline operation. | Needs maintenance planning; TOAD does not provide a rolling resize workflow. |
| Extra worker servers | More compute capacity on the same platform. | Needs Heat/inventory adaptation; there is no automated node-growth command. |
| One-node experiment to the three-manager platform | Different resources, addresses and storage placement. | A planned migration/rebuild with data recovery, not an automatic two-node upgrade. |

Local-volume services remain single-replica on one pinned node. More app
copies do not replicate their files. Three managers protect coordination;
they do not remove the single Traefik replica or local-data limits.

See the provider's [resize procedure](https://docs.infomaniak.cloud/compute/instances/resources_modification/),
TOAD's [storage profiles](STATEFUL-STORAGE.md), and the
[full Infomaniak deployment example](INFOMANIAK-EXAMPLE.md).

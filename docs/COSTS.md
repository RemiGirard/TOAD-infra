# Cost worksheet

TOAD has no hosted-service subscription. You pay providers directly. These
illustrative estimates were checked against
[Infomaniak public pricing](https://www.infomaniak.com/en/hosting/public-cloud/prices)
on 2026-10-27. They are resource estimates, not a quotation or measured invoice.

| Resource | One-manager evaluation | Three-manager production |
|---|---:|---:|
| 4 vCPU / 8 GB / 50 GB instance, illustrative CHF 16.10/month | 1 × 16.10 | 3 × 16.10 |
| Reserved IPv4, CHF 0.00457/hour × 730 hours | 1 × 3.34 | 2 × 3.34 |
| Standard load balancer, CHF 0.0137/hour × 730 hours | — | 10.00 |
| Illustrative resource subtotal | **CHF 19.44/month** | **CHF 64.98/month** |

The instance price is the provider's comparison example. Confirm the actual
flavor, disk tier, region, and capacity before creating resources. Production
uses one SSH bootstrap IP and one load-balancer IP. Smaller flavors can cost
less but must fit the workloads, platform services, and resource reservations.

Add domain/DNS charges, registry storage, offsite backup storage and requests,
extra volumes/snapshots, any chargeable traffic, taxes, and operator time.
This is not a capacity or availability guarantee.

For a short experiment, multiply actual hourly instance and reserved-IPv4
rates by the running/reservation time, then add storage and enabled services.
Use the provider calculator and account quotas before deployment. The local
Node trial creates no cloud resources. Delete an experiment only after
reviewing its resources and explicitly approving the exact stack name.

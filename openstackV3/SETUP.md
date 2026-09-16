# Infomaniak setup

## 1. Create a project service user

In Infomaniak Manager, open **Public Cloud → Users**, create a user dedicated to
TOAD, and grant the project roles required for compute, network, orchestration,
load balancing, and DNS. Save the generated password in a password manager.

Use password authentication for the Heat profile. Application credentials work
for many OpenStack APIs, but Infomaniak Heat creates a Keystone trust and a
delegated token cannot manage trusts.

Create `credentials/clouds.yaml`:

```yaml
clouds:
  openstack:
    auth:
      auth_url: https://api.pub1.infomaniak.cloud/identity/v3
      project_name: YOUR_PROJECT_NAME
      project_domain_name: Default
      username: YOUR_SERVICE_USER
      user_domain_name: Default
    region_name: dc4-a
    interface: public
    identity_api_version: 3
```

Run `pnpm run setup`; it prompts for the password, saves it separately with mode
`0600`, creates the local OpenStack environment, generates a project SSH key,
and uploads the public key. Do not commit anything under `credentials/`.

## 2. Configure inputs

```sh
cp heat/env/example.yaml heat/env/production.yaml
cp ../router/config.example.yaml ../router/config.yaml
```

Set the discovered flavor, immutable image UUID, network, three availability zones, your DNS
child zone, and an SSH source CIDR such as `203.0.113.9/32`. Never deploy a
client environment with SSH open to `0.0.0.0/0`.

Create an API token at
<https://manager.infomaniak.com/v3/ng/accounts/token/list> with only
`dns:read` and `dns:write`. Save it locally without terminal
echo:

```sh
pnpm run dns-token
```

This token controls DNS records, so keep it in the same secret backup as the
OpenStack credential. It is ignored by Git and reaches Traefik only as a Docker
secret file.

## 3. Apply

```sh
pnpm run check
pnpm run doctor -- --cloud
pnpm run apply -- toad-prod heat/env/production.yaml
```

The first apply also creates a local admin CA and 90-day operator certificate.
Import `credentials/admin-pki/operator.p12` into the operator browser to open
`https://traefik.toad.remigirard.dev/dashboard/`. The directory is ignored by
Git; back up the CA key securely and never copy it to a server.

## 4. Delegate DNS once

In the parent domain's DNS zone, add `NS` records for the child label (for
example `toad`) using the two Designate nameservers. For Infomaniak Public Cloud
these are currently:

```text
ns1.pub2.infomaniak.cloud.
ns2.pub2.infomaniak.cloud.
```

Heat owns the child zone, wildcard/apex records, and their load-balancer IP. The
parent delegation remains when the stack is destroyed, enabling a clean rebuild.
The TypeScript `dns` command owns only the parent `@` and `*` A records; it does
not modify MX, TXT, CAA, or the child-zone NS delegation.

## 5. Verify or destroy

```sh
pnpm run verify -- toad-prod --json
pnpm run destroy -- toad-prod
```

After destruction, verify that stack resources, instances, floating IPs,
load balancers, the tenant network, and the Designate child zone are gone. Run
the same `apply` command to rebuild them.

To repair only the parent DNS after a load-balancer change, run
`pnpm run dns -- toad-prod`. Normal `apply` already performs this operation at
the safe point after ingress is deployed.

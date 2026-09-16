# TOAD ingress

Traefik has two ACME resolvers:

- `letsencrypt` uses HTTP-01 for explicit routers in the delegated Designate
  child zone.
- `infomaniak` uses DNS-01 for the parent apex plus wildcard certificate.

The Infomaniak token is mounted from a versioned external Docker secret. Never
put it in `config.yaml`, Compose labels, or this directory.

This stack runs one Traefik task on a Swarm manager and publishes ports 80 and
443 through the Swarm routing mesh. An Octavia load balancer can therefore send
traffic to any manager node; Swarm forwards it to the active Traefik task.

One replica is intentional. Traefik OSS stores ACME state in a local file and
that file must not be written concurrently by multiple replicas. Swarm will
restart the task after a node failure, but a move to another node can require a
fresh certificate issuance. Back up the `traefik-certificates` volume and use
Let's Encrypt staging while testing to avoid rate limits.

The dashboard is enabled at `https://traefik.<base_domain>/dashboard/` and is
protected by mandatory mutual TLS. Port 8080 is not published. The public
client CA is mounted read-only and the CA private key is never deployed. The
Docker socket is also mounted read-only, but access to it remains privileged;
only trusted, pinned Traefik images should be deployed.

## Deploy

Create `config.yaml` from `config.example.yaml`. From the repository root,
deploy with:

```sh
ansible-playbook -i openstackV3/inventory.yaml ansible/playbooks/deployTraefik.yaml
```

Certificates use HTTP-01. DNS for `*.toad.remigirard.dev` is owned by the Heat
stack through OpenStack Designate, so Traefik needs no DNS-provider credential.

Application labels must be placed under `deploy.labels`, use the
`traefik-public` network, and reference the `letsencrypt` certificate resolver.
Admin routers must additionally reference the file-provider TLS option
`admin-mtls@file`.

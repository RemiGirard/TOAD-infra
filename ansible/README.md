# TOAD host configuration

Ansible is the thin, idempotent host layer after Heat creates the machines. The
normal entry point is the TypeScript command from `openstackV3`:

```sh
pnpm run apply -- toad-prod heat/env/production.yaml
```

For layer-by-layer debugging:

```sh
python3 -m venv venv
venv/bin/pip install -r requirements.lock.txt
venv/bin/ansible all -i ../openstackV3/inventory.yaml -m ping
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/installDocker.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/hardenHosts.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/initJoinSwarm.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/deployTraefik.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/deployRoot.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/deployMonitoring.yaml
venv/bin/ansible-playbook -i ../openstackV3/inventory.yaml playbooks/deployHello.yaml
```

`hardenHosts.yaml` disables password/root SSH login, keeps TCP forwarding for
the private-manager jump path, installs auditd and unattended security updates,
prevents unattended reboots, and applies conservative kernel protections that
do not conflict with Docker forwarding. It runs serially across nodes.

`deployTraefik.yaml` reads the ignored local Infomaniak DNS token and creates a
versioned Swarm secret through stdin. `deployRoot.yaml` installs the small
parent-domain landing stack that requests the apex/wildcard certificate.

The inventory is generated from stable Heat outputs. Managers 2 and 3 are
reached through manager 1 using an explicit `ProxyCommand` and the repository's
local SSH key. Swarm uses `10.20.0.0/16` in `/24` blocks so its ingress and
overlay networks cannot collide with the OpenStack `10.0.0.0/24` subnet.

The Traefik playbook copies the dynamic TLS policy and only the public admin CA
certificate to `/opt/toad/traefik`. Client certificates and every private key
remain on the operator workstation.

The monitoring playbook validates its rendered Swarm definition, Prometheus
rules, and Alertmanager configuration before deploying any service. It copies
only non-secret configuration to `/opt/toad/monitoring`.

The former experimental registry playbook was removed: it generated private
keys on a server and bypassed the maintained Traefik ingress policy. Deploy a
registry as a reviewed manifest-driven application if one is needed.

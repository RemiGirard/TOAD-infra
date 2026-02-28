# Ansible

Playbooks for configuring Docker Swarm on provisioned servers.

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

On subsequent uses:
```bash
source venv/bin/activate
```

## Inventory

Copy and edit the example inventory:
```bash
cp inventory.example.yaml inventory.yaml
# Edit inventory.yaml with your server details
```

## Playbooks

Run in order:
```bash
# 1. Install Docker on all nodes
ansible-playbook -i inventory.yaml playbooks/installDocker.yaml

# 2. Initialize Swarm and join workers
ansible-playbook -i inventory.yaml playbooks/initJoinSwarm.yaml

# 3. (Optional) Deploy private Docker registry with mTLS
ansible-playbook -i inventory.yaml playbooks/runDockerRepositoryWithCerts.yaml
```

### Playbook descriptions

| Playbook | Description |
|----------|-------------|
| `installDocker.yaml` | Installs Docker Engine on Debian |
| `initJoinSwarm.yaml` | Initializes Swarm on manager, joins workers |
| `runDockerRepositoryWithCerts.yaml` | Deploys a private registry with client certificate auth |

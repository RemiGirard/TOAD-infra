# TOAD OpenStack v3 - Infomaniak OpenCloud

Heat templates for provisioning Docker Swarm infrastructure on Infomaniak OpenCloud.

## Setup

```bash
# Create Python virtual environment
python3 -m venv openstack_cli
source openstack_cli/bin/activate
pip install -r requirements.txt

# Configure credentials
cp .env.example .env
# Edit .env and add your password

# Load environment
source scripts/source-env.sh

# Verify connection
openstack token issue
```

## Heat Template Levels

| Level | Template | Description |
|-------|----------|-------------|
| 0 | `level0-single-node.yaml` | 1 VM with SSH (22), HTTP (80), HTTPS (443) |
| 1 | `level1-swarm-single.yaml` | 1 VM + Swarm ports (2377, 7946, 4789) |
| 2 | `level2-swarm-duo.yaml` | 2 VMs for Swarm cluster |
| 3 | `level3-swarm-trio.yaml` | 3 VMs: 1 manager + 2 workers |
| 4 | `level4-swarm-network.yaml` | 3-10 VMs with private network |
| 5 | `level5-production.yaml` | 4+ VMs with bastion host |

## Usage

```bash
# Discover available resources
./scripts/discover.sh

# Deploy a stack (level 0-5)
./scripts/deploy.sh 3 my-swarm heat/env/example.yaml

# Get stack outputs
openstack stack output show my-swarm --all

# Delete a stack
./scripts/cleanup.sh my-swarm
```

## Manual Deployment

```bash
# Deploy Level 3 (recommended for HA)
openstack stack create \
    -t heat/level3-swarm-trio.yaml \
    -e heat/env/example.yaml \
    my-swarm \
    --wait

# Get floating IP
openstack stack output show my-swarm floating_ip

# Connect via SSH
ssh ubuntu@<floating-ip>

# Delete
openstack stack delete my-swarm --yes --wait
```

## After Deployment

Heat only provisions infrastructure. Use Ansible to configure Docker and Swarm:

```bash
cd ../ansible
ansible-playbook -i inventory.yaml playbooks/initJoinSwarm.yaml
```

## Files

```
openstackV3/
├── .env                    # Your credentials (gitignored)
├── .env.example            # Credentials template
├── requirements.txt        # Python dependencies
├── heat/
│   ├── level0-5*.yaml      # Heat templates
│   └── env/example.yaml    # Parameters template
└── scripts/
    ├── source-env.sh       # Load credentials
    ├── discover.sh         # List available resources
    ├── deploy.sh           # Deploy a stack
    └── cleanup.sh          # Delete a stack
```

# TOAD OpenStack Setup Guide

Quick setup for Infomaniak OpenCloud infrastructure.

## Prerequisites

- Infomaniak OpenCloud account
- SSH key pair on your local machine (`~/.ssh/id_ed25519` or `~/.ssh/id_rsa`)

## 1. Clone and Setup

```bash
cd /path/to/TOAD-infra/openstackV3

# Create Python virtual environment
python3 -m venv openstack_cli
source openstack_cli/bin/activate
pip install -r requirements.txt
```

## 2. Configure Credentials

```bash
# Copy template
cp .env.example .env

# Edit and add your password
nano .env
```

Your `.env` should look like:
```
OS_AUTH_URL=https://api.pub1.infomaniak.cloud/identity/v3
OS_USERNAME=PCU-XXXXXXX
OS_PASSWORD=your-password-here
OS_PROJECT_NAME=PCP-XXXXXXX
OS_USER_DOMAIN_NAME=default
OS_PROJECT_DOMAIN_NAME=default
OS_IDENTITY_API_VERSION=3
OS_REGION_NAME=dc3-a
```

## 3. Load Environment and Test

```bash
source scripts/source-env.sh
openstack token issue
```

## 4. Create SSH Keypair

```bash
# Upload your public key to OpenStack
openstack keypair create --public-key ~/.ssh/id_ed25519.pub my-key

# Verify
openstack keypair list
```

## 5. Update Environment File

Edit `heat/env/example.yaml` with your values:

```yaml
parameters:
  flavor: "a2-ram4-disk20-perf1"
  image: "Ubuntu 24.04 LTS Noble Numbat"
  keypair_name: "my-key"          # Your keypair name from step 4
  public_network: "ext-floating1"
```

## 6. Deploy

Choose your level:

| Level | Description | Nodes | Floating IPs |
|-------|-------------|-------|--------------|
| 4 | Standard (1 gateway + 3 swarm) | 4 | 1 |
| 5 | HA (bastion + LB + 2 gateways + 3 swarm) | 6 | 2 |

```bash
# Deploy Level 4 (standard)
./scripts/deploy.sh 4 my-stack heat/env/example.yaml

# Or deploy Level 5 (HA)
./scripts/deploy.sh 5 my-stack heat/env/example.yaml
```

## 7. Get Connection Info

```bash
openstack stack output show my-stack --all
```

## 8. Connect

**Level 4:**
```bash
ssh ubuntu@<gateway-floating-ip>
ssh -J ubuntu@<gateway-ip> ubuntu@10.0.0.11  # swarm node
```

**Level 5:**
```bash
ssh ubuntu@<bastion-floating-ip>
ssh -J ubuntu@<bastion-ip> ubuntu@10.0.0.10  # gateway node
```

## 9. Cleanup

```bash
./scripts/cleanup.sh my-stack
openstack keypair delete my-key
```

---

## Architecture

### Level 4 - Standard
```
Internet
    │
    ▼
┌─────────────────┐
│  Floating IP    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Gateway      │ 10.0.0.10  (Traefik + SSH)
└────────┬────────┘
         │
    ┌────┴────┬─────────┐
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│Swarm 1│ │Swarm 2│ │Swarm 3│
│  .11  │ │  .12  │ │  .13  │
└───────┘ └───────┘ └───────┘
```

### Level 5 - HA
```
Internet
    │
    ├──────────────────┐
    ▼                  ▼
┌─────────┐      ┌─────────┐
│ FIP:SSH │      │ FIP:LB  │
└────┬────┘      └────┬────┘
     │                │
     ▼                ▼
┌─────────┐      ┌─────────┐
│ Bastion │      │Octavia  │
│  .5     │      │  LB     │
└────┬────┘      └────┬────┘
     │                │
     │           ┌────┴────┐
     │           ▼         ▼
     │      ┌───────┐ ┌───────┐
     │      │  GW 1 │ │  GW 2 │
     │      │  .10  │ │  .11  │
     │      └───┬───┘ └───┬───┘
     │          │         │
     │     ┌────┴─────────┴────┐
     │     ▼         ▼         ▼
     │ ┌───────┐ ┌───────┐ ┌───────┐
     └─│Swarm 1│ │Swarm 2│ │Swarm 3│
       │  .20  │ │  .21  │ │  .22  │
       └───────┘ └───────┘ └───────┘
```

## Troubleshooting

**"keypair not found"**: Run step 4 to create keypair.

**"quota exceeded"**: Delete old resources or request quota increase.

**SSH timeout**: Wait 1-2 minutes for instance to boot.

**LB status ERROR**: Expected until Traefik is installed by Ansible.

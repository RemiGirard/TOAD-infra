# TOAD OpenStack Setup Guide

One-command setup for Infomaniak OpenCloud infrastructure.

## Prerequisites

- Node.js 18+
- Python 3.8+
- Infomaniak OpenCloud account

## Quick Start

```bash
# 1. Install npm dependencies
npm install

# 2. Run setup (creates venv, prompts for credentials, generates SSH key)
npm run setup

# 3. Deploy infrastructure
npm run deploy

# 4. Check status
npm run status

# 5. SSH to nodes
npm run ssh

# 6. Generate Ansible inventory
npm run inventory <stack-name>

# 7. Cleanup
npm run destroy
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full setup: Python venv, credentials, SSH key |
| `npm run discover` | Show available flavors, images, networks |
| `npm run deploy` | Deploy a stack (interactive) |
| `npm run status` | Show all stacks, servers, IPs |
| `npm run ssh` | SSH to any node (interactive) |
| `npm run inventory` | Generate Ansible inventory.yaml |
| `npm run destroy` | Delete a stack (interactive) |

## Deployment Levels

| Level | Description | Nodes | Floating IPs |
|-------|-------------|-------|--------------|
| 0 | Single node | 1 | 1 |
| 1 | Single node + Swarm ports | 1 | 1 |
| 2 | 2-node cluster | 2 | 2 |
| 3 | 3-node HA cluster | 3 | 3 |
| **4** | Gateway + 3 Swarm (Standard) | 4 | 1 |
| **5** | Bastion + LB + 2 Gateways + 3 Swarm (HA) | 6 | 2 |

## Architecture

### Level 4 - Standard
```
Internet
    │
    ▼
┌─────────────────┐
│  1 Floating IP  │
└────────┬────────┘
         ▼
    ┌─────────┐
    │ Gateway │ 10.0.0.10
    └────┬────┘
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
    ├────────────────┐
    ▼                ▼
┌─────────┐    ┌──────────┐
│ FIP:SSH │    │ FIP:HTTP │
└────┬────┘    └────┬─────┘
     ▼              ▼
┌─────────┐    ┌─────────┐
│ Bastion │    │Octavia  │
│   .5    │    │   LB    │
└─────────┘    └────┬────┘
                    │
              ┌─────┴─────┐
              ▼           ▼
         ┌────────┐ ┌────────┐
         │  GW 1  │ │  GW 2  │
         │  .10   │ │  .11   │
         └────┬───┘ └────┬───┘
              │          │
         ┌────┴──────────┴────┐
         ▼         ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │Swarm 1 │ │Swarm 2 │ │Swarm 3 │
    │  .20   │ │  .21   │ │  .22   │
    └────────┘ └────────┘ └────────┘
```

## File Structure

```
openstackV3/
├── package.json          # npm scripts
├── .env                  # Credentials (gitignored)
├── .env.example          # Credentials template
├── credentials/
│   ├── toad-key          # SSH private key (gitignored)
│   └── toad-key.pub      # SSH public key (gitignored)
├── heat/
│   ├── env/example.yaml  # Heat parameters
│   └── level*.yaml       # Heat templates
├── scripts/
│   ├── lib/openstack.ts  # Shared utilities
│   ├── setup.ts          # npm run setup
│   ├── discover.ts       # npm run discover
│   ├── deploy.ts         # npm run deploy
│   ├── status.ts         # npm run status
│   ├── ssh.ts            # npm run ssh
│   ├── inventory.ts      # npm run inventory
│   └── cleanup.ts        # npm run destroy
└── inventory.yaml        # Generated Ansible inventory
```

## Isolation

Everything stays local to this project:
- SSH keys: `credentials/toad-key` (not `~/.ssh/`)
- Python venv: `openstack_cli/` (not global)
- Credentials: `.env` (not environment)
- Ansible inventory: `inventory.yaml` (generated per stack)

No global files are modified.

## Next Steps After Deploy

```bash
# Generate Ansible inventory
npm run inventory my-stack

# Run Ansible playbooks
cd ../ansible
ansible-playbook -i ../openstackV3/inventory.yaml playbooks/initJoinSwarm.yaml
```

# TOAD OpenStack v3

Infrastructure as Code for Infomaniak OpenCloud using Heat templates.

## Quick Start

```bash
npm install
npm run setup    # Configure credentials & SSH key
npm run deploy   # Deploy infrastructure (interactive)
npm run ssh      # Connect to nodes
npm run destroy  # Cleanup
```

## Commands

| Command | Description |
|---------|-------------|
| `npm run setup` | Full setup (venv, credentials, SSH key) |
| `npm run discover` | List available resources |
| `npm run deploy` | Deploy stack |
| `npm run status` | Show stacks, servers, IPs |
| `npm run ssh` | SSH to nodes |
| `npm run inventory` | Generate Ansible inventory |
| `npm run destroy` | Delete stack |

## Levels

| Level | Architecture | Nodes | FIPs |
|-------|--------------|-------|------|
| 4 | Gateway → Swarm | 4 | 1 |
| 5 | Bastion + LB → Gateways → Swarm | 6 | 2 |

See [SETUP.md](SETUP.md) for detailed documentation.

# TOAD infra

**T**raefik, **O**penStack, **A**nsible, **D**ocker

Infrastructure-as-code to provision a Docker Swarm cluster on OpenStack and route traffic through Traefik.

## Overview

```
OpenStack (Heat)     -->  Provision VMs and networks
Ansible              -->  Install Docker, init Swarm, deploy registry
Traefik (router/)    -->  Reverse proxy with automatic TLS
Docker Swarm         -->  Run your applications
```

## Project structure

```
TOAD-infra/
├── openstackV3/          # CLI to create/manage OpenStack infrastructure
│   ├── heat/             # Heat templates (level 0-5)
│   └── scripts/          # TypeScript CLI (npm run deploy, ssh, status, ...)
├── ansible/              # Playbooks: Docker install, Swarm init, registry
│   ├── playbooks/
│   └── inventory.example.yaml
├── router/               # Traefik reverse proxy (docker-compose for Swarm)
│   ├── docker-compose.yaml
│   └── .env.example
└── docs/
    └── devops.excalidraw
```

## Getting started

### 1. Provision servers with OpenStack

```bash
cd openstackV3
pnpm install
pnpm run setup     # configure credentials & SSH key
pnpm run deploy    # deploy infrastructure (interactive)
```

See [openstackV3/README.md](openstackV3/README.md) for all commands and deployment levels.

### 2. Configure the cluster with Ansible

```bash
cd ansible
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Copy and edit inventory with your server details
cp inventory.example.yaml inventory.yaml

# Install Docker, init Swarm, (optional) deploy private registry
ansible-playbook -i inventory.yaml playbooks/installDocker.yaml
ansible-playbook -i inventory.yaml playbooks/initJoinSwarm.yaml
ansible-playbook -i inventory.yaml playbooks/runDockerRepositoryWithCerts.yaml
```

See [ansible/README.md](ansible/README.md) for details.

### 3. Deploy Traefik reverse proxy

```bash
cd router
cp .env.example .env
# Edit .env with your domain, email, and DNS provider token

docker stack deploy -c docker-compose.yaml traefik
```

### 4. Deploy your application

Create a `docker-compose.prod.yaml` in your app repo:

```yaml
services:
  app:
    image: your-registry/your-app:latest
    networks:
      - traefik-public
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.myapp.rule=Host(`app.example.com`)"
        - "traefik.http.routers.myapp.entrypoints=websecure"
        - "traefik.http.routers.myapp.tls.certresolver=wildcardresolver"
        - "traefik.http.services.myapp.loadbalancer.server.port=3000"

networks:
  traefik-public:
    external: true
```

```bash
docker stack deploy -c docker-compose.prod.yaml myapp
```

## Credentials

All credentials are gitignored. Each component has a `credentials/` directory with a `.gitkeep` placeholder.

- `openstackV3/credentials/` - OpenStack clouds.yaml, SSH keys
- `openstackV3/.env` - OpenStack auth (see `.env.example`)
- `router/.env` - Traefik config (see `.env.example`)
- `ansible/inventory.yaml` - server IPs and SSH keys (see `inventory.example.yaml`)

## CI/CD (example)

To deploy via GitHub Actions, store certificates and keys as repository secrets, then:

```yaml
# .github/workflows/deploy.yml (example)
- name: Prepare Docker client certificates
  run: |
    sudo mkdir -p /etc/docker/certs.d/registry.example.com:5000/
    echo "${{ secrets.REGISTRY_CA_CRT }}" | sudo tee /etc/docker/certs.d/registry.example.com:5000/ca.crt
    echo "${{ secrets.REGISTRY_CLIENT_CRT }}" | sudo tee /etc/docker/certs.d/registry.example.com:5000/client.cert
    echo "${{ secrets.REGISTRY_CLIENT_KEY }}" | sudo tee /etc/docker/certs.d/registry.example.com:5000/client.key

- name: Deploy
  env:
    DOCKER_HOST: ssh://debian@your-server.example.com
  run: docker stack deploy -c docker-compose.prod.yaml myapp
```

# TOAD infra

**T**raefik, **O**penStack, **A**nsible, **D**ocker

Devops configuration files to create a cluster with :
- Infomaniak : Openstack provider
- OpenStack : create servers and networks
- Ansible : install docker, docker swarm, docker registry
- Docker Swarm : create traefik (reverse proxy), docker registry, deploy applications

## Full cluster creation

### From zero to Horizon

- infomaniak account
  - mail address
  - phone number + phone access
  - credit card (can be limited to 1€ and use 3 months 300€ free credits)

- create a cluster
- create a project
- create a user with password

We know have access to Horizon (openstack)

### Orchestrate the cluster with Heat

- Prepare access
See [openstack/README.md](openstack/README.md) for the process.
Check if access is working:
```
  openstack stack list --print-empty
  +----+------------+--------------+---------------+--------------+
  | ID | Stack Name | Stack Status | Creation Time | Updated Time |
  +----+------------+--------------+---------------+--------------+
  +----+------------+--------------+---------------+--------------+
```
- create a key pair
```
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/certificates/test-ts-bastion.key
  cat ~/.ssh/certificates/test-ts-bastion.key.pub
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/certificates/test-ts-worker.key
  cat ~/.ssh/certificates/test-ts-worker.key.pub
  
  # copy ssh keys to Horizon or create them via CLI :
  openstack keypair create --public-key ~/.ssh/certificates/test-ts-bastion.key.pub test-ts-bastion
  openstack keypair create --public-key ~/.ssh/certificates/test-ts-worker.key.pub test-ts-worker
```
  
Create a stack with the template:
```
  openstack stack create --template ./heat/02-MultipleNode/V3/swarm-cluster.yaml --wait test-ts-stack
```

-- get ip addresses
```
openstack stack output show test-ts-stack worker_private_ips -f value -c output_value
openstack stack output show test-ts-stack bastion_private_ip -f value -c output_value
openstack stack output show test-ts-stack bastion_floating_ip -f value -c output_value
```

-- connect to the bastion host
setup ssh config
```
nano ~/.ssh/config
```
```
Host test-ts
  HostName 123.456.789.012
  User debian
  IdentityFile /home/ubuntu/.ssh/certificates/test-ts-bastion.key
```

try access the bastion host
```bash
ssh test-ts
exit
```

-- install docker swarm on cluster
### prepare ansible access
setup inventory file
```yaml
swarm:
hosts:
main:
  ansible_host: test-ts
  ansible_user: debian
  ansible_ssh_private_key_file: ~/.ssh/certificates/swarm-admin.key
children:
workers:
  hosts:
    worker-0:
      ansible_host: 192.168.100.46
    worker-1:
      ansible_host: 192.168.100.58
    worker-2:
      ansible_host: 192.168.100.55
  vars:
    ansible_user: debian
    ansible_ssh_private_key_file: ~/.ssh/certificates/bastion-key.key
    ansible_ssh_common_args: '-o ProxyJump=debian@test-ts -o StrictHostKeyChecking=accept-new'
```

```bash
ansible-playbook -i inventory.yaml ./playbooks/installDocker.yaml 
ansible-playbook -i inventory.yaml ./playbooks/initJoinSwarmV2.yaml
ansible-playbook -i inventory.yaml ./playbooks/runDockerRepositoryWithCerts.yaml
```

### Use the docker repository

get certificates to push and pull images

Client certificate: `/opt/registry/certs/client.crt`
Client private key: `/opt/registry/certs/client.key`
CA certificate: `/opt/registry/certs/ca.crt`

Store them as secret so your github workflow can use them.
```yaml
- name: Prepare Docker client certificates
run: |
  sudo mkdir -p /etc/docker/certs.d/remigirard.dev:5000/
  echo "${{ secrets.REGISTRY_CA_CRT }}" | sudo tee /etc/docker/certs.d/remigirard.dev:5000/ca.crt
  echo "${{ secrets.REGISTRY_CLIENT_CRT }}" | sudo tee /etc/docker/certs.d/remigirard.dev:5000/client.cert
  echo "${{ secrets.REGISTRY_CLIENT_KEY }}" | sudo tee /etc/docker/certs.d/remigirard.dev:5000/client.key
      - name: Verify Docker registry certificates
        run: docker pull remigirard.dev:5000/nonexistent-image || echo "Certificates are valid"

      - run: docker tag remigirarddev_next-app remigirard.dev:5000/admin/remigirarddev_next-app:${{ github.ref_name }}
      - run: docker push remigirard.dev:5000/admin/remigirarddev_next-app:${{ github.ref_name }}
```

To deploy, you can do by accessing docker via ssh and setting up DOCKER_HOST

```bash
      - name: create .ssh if does not exist
        run: mkdir -p ~/.ssh
      - run: echo "${{secrets.REGISTRY_CERTIFICATE}}" > ~/.ssh/id_rsa
      - run: chmod 600 ~/.ssh/id_rsa

      - run: ssh-keyscan -H remigirard.dev >> ~/.ssh/known_hosts

      - run: curl -k https://remigirard.dev
      - run: docker container ls
        env:
          DOCKER_HOST: ssh://debian@remigirard.dev
      - run: docker pull remigirard.dev:5000/admin/remigirarddev_next-app:${{ github.ref_name }}
        env:
          DOCKER_HOST: ssh://debian@remigirard.dev
      - name: Set DEPLOY_URL
        id: set_deploy_url
        run: |
          if [ "${{ github.ref_name }}" = "main" ]; then
            echo "DEPLOY_URL=remigirard.dev" >> $GITHUB_ENV
          else
            echo "DEPLOY_URL=${{ github.ref_name }}.staging.remigirard.dev" >> $GITHUB_ENV
          fi
      - run: docker stack deploy -c docker-compose.prod.yaml --with-registry-auth remigirarddev-${{ github.ref_name }}
        env:
          DEPLOY_URL: ${{ env.DEPLOY_URL }}
          STAGE_NAME: ${{ github.ref_name }}
          DOCKER_HOST: ssh://debian@remigirard.dev
````

Customize DEPLOY_URL in the script to control the deployment URL.

And use this kind of docker-compose.prod.yaml file to deploy your application:
```yaml
services:
  app:
    image: remigirard.dev:5000/admin/remigirarddev_next-app:${STAGE_NAME}
    networks:
      - traefik-public
    deploy:
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.${STAGE_NAME}.rule=Host(`${DEPLOY_URL}`)"
        - "traefik.http.routers.${STAGE_NAME}.entrypoints=websecure"
        - "traefik.http.routers.${STAGE_NAME}.tls.certresolver=wildcardresolver"
        - "traefik.http.services.${STAGE_NAME}.loadbalancer.server.port=3000"
networks:
  traefik-public:
    external: true

```


optional:add bastionkey to be able to access manually to the workers
```
ssh test-ts
nano .ssh/id_ed25519.pub
chmod 600 .ssh/id_ed25519.pub
```


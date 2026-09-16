FROM node:26-trixie-slim@sha256:14bf3eac4bf209d906d3c41256597d3ab1f926b2e93a79e9bdfe1efd32454239

LABEL org.opencontainers.image.title="TOAD infra" \
      org.opencontainers.image.description="Open infrastructure automation for Infomaniak Public Cloud and Docker Swarm" \
      org.opencontainers.image.source="https://github.com/RemiGirard/TOAD-infra" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"

ENV DEBIAN_FRONTEND=noninteractive
ENV TOAD_STATE_DIR=/state
ENV TOAD_BACKUP_DIR=/backups
RUN apt-get update \
    && apt-get install --yes --no-install-recommends age ca-certificates openssh-client python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/* \
    && corepack enable

WORKDIR /opt/toad

COPY openstackV3/package.json openstackV3/pnpm-lock.yaml openstackV3/pnpm-workspace.yaml ./openstackV3/
RUN pnpm --dir openstackV3 install --frozen-lockfile

COPY ansible/requirements.lock.txt ./ansible/requirements.lock.txt
RUN python3 -m venv ansible/venv \
    && ansible/venv/bin/pip install --no-cache-dir --requirement ansible/requirements.lock.txt

COPY openstackV3/requirements.lock.txt ./openstackV3/requirements.lock.txt
RUN python3 -m venv openstackV3/openstack_cli \
    && openstackV3/openstack_cli/bin/pip install --no-cache-dir --requirement openstackV3/requirements.lock.txt

COPY . .

WORKDIR /opt/toad/openstackV3
VOLUME ["/state", "/backups"]
ENTRYPOINT ["pnpm", "run", "cli"]
CMD ["--help"]

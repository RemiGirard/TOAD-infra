#!/bin/bash
# Deploy a TOAD Heat stack
# Usage: ./scripts/deploy.sh <level> [stack-name] [env-file]
# Example: ./scripts/deploy.sh 0 my-stack heat/env/example.yaml

set -e

LEVEL="${1:-}"
STACK_NAME="${2:-toad-level${LEVEL}}"
ENV_FILE="${3:-heat/env/example.yaml}"

if [[ -z "$LEVEL" ]] || [[ ! "$LEVEL" =~ ^[0-5]$ ]]; then
    echo "Usage: $0 <level> [stack-name] [env-file]"
    echo ""
    echo "Levels:"
    echo "  0 - Single node (SSH, HTTP, HTTPS)"
    echo "  1 - Single node with Swarm ports"
    echo "  2 - Two-node Swarm cluster"
    echo "  3 - Three-node Swarm (HA)"
    echo "  4 - Multi-network cluster (3-10 nodes)"
    echo "  5 - Production setup with bastion"
    exit 1
fi

# Map level to template
case $LEVEL in
    0) TEMPLATE="heat/level0-single-node.yaml" ;;
    1) TEMPLATE="heat/level1-swarm-single.yaml" ;;
    2) TEMPLATE="heat/level2-swarm-duo.yaml" ;;
    3) TEMPLATE="heat/level3-swarm-trio.yaml" ;;
    4) TEMPLATE="heat/level4-swarm-network.yaml" ;;
    5) TEMPLATE="heat/level5-production.yaml" ;;
esac

echo "Deploying Level $LEVEL stack: $STACK_NAME"
echo "Template: $TEMPLATE"
echo "Environment: $ENV_FILE"
echo ""

openstack stack create \
    -t "$TEMPLATE" \
    -e "$ENV_FILE" \
    "$STACK_NAME" \
    --wait

echo ""
echo "=== Stack Outputs ==="
openstack stack output show "$STACK_NAME" --all

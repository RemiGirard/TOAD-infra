#!/bin/bash
# Delete a TOAD Heat stack
# Usage: ./scripts/cleanup.sh <stack-name>
# Example: ./scripts/cleanup.sh toad-level0

set -e

STACK_NAME="${1:-}"

if [[ -z "$STACK_NAME" ]]; then
    echo "Usage: $0 <stack-name>"
    echo ""
    echo "Available stacks:"
    openstack stack list --format table
    exit 1
fi

echo "Deleting stack: $STACK_NAME"
read -p "Are you sure? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    openstack stack delete "$STACK_NAME" --yes --wait
    echo "Stack deleted."
else
    echo "Cancelled."
fi

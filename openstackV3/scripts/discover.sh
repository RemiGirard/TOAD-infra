#!/bin/bash
# Discover available Infomaniak OpenCloud resources
# Usage: ./scripts/discover.sh

set -e

echo "=== Available Flavors ==="
openstack flavor list --format table

echo ""
echo "=== Available Images ==="
openstack image list --format table

echo ""
echo "=== Available Networks ==="
openstack network list --format table

echo ""
echo "=== Your Keypairs ==="
openstack keypair list --format table

echo ""
echo "=== Current Quotas ==="
openstack quota show --format table

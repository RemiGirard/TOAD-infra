#!/bin/bash
# Source OpenStack environment variables from .env file
# Usage: source scripts/source-env.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Error: .env file not found at $ENV_FILE"
    echo "Copy .env.example to .env and fill in your credentials:"
    echo "  cp .env.example .env"
    return 1 2>/dev/null || exit 1
fi

# Export all variables from .env
set -a
source "$ENV_FILE"
set +a

echo "OpenStack environment loaded:"
echo "  OS_AUTH_URL: $OS_AUTH_URL"
echo "  OS_USERNAME: $OS_USERNAME"
echo "  OS_PROJECT_NAME: $OS_PROJECT_NAME"
echo "  OS_REGION_NAME: $OS_REGION_NAME"
echo "  OS_PASSWORD: ****"

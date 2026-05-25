#!/usr/bin/env bash
# Full Helply OCI provision: network + security policies + both instances.
#
# Prerequisites:
#   1. Install OCI CLI: https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/cliinstall.htm
#   2. Run: oci setup config
#   3. Copy scripts/oci/env.example → scripts/oci/env.local and fill in values
#
# Usage:
#   bash scripts/oci/provision-all.sh

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== Helply OCI: network + policies ==="
bash "$ROOT/lib/network.sh"

echo ""
echo "=== Helply OCI: compute instances ==="
bash "$ROOT/lib/compute.sh"

echo ""
echo "=== Done. See scripts/oci/.state.env for OCIDs and IPs ==="

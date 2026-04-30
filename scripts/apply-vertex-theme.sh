#!/usr/bin/env bash
# apply-vertex-theme.sh — legacy compatibility shim.
#
# Vertex now ships its own vendored CLI runtime at vendor/vertex-cli, already
# branded as Vertex. There is no external OpenClaude install to patch.
set -euo pipefail

echo "Vertex CLI runtime is bundled; no external theme patch is required."

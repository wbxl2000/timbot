#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Installing openclaw plugin: timbot ==="

# Step 1: Build
echo "[1/2] Building..."
cd "$SCRIPT_DIR"
pnpm run build

# Step 2: Link install
echo "[2/2] Installing (link mode)..."
openclaw plugins install -l "$SCRIPT_DIR"

echo ""
echo "=== Done! Plugin installed via symlink. ==="
echo "  Restart the gateway to load the plugin."

#!/usr/bin/env bash
set -euo pipefail

PLUGIN_ID="timbot"
OPENCLAW_DIR="$HOME/.openclaw"
CONFIG_FILE="$OPENCLAW_DIR/openclaw.json"
EXTENSION_DIR="$OPENCLAW_DIR/extensions/$PLUGIN_ID"

echo "=== Uninstalling openclaw plugin: $PLUGIN_ID ==="

# Step 1: Disable the plugin
echo "[1/3] Disabling plugin..."
if openclaw plugins disable "$PLUGIN_ID" 2>/dev/null; then
  echo "  Plugin disabled."
else
  echo "  Plugin already disabled or not found, skipping."
fi

# Step 2: Remove the extension directory
echo "[2/3] Removing extension directory: $EXTENSION_DIR"
if [ -d "$EXTENSION_DIR" ]; then
  rm -rf "$EXTENSION_DIR"
  echo "  Directory removed."
else
  echo "  Directory not found, skipping."
fi

# Step 3: Remove plugin entries from openclaw.json
echo "[3/3] Cleaning openclaw.json..."
if [ -f "$CONFIG_FILE" ]; then
  # Backup the config file
  cp "$CONFIG_FILE" "$CONFIG_FILE.bak.uninstall"

  # Remove plugins.entries.<id> and plugins.installs.<id> using node (jq alternative)
  node -e "
    const fs = require('fs');
    const cfg = JSON.parse(fs.readFileSync('$CONFIG_FILE', 'utf8'));
    let changed = false;
    if (cfg.plugins?.entries?.['$PLUGIN_ID']) {
      delete cfg.plugins.entries['$PLUGIN_ID'];
      changed = true;
    }
    if (cfg.plugins?.installs?.['$PLUGIN_ID']) {
      delete cfg.plugins.installs['$PLUGIN_ID'];
      changed = true;
    }
    if (cfg.channels?.['$PLUGIN_ID']) {
      delete cfg.channels['$PLUGIN_ID'];
      changed = true;
    }
    const paths = cfg.plugins?.load?.paths;
    if (Array.isArray(paths)) {
      const filtered = paths.filter(p => !p.includes('$PLUGIN_ID'));
      if (filtered.length !== paths.length) {
        cfg.plugins.load.paths = filtered;
        if (filtered.length === 0) delete cfg.plugins.load;
        changed = true;
      }
    }
    if (changed) {
      fs.writeFileSync('$CONFIG_FILE', JSON.stringify(cfg, null, 2) + '\n');
      console.log('  Removed plugin entries from config.');
    } else {
      console.log('  No plugin entries found in config, skipping.');
    }
  "
else
  echo "  Config file not found: $CONFIG_FILE"
fi

echo ""
echo "=== Done! Plugin '$PLUGIN_ID' has been uninstalled. ==="
echo "  Backup saved to: $CONFIG_FILE.bak.uninstall"

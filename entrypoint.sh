#!/bin/bash
set -e

echo "=== PijulServ Entrypoint ==="

# Ensure required directories exist (in case of fresh volume mounts)
mkdir -p /app/repos /app/data

# Ensure correct permissions for volume mounts (fixes rootless Podman UID mapping issues)
echo "[entrypoint] Fixing volume permissions..."
chown -R pijulserv:pijulserv /app/repos /app/data

# Initialize a Pijul System Identity for the server (to sign automated pull-backs)
echo "[entrypoint] Initializing Pijul system identity..."
su - pijulserv -c "mkdir -p ~/.config/pijul && pijul identity new --no-prompt --display-name 'PijulServ' --email 'serv@pijul.org' default >/dev/null 2>&1 || true"

echo "[entrypoint] Starting PijulServ services..."
# Start SSH server in background
su - pijulserv -c "node /app/backend/ssh-server.js" &
# Start Web UI backend (last, so logs are visible)
exec su - pijulserv -c "node /app/backend/server.js"

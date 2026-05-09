#!/bin/bash
set -e

echo "=== PijulServ Entrypoint ==="

# Generate SSH host keys if they don't already exist (first boot / fresh volume)
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    echo "[entrypoint] Generating SSH host keys..."
    ssh-keygen -A
fi

# Ensure required directories exist (in case of fresh volume mounts)
mkdir -p /app/repos /app/data

# Copy data directory if it doesn't exist yet
if [ ! -d /app/backend/data ] || [ -z "$(ls -A /app/backend/data 2>/dev/null)" ]; then
    echo "[entrypoint] Initializing backend/data from defaults..."
    mkdir -p /app/backend/data
fi

# Ensure correct permissions for volume mounts (fixes rootless Podman UID mapping issues)
echo "[entrypoint] Fixing volume permissions..."
chown -R pijulserv:pijulserv /app/repos /app/data /app/backend/data

echo "[entrypoint] Starting sshd..."
/usr/sbin/sshd

echo "[entrypoint] Starting PijulServ backend on port 3001..."
exec su - pijulserv -c "node /app/backend/server.js"

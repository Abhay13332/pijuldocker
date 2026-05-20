#!/bin/bash
set -e

echo "=== PijulServ Entrypoint ==="

# Ensure required directories exist (in case of fresh volume mounts)
mkdir -p /app/repos /app/data


# Set data directory
HOST_DATA_DIR_PATH="/app/data"
HOST_KEY_PATH="${HOST_DATA_DIR_PATH}/host_key"

# Create data directory if it doesn't exist
mkdir -p "${HOST_DATA_DIR_PATH}"

# Check if host key already exists
if [ ! -f "${HOST_KEY_PATH}" ]; then
    echo "Generating unique SSH host key for this container..."
    
    # Generate ed25519 host key (modern and secure)
    ssh-keygen -t ed25519 -f "${HOST_KEY_PATH}" -N "" -C "pijulserv-container-$(hostname)"
    
    # Set proper permissions
    chmod 600 "${HOST_KEY_PATH}"
    chmod 644 "${HOST_KEY_PATH}.pub"
    
    echo "SSH host key generated successfully"
else
    echo "SSH host key already exists, reusing it"
fi

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

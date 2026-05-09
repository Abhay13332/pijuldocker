#!/bin/bash
# PijulServ SSH Automation Setup Script
# Run this once as root on your server OR inside the Docker container.
# Usage: sudo ./scripts/setup-ssh.sh

set -e

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo or pkexec)"
   exit 1
fi

# --- Configuration ---
# APP_DIR is where the pijulserv app code lives (adjust for Docker: /app)
APP_DIR="${APP_DIR:-/app}"
# AUTH_COMMAND_USER: the system user sshd runs the AuthorizedKeysCommand as
AUTH_COMMAND_USER="${AUTH_COMMAND_USER:-pijulserv}"
# In Docker this defaults to 'pijulserv'; override for bare-metal deployments

AUTH_BIN="/usr/local/bin/pijul-auth"
SHELL_BIN="/usr/local/bin/pijul-shell"

echo "=== PijulServ SSH Setup ==="
echo "  APP_DIR:            $APP_DIR"
echo "  AUTH_COMMAND_USER:  $AUTH_COMMAND_USER"
echo "  AUTH_BIN:           $AUTH_BIN"
echo "  SHELL_BIN:          $SHELL_BIN"
echo ""

NODE_PATH=$(which node)
echo "[1/4] Installing pijul-auth and pijul-shell to /usr/local/bin..."

# Write pijul-auth
cat > "$AUTH_BIN" << AUTHEOF
#!${NODE_PATH}
/**
 * PijulServ Dynamic SSH Authenticator
 * Called by sshd AuthorizedKeysCommand for every SSH login attempt.
 * Returns authorized_keys-format lines for ALL web UI users.
 */
const fs = require("fs");
const usersFile = "${APP_DIR}/data/users.json";
const shellPath = "${SHELL_BIN}";
const logFile = "/tmp/pijul-auth.log";

try { fs.appendFileSync(logFile, \`\${new Date().toISOString()} - Auth called for: \${process.argv[2]}\\n\`); } catch(e) {}

if (!fs.existsSync(usersFile)) process.exit(0);

const users = JSON.parse(fs.readFileSync(usersFile, "utf8"));
const seen = new Set();

users.forEach(user => {
    if (!user.sshKeys) return;
    user.sshKeys.forEach(k => {
        const keyStr = k.key.trim();
        if (seen.has(keyStr)) return;
        seen.add(keyStr);
        const opts = \`command="\${shellPath} \${user.username}",no-port-forwarding,no-X11-forwarding,no-agent-forwarding\`;
        process.stdout.write(opts + " " + keyStr + "\\n");
    });
});
AUTHEOF

# Write pijul-shell as a wrapper script so it retains its __dirname context
cat > "$SHELL_BIN" << SHELLEOF
#!/bin/bash
exec ${NODE_PATH} ${APP_DIR}/backend/pijul-shell.js "\$@"
SHELLEOF

chmod 755 "$AUTH_BIN" "$SHELL_BIN"
chown root:root "$AUTH_BIN" "$SHELL_BIN"
echo "  Done."

echo "[2/4] Updating sshd_config..."
# Remove any old lines from the main sshd_config
sed -i '/^AuthorizedKeysCommand /d' /etc/ssh/sshd_config
sed -i '/^AuthorizedKeysCommandUser /d' /etc/ssh/sshd_config

# Write a high-priority drop-in that overrides systemd-userdb (20-*.conf)
DROPIN_DIR="/etc/ssh/sshd_config.d"
mkdir -p "$DROPIN_DIR"
cat > "$DROPIN_DIR/05-pijul.conf" << EOF
# PijulServ SSH Authentication
AuthorizedKeysCommand ${AUTH_BIN} %u
AuthorizedKeysCommandUser ${AUTH_COMMAND_USER}
EOF
echo "  Written: $DROPIN_DIR/05-pijul.conf"

echo "[3/4] Verifying effective sshd config..."
sshd -T | grep -i authorizedkeyscommand || true

echo "[4/4] Restarting sshd (skipped inside Docker — entrypoint handles this)..."
if command -v systemctl &>/dev/null && systemctl is-system-running &>/dev/null; then
    systemctl restart sshd
    echo "  sshd restarted."
else
    echo "  No systemd detected — skipping restart (sshd will start via entrypoint.sh)."
fi

echo ""
echo "=== Setup complete! ==="
echo "Clone URL: pijul clone ${AUTH_COMMAND_USER}@<server-ip>:/<reponame>"
echo "Users authenticate using their SSH keys registered in the web UI."

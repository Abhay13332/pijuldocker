#!/bin/bash

# Client SSH Setup Script for PijulServ
# This script helps users generate an SSH key, optionally install a keychain manager,
# configure their shell, and displays the public key.

set -e

echo -e "\e[1;36m=========================================\e[0m"
echo -e "\e[1;36m   PijulServ Client SSH Setup Wizard     \e[0m"
echo -e "\e[1;36m=========================================\e[0m"
echo ""

# 1. Ask for key name
read -p "Enter a name for your new SSH key (default: id_pijul): " KEY_NAME
KEY_NAME=${KEY_NAME:-id_pijul}
KEY_PATH="$HOME/.ssh/$KEY_NAME"

if [ -f "$KEY_PATH" ]; then
    echo -e "\e[1;33mWarning: $KEY_PATH already exists!\e[0m"
    read -p "Do you want to overwrite it? (y/N): " OVERWRITE
    if [[ ! "$OVERWRITE" =~ ^[Yy]$ ]]; then
        echo "Aborting."
        exit 1
    fi
    rm -f "$KEY_PATH" "$KEY_PATH.pub"
fi

# 2. Ask for passphrase
echo ""
echo -e "\e[1;33mSecurity Choice:\e[0m"
echo "A passphrase encrypts your key file for maximum security, but requires entering it once per restart."
echo "No passphrase is less secure but much more convenient."
read -p "Do you want to use a passphrase for this key? (y/N): " USE_PASSPHRASE

if [[ "$USE_PASSPHRASE" =~ ^[Yy]$ ]]; then
    echo -e "\e[1;34mGenerating Ed25519 SSH key (you will be prompted for a passphrase)...\e[0m"
    ssh-keygen -t ed25519 -f "$KEY_PATH"
else
    echo -e "\e[1;34mGenerating Ed25519 SSH key with NO passphrase...\e[0m"
    ssh-keygen -t ed25519 -f "$KEY_PATH" -N ""
fi

# 3. Configure ~/.ssh/config
echo ""
echo -e "\e[1;33mSSH Config:\e[0m"
echo "We can configure SSH to automatically use this key when connecting to your Pijul server."
read -p "Do you want to add this to your ~/.ssh/config? (Y/n): " ADD_CONFIG
ADD_CONFIG=${ADD_CONFIG:-y}

if [[ "$ADD_CONFIG" =~ ^[Yy]$ ]]; then
    read -p "Enter your server IP or domain (e.g., 10.8.1.7): " SERVER_IP
    read -p "Enter the system username (e.g., pijulserv): " SERVER_USER
    read -p "Enter the SSH port (e.g., 2222 for docker, 22 for native) [22]: " SERVER_PORT
    SERVER_PORT=${SERVER_PORT:-22}
    
    mkdir -p "$HOME/.ssh"
    
    # Remove existing Host block for this server to prevent duplicate/conflicting entries
    if [ -f "$HOME/.ssh/config" ]; then
        sed -i -e "/^Host $SERVER_IP$/,/^[[:space:]]*$/d" "$HOME/.ssh/config" 2>/dev/null || true
    fi

    echo "" >> "$HOME/.ssh/config"
    echo "Host $SERVER_IP" >> "$HOME/.ssh/config"
    echo "    User $SERVER_USER" >> "$HOME/.ssh/config"
    echo "    Port $SERVER_PORT" >> "$HOME/.ssh/config"
    echo "    IdentityFile $KEY_PATH" >> "$HOME/.ssh/config"
    echo "" >> "$HOME/.ssh/config"
    
    echo "Added entry for $SERVER_IP to ~/.ssh/config"
fi

# 4. Pijul Identity
echo ""
echo -e "\e[1;33mPijul Identity:\e[0m"
echo "A global identity is used to sign your patches in Pijul."
read -p "Do you want to create a new Pijul identity now? (y/N): " CREATE_IDENTITY

if [[ "$CREATE_IDENTITY" =~ ^[Yy]$ ]]; then
    echo ""
    echo -e "\e[1;34mRecommended Answers:\e[0m"
    echo "  Unique identity name: Your username (e.g. anshuman)"
    echo "  Display name:         Your full name"
    echo "  Email:                Your account email"
    echo "  Change encryption?    Enter y (recommended)"
    echo "  Key to expire?        Enter n (recommended)"
    echo "  Link to remote?       Enter n (recommended)"
    echo "  Passphrase:           Choose a secure password for your identity"
    echo ""
    pijul identity new
fi

# 5. Print Public Key
echo ""
echo -e "\e[1;32m=========================================\e[0m"
echo -e "\e[1;32m          SETUP COMPLETE!                \e[0m"
echo -e "\e[1;32m=========================================\e[0m"
echo "Please copy the following line and paste it into the Web UI:"
echo ""
cat "$KEY_PATH.pub"
echo ""

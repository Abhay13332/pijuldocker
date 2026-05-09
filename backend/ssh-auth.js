#!/usr/bin/env node

/**
 * PijulServ Dynamic SSH Authenticator
 * This script is called by sshd to fetch authorized keys from our database.
 */

// Debug logging
try { require("fs").appendFileSync("/tmp/pijul-auth.log", `${new Date().toISOString()} - Auth called for user: ${process.argv[2]}\n`); } catch (e) {}
const fs = require('fs');
const path = require('path');
const usersFile = path.join(__dirname, '../data/users.json');

if (!fs.existsSync(usersFile)) {
    process.exit(0);
}

const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'));
const shellPath = path.join(__dirname, 'pijul-shell.js');

// sshd calls this with the system username (e.g., 'abhay')
const systemUser = process.argv[2];

// We iterate through all our Web UI users and output their keys with forced command restrictions
users.forEach(user => {
    if (user.sshKeys) {
        user.sshKeys.forEach(key => {
            // This is the magic line that ties the SSH key to our security wrapper
            const restriction = `command="${shellPath} ${user.username}",no-port-forwarding,no-X11-forwarding,no-agent-forwarding`;
            process.stdout.write(`${restriction} ${key.key}\n`);
        });
    }
});

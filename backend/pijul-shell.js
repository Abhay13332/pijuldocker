#!/usr/bin/env node

/**
 * PijulServ SSH Wrapper
 *
 * Called by sshd via the `command=` restriction in AuthorizedKeysCommand output.
 * Usage: pijul-shell <web-username>
 *
 * SSH_ORIGINAL_COMMAND contains the raw pijul command, e.g.:
 *   pijul protocol /first
 *   pijul push /first
 *   pijul clone /first
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPOS_PATH = process.env.REPOS_PATH || path.join(__dirname, '../repos');
const LOG_FILE = '/tmp/pijul-shell.log';

function log(msg) {
    try { fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ${msg}\n`); } catch (e) {}
}

const username = process.argv[2];
const sshCommand = process.env.SSH_ORIGINAL_COMMAND;

log(`Called: user=${username}, cmd=${sshCommand}`);

if (!username || !sshCommand) {
    log('ERROR: missing username or SSH_ORIGINAL_COMMAND');
    console.error('Access Denied.');
    process.exit(1);
}

// Split command respecting quotes (pijul may quote paths)
const parts = sshCommand.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
if (parts.length === 0) {
    console.error('Access Denied: empty command.');
    process.exit(1);
}

const command = parts[0]; // should be 'pijul'

if (command !== 'pijul') {
    log(`ERROR: non-pijul command attempted: ${command}`);
    console.error('Error: Only Pijul commands are allowed.');
    process.exit(1);
}

const subCommand = parts[1]; // e.g. 'protocol', 'push', 'clone', etc.

// Determine required permission level
// 'protocol' is pijul's internal SSH command — it handles everything,
// so we check write for push-like subcommands
const writeSubCommands = ['push', 'record', 'add', 'apply', 'unrecord', 'reset', 'fork'];
const requiredLevel = writeSubCommands.includes(subCommand) ? 'write' : 'read';

// Extract repo name from pijul's arguments.
// pijul sends: pijul protocol --version 3 --repository /reponame
// We look for --repository explicitly, then fall back to any non-flag path arg.
let repoName = null;

// First: check for explicit --repository flag
const repoFlagIdx = parts.indexOf('--repository');
if (repoFlagIdx !== -1 && parts[repoFlagIdx + 1]) {
    let repoPath = parts[repoFlagIdx + 1].replace(/^['"]|['"]$/g, '');
    repoPath = repoPath.replace(/^\d+:/, ''); // Strip any accidental port prefix (e.g. 2222:/first -> /first)
    repoName = path.basename(repoPath.replace(/^\/+/, '').split('/')[0]);
}

// Fallback: find first non-flag arg that isn't a value to a --key flag
if (!repoName) {
    const flagsWithValues = new Set(['--version', '--repository', '--channel', '--limit', '--from-key']);
    for (let i = 2; i < parts.length; i++) {
        let arg = parts[i].replace(/^['"]|['"]$/g, '');
        if (flagsWithValues.has(arg)) {
            i++; // skip the value
            continue;
        }
        if (!arg.startsWith('-')) {
            arg = arg.replace(/^\d+:/, ''); // Strip any accidental port prefix
            repoName = path.basename(arg.replace(/^\/+/, '').split('/')[0]);
            break;
        }
    }
}

log(`subCommand=${subCommand}, repoName=${repoName}, requiredLevel=${requiredLevel}`);

// Load repoStore dynamically so it reads latest data
let repoStore;
try {
    repoStore = require('./repoStore');
} catch (e) {
    log(`ERROR loading repoStore: ${e.message}`);
    console.error('Internal server error.');
    process.exit(1);
}

if (repoName) {
    if (!repoStore.canAccess(repoName, username, requiredLevel)) {
        log(`ACCESS DENIED: ${username} needs ${requiredLevel} on ${repoName}`);
        console.error(`Access Denied: ${requiredLevel} permission required for '${repoName}'.`);
        process.exit(1);
    }
    log(`ACCESS GRANTED: ${username} has ${requiredLevel} on ${repoName}`);
} else {
    log(`No repoName extracted, proceeding (pijul protocol may handle it)`);
}

// Rewrite the --repository argument to be a relative path, 
// because pijul will look for the absolute path "/first" instead of inside REPOS_PATH
const pijulArgs = parts.slice(1).map((arg, idx, arr) => {
    // If the previous argument was --repository, strip leading slashes from this argument
    if (idx > 0 && arr[idx - 1] === '--repository') {
        let cleanArg = arg.replace(/^['"]|['"]$/g, '');
        cleanArg = cleanArg.replace(/^\d+:/, ''); // Strip accidental port prefix
        return cleanArg.replace(/^\/+/, '');
    }
    return arg;
});

log(`Executing: pijul ${pijulArgs.join(' ')} in ${REPOS_PATH}`);

const child = spawn('pijul', pijulArgs, {
    cwd: REPOS_PATH,
    stdio: 'inherit',
    env: { ...process.env, HOME: process.env.HOME || '/tmp' }
});

child.on('error', (err) => {
    log(`ERROR spawning pijul: ${err.message}`);
    console.error(`Error: ${err.message}`);
    process.exit(1);
});

child.on('exit', (code) => {
    log(`pijul exited with code ${code}`);
    process.exit(code ?? 1);
});

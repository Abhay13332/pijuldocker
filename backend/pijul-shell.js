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

const REPOS_PATH = process.env.PIJUL_REPO_PATH || path.join(__dirname, '../repos/pijul_repos');
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
let targetChannel = 'main'; // Default Pijul channel

const channelFlagIdx = parts.indexOf('--channel');
if (channelFlagIdx !== -1 && parts[channelFlagIdx + 1]) {
    targetChannel = parts[channelFlagIdx + 1].replace(/^['"]|['"]$/g, '');
}


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

log(`subCommand=${subCommand}, repoName=${repoName}, channel=${targetChannel}, requiredLevel=${requiredLevel}`);

// Load repoStore dynamically so it reads latest data
let repoStore;
try {
    repoStore = require('./repoStore');
} catch (e) {
    log(`ERROR loading repoStore: ${e.message}`);
    console.error('Internal server error.');
    process.exit(1);
}

// Resolve owner from store for filesystem path
let repoOwner = null;
if (repoName) {
    const repoMeta = repoStore.getByName(repoName);
    if (repoMeta) repoOwner = repoMeta.owner;

    if (!repoStore.canAccess(repoName, username, requiredLevel)) {
        log(`ACCESS DENIED: ${username} needs ${requiredLevel} on ${repoName}`);
        console.error(`Access Denied: ${requiredLevel} permission required for '${repoName}'.`);
        process.exit(1);
    }

    // Check branch protection
    if (requiredLevel === 'write') {
        const isDiscussionChannel = targetChannel.startsWith(':');
        
        // If it's a protected channel (like main) and NOT a discussion channel, enforce manage level
        if (repoStore.isChannelProtected(repoName, targetChannel) && !isDiscussionChannel) {
            if (!repoStore.canAccess(repoName, username, 'manage')) {
                log(`PROTECTION BLOCKED: ${username} attempted push to protected channel ${targetChannel} on ${repoName}`);
                console.error(`Error: Channel '${targetChannel}' is protected. Please submit a Discussion instead.`);
                process.exit(1);
            }
        }
        
        // If it IS a discussion channel, we allow any authenticated user with 'read' access (viewer/developer/etc) to push
        // (as long as they passed the initial canAccess check for 'read' or better)
    }


    log(`ACCESS GRANTED: ${username} has ${requiredLevel} on ${repoName} (owner: ${repoOwner})`);
} else {
    log(`No repoName extracted, proceeding (pijul protocol may handle it)`);
}

// Rewrite the --repository argument to point at owner/reponame sub-directory.
// pijul resolves it relative to REPOS_PATH (the cwd).
const pijulArgs = parts.slice(1).map((arg, idx, arr) => {
    if (idx > 0 && arr[idx - 1] === '--repository') {
        let cleanArg = arg.replace(/^['"']|['"']$/g, '');
        cleanArg = cleanArg.replace(/^\d+:/, ''); // Strip accidental port prefix
        const bareRepoName = cleanArg.replace(/^\/+/, '').split('/').pop();
        // Prepend owner so pijul finds repos/<owner>/<name>
        return repoOwner ? `${repoOwner}/${bareRepoName}` : bareRepoName;
    }
    return arg;
});

log(`Executing: pijul ${pijulArgs.join(' ')} in ${REPOS_PATH}`);

let finalCommand = 'pijul';
let finalArgs = pijulArgs;

// If the user only has 'read' access, use unshare to mount the repos directory as read-only.
if (!repoStore.canAccess(repoName, username, 'write')) {
    log(`STRICT MODE: Running as Read-Only for ${username}`);
    finalCommand = 'unshare';
    finalArgs = [
        '--map-root-user', '--mount', 
        'bash', '-c', `mount --bind -o ro "${REPOS_PATH}" "${REPOS_PATH}" && exec pijul "$@"`,
        '--', ...pijulArgs
    ];
}

const child = spawn(finalCommand, finalArgs, {
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

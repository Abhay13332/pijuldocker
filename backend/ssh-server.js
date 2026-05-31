const fs = require('fs');
const path = require('path');
const { Server } = require('ssh2');
const users = require('./users');
const repoStore = require('./repoStore');
const discussionStore = require('./discussionStore');
const { pool } = require('./db');
const { spawn } = require('child_process');
const { mkdirSync } = require('node:fs');
const { promisify } = require('util');
const exec = promisify(require('child_process').exec);

const REPOS_PATH = process.env.PIJUL_REPO_PATH || path.join(__dirname, '../repos/pijul_repos');
const HOST_DATA_DIR_PATH = path.join(__dirname, '../data');
const HOST_KEY_PATH = path.join(HOST_DATA_DIR_PATH, 'host_key');
const MAX_CONNECTIONS = process.env.MAX_SSH_CONNECTIONS || 30;
let activeConnections = 0;

// Queue for pending connections
const pendingClients = [];

function processQueue() {
    while (pendingClients.length > 0 && activeConnections < MAX_CONNECTIONS) {
        const client = pendingClients.shift();
        setupClient(client);
    }
}

function setupClient(client) {
    activeConnections++;
    console.log(`SSH: Connection accepted (${activeConnections}/${MAX_CONNECTIONS})`);
    
    client.on('close', () => {
        activeConnections--;
        console.log(`SSH: Connection closed (${activeConnections}/${MAX_CONNECTIONS})`);
        processQueue(); // Process next in queue
    });
    
    let authUser = null;

    client.on('authentication', async (ctx) => {
        const username = ctx.username;
        console.log(`SSH: Auth attempt for user: ${username} using ${ctx.method}`);
        
        try {
            const user = await users.findByUsername(username);
            
            if (!user) {
                console.log(`SSH: User ${username} not found in database.`);
                return ctx.reject();
            }

            if (ctx.method === 'publickey') {
                const sshKeys = await users.getsshkeys(username);
                console.log(`SSH: Comparing key with ${sshKeys.length} allowed keys for ${username}`);
                
                const isMatch = sshKeys.some(k => {
                    const parts = k.key.trim().split(' ');
                    if (parts.length < 2) return false;
                    const keyBuffer = Buffer.from(parts[1], 'base64');
                    const match = ctx.key.algo === parts[0] && ctx.key.data.equals(keyBuffer);
                    if (match) console.log(`SSH: Key matched! (${parts[0]})`);
                    return match;
                });

                if (isMatch) {
                    authUser = username;
                    return ctx.accept();
                }
                console.log(`SSH: No key match found for ${username}`);
            }
            ctx.reject();
        } catch (e) {
            console.error(`SSH: error during authentication:`, e);
            ctx.reject();
        }
    }).on('ready', () => {
        client.on('session', (accept) => {
            const session = accept();
            session.on('exec', async (accept, reject, info) => {
                const exec = accept();
                const cmd = info.command;
                console.log(`SSH: Command: ${cmd}`);
                
                try {
                    await handleCommand(authUser, cmd, exec);
                } catch (e) {
                    exec.stderr.write(`Error: ${e.message}\n`);
                    if (typeof exec.exit === 'function') {
                        exec.exit(1);
                    }
                    exec.end();
                }
            });
        });
    });
}
// Ensure we have a host key
if (!fs.existsSync(HOST_KEY_PATH)) {
    console.log('Generating SSH host key...');
    const { execSync } = require('child_process');
    mkdirSync(HOST_DATA_DIR_PATH, { recursive: true });
    execSync(`ssh-keygen -t ed25519 -f "${HOST_KEY_PATH}" -N ""`);
}

const server = new Server({
    hostKeys: [fs.readFileSync(HOST_KEY_PATH)]
}, (client) => {
    if (activeConnections >= MAX_CONNECTIONS) {
        console.log(`SSH: Connection queued (${activeConnections}/${MAX_CONNECTIONS} active, ${pendingClients.length} queued)`);
        pendingClients.push(client);
    } else {
        setupClient(client);
    }
});

async function handleCommand(username, fullCmd, channel) {
    const parts = fullCmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    console.log(`SSH: User ${username} executing: ${fullCmd}`);

    if (parts.length === 0 || parts[0] !== 'pijul') {
        channel.stderr.write('Error: Only Pijul commands are allowed.\n');
        return channel.exit(1);
    }

    const subCommand = parts[1];

    // Extract repo name
    let repoName = null;
    let repoOwner = null;

    const repoFlagIdx = parts.indexOf('--repository');
    let rawPath = null;
    if (repoFlagIdx !== -1 && parts[repoFlagIdx + 1]) {
        rawPath = parts[repoFlagIdx + 1].replace(/^['"]|['"]$/g, '').replace(/^\d+:/, '').replace(/^\//, '');
    } else {
        for (let i = 2; i < parts.length; i++) {
            let arg = parts[i].replace(/^['"]|['"]$/g, '');
            if (!arg.startsWith('-')) {
                rawPath = arg.replace(/^\d+:/, '').replace(/^\//, '');
                break;
            } else if (['--version', '--repository', '--channel'].includes(arg)) {
                i++;
            }
        }
    }

    if (!rawPath) {
        channel.stderr.write('Error: No repository path given. Use /owner/repo format.\n');
        return channel.exit(1);
    }

    const pathParts = rawPath.split('/').filter(Boolean);
    if (pathParts.length < 2) {
        channel.stderr.write(
            `Error: Path '${rawPath}' is ambiguous.\n` +
            `Use the full /owner/repo format.\n`
        );
        return channel.exit(1);
    }
    repoOwner = pathParts[0];
    repoName = pathParts[1];

    console.log(`SSH: Routing to Owner: ${repoOwner}, Repo: ${repoName}`);

    const sourcePath = path.join(REPOS_PATH, repoOwner, repoName);
    if (!fs.existsSync(sourcePath)) {
        channel.stderr.write(`Error: Repository '/${repoOwner}/${repoName}' not found.\n`);
        return channel.exit(1);
    }

    const canAccess = await repoStore.canAccess(repoOwner, repoName, username, 'read');
    
    if (!canAccess) {
        console.warn(`SSH: ACCESS DENIED for ${username} on ${repoOwner}/${repoName}`);
        channel.stderr.write(`Access Denied: read permission required.\n`);
        return channel.exit(1);
    }

    // Extract target channel
    let targetChannel = null;
    const pijulArgs = parts.slice(1).map((arg, idx, arr) => {
        if (idx > 0 && arr[idx - 1] === '--repository') {
            return `${repoOwner}/${repoName}`;
        }
        if (idx > 0 && arr[idx - 1] === '--to-channel') {
            targetChannel = arg.replace(/^['"]|['"]$/g, '');
        }
        return arg;
    });

    const role = await repoStore.getUserRole(repoOwner, repoName, username);
    console.log(`SSH: User ${username} role is ${role}`);

    const isDeveloper = role === 'developer';
    const isViewer = role === 'viewer';
    const useShadow = (isDeveloper || isViewer) && subCommand === 'protocol';

    if (useShadow) {
        await handleShadowSession(username, repoOwner, repoName, pijulArgs, channel, isDeveloper);
    } else {
        await handleDirectSession(pijulArgs, channel);
    }
}

async function handleShadowSession(username, repoOwner, repoName, pijulArgs, channel, isDeveloper) {
    const shadowId = Math.random().toString(36).substring(7);
    const shadowBase = path.join(REPOS_PATH, '.shadows');
    const shadowPath = path.join(shadowBase, `${username}_${shadowId}`);
    const repoSourcePath = path.join(REPOS_PATH, repoOwner, repoName);

    console.log(`SSH: Creating shadow at ${shadowPath}`);

    try {
        // Create shadow directories
        await fs.promises.mkdir(shadowBase, { recursive: true });
        await fs.promises.mkdir(shadowPath, { recursive: true });

        // Copy .pijul directory for DB isolation
        await exec(`cp -ar "${repoSourcePath}/.pijul" "${shadowPath}/.pijul"`);
        
        // Hardlink data files
        const entries = await fs.promises.readdir(repoSourcePath);
        for (const entry of entries) {
            if (entry === '.pijul') continue;
            await exec(`cp -al "${repoSourcePath}/${entry}" "${shadowPath}/${entry}"`);
        }

        // Get initial channel states
        const initialStates = await getChannelStates(shadowPath);
        console.log(`SSH: Initial channel states recorded for ${initialStates.size} channels`);

        // Reset working tree
        try {
            await exec('pijul reset --force', { cwd: shadowPath });
        } catch (e) {
            console.warn(`SSH: Reset failed: ${e.message}`);
        }

        // Build shadow args
        const shadowArgs = [];
        for (let i = 0; i < pijulArgs.length; i++) {
            if (pijulArgs[i] === '--repository') {
                i++;
                continue;
            }
            shadowArgs.push(pijulArgs[i]);
        }

        console.log(`SSH: Shadow Args: ${JSON.stringify(shadowArgs)}`);

        const child = spawn('pijul', shadowArgs, {
            cwd: shadowPath,
            env: { ...process.env, HOME: '/home/pijulserv' }
        });

        channel.stdin.pipe(child.stdin);
        child.stdout.on('data', (data) => channel.stdout.write(data));
        child.stderr.on('data', (data) => {
            channel.stderr.write(data);
            console.error(`SSH: Pijul Stderr: ${data.toString().trim()}`);
        });

        const cleanupShadow = async () => {
            try {
                await exec(`chmod -R u+rwx "${shadowPath}" && rm -rf "${shadowPath}"`);
                console.log(`SSH: Shadow cleaned up: ${shadowPath}`);
            } catch (err) {
                console.error(`SSH: Cleanup error: ${err.message}`);
            }
        };

        child.on('exit', async (code) => {
            console.log(`SSH: Shadow session ended. Status: ${code}`);

            if (code === 0) {
                try {
                    const finalStates = await getChannelStates(shadowPath);
                    const updatedChannels = [];

                    for (const [channel, finalHash] of finalStates) {
                        const initialHash = initialStates.get(channel);
                        if (finalHash && finalHash !== initialHash) {
                            updatedChannels.push(channel);
                        }
                    }

                    if (updatedChannels.length === 0) {
                        console.log(`SSH: No channels were updated`);
                        await cleanupShadow();
                        channel.exit(0);
                        channel.end();
                        return;
                    }

                    console.log(`SSH: Updated channels: ${JSON.stringify(updatedChannels)}`);

                    let channelsToPull;
                    if (isDeveloper) {
                        channelsToPull = await getUnprotectedChannels(repoOwner, repoName, updatedChannels);
                    } else {
                        channelsToPull = await getUserChannels(repoOwner, repoName, username, updatedChannels);
                    }

                    if (channelsToPull.length === 0) {
                        console.log(`SSH: No accessible channels updated`);
                        await cleanupShadow();
                        channel.stderr.write(`\x1b[31mpijul: permission denied\npijul: nothing is changed\x1b[0m\n`);
                        channel.exit(0);
                        channel.end();
                        return;
                    }

                    // Pull changes to real repo
                    for (const ch of channelsToPull) {
                        try {
                            const realChannels = await getChannelList(repoSourcePath);
                            if (!realChannels.includes(ch)) {
                                await exec(`pijul channel create "${ch}"`, { cwd: repoSourcePath });
                            }
                            await exec(
                                `pijul pull --to-channel "${ch}" --from-channel "${ch}" --no-prompt "${shadowPath}"`,
                                { cwd: repoSourcePath, timeout: 30000 }
                            );
                            console.log(`SSH: Pulled changes for "${ch}"`);
                        } catch (pullErr) {
                            console.error(`SSH: Failed to pull "${ch}": ${pullErr.message}`);
                        }
                    }
                } catch (err) {
                    console.error(`SSH: Sync error: ${err.message}`);
                }
            }

            await cleanupShadow();
            channel.exit(code ?? 0);
            channel.end();
        });

    } catch (err) {
        console.error(`SSH: Shadow creation failed: ${err.message}`);
        channel.stderr.write('Error: Server-side initialization failed.\n');
        channel.exit(1);
    }
}

async function handleDirectSession(pijulArgs, channel) {
    console.log(`SSH: Direct session: pijul ${pijulArgs.join(' ')}`);

    const child = spawn('pijul', pijulArgs, {
        cwd: REPOS_PATH,
        env: { ...process.env, HOME: '/tmp' }
    });

    channel.stdin.pipe(child.stdin);
    child.stdout.pipe(channel.stdout);
    child.stderr.pipe(channel.stderr);

    child.on('exit', (code) => {
        channel.exit(code ?? 0);
    });
}

// Helper functions
async function getChannelStates(repoPath) {
    const states = new Map();
    try {
        const { stdout } = await exec('pijul channel', { cwd: repoPath });
        const channels = stdout.split('\n')
            .map(l => l.trim().replace(/^\* /, '').trim())
            .filter(Boolean);

        for (const channel of channels) {
            try {
                const { stdout: logOut } = await exec(`pijul log --channel "${channel}" --limit 1`, { cwd: repoPath });
                const lines = logOut.split('\n');
                for (const line of lines) {
                    if (line && !line.startsWith('Author:') && !line.startsWith('Date:') && !line.startsWith('    ')) {
                        states.set(channel, line.trim());
                        break;
                    }
                }
            } catch (e) {
                states.set(channel, null);
            }
        }
    } catch (e) {
        console.error(`SSH: Failed to get channel states: ${e.message}`);
    }
    return states;
}

async function getChannelList(repoPath) {
    try {
        const { stdout } = await exec('pijul channel', { cwd: repoPath });
        return stdout.split('\n')
            .map(l => l.trim().replace(/^\* /, '').trim())
            .filter(Boolean);
    } catch (e) {
        return [];
    }
}

async function getUserChannels(repoOwner, repoName, username, updatedChannels) {
    try {
        const result = await pool.query(
            `SELECT source_channel_id 
             FROM discussions 
             WHERE repository_id = (SELECT id FROM repositories WHERE owner = $1 AND name = $2)
               AND author_id = (SELECT id FROM users WHERE username = $3)
               AND status = 'open'`,
            [repoOwner, repoName, username]
        );
        
        const userChannelNames = result.rows.map(row => row.source_channel_id);
        return updatedChannels.filter(channel => userChannelNames.includes(channel));
    } catch (err) {
        console.error(`SSH: Failed to get user channels: ${err.message}`);
        return [];
    }
}

async function getUnprotectedChannels(repoOwner, repoName, updatedChannels) {
    try {
        const result = await pool.query(
            `SELECT protected_channels 
             FROM repositories 
             WHERE owner = $1 AND name = $2`,
            [repoOwner, repoName]
        );
        
        if (result.rows.length === 0) return [];
        
        const protectedChannels = result.rows[0].protected_channels;
        return updatedChannels.filter(ch => !protectedChannels.includes(ch));
    } catch (err) {
        console.error(`SSH: Failed to get unprotected channels: ${err.message}`);
        return [];
    }
}

function startSshServer(port = 2222) {
    server.listen(port, '0.0.0.0', () => {
        console.log(`SSH server listening on port ${port}`);
    });
}

if (require.main === module) {
    startSshServer(2222);
}

module.exports = { startSshServer };
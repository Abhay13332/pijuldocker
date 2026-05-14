const fs = require('fs');
const path = require('path');
const { Server } = require('ssh2');
const users = require('./users');
const repoStore = require('./repoStore');
const discussionStore = require('./discussionStore');
const { spawn } = require('child_process');

const REPOS_PATH = process.env.REPOS_PATH || path.join(__dirname, '../repos');
const HOST_KEY_PATH = path.join(__dirname, '../data/host_key');

// Ensure we have a host key
if (!fs.existsSync(HOST_KEY_PATH)) {
    console.log('Generating SSH host key...');
    const { execSync } = require('child_process');
    execSync(`ssh-keygen -t ed25519 -f "${HOST_KEY_PATH}" -N ""`);
}

const server = new Server({
    hostKeys: [fs.readFileSync(HOST_KEY_PATH)]
}, (client) => {
    let authUser = null;

    client.on('authentication', (ctx) => {
        const username = ctx.username;
        console.log(`SSH: Auth attempt for user: ${username} using ${ctx.method}`);
        const user = users.findByUsername(username);

        if (!user) {
            console.log(`SSH: User ${username} not found in database.`);
            return ctx.reject();
        }

        if (ctx.method === 'publickey') {
            const allowedKeys = user.sshKeys || [];
            console.log(`SSH: Comparing key with ${allowedKeys.length} allowed keys for ${username}`);
            
            const isMatch = allowedKeys.some(k => {
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
    }).on('ready', () => {
        client.on('session', (accept, reject) => {
            const session = accept();
            session.on('exec', (accept, reject, info) => {
                const exec = accept();
                const cmd = info.command;
                console.log(`SSH: info: ${JSON.stringify(info)}`);
                handleCommand(authUser, cmd, exec);
            });
        });
    });
});

function handleCommand(username, fullCmd, channel) {
    const parts = fullCmd.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    console.log(`SSH: User ${username} executing: ${fullCmd}`);
    console.log(`SSH: Command Parts: ${JSON.stringify(parts)}`);

    if (parts.length === 0 || parts[0] !== 'pijul') {
        channel.stderr.write('Error: Only Pijul commands are allowed.\n');
        return channel.exit(1);
    }

    const subCommand = parts[1];
    // protocol is used for both push and pull. We treat it as 'read' so Viewers can connect.
    // We will protect the repo using a Shadow Clone for Viewers.
    const writeSubCommands = ['push', 'record', 'apply']; 
    const requiredLevel = writeSubCommands.includes(subCommand) ? 'write' : 'read';

    // ... (repo extraction logic remains same) ...
    // Extract repo name
    let repoName = null;
    let repoOwner = null;

    // GitHub-style parsing: /owner/repo or owner/repo
    const repoFlagIdx = parts.indexOf('--repository');
    let rawPath = null;
    if (repoFlagIdx !== -1 && parts[repoFlagIdx + 1]) {
        rawPath = parts[repoFlagIdx + 1].replace(/^['"]|['"]$/g, '').replace(/^\d+:/, '').replace(/^\//, '');
    } else {
        // Fallback: look for the first non-flag argument after 'protocol'
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
        channel.stderr.write('Error: No repository path given. Use /owner/repo format (e.g. /root/new4).\n');
        return channel.exit(1);
    }

    // STRICTLY require /owner/repo — no fallback.
    // This is the key to enabling same-name repos for different users.
    const pathParts = rawPath.split('/').filter(Boolean);
    if (pathParts.length < 2) {
        channel.stderr.write(
            `Error: Path '${rawPath}' is ambiguous.\n` +
            `Use the full /owner/repo format, e.g.: pijul clone user@host:/root/new4\n`
        );
        return channel.exit(1);
    }
    repoOwner = pathParts[0];
    repoName  = pathParts[1];

    console.log(`SSH: Routing to Owner: ${repoOwner}, Repo: ${repoName}`);

    const sourcePath = path.join(REPOS_PATH, repoOwner, repoName);
    if (!fs.existsSync(sourcePath)) {
        console.error(`SSH: Repository not found at: ${sourcePath}`);
        channel.stderr.write(`Error: Repository '/${repoOwner}/${repoName}' not found.\nDid you mean a different owner?\n`);
        return channel.exit(1);
    }

    const canAccess = repoStore.canAccess(repoOwner, repoName, username, requiredLevel);
    console.log(`SSH: Access control check: user=${username}, repo=${repoOwner}/${repoName}, level=${requiredLevel}, result=${canAccess}`);
    if (!canAccess) {
        console.warn(`SSH: ACCESS DENIED for ${username} on ${repoOwner}/${repoName} (${requiredLevel})`);
        channel.stderr.write(`Access Denied: ${requiredLevel} permission required for '/${repoOwner}/${repoName}'.\n`);
        return channel.exit(1);
    }

    // Rewrite repository path
    let targetChannel = null;
    const pijulArgs = parts.slice(1).map((arg, idx, arr) => {
        if (idx > 0 && arr[idx - 1] === '--repository') {
            // Already handled by rawPath extraction, but we ensure it points to the correct owner/name
            return `${repoOwner}/${repoName}`;
        }
        if (idx > 0 && arr[idx - 1] === '--to-channel') {
            targetChannel = arg.replace(/^['"]|['"]$/g, '');
            console.log(`SSH: Target channel: ${targetChannel}`);
        }
        return arg;
    });

    const isViewer = !repoStore.canAccess(repoOwner, repoName, username, 'write');
    let useShadow = isViewer && subCommand === 'protocol';
    console.log(`SSH: Execution context: subCommand=${subCommand}, isViewer=${isViewer}, useShadow=${useShadow}, targetChannel=${targetChannel}`);

    if (useShadow) {
        const shadowId = Math.random().toString(36).substring(7);
        const shadowBase = path.join(REPOS_PATH, '.shadows');
        const shadowPath = path.join(shadowBase, `${username}_${shadowId}`);
        const repoSourcePath = path.join(REPOS_PATH, repoOwner, repoName);

        console.log(`SSH: Original Args: ${JSON.stringify(pijulArgs)}`);
        
        const { execSync, spawnSync } = require('child_process');
        try {
            // 1. Ensure shadow root exists
            if (!fs.existsSync(shadowBase)) fs.mkdirSync(shadowBase, { recursive: true });
            fs.mkdirSync(shadowPath, { recursive: true });
            
            // 2. Deep copy entire .pijul dir first, then hardlink the rest (ensures DB isolation)
            console.log(`SSH: Mirroring ${repoSourcePath} to ${shadowPath}`);
            execSync(`cp -ar "${repoSourcePath}/.pijul" "${shadowPath}/.pijul"`);
            // Hardlink data files
            const entries = fs.readdirSync(repoSourcePath);
            for (const entry of entries) {
                if (entry === '.pijul') continue;
                execSync(`cp -al "${repoSourcePath}/${entry}" "${shadowPath}/${entry}"`);
            }
            
            // 3. SMART SWITCH: Find discussion channels (:N) in the shadow and switch to the first one.
            // This is the core fix: we don't need discussionStore, we just look at what channels exist.
            let activeShadowChannel = null;
            try {
                // IMPORTANT: Because we use hardlinks, Pijul might detect "unrecorded changes".
                // We must reset the working tree so the channel switch doesn't abort.
                execSync('pijul reset --force', { cwd: shadowPath });
                const chanResult = spawnSync('pijul', ['channel'], { cwd: shadowPath, encoding: 'utf8' });
                const allChannels = (chanResult.stdout || '').split('\n')
                    .map(l => l.trim().replace(/^\* /, '').trim())
                    .filter(Boolean);
                console.log(`SSH: Channels in shadow: ${JSON.stringify(allChannels)}`);

                // Prefer channels that match discussions owned by this user
                let targetDiscChan = null;
                try {
                    const discData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/discussions.json'), 'utf8'));
                    const userDisc = discData.find(d => d.owner === repoOwner && d.repoName === repoName && d.author === username && d.status === 'open');
                    if (userDisc) targetDiscChan = `pr-${userDisc.id}`;
                } catch (_) {}

                const discussionChannels = allChannels.filter(c => c.startsWith('pr-'));
                console.log(`SSH: Filtered discussionChannels: ${JSON.stringify(discussionChannels)}`);
                console.log(`SSH: targetDiscChan: ${targetDiscChan}, includes: ${allChannels.includes(targetDiscChan)}`);

                const channelToSwitch = (targetDiscChan && allChannels.includes(targetDiscChan))
                    ? targetDiscChan
                    : null; // MUST be null. Never fallback to other users' channels!

                console.log(`SSH: Evaluated channelToSwitch: ${channelToSwitch}`);

                if (channelToSwitch) {
                    console.log(`SSH: Smart-switching shadow to ${channelToSwitch} (viewer: ${username})`);
                    execSync(`pijul channel switch "${channelToSwitch}"`, { cwd: shadowPath });
                    activeShadowChannel = channelToSwitch;
                } else {
                    console.log(`SSH: No discussion channel found in shadow. Viewer stays on default.`);
                }
            } catch (e) {
                console.warn(`SSH: Smart switch failed: ${e.message}`);
            }

            // 4. Build shadow args: remove --repository and rely on CWD
            const shadowArgs = [];
            for (let i = 0; i < pijulArgs.length; i++) {
                if (pijulArgs[i] === '--repository') {
                    i++; // skip the path value
                    continue;
                }
                shadowArgs.push(pijulArgs[i]);
            }
            console.log(`SSH: Shadow Args (CWD-based): ${JSON.stringify(shadowArgs)}`);

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

            const cleanupShadow = () => {
                try {
                    execSync(`chmod -R u+rwx "${shadowPath}" && rm -rf "${shadowPath}"`);
                    console.log(`SSH: Shadow cleaned up: ${shadowPath}`);
                } catch (err) {
                    console.error(`SSH: Cleanup error: ${err.message}`);
                }
            };

            child.on('exit', (code) => {
                console.log(`SSH: Shadow session for ${username} ended. Status: ${code}`);

                if (code === 0 && activeShadowChannel) {
                    // Pull patches from shadow's discussion channel back into the REAL repo
                    console.log(`SSH: Pulling back ${activeShadowChannel} from shadow to real repo...`);
                    try {
                        // Run inside the real repo, pull from shadow
                        execSync(
                            `pijul pull --from-channel "${activeShadowChannel}" --to-channel "${activeShadowChannel}" --no-prompt "${shadowPath}"`,
                            { cwd: repoSourcePath, timeout: 30000, env: { ...process.env, EDITOR: 'true', VISUAL: 'true' } }
                        );
                        console.log(`SSH: Pull-back successful for ${activeShadowChannel}`);
                    } catch (pullErr) {
                        console.error(`SSH: Pull-back failed: ${pullErr.message}`);
                    }
                }

                cleanupShadow();

                try { channel.exit(code ?? 0); channel.end(); } catch (e) {}
            });

            return;
        } catch (err) {
            console.error(`SSH: Failed to create shadow: ${err.message}`);
            channel.stderr.write('Error: Server-side initialization failed.\n');
            return channel.exit(1);
        }
    }

    // Default behavior for Developers (Read/Write)
    console.log(`SSH: Spawning pijul ${pijulArgs.join(' ')}`);

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

function startSshServer(port = 2222) {
    server.listen(port, '0.0.0.0', () => {
        console.log(`SSH server listening on port ${port}`);
    });
}

// Auto-start if run directly
if (require.main === module) {
    startSshServer(2222);
}

module.exports = { startSshServer };

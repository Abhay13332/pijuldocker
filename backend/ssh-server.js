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
     let requiredLevel='read';
    const canAccess = repoStore.canAccess(repoOwner, repoName, username, 'read');
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
  
    const hasAllWriteAccess = repoStore.canAccess(repoOwner, repoName, username, 'allwrite');
    const hasUnprotectedWriteAccess = repoStore.canAccess(repoOwner, repoName, username, 'unprotectedwrite');
    const isDeveloper = hasUnprotectedWriteAccess && !hasAllWriteAccess; // Developers have unprotectedwrite but NOT allwrite
    const isViewer = !hasUnprotectedWriteAccess && !hasAllWriteAccess;
    console.log(isDeveloper?"SSH: user is a developer":"SSH :user is visitor")
    let useShadow = !hasAllWriteAccess && subCommand === 'protocol';
    console.log(`SSH: Execution context: subCommand=${subCommand}, isViewer=${isViewer} ,isdeveloper=${isDeveloper}, useShadow=${useShadow}, targetChannel=${targetChannel}`);
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
        
        // 3. Record initial state of channels before operation (get latest change hash)
        const getLatestChangeHash = (cwd, channel) => {
            try {
                const result = execSync(`pijul log --channel "${channel}" --limit 1`, { 
                    cwd, 
                    encoding: 'utf8',
                    stdio: 'pipe'
                });
                // Parse first line to get change hash
                const lines = result.split('\n');
                for (const line of lines) {
                    if (line && !line.startsWith('Author:') && !line.startsWith('Date:') && !line.startsWith('    ')) {
                        return line.trim();
                    }
                }
                return null;
            } catch (e) {
                return null;
            }
        };

        // Get initial channel states
        const initialChanResult = spawnSync('pijul', ['channel'], { cwd: shadowPath, encoding: 'utf8' });
        const initialChannels = (initialChanResult.stdout || '').split('\n')
            .map(l => l.trim().replace(/^\* /, '').trim())
            .filter(Boolean);
        
        const initialStates = new Map();
        for (const channel of initialChannels) {
            initialStates.set(channel, getLatestChangeHash(shadowPath, channel));
        }
        console.log(`SSH: Initial channel states recorded for ${initialChannels.length} channels`);
        
        // 4. Reset working tree to avoid issues
        try {
            execSync('pijul reset --force', { cwd: shadowPath });
            console.log(`SSH: Reset shadow working tree`);
        } catch (e) {
            console.warn(`SSH: Reset failed: ${e.message}`);
        }

        // 5. Build shadow args: remove --repository and rely on CWD
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

            if (code === 0) {
                // Get final state of channels after operation
                try {
                    const finalChanResult = spawnSync('pijul', ['channel'], { cwd: shadowPath, encoding: 'utf8' });
                    const finalChannels = (finalChanResult.stdout || '').split('\n')
                        .map(l => l.trim().replace(/^\* /, '').trim())
                        .filter(Boolean);
                    
                    // Find which channel(s) had new changes (different latest hash)
                    const updatedChannels = [];
                    for (const channel of finalChannels) {
                        const finalHash = getLatestChangeHash(shadowPath, channel);
                        const initialHash = initialStates.get(channel);
                        
                        if (finalHash && finalHash !== initialHash) {
                            updatedChannels.push(channel);
                            console.log(`SSH: Channel "${channel}" was updated (${initialHash} -> ${finalHash})`);
                        }
                    }
                    
                    if (updatedChannels.length === 0) {
                        console.log(`SSH: No channels were updated in this session`);
                        cleanupShadow();
                        try { channel.exit(code ?? 0); channel.end(); } catch (e) {}
                        return;
                    }
                    
                    console.log(`SSH: Updated channel(s): ${JSON.stringify(updatedChannels)}`);
                    
                    // Get user's open discussions from discussions.json
                    const getUserchannels=(updatedChannels)=>{
                      let userChannelNames = [];
                      try {
                        if(!isDeveloper){
                          const discData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/discussions.json'), 'utf8'));
                          const userDiscussions = discData.filter(d => 
                            d.owner === repoOwner && 
                            d.repoName === repoName && 
                            d.author === username && 
                            d.status === 'open'
                        );
                          userChannelNames = userDiscussions.map(d => d.sourceChannel);
                        }
                          console.log(`SSH: User's open discussion channels: ${JSON.stringify(userChannelNames)}`);
                          return updatedChannels.filter(channel => 
                               userChannelNames.includes(channel)
                             )
                        } catch (err) {
                          console.error(`SSH: Failed to read discussions.json: ${err.message}`);
                          return [];
                       }
                    }
                    
                    const getunprotectedchannel=(updatedChannels)=>{
                        try{
                        const repoData=JSON.parse(fs.readFileSync(path.join(__dirname, '../data/repos.json'), 'utf8'));
                        const prchannels=repoData.find((repo)=>repo.name==repoName &&repo.owner==repoOwner).protectedChannels;
                        // console.log(repoData.find((repo)=>(repo.name==repoName) && repo.owner==repoOwner));
                        console.log(`SSH: get repo protected channels : ${JSON.stringify(prchannels)}`);

                        const unprchannle= updatedChannels.filter((ch)=>!prchannels.includes(ch));
                        console.log(`SSH: get repo unprotected channels : ${JSON.stringify(unprchannle)}`);
                        return unprchannle;
                        }catch(e){
                        console.error(`SSH: Failed to read repos.json: ${err.message}`);
                        return [];
                        }

                    }
                    // Find which updated channels belong to this user
                    const channelsToPull =isDeveloper?getunprotectedchannel(updatedChannels):getUserchannels(updatedChannels);
                    
                    
                    if (channelsToPull.length === 0) {
                        console.log(`SSH: Updated channels can't accessible by ${username}, skipping pull`);
                        cleanupShadow();
                        console.log("nothing is updated")
                        channel.stderr.write("(permission denied) nothing is changed\n")
                        try { channel.exit(code ?? 0); channel.end(); } catch (e) {}
                        return;
                    }
                    
                    console.log(`SSH: Pulling ${channelsToPull.length} channel(s) belonging to user: ${JSON.stringify(channelsToPull)}`);
                    
                    // Pull only the channels that were updated and belong to user
                    for (const channel of channelsToPull) {
                        console.log(`SSH: Pulling changes for channel "${channel}" from shadow to real repository...`);
                        try {
                            // Check if channel exists in real repo
                            const realChanResult = spawnSync('pijul', ['channel'], { cwd: repoSourcePath, encoding: 'utf8' });
                            const realChannels = (realChanResult.stdout || '').split('\n')
                                .map(l => l.trim().replace(/^\* /, '').trim())
                                .filter(Boolean);
                            
                            if (!realChannels.includes(channel)) {
                                console.log(`SSH: Channel "${channel}" does not exist in real repo, creating it...`);
                                execSync(`pijul channel create "${channel}"`, { cwd: repoSourcePath, stdio: 'pipe' });
                                console.log(`SSH: Channel "${channel}" created in real repo`);
                            }
                            
                            // Pull changes from shadow to real repo
                            execSync(
                                `pijul pull --to-channel "${channel}" --from-channel "${channel}" --no-prompt "${shadowPath}"`,
                                { 
                                    cwd: repoSourcePath, 
                                    timeout: 30000, 
                                    env: { ...process.env, EDITOR: 'true', VISUAL: 'true' },
                                    stdio: 'pipe'
                                }
                            );
                            console.log(`SSH: Successfully pulled changes for "${channel}" from shadow to real repo`);
                        } catch (pullErr) {
                            console.error(`SSH: Failed to pull changes for "${channel}": ${pullErr.message}`);
                        }
                    }
                } catch (err) {
                    console.error(`SSH: Failed to sync channels from shadow to real repo: ${err.message}`);
                }
            } else {
                console.log(`SSH: Shadow command failed with code ${code}, skipping sync to real repo`);
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

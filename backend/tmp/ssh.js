const fs = require('fs');
const path = require('path');
const { Server } = require('ssh2');
const { spawn } = require('child_process');
const { mkdirSync } = require('node:fs');
const REPOS_PATH = path.join(__dirname, '../repos');
const HOST_DATA_DIR_PATH =  path.join(__dirname, '../../data');
const HOST_KEY_PATH = path.join(HOST_DATA_DIR_PATH, 'host_key');
console.log(REPOS_PATH);
if (!fs.existsSync(HOST_KEY_PATH)) {
    console.log('Generating SSH host key...');
    const { execSync } = require('child_process');
    mkdirSync(HOST_DATA_DIR_PATH, { recursive: true });
    execSync(`ssh-keygen -t ed25519 -f "${HOST_KEY_PATH}" -N ""`);
}

const server = new Server({
    hostKeys: [fs.readFileSync(HOST_KEY_PATH)]
}, (client) => {
    let authUser = null;

    client.on('authentication', async(ctx) => {
        ctx.accept();
    }).on('ready', () => {
        client.on('session', (accept, reject) => {
            const session = accept();
            session.on('exec', async (accept, reject, info) => {
                const exec = accept();
                const cmd = info.command;
                console.log(`SSH: info: ${JSON.stringify(info)}`);
                try {
                    await handleCommand(authUser, cmd, exec);
                } catch(e) {
                    // Fix 1: Safely write string data to the stream
                    exec.stderr.write(e.stack || String(e));
                    // Fix 2: 'channel' was undefined here, it's called 'exec'
                    if (typeof exec.exit === 'function') {
                        exec.exit(1);
                    }
                    exec.end();
                }
            });
        });
    });
});

async function handleCommand(username, fullCmd, channel) {
    // Fix 3: Parse and extract the actual arguments for pijul
    const args = fullCmd.split(' ');
    const commandName = args.shift(); // removes 'pijul'
    
    if (commandName !== 'pijul') {
        throw new Error(`Unsupported binary command: ${commandName}`);
    }

    const child = spawn('pijul', args, {
        cwd: REPOS_PATH,
        env: { ...process.env, HOME: '/tmp' }
    });

   channel.stdin.on('data', (data) => {
    // 1. Find the first newline character (byte value 10 for '\n')
    const newlineIndex = data.indexOf(10); 

    if (newlineIndex !== -1) {
        // 2. Extract only the bytes up to that first newline
        const firstLineBuffer = data.subarray(0, newlineIndex);
        const firstLineText = firstLineBuffer.toString('utf8');

        // 3. Match your text command pattern (e.g., 'apply <channel> <hash>')
        if (firstLineText.startsWith('apply')) {
            const parts = firstLineText.trim().split(' ');
            const action = parts[0];       // 'apply'
            const targetChannel = parts[1]; // 'main'
            const patchHash = parts[2];     // 'EGZ3MCRETQDWDWU3KXZX34BXU6TFKRG6FYBC25MV7OPXOSQEPNIAC'

            console.log(`[Intercepted Command] Action: ${action}, Channel: ${targetChannel}, Hash: ${patchHash}`);
        }
    }

    // Always pass the raw, untouched binary data directly to the child process
    child.stdin.write(data);
});

    // channel.stdin.pipe(child.stdin);

//     child.stdout.on('data', (data) => {
//     // Log outgoing stdout data from the pijul child process
//     console.log('Interceptors - Data sending:', data.toString());
    
//     // Pass the data along to the SSH channel
//     channel.stdout.write(data);
// });
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

if (require.main === module) {
    startSshServer(2222);
}

module.exports = { startSshServer };

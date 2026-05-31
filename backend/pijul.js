const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPOS_PATH = path.join(__dirname,process.env.PIJUL_REPO_PATH || '../repos/pijul_repos');

function runPijul(owner, repoName, args) {
    return new Promise((resolve, reject) => {
        const cwd = (owner && repoName)
            ? path.join(REPOS_PATH, owner, repoName)
            : REPOS_PATH;
        exec(`pijul ${args}`, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject(stderr || error.message);
                return;
            }
            resolve(stdout);
        });
    });
}

const pijul = {

    async listRepos() {
        if (!fs.existsSync(REPOS_PATH)) {
            fs.mkdirSync(REPOS_PATH, { recursive: true });
        }
        return fs.readdirSync(REPOS_PATH).filter(f => 
            fs.statSync(path.join(REPOS_PATH, f)).isDirectory() && 
            fs.existsSync(path.join(REPOS_PATH, f, '.pijul'))
        );
    },

    async initRepo(owner, name) {
        const ownerPath = path.join(REPOS_PATH, owner);
        if (!fs.existsSync(ownerPath)) fs.mkdirSync(ownerPath, { recursive: true });
        return runPijul(null, null, `init ${path.join(ownerPath, name)}`);
    },

    async getLog(owner, repoName, channel = 'main',page = 1, limit = 10) {
        
        let offset = (page-1)*limit;
        const output = await runPijul(owner, repoName, `log --channel "${channel}" --description  --limit ${limit} --offset ${offset}`);
        // Parse log output. Pijul log is usually like:
        // Change <HASH>
        // Author: <AUTHOR>
        // Date: <DATE>
        // <MESSAGE>
        const patches = [];
        const lines = output.split('\n');
        let currentPatch = null;
         
        for (const line of lines) {
            if (line.startsWith('Change ')) {
                if (currentPatch) patches.push(currentPatch);
                currentPatch = { hash: line.split(' ')[1], message: '' };
            } else if (line.startsWith('Author: ')) {
                currentPatch.author = line.replace('Author: ', '');
            } else if (line.startsWith('Date: ')) {
                currentPatch.date = line.replace('Date: ', '');
            } else if (line.trim() !== '' && currentPatch && !line.startsWith('Change ') && !line.startsWith('Author: ') && !line.startsWith('Date: ')) {
                currentPatch.message += line.trim() + ' ';
            }
        }
        if (currentPatch) patches.push(currentPatch);
        return {
            isLastPage:(patches.length==0),
            patches
        };
    },

    async getTree(owner, repoName, subPath = '', channel = 'main') {
        const repoPath = path.join(REPOS_PATH, owner, repoName);
        const { getRepositoryFiles } = await import('./pijul-reader/index.js');
        const allFiles = getRepositoryFiles(repoPath, channel, subPath);
        
        const prefix = subPath ? (subPath.endsWith('/') ? subPath : subPath + '/') : '';
        const levelFiles = new Map();
        
        for (const file of allFiles) {
            if (!file.path.startsWith(prefix)) continue;
            
            const relativePath = file.path.slice(prefix.length);
            if (relativePath === '') continue; // The directory itself
            
            const parts = relativePath.split('/');
            const name = parts[0];
            const isDir = parts.length > 1 || file.isDir;
            
            if (!levelFiles.has(name)) {
                levelFiles.set(name, { path: name, isDir });
            } else if (isDir) {
                levelFiles.get(name).isDir = true;
            }
        }
        
        return Array.from(levelFiles.values());
    },

    async getFileContent(owner, repoName, filePath, channel = 'main') {
        const repoPath = path.join(REPOS_PATH, owner, repoName);
        const { getFileContent } = await import('./pijul-reader/index.js');
        try {
            const content = getFileContent(repoPath, channel, filePath);
            return content.toString('utf8');
        } catch (error) {
            throw new Error('File not found or unreadable');
        }
    },
    async getMergeconflictinfo(owner,repoName,sourcechannel,targetchannel='main'){
        const repoPath = path.join(REPOS_PATH, owner, repoName);
        const { getMergeConflicts} = await import('./pijul-reader/index.js')
        try {
            conflicts=getMergeConflicts(repoPath,sourcechannel,targetchannel);
        
            return conflicts; 
        }catch(e){
            throw new Error("merge conflict detection failed");
        }
    },

    async getPatch(owner, repoName, hash, channel = 'main') {
        const repoPath = path.join(REPOS_PATH, owner, repoName);
        const { getChangeDetails } = await import('./pijul-reader/index.js');
        return getChangeDetails(repoPath, hash, channel);
    },

    async getChannels(owner, repoName) {
        const output = await runPijul(owner, repoName, 'channel');
        // Pijul channel output lists channels, with current marked by *
        return output.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => ({
                name: line.replace('* ', '').trim(),
                isCurrent: line.startsWith('*')
            }));
    },

    async switchChannel(owner, repoName, channelName) {
        return runPijul(owner, repoName, `channel switch ${channelName}`);
    },

    async forkRepo(sourceOwner, sourceRepoName, destOwner, destRepoName) {
        const sourcePath = path.join(REPOS_PATH, sourceOwner, sourceRepoName);
        const destOwnerPath = path.join(REPOS_PATH, destOwner);
        const destPath = path.join(REPOS_PATH, destOwner, destRepoName);

        if (!fs.existsSync(sourcePath)) throw new Error('Source repository not found');
        if (fs.existsSync(destPath)) throw new Error('Destination repository already exists');

        if (!fs.existsSync(destOwnerPath)) fs.mkdirSync(destOwnerPath, { recursive: true });
        fs.cpSync(sourcePath, destPath, { recursive: true });
        return true;
    },

    async getDiff(owner, repoName, hash) {
        return runPijul(owner, repoName, `change ${hash}`);
    },

    async deleteRepo(owner, repoName) {
        const fullPath = path.join(REPOS_PATH, owner, repoName);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    },

    async pullChannel(owner, repoName, fromChannel, toChannel) {
        // In Pijul: pijul pull --from-channel from --channel target
        return runPijul(owner, repoName, `pull --from-channel ${fromChannel} --to-channel ${toChannel} --all .`);
    },

    async createChannel(owner, repoName, channelName) {
        return runPijul(owner, repoName, `channel new ${channelName}`);
    },

    async deleteChannel(owner, repoName, channelName) {
        return runPijul(owner, repoName, `channel delete ${channelName}`);
    },
     extractPijulChangeMessage(pijulRepoPath, changeHash) {
    try {
        // Get the change details using pijul change command
        const output = execSync(`pijul change ${changeHash}`, { 
            cwd: pijulRepoPath, 
            encoding: 'utf8' 
        });
        
        // Parse the output to extract message
        // The message appears as: message = "content"
        const messageMatch = output.match(/message = "([^"]*)"/);
        
        if (messageMatch && messageMatch[1]) {
            return {
                success: true,
                hash: changeHash,
                message: messageMatch[1]
            };
        }
        
        // Handle case where message is empty (like the root change in your example)
        return {
            success: true,
            hash: changeHash,
            message: "", // Empty message
            raw: output
        };
        
    } catch (error) {
        console.error(`Error extracting message for change ${changeHash}: ${error.message}`);
        return {
            success: false,
            error: error.message,
            hash: changeHash,
            message: null
        };
    }
}

};

module.exports = pijul;

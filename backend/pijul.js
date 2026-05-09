const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPOS_PATH = path.join(__dirname, '../repos');

function runPijul(repoName, args) {
    return new Promise((resolve, reject) => {
        const cwd = repoName ? path.join(REPOS_PATH, repoName) : REPOS_PATH;
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

    async initRepo(name) {
        return runPijul(null, `init ${name}`);
    },

    async getLog(repoName) {
        const output = await runPijul(repoName, 'log --description');
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
        return patches;
    },

    async getTree(repoName, subPath = '') {
        const output = await runPijul(repoName, 'ls');
        const files = output.split('\n').filter(f => f.trim() !== '');
        
        // Convert flat list to tree if needed, but for now just return flat list
        // or filter by subPath
        if (!subPath) {
            return files.filter(f => !f.includes('/'));
        }
        const prefix = subPath.endsWith('/') ? subPath : subPath + '/';
        return files
            .filter(f => f.startsWith(prefix))
            .map(f => f.slice(prefix.length))
            .filter(f => !f.includes('/'));
    },

    async getFileContent(repoName, filePath) {
        const fullPath = path.join(REPOS_PATH, repoName, filePath);
        if (!fs.existsSync(fullPath)) {
            throw new Error('File not found');
        }
        return fs.readFileSync(fullPath, 'utf8');
    },

    async getPatch(repoName, hash) {
        return runPijul(repoName, `change ${hash}`);
    },

    async deleteRepo(repoName) {
        const fullPath = path.join(REPOS_PATH, repoName);
        if (fs.existsSync(fullPath)) {
            fs.rmSync(fullPath, { recursive: true, force: true });
        }
    }
};

module.exports = pijul;

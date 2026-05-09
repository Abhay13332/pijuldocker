const fs = require('fs');
const path = require('path');

const REPO_META_FILE = path.join(__dirname, '../data/repos.json');

if (!fs.existsSync(path.dirname(REPO_META_FILE))) {
    fs.mkdirSync(path.dirname(REPO_META_FILE), { recursive: true });
}

if (!fs.existsSync(REPO_META_FILE)) {
    fs.writeFileSync(REPO_META_FILE, JSON.stringify([]));
}

const repoStore = {
    getAll() {
        return JSON.parse(fs.readFileSync(REPO_META_FILE, 'utf8'));
    },

    getByName(name) {
        return this.getAll().find(r => r.name === name) || null;
    },

    saveAll(data) {
        fs.writeFileSync(REPO_META_FILE, JSON.stringify(data, null, 2));
    },

    create(name, owner, isPrivate = false) {
        const data = this.getAll();
        if (data.find(r => r.name === name)) throw new Error('Repository already exists');
        
        const newRepo = { 
            name, 
            owner, 
            isPrivate, 
            collaborators: [], // Array of { username, role }
            createdAt: new Date().toISOString() 
        };
        data.push(newRepo);
        this.saveAll(data);
        return newRepo;
    },

    getUserRole(repoName, username) {
        const data = this.getAll();
        const repo = data.find(r => r.name === repoName);
        if (!repo) return null;
        if (repo.owner === username) return 'owner';
        
        const collab = repo.collaborators?.find(c => c.username === username);
        if (collab) return collab.role;

        return repo.isPrivate ? null : 'viewer'; // Default for public repos
    },

    getVisible(username) {
        const data = this.getAll();
        return data.filter(r => {
            if (!r.isPrivate) return true;
            if (r.owner === username) return true;
            return r.collaborators?.some(c => c.username === username);
        });
    },

    canAccess(name, username, requiredLevel = 'read') {
        const role = this.getUserRole(name, username);
        if (!role) return false;

        const levels = {
            'read': ['owner', 'maintainer', 'developer', 'viewer'],
            'write': ['owner', 'maintainer', 'developer'],
            'manage': ['owner', 'maintainer'],
            'delete': ['owner']
        };

        return levels[requiredLevel].includes(role);
    },

    addCollaborator(name, username, role = 'developer') {
        const data = this.getAll();
        const repo = data.find(r => r.name === name);
        if (!repo) throw new Error('Repository not found');
        if (!repo.collaborators) repo.collaborators = [];
        
        const existing = repo.collaborators.find(c => c.username === username);
        if (existing) {
            existing.role = role;
        } else {
            repo.collaborators.push({ username, role });
        }
        
        this.saveAll(data);
        return repo;
    },

    removeCollaborator(name, username) {
        const data = this.getAll();
        const repo = data.find(r => r.name === name);
        if (!repo) throw new Error('Repository not found');
        if (!repo.collaborators) return repo;
        repo.collaborators = repo.collaborators.filter(c => c.username !== username);
        this.saveAll(data);
        return repo;
    },

    delete(name) {
        const data = this.getAll();
        const filtered = data.filter(r => r.name !== name);
        this.saveAll(filtered);
    }
};

module.exports = repoStore;

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

    getByOwnerAndName(owner, name) {
        return this.getAll().find(r => r.name === name && r.owner === owner) || null;
    },

    getByName(name, ownerHint = null) {
        const all = this.getAll();
        // If an owner hint is provided, prefer exact owner+name match
        if (ownerHint) {
            const exact = all.find(r => r.name === name && r.owner === ownerHint);
            if (exact) return exact;
        }
        // Otherwise return first match (for backward compat with single-owner setups)
        return all.find(r => r.name === name) || null;
    },

    saveAll(data) {
        fs.writeFileSync(REPO_META_FILE, JSON.stringify(data, null, 2));
    },

    create(name, owner, isPrivate = false) {
        const data = this.getAll();
        if (data.find(r => r.name === name && r.owner === owner)) throw new Error('Repository already exists for this owner');
        
        const newRepo = { 
            id: Math.random().toString(36).substring(2, 10),
            name, 
            owner, 
            isPrivate, 
            collaborators: [], // Array of { username, role }
            protectedChannels: ['main'], // Default protected channel
            createdAt: new Date().toISOString() 
        };
        data.push(newRepo);
        this.saveAll(data);
        return newRepo;
    },

    getUserRole(owner, name, username) {
        const repo = this.getByOwnerAndName(owner, name);
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

    canAccess(owner, name, username, requiredLevel = 'read') {
        const role = this.getUserRole(owner, name, username);
        if (!role) return false;

        const levels = {
            'read': ['owner', 'maintainer', 'developer', 'viewer'],
            'write': ['owner', 'maintainer', 'developer'],
            'manage': ['owner', 'maintainer'],
            'delete': ['owner']
        };

        return levels[requiredLevel].includes(role);
    },

    addCollaborator(owner, name, username, role = 'developer') {
        const data = this.getAll();
        const repo = data.find(r => r.name === name && r.owner === owner);
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

    removeCollaborator(owner, name, username) {
        const data = this.getAll();
        const repo = data.find(r => r.name === name && r.owner === owner);
        if (!repo) throw new Error('Repository not found');
        if (!repo.collaborators) return repo;
        repo.collaborators = repo.collaborators.filter(c => c.username !== username);
        this.saveAll(data);
        return repo;
    },

    toggleProtectedChannel(owner, name, channel) {
        const data = this.getAll();
        const repo = data.find(r => r.name === name && r.owner === owner);
        if (!repo) throw new Error('Repository not found');
        if (!repo.protectedChannels) repo.protectedChannels = [];
        
        const idx = repo.protectedChannels.indexOf(channel);
        if (idx === -1) {
            repo.protectedChannels.push(channel);
        } else {
            repo.protectedChannels.splice(idx, 1);
        }
        this.saveAll(data);
        return repo;
    },

    isChannelProtected(owner, name, channel) {
        const repo = this.getByOwnerAndName(owner, name);
        if (!repo || !repo.protectedChannels) return false;
        return repo.protectedChannels.includes(channel);
    },

    delete(owner, name) {
        const data = this.getAll();
        const filtered = data.filter(r => !(r.name === name && r.owner === owner));
        this.saveAll(filtered);
    }
};

module.exports = repoStore;

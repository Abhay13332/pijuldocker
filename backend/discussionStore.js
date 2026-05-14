const fs = require('fs');
const path = require('path');

const DISCUSSIONS_FILE = path.join(__dirname, '../data/discussions.json');

if (!fs.existsSync(path.dirname(DISCUSSIONS_FILE))) {
    fs.mkdirSync(path.dirname(DISCUSSIONS_FILE), { recursive: true });
}

if (!fs.existsSync(DISCUSSIONS_FILE)) {
    fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify([]));
}

const discussionStore = {
    getAll() {
        return JSON.parse(fs.readFileSync(DISCUSSIONS_FILE, 'utf8'));
    },

    saveAll(data) {
        fs.writeFileSync(DISCUSSIONS_FILE, JSON.stringify(data, null, 2));
    },

    create(owner, repoName, title, description, author, sourceChannel, targetChannel) {
        const data = this.getAll();
        const repoDiscussions = data.filter(d => d.owner === owner && d.repoName === repoName);
        const nextId = (repoDiscussions.length + 1).toString();
        
        const newPR = {
            id: nextId,
            owner,
            repoName,
            title,
            description,
            author,
            sourceChannel: sourceChannel || `pr-${nextId}`,
            targetChannel: targetChannel || 'main',
            status: 'open', // open, merged, closed
            comments: [],
            createdAt: new Date().toISOString()
        };
        data.push(newPR);
        this.saveAll(data);
        return newPR;
    },

    getByRepo(owner, repoName) {
        return this.getAll().filter(d => d.owner === owner && d.repoName === repoName);
    },

    getByAuthor(owner, repoName, author) {
        return this.getAll().filter(d => d.owner === owner && d.repoName === repoName && d.author === author);
    },

    getById(owner, repoName, id) {
        return this.getAll().find(d => d.owner === owner && d.repoName === repoName && d.id === id);
    },

    addComment(id, author, text) {
        const data = this.getAll();
        const pr = data.find(d => d.id === id);
        if (!pr) throw new Error('Discussion not found');
        
        pr.comments.push({
            id: Date.now().toString(),
            author,
            text,
            createdAt: new Date().toISOString()
        });
        
        this.saveAll(data);
        return pr;
    },

    updateStatus(id, status) {
        const data = this.getAll();
        const pr = data.find(d => d.id === id);
        if (!pr) throw new Error('Discussion not found');
        
        pr.status = status;
        this.saveAll(data);
        return pr;
    }
};

module.exports = discussionStore;

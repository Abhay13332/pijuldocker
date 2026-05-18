const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const pijul = require('./pijul');
const users = require('./users');
const repoStore = require('./repoStore');
const discussionStore = require('./discussionStore');
const app = express();
const PORT = 3001;

const JWT_SECRET = 'pijul-serv-secret-key';

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        req.user = null;
        return next();
    }
    jwt.verify(token, JWT_SECRET, (err, user) => {
        req.user = err ? null : user;
        next();
    });
};

// --- API Routes ---

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.findByUsername(username);
    if (!user || user.password !== password) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, username: user.username });
});

app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = users.create(username, password);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.json({ token, username: user.username });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/user/profile', authenticateToken, (req, res) => {
    const user = users.findByUsername(req.user.username);
    const { password, ...userWithoutPassword } = user;
    res.json(userWithoutPassword);
});

// SSH Key Management
app.post('/api/user/keys', authenticateToken, (req, res) => {
    const { name, key } = req.body;
    try {
        const newKey = users.addSshKey(req.user.username, name, key);
        res.json(newKey);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/user/keys/:id', authenticateToken, (req, res) => {
    try {
        users.removeSshKey(req.user.username, req.params.id);
        res.json({ message: 'Key deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// --- Repo Endpoints ---

app.get('/api/repos', optionalAuthenticateToken, async (req, res) => {
    try {
        const username = req.user ? req.user.username : null;
        const repos = repoStore.getVisible(username);
        res.json(repos);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/api/repos', authenticateToken, async (req, res) => {
    const { name, isPrivate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        await pijul.initRepo(req.user.username, name);
        const repo = repoStore.create(name, req.user.username, isPrivate);
        res.json(repo);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Middleware: resolve repo by owner+name from URL — supports same-name repos for different users
const checkRepoAccess = (level) => (req, res, next) => {
    const owner = req.params.owner;
    const repoName = req.params.name;
    const username = req.user ? req.user.username : null;
    const repo = repoStore.getByOwnerAndName(owner, repoName);
    if (!repo) return res.status(404).json({ error: `Repository '${owner}/${repoName}' not found` });
    req.repo = repo;
    if (repoStore.canAccess(owner, repoName, username, level)) {
        next();
    } else {
        res.status(403).json({ error: `Insufficient permissions (requires ${level})` });
    }
};

app.get('/api/repos/:owner/:name/log', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const log = await pijul.getLog(req.repo.owner, req.repo.name, channel);
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:owner/:name/tree', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const tree = await pijul.getTree(req.repo.owner, req.repo.name, req.query.path || '', channel);
        res.json(tree);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:owner/:name/blob', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const content = await pijul.getFileContent(req.repo.owner, req.repo.name, req.query.path, channel);
        res.type('text/plain').send(content);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});


app.get('/api/repos/:owner/:name/patches/:hash', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const patch = await pijul.getPatch(req.repo.owner, req.repo.name, req.params.hash, req.query.channel);
        res.json({ patch });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:owner/:name/channels', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channels = await pijul.getChannels(req.repo.owner, req.repo.name);
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/api/repos/:owner/:name/channels/switch', authenticateToken, checkRepoAccess('write'), async (req, res) => {
    const { channel } = req.body;
    try {
        await pijul.switchChannel(req.repo.owner, req.repo.name, channel);
        res.json({ message: `Switched to channel ${channel}` });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/api/repos/:owner/:name/fork', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const sourceOwner = req.params.owner;
    const sourceName  = req.params.name;
    const sourceRepo  = req.repo;
    if (!sourceRepo) return res.status(404).json({ error: 'Source repository not found' });
    const newName = `${sourceName}-${req.user.username}`;
    try {
        await pijul.forkRepo(sourceOwner, sourceName, req.user.username, newName);
        const forked = repoStore.create(newName, req.user.username, sourceRepo.isPrivate);
        res.json(forked);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Collaborators
app.post('/api/repos/:owner/:name/collaborators', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const { username, role } = req.body;
    try {
        const updated = repoStore.addCollaborator(req.repo.owner, req.repo.name, username, role);
        res.json(updated.collaborators);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/repos/:owner/:name/collaborators/:username', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    try {
        const updated = repoStore.removeCollaborator(req.repo.owner, req.repo.name, req.params.username);
        res.json(updated.collaborators);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete a repository (owner only)
app.delete('/api/repos/:owner/:name', authenticateToken, checkRepoAccess('delete'), async (req, res) => {
    try {
        await pijul.deleteRepo(req.repo.owner, req.repo.name);
        repoStore.delete(req.repo.owner, req.repo.name);
        res.json({ message: 'Repository deleted' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Branch Protection
app.post('/api/repos/:owner/:name/protected-channels/toggle', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const { channel } = req.body;
    try {
        const updated = repoStore.toggleProtectedChannel(req.repo.owner, req.repo.name, channel);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Discussions / PRs
app.get('/api/repos/:owner/:name/discussions', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    const discussions = discussionStore.getByRepo(req.repo.owner, req.repo.name);
    res.json(discussions);
});

app.post('/api/repos/:owner/:name/discussions', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const { title, description, targetChannel } = req.body;
    try {
        const pr = discussionStore.create(req.repo.owner, req.repo.name, title, description, req.user.username, null, targetChannel || 'main');
        await pijul.createChannel(req.repo.owner, req.repo.name, `pr-${pr.id}`);
        res.json(pr);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:owner/:name/discussions/:id', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    const pr = discussionStore.getById(req.repo.owner, req.repo.name, req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });
    res.json(pr);
});

app.post('/api/repos/:owner/:name/discussions/:id/comments', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const { text } = req.body;
    try {
        const updatedPR = discussionStore.addComment(req.params.id, req.user.username, text);
        res.json(updatedPR);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/repos/:owner/:name/discussions/:id/merge', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr = discussionStore.getById(req.repo.owner, req.repo.name, req.params.id);
    
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });

    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });
     
    try {
        await pijul.pullChannel(req.repo.owner, req.repo.name, pr.sourceChannel, pr.targetChannel);
        
        discussionStore.updateStatus(req.params.id, 'merged');

        // Delete the source branch after merging
        try { await pijul.deleteChannel(req.repo.owner, req.repo.name, pr.sourceChannel); } catch (_) {}
        res.json({ message: 'Merged successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.toString() });
    }
});
//get merge conflicts in discussion
app.post('/api/repos/:owner/:name/discussions/:id/mergeconflicts',authenticateToken,checkRepoAccess('read'),async (req,res) => {
    const pr = discussionStore.getById(req.repo.owner, req.repo.name, req.params.id);
    if(!pr) return res.status(404).json({ error: 'Discussion not found' });
    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });
    try{
        let conflicts=await pijul.getMergeconflictinfo(req.repo.owner,req.repo.name,pr.sourceChannel,pr.targetChannel);
        if(conflicts.length==0){
            res.json({'isconflicts':false})
        }else{
            res.json({'isconflicts':true,conflicts:conflicts});
        }
    }catch{
        res.status(500).json({ error: error.toString() });
    }

})
// Close a discussion (marks closed + deletes branch, no merge)
app.post('/api/repos/:owner/:name/discussions/:id/close', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr = discussionStore.getById(req.repo.owner, req.repo.name, req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });
    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });

    try {
        discussionStore.updateStatus(req.params.id, 'closed');
        try { await pijul.deleteChannel(req.repo.owner, req.repo.name, pr.sourceChannel); } catch (_) {}
        res.json({ message: 'Discussion closed and branch deleted' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Delete a discussion entirely (removes record + deletes branch)
app.delete('/api/repos/:owner/:name/discussions/:id', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr = discussionStore.getById(req.repo.owner, req.repo.name, req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });

    try {
        // Remove from store
        const data = discussionStore.getAll().filter(
            d => !(d.owner === req.repo.owner && d.repoName === req.repo.name && d.id === req.params.id)
        );
        discussionStore.saveAll(data);
        // Delete the branch
        try { await pijul.deleteChannel(req.repo.owner, req.repo.name, pr.sourceChannel); } catch (_) {}
        res.json({ message: 'Discussion deleted and branch removed' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Client Setup Script Endpoint
app.get('/setup.sh', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../scripts/setup-client-ssh.sh'));
});

// Serve Frontend Static Files
app.use(express.static(path.join(__dirname, '../frontend/dist')));
// SPA fallback — serve index.html for any non-API route
app.use((req, res, next) => {
    // Only intercept non-API requests
    if (req.path.startsWith('/api/') || req.path === '/setup.sh') return next();
    res.sendFile(path.resolve(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Pijul WebUI Backend running on http://0.0.0.0:${PORT}`);
});

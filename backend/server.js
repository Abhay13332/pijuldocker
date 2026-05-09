const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const pijul = require('./pijul');
const users = require('./users');
const repoStore = require('./repoStore');

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

const checkRepoAccess = (level) => (req, res, next) => {
    const repoName = req.params.name;
    const username = req.user ? req.user.username : null;
    if (repoStore.canAccess(repoName, username, level)) {
        next();
    } else {
        res.status(403).json({ error: `Insufficient permissions (requires ${level})` });
    }
};

app.get('/api/repos/:name/log', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        const log = await pijul.getLog(repo.owner, req.params.name);
        res.json(log);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:name/tree', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        const tree = await pijul.getTree(repo.owner, req.params.name, req.query.path || '');
        res.json(tree);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:name/blob', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        const content = await pijul.getFileContent(repo.owner, req.params.name, req.query.path);
        res.send(content);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:name/patches/:hash', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        const patch = await pijul.getPatch(repo.owner, req.params.name, req.params.hash);
        res.json({ patch });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:name/channels', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        const channels = await pijul.getChannels(repo.owner, req.params.name);
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/api/repos/:name/channels/switch', authenticateToken, checkRepoAccess('write'), async (req, res) => {
    const { channel } = req.body;
    try {
        const repo = repoStore.getByName(req.params.name);
        await pijul.switchChannel(repo.owner, req.params.name, channel);
        res.json({ message: `Switched to channel ${channel}` });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.post('/api/repos/:name/fork', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const sourceName = req.params.name;
    const sourceRepo = repoStore.getByName(sourceName);
    if (!sourceRepo) return res.status(404).json({ error: 'Source repository not found' });

    try {
        const newRepoName = `${sourceName}-${req.user.username}`;
        await pijul.forkRepo(sourceRepo.owner, sourceName, req.user.username, newRepoName);
        const repo = repoStore.create(newRepoName, req.user.username, true);
        res.json(repo);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Collaborators
app.post('/api/repos/:name/collaborators', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const { username, role } = req.body;
    try {
        const repo = repoStore.addCollaborator(req.params.name, username, role);
        res.json(repo.collaborators);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/repos/:name/collaborators/:username', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    try {
        const repo = repoStore.removeCollaborator(req.params.name, req.params.username);
        res.json(repo.collaborators);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete a repository (owner only)
app.delete('/api/repos/:name', authenticateToken, checkRepoAccess('delete'), async (req, res) => {
    try {
        const repo = repoStore.getByName(req.params.name);
        await pijul.deleteRepo(repo.owner, req.params.name);
        repoStore.delete(req.params.name);
        res.json({ message: 'Repository deleted' });
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

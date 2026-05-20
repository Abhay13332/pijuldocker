const express = require('express');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const pijul = require('./pijul');
const users = require('./users');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const { initDatabase } = require('./db');
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
app.use(cookieParser()); 

app.use(bodyParser.json());


(async () => {
    try {
        // Initialize database tables
        await initDatabase();
        console.log('✅ Database initialized successfully');
        
        // Start your server after DB is ready
        const PORT = process.env.PORT || 3001;
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1); // Exit if database connection fails
    }
})();

//ok
// Auth Middleware
const authenticateToken = (req, res, next) => {
    let token = req.cookies?.token;
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};
//ok
const optionalAuthenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    let token = req.cookies?.token;
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
//ok
app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await users.findByUsername(username);
    if (!user || !(await (bcrypt.compare(password,user.password)))) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.cookie('token', token, {
          httpOnly: true,      // Prevents client-side JS from accessing the cookie
          sameSite:'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });
    res.json({  username: user.username });
});
//ok
app.post('/api/auth/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user =await  users.create(username, password);
        const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
        res.cookie('token', token, {
          httpOnly: true,      // Prevents client-side JS from accessing the cookie
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        res.json({ token, username: user.username });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
//ok
app.get('/api/user/profile', authenticateToken, async(req, res) => {
    const [user,keys] =await Promise.all([ users.findByUsername(req.user.username),users.getsshkeys(req.user.username)]);

    const { password, ...userWithoutPassword } = user;
    userWithoutPassword.sshKeys=keys;
    res.json(userWithoutPassword);
});

// SSH Key Management
//ok
app.post('/api/user/keys', authenticateToken,async (req, res) => {
    const { name, key } = req.body;
    try {
        await users.addSshKey(req.user.username, name, key);
        
        res.json({message:"key added "});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
//ok
app.delete('/api/user/keys/:id', authenticateToken,async (req, res) => {
    try {
        await users.removeSshKey(req.user.username, req.params.id);
        res.json({ message: 'Key deleted' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});
//ok
// Middleware: resolve repo by owner+name from URL — supports same-name repos for different users
const checkRepoAccess =  (level) => async(req, res, next) => {
    const owner = req.params.owner;
    const repoName = req.params.name;
    const username = req.user ? req.user.username : null;
    const repo =await  repoStore.getByOwnerAndName(owner, repoName);
    if (!repo) return res.status(404).json({ error: `Repository '${owner}/${repoName}' not found` });
    req.repo = repo;
    if (await repoStore.canAccess(owner, repoName, username, level,repo.id)) {
        next();
    } else {
        res.status(403).json({ error: `Insufficient permissions (requires ${level})` });
    }
};
// --- Repo Endpoints ---
//ok
app.get('/api/repos', optionalAuthenticateToken, async (req, res) => {
    try {
        const username = req.user ? req.user.username : null;
        const repos = await repoStore.getVisible(username);
        res.json(repos);
    } catch (error) {
        res.status(500).json({ error: error.toString() })``;
    }
});//ok
app.get('/api/repos/personal',authenticateToken,async(req,res)=>{
     try {
        const username = req.user ? req.user.username : null;
        const repoPage = await repoStore.getPersonalRepos(username,req.query.page,req.query.limit);
        res.json(repoPage);
    } catch (error) {
        res.status(500).json({ error: error.toString() })``;
    }
});//ok
app.get('/api/repos/collaborators',authenticateToken,async(req,res)=>{
     try {
        const username = req.user ? req.user.username : null;
        const repoPage = await repoStore.getCollabRepos(username,req.query.page,req.query.limit);
        res.json(repoPage);
    } catch (error) {
        res.status(500).json({ error: error.toString() })``;
    }
});//ok
app.get('/api/repos/public',authenticateToken,async(req,res)=>{
     try {
        const username = req.user ? req.user.username : null;
        const repoPage = await repoStore.getPublicRepos(username,req.query.page,req.query.limit);
        res.json(repoPage);
    } catch (error) {
        res.status(500).json({ error: error.toString() })``;
    }
});//ok
app.get('/api/repo/:owner/:name/meta' ,optionalAuthenticateToken,checkRepoAccess('read'),async(req,res)=>{
    res.json(req.repo);
});
//ok
app.post('/api/repos', authenticateToken, async (req, res) => {
    const { name, isPrivate } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        await pijul.initRepo(req.user.username, name);
        const repo =await  repoStore.create(name, req.user.username, isPrivate);
        res.json(repo);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

//ok
app.get('/api/repos/:owner/:name/log', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const page=req.query.page||1;
        const limit=req.query.limit||10;
        const logData = await pijul.getLog(req.repo.owner, req.repo.name, channel,page,limit);
        res.json(logData);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

//ok
app.get('/api/repos/:owner/:name/tree', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const tree = await pijul.getTree(req.repo.owner, req.repo.name, req.query.path || '', channel);
        res.json(tree);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});
//ok
app.get('/api/repos/:owner/:name/blob', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channel = req.query.channel || 'main';
        const content = await pijul.getFileContent(req.repo.owner, req.repo.name, req.query.path, channel);
        res.type('text/plain').send(content);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

//ok
app.get('/api/repos/:owner/:name/patches/:hash', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const patch = await pijul.getPatch(req.repo.owner, req.repo.name, req.params.hash, req.query.channel);
        res.json({ patch });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});
//ok
app.get('/api/repos/:owner/:name/channels', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    try {
        const channels = await pijul.getChannels(req.repo.owner, req.repo.name);
        res.json(channels);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});
//ok
app.post('/api/repos/:owner/:name/channels/switch', authenticateToken, checkRepoAccess('write'), async (req, res) => {
    const { channel } = req.body;
    try {
        await pijul.switchChannel(req.repo.owner, req.repo.name, channel);
        res.json({ message: `Switched to channel ${channel}` });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});
//ok
app.post('/api/repos/:owner/:name/fork', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const sourceOwner = req.params.owner;
    const sourceName  = req.params.name;
    const sourceRepo  = req.repo;
    if (!sourceRepo) return res.status(404).json({ error: 'Source repository not found' });
    const newName = `${sourceName}-${req.user.username}`;
    try {
        await pijul.forkRepo(sourceOwner, sourceName, req.user.username, newName);
        const forked = await repoStore.create(newName, req.user.username, sourceRepo.isPrivate);
        res.json(forked);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});
//ok
// Collaborators
app.get('/api/repos/:owner/:name/collaborators',authenticateToken,checkRepoAccess('read'),async (req,res) =>{
    try{
        let collaborator=await repoStore.getCollaborators(req.repo.owner,req.repo.name,req.repo.id);
        res.json(collaborator);
    }catch(error){
        res.status(400).json({ error: error.message });

    }
})

app.post('/api/repos/:owner/:name/collaborators', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const { username, role } = req.body;
    try {
        const updatedcollaborators =await repoStore.addCollaborator(req.repo.owner, req.repo.name, username, role,req.repo.id);
        res.json({message:"collaborator added"});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.delete('/api/repos/:owner/:name/collaborators/:username', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    try {
        const updated =await  repoStore.removeCollaborator(req.repo.owner, req.repo.name, req.params.username,req.repo.id);
        res.json({message:"collaborator removed"});
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Delete a repository (owner only)
app.delete('/api/repos/:owner/:name', authenticateToken, checkRepoAccess('delete'), async (req, res) => {
    try {
        await pijul.deleteRepo(req.repo.owner, req.repo.name);
        await repoStore.delete(req.repo.owner, req.repo.name);
        res.json({ message: 'Repository deleted' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Branch Protection
app.get('/api/repos/:owner/:name/protected-channels',authenticateToken, checkRepoAccess('read'),async(req,res)=>{
    try{
        let protectedCh=await repoStore.getProtectedCh(req.repo.id);
        res.json(protectedCh);
    }catch(error){
        res.status(400).json({ error: error.message });

    }
})
app.post('/api/repos/:owner/:name/protected-channels/toggle', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const { channel } = req.body;
    try {
         repoStore.toggleProtectedChannel(req.repo.owner, req.repo.name, channel,req.repo.id);
        res.json({message:"updated succesfully"});//channles data only
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Discussions / PRs
app.get('/api/repos/:owner/:name/discussions', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    const page=req.query.page||1;
    const limit=req.query.limit||10;
    const discussions =await discussionStore.getByRepo(req.repo.owner, req.repo.name,page,limit);
    res.json(discussions);
});

app.post('/api/repos/:owner/:name/discussions', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const { title, description, targetChannel } = req.body;
    try {
        const pr = await discussionStore.create(req.repo.owner, req.repo.name, title, description, req.user.username, null, targetChannel || 'main');
        await pijul.createChannel(req.repo.owner, req.repo.name, pr.sourceChannel);
        res.json(pr);
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

app.get('/api/repos/:owner/:name/discussions/:id', optionalAuthenticateToken, checkRepoAccess('read'), async (req, res) => {
    const pr =await discussionStore.getById(req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });
    res.json(pr);
});

app.post('/api/repos/:owner/:name/discussions/:id/comments', authenticateToken, checkRepoAccess('read'), async (req, res) => {
    const { text } = req.body;
    try {
        const updatedPR =await discussionStore.addComment(req.params.id, req.user.username, text);
        res.json(updatedPR);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/repos/:owner/:name/discussions/:id/merge', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr = await discussionStore.getById( req.params.id);
    
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });

    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });
     
    try {
        await pijul.pullChannel(req.repo.owner, req.repo.name, pr.sourceChannel, pr.targetChannel);
        
       await discussionStore.updateStatus(req.params.id, 'merged');

        // Delete the source branch after merging
        try { await pijul.deleteChannel(req.repo.owner, req.repo.name, pr.sourceChannel); } catch (_) {}
        res.json({ message: 'Merged successfully' });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: error.toString() });
    }
});
//get merge conflicts in discussion
app.get('/api/repos/:owner/:name/discussions/:id/mergeconflicts',authenticateToken,checkRepoAccess('read'),async (req,res) => {
    const pr =await discussionStore.getById(req.params.id);
    if(!pr) return res.status(404).json({ error: 'Discussion not found' });
    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });
    try{
        let conflicts=await pijul.getMergeconflictinfo(req.repo.owner,req.repo.name,pr.sourceChannel,pr.targetChannel);
        if(conflicts.length==0){
            res.json({'isconflicts':false})
        }else{
            res.json({'isconflicts':true,conflicts:conflicts});
        }
    }catch(error){
        res.status(500).json({ error: error.toString() });
    }

})
// Close a discussion (marks closed + deletes branch, no merge)
app.post('/api/repos/:owner/:name/discussions/:id/close', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr =await discussionStore.getById( req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });
    if (pr.status !== 'open') return res.status(400).json({ error: 'Already merged or closed' });

    try {
        await discussionStore.updateStatus(req.params.id, 'closed');
        try { await pijul.deleteChannel(req.repo.owner, req.repo.name, pr.sourceChannel); } catch (_) {}
        res.json({ message: 'Discussion closed and branch deleted' });
    } catch (error) {
        res.status(500).json({ error: error.toString() });
    }
});

// Delete a discussion entirely (removes record + deletes branch)
app.delete('/api/repos/:owner/:name/discussions/:id', authenticateToken, checkRepoAccess('manage'), async (req, res) => {
    const pr =await discussionStore.getById( req.params.id);
    if (!pr) return res.status(404).json({ error: 'Discussion not found' });

    try {
        // Remove from store
       await discussionStore.removedCompletely(req.params.id);
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

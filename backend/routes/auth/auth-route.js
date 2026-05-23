const express = require('express');
const jwt = require('jsonwebtoken');
const users = require('../.././users');
const JWT_SECRET = process.env.JWT_SECRET||"my-secret-password";
const {authenticateToken} = require('./tokens');
const bcrypt = require('bcrypt');
const {getGithubAccessToken} = require('../../github/gittoken');
const router = express.Router();
//ok
router.post('/api/auth/login', async (req, res) => {
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
router.post('/api/auth/register', async (req, res) => {
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
router.get('/api/user/profile', authenticateToken, async(req, res) => {
    const [user,keys] =await Promise.all([ users.findByUsername(req.user.username),users.getsshkeys(req.user.username)]);

    const { password, ...userWithoutPassword } = user;
    userWithoutPassword.sshKeys=keys;
    res.json(userWithoutPassword);
});
router.get('/api/auth/github', async (req, res) => {
    const { code,installation_id } = req.query;
    const user=req.user;
    if(!code || !installation_id ) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    res.redirect("/dashboard");
    const {longLivedToken,refreshToken} = await getGithubAccessToken(code);
    
})

module.exports = router;
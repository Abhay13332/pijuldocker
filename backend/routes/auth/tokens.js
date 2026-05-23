const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET||"my-secret-password";
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

module.exports = { authenticateToken, optionalAuthenticateToken };
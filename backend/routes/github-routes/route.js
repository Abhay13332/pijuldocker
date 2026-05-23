// routes/webhook.js
const express = require('express');
const crypto = require('crypto');
const {ghApp} = require('../../github/gittoken');
const ghWebhhoks=ghApp.webhooks;



const router = express.Router();
router.use((req, res, next) => {
  if (req.url === "/webhooks" && req.method === "POST") {
    return ghApp.webhooks.middleware(req, res);
  }
  next();
})

module.exports = router;


//latest peice
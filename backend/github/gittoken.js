let {Octokit}=require("@octokit/core");
let {createOAuthUserAuth}=require("@octokit/auth-oauth-user");
let path=require("node:path");
let fs=require("node:fs");
let crypto=require("crypto");
const GITHUB_PRIVATE_KEY = fs.readFileSync(process.env.GITHUB_KEY_PATH, "utf8");
// let octoApp=new OctoApp({
//     appId:process.env.GITHUB_APP_ID,
//     privateKey:privateKey
// })
const ghApp = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: GITHUB_PRIVATE_KEY,
  oauth: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  webhooks: {
    secret: process.env.GITHUB_WEBHOOK_SECRET,
  },
});

async function getGithubAccessToken(code) {
    // Implementation for getting GitHub token
const octokit = new ghApp.oauth.getUserOctokit({ code });

    const authData = await octokit.auth();
    const {token:longLivedToken,refreshToken,expiresAt} = authData; // This starts with "gho_"
    console.log("Obtained GitHub token:", longLivedToken);
    console.log("Obtained Github refresh token :",refreshToken)
    // 3. Encrypt the token for safety
    return {longLivedToken,refreshToken,expiresAt};

}

module.exports = {ghApp,getGithubAccessToken} ;
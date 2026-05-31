const crypto = require("crypto");
const { Octokit } = require("@octokit/core");
const { createOAuthUserAuth } = require("@octokit/auth-oauth-user");
const { createAppAuth } = require("@octokit/auth-app");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { pool } = require("../db");
const {ghApp}= require("./gittoken");
const { get } = require("http");
const pijul = require("../pijul");
const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY, "hex");
const IV_LENGTH = 16;

const gitStore = {
  // Store user token with encryption

  encryptToken(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
  },

  decryptToken(text) {
    const textParts = text.split(":");
    const iv = Buffer.from(textParts.shift(), "hex");
    const encryptedText = Buffer.from(textParts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  },
  getDefaultExpiryDate() {
    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + 8 * 60 * 60 * 1000);
    return expiryDate;
  },

 async storeUserInfo(
  pijulUsername,
  {
    userToken = null,
    gitRefreshToken = null,
    installationId = null,
    expiryDate = null,
    githubUsername = null,
    connectionType = 'user'
  },
) {
  try {
    // Encrypt tokens only if they are provided
    const encryptedUserToken = userToken ? this.encryptToken(userToken) : null;
    const encryptedRefreshToken = gitRefreshToken
      ? this.encryptToken(gitRefreshToken)
      : null;

    // Check if user exists
    const userResult = await pool.query(
      `SELECT id FROM users WHERE username = $1`,
      [pijulUsername],
    );

    if (userResult.rows.length === 0) {
      throw new Error(`User ${pijulUsername} not found`);
    }

    const userId = userResult.rows[0].id;

    // Use provided expiry date or calculate default (30 days from now)
    const finalExpiryDate = expiryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Insert or update - matching your git_info table schema
    await pool.query(
      `
      INSERT INTO git_info (
        user_id, 
        provider, 
        provider_username, 
        access_token, 
        refresh_token, 
        installation_id, 
        token_expires_at,
        connection_type
      )
      VALUES ($1, 'github', $2, $3, $4, $5, $6,$7,$8)
      ON CONFLICT (user_id, provider) DO UPDATE SET
      provider_username = COALESCE($2, git_info.provider_username),
      access_token = COALESCE($3, git_info.access_token),
      refresh_token = COALESCE($4, git_info.refresh_token),
      installation_id = COALESCE($5, git_info.installation_id),
      token_expires_at = COALESCE($6, git_info.token_expires_at)
      username = COALESCE($7, git_info.username),
      connection_type = COALESCE($8, git_info.connection_type)
      `,
      [
        userId,
        githubUsername || pijulUsername,
        encryptedUserToken,
        encryptedRefreshToken,
        installationId,
        finalExpiryDate,
        pijulUsername,
        connectionType
      ],
    );

    return {
      success: true,
      message: "Tokens stored successfully",
      stored: {
        userToken: !!userToken,
        refreshToken: !!gitRefreshToken,
        installationId: !!installationId,
        expiryDate: finalExpiryDate,
        githubUsername: githubUsername || pijulUsername
      },
    };
  } catch (error) {
    console.error("Error storing user tokens:", error);
    throw new Error(`Failed to store user tokens: ${error.message}`);
  }
},
  async  retrievegithubUsername(pijulUsername) {
  try {
    const result = await pool.query(
      `
      SELECT provider_username 
      FROM git_info gi
      INNER JOIN users u ON gi.user_id = u.id
      WHERE u.username = $1 
        AND gi.provider = 'github'
      `,
      [pijulUsername],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].provider_username;
  } catch (error) {
    console.error("Error retrieving GitHub username:", error);
    throw new Error(`Failed to retrieve GitHub username: ${error.message}`);
  }
},
  async  retrievepijulUsername(githubUsername) {
  try {
    const result = await pool.query(
      `
      SELECT u.username 
      FROM git_info gi
      INNER JOIN users u ON gi.user_id = u.id
      WHERE gi.provider_username = $1 
        AND gi.provider = 'github'
      `,
      [githubUsername],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0].username;
  } catch (error) {
    console.error("Error retrieving pijul username:", error);
    throw new Error(`Failed to retrieve pijul username: ${error.message}`);
  }
},
 async  getGithubRepoInfo({pijulUsername=null,githubUsername=null, pijulRepoName}) {
  try {
    if(!pijulRepoName && !githubUsername){
      throw new Error("At least one of pijulRepoName or githubUsername must be provided");
    } 
     githubUsername =githubUsername?githubUsername : await this.retrievegithubUsername(pijulUsername);
     pijulUsername = pijulUsername? pijulUsername : await this.retrievepijulUsername(githubUsername);     
    const result = await pool.query(
      `
      SELECT github_repo_name 
      FROM repositories 
      WHERE owner = $1 AND name = $2
      `,
      [pijulUsername, pijulRepoName],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return { 
      githubRepoName: result.rows[0].github_repo_name, 
      githubUsername 
    };
  } catch (error) {
    console.error("Error retrieving repo info:", error);
    throw new Error(`Failed to retrieve repo info: ${error.message}`);
  }
},
async getPijulRepoInfo({githubUsername=null,pijulUsername=null, githubReponame}) {
  try {
    if(!githubReponame && !pijulUsername){
      throw new Error("At least one of githubReponame or pijulUsername must be provided");
    }
    const pijulUsername = pijulUsername || await this.retrievepijulUsername(githubUsername);
    
    if (!pijulUsername) {
      return null;
    }
    
    const result = await pool.query(
      `
      SELECT name, id 
      FROM repositories 
      WHERE owner = $1 AND github_repo_name = $2
      `,
      [pijulUsername, githubReponame],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return { 
      name: result.rows[0].name, 
      owner: pijulUsername, 
      repoId: result.rows[0].id 
    };
  } catch (error) {
    console.error("Error retrieving pijul repo info:", error);
    throw new Error(`Failed to retrieve pijul repo info: ${error.message}`);
  }
},

// Retrieve and decrypt user token
async retrieveUserToken({pijulUsername=null,githubUsername=null}) {
  try {
    if(!pijulUsername && !githubUsername){
      throw new Error("At least one of pijulUsername or githubUsername must be provided");
    }
    
    const result =pijulUsername? await pool.query(
      `
      SELECT gi.access_token, gi.refresh_token, gi.token_expires_at
      FROM git_info gi
      INNER JOIN users u ON gi.user_id = u.id
      WHERE u.username = $1 
        AND gi.provider = 'github'
        AND gi.token_expires_at > NOW()
      `,
      [pijulUsername],
    ) : await pool.query(
      `
      SELECT gi.access_token, gi.refresh_token, gi.token_expires_at
      FROM git_info gi
      INNER JOIN users u ON gi.user_id = u.id
      WHERE u.provider_username = $1 
        AND gi.provider = 'github'
        AND gi.token_expires_at > NOW()
      `,
      [githubUsername],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const tokens = result.rows[0];

    return {
      userToken: tokens.access_token
        ? this.decryptToken(tokens.access_token)
        : null,
      refreshToken: tokens.refresh_token
        ? this.decryptToken(tokens.refresh_token)
        : null,
      expiredAt: tokens.token_expires_at,
    };
  } catch (error) {
    console.error("Error retrieving user token:", error);
    throw new Error(`Failed to retrieve user token: ${error.message}`);
  }
},

// Retrieve installation ID
async retrieveInstallationId({pijulUsername=null,githubUsername=null}) {

  try {
    if(!pijulUsername && !githubUsername){
      throw new Error("At least one of pijulUsername or githubUsername must be provided");
    }
    const result = await pool.query(
      `
      SELECT gi.installation_id 
      FROM git_info gi
      INNER JOIN users u ON gi.user_id = u.id
      WHERE (u.username = $1 OR u.provider_username = $2)
        AND gi.provider = 'github'
      `,
      [pijulUsername ,githubUsername],
    );

    if (result.rows.length === 0 || !result.rows[0].installation_id) {
      return null;
    }

    return result.rows[0].installation_id;
  } catch (error) {
    console.error("Error retrieving installation ID:", error);
    throw new Error(`Failed to retrieve installation ID: ${error.message}`);
  }
},
  // Get authenticated Octokit instance for user
  async getUserOctokit({pijulUsername=null,githubUsername=null}) {
    const { userToken, refreshToken, expiredAt } =
      await this.retrieveUserToken({pijulUsername, githubUsername});

    const octokit = ghApp.oauth.getUserOctokit({
       token: userToken,
    refreshToken: refreshToken,
    expiresAt: expiredAt,
    });

    // ⚠️ CRITICAL: Bind the database update hook inside the constructor lifecycle
    octokit.hook.on("auth-refresh", async (options) => {
     try {
    // Extract the newly generated tokens and their expiration date directly from the event payload
    const { token, refreshToken, expiresAt } = options;   
    console.log(`🔄 Tokens automatically refreshed for user: ${pijulUsername}`);

    // Update your database immediately with the newly rotated values
    await this.storeUserInfo(pijulUsername||await this.retrievePijulUsername(githubUsername), {
      userToken: token,
      refreshToken: refreshToken,
      expiredAt: expiresAt, // Stores the updated ISO string/date timestamp
    });
    
  } catch (error) {
    console.error(`❌ Failed to commit freshly rotated tokens to the database for ${pijulUsername}:`, error);
  }

    });

    return octokit;
  },
  async getActiveUserToken({pijulUsername=null,githubUsername=null}) {
    // 1. Get the self-refreshing Octokit instance
    const octokit = await this.getUserOctokit({pijulUsername, githubUsername});

    // 2. Extract the current state. If the token is already expired,
    const authData = await octokit.auth();
    // 3. Return the guaranteed fresh token string
    return authData.token;
  },
  async getActiveUserTokenbyoctKit(octokit){
  // 1. Get the self-refreshing Octokit instance

    // 2. Extract the current state. If the token is already expired,
    const authData = await octokit.auth();

    // 3. Return the guaranteed fresh token string
    return authData.token;
  }
,
  // Get app installation Octokit instance
  async  getAppOctokit(installationId) {
  // Directly request a pre-authenticated installation client from your root App instance
  const installationOctokit = await ghApp.getInstallationOctokit(installationId);
  
  return installationOctokit;
},
async getAppOctokitbyUsername({pijulUsername=null,githubUsername=null}){
  const installationId = await this.retrieveInstallationId({pijulUsername, githubUsername});
  if(!installationId){
    throw new Error("No installation ID found for user");
  }
  const installationOctokit = await this.getAppOctokit(installationId);
  return installationOctokit;
}
,

  // Create repository (public or private)
  async createRepo({pijulUsername=null,githubUsername=null, repoName, description = "", isPrivate = true}) {
    try {
      if(!pijulUsername && !githubUsername){
        throw new Error("At least one of pijulUsername or githubUsername must be provided");
      }
      const octokit = await this.getUserOctokit({pijulUsername, githubUsername});

      const response = await octokit.request("POST /user/repos", {
        name: repoName,
        description: description,
        private: isPrivate,
        auto_init: false,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return {
        success: true,
        repoUrl: response.data.html_url,
        cloneUrl: response.data.clone_url,
        sshUrl: response.data.ssh_url,
        repoData: response.data,
      };
    } catch (error) {
      console.error("Error creating repository:", error);
      throw new Error(`Failed to create repository: ${error.message}`);
    }
  },

  // Push to repository from local folder with authentication
  async pushToRepo({pijulUsername=null,githubUsername=null, githubRepoName, contributorPijulUsername=null,contributorGithubUsername=null,  gitRepoLocalPath, commitMessage = "Initial commit", branch = "main"}) {
    try {
      if(!pijulUsername && !githubUsername){
        throw new Error("At least one of pijulUsername or githubUsername must be provided");
      }

      const octokit = await this.getUserOctokit({pijulUsername, githubUsername});
      const octokitforcontributor=contributorPijulUsername||contributorGithubUsername?await this.getUserOctokit({pijulUsername: contributorPijulUsername, githubUsername: contributorGithubUsername}):octokit;
      const userInfo = await octokitforcontributor.request("GET /user");
      const userToken = await this.getActiveUserTokenbyoctKit(octokit);
       githubUsername = githubUsername?githubUsername:await this.retrievegithubUsername(pijulUsername);
      // Get user info for git config

      // Create authenticated URL for push
      const authenticatedUrl = `https://${githubUsername}:${userToken}@github.com/${githubUsername}/${githubRepoName}.git`;

      // Initialize simple-git
      const git = simpleGit(gitRepoLocalPath);

      // Check if .git exists, if not initialize
      const gitPath = path.join(gitRepoLocalPath, ".git");
      if (!fs.existsSync(gitPath)) {
        await git.init();
      }

      // Set git user config
      await git.addConfig("user.name", userInfo.data.name || githubUsername);
      await git.addConfig(
        "user.email",
        userInfo.data.email || `${githubUsername}@users.noreply.github.com`,
      );

      // Check if remote origin exists
      try {
        await git.getRemotes();
        const remotes = await git.getRemotes();
        const hasOrigin = remotes.some((remote) => remote.name === "origin");

        if (hasOrigin) {
          // Update existing origin URL
          await git.removeRemote("origin");
        }
      } catch (e) {
        // No remotes found, continue
      }

      // Add remote origin with authentication
      await git.addRemote("origin", authenticatedUrl);

      // Add all files
      await git.add(".");

      // Check if there are changes to commit
      const status = await git.status();
      if (status.files.length > 0) {
        // Commit changes
        await git.commit(commitMessage);
      }

      // Push to remote
      await git.push("origin", branch, ["-u", "--force"]);

      return {
        success: true,
        message: "Successfully pushed to repository",
        repoUrl: `https://github.com/${githubUsername}/${githubRepoName}`,
      };
    } catch (error) {
      console.error("Error pushing to repository:", error);
      throw new Error(`Failed to push to repository: ${error.message}`);
    }
  },

  // Pull from repository to local folder with authentication
  async pullFromRepo({pijulUsername,githubUsername, githubRepoName,  localGitPath, branch = "main"}) {
    try {
      const userToken = await this.getActiveUserToken({pijulUsername,githubUsername});
      const githubUsername=githubUsername?githubUsername:await this.retrievegithubUsername(pijulUsername);
      // Create authenticated URL for clone/pull
      const authenticatedUrl = `https://${githubUsername}:${userToken}@github.com/${githubUsername}/${githubRepoName}.git`;

      // Ensure directory exists
      await fs.ensureDir(localGitPath);

      const git = simpleGit(localGitPath);
      const gitPath = path.join(localGitPath, ".git");

      // Check if the folder is already a git repository
      const isRepo = fs.existsSync(gitPath);

      if (!isRepo) {
        // Clone the repository with authentication
        await git.clone(authenticatedUrl, localGitPath, [
          "--branch",
          branch,
        ]);
      } else {
        // Update remote URL with authentqication if needed
        try {
          const remotes = await git.getRemotes();
          const origin = remotes.find((r) => r.name === "origin");
          if (origin && !origin.refs.fetch.includes(userToken)) {
            await git.removeRemote("origin");
            await git.addRemote("origin", authenticatedUrl);
          }
        } catch (e) {
          // If no remote exists, add it
          await git.addRemote("origin", authenticatedUrl);
        }

        // Pull latest changes with authentication
        await git.pull("origin", branch);
      }

      return {
        success: true,
        message: "Successfully pulled from repository",
        localPath: localGitPath,
      };
    } catch (error) {
      console.error("Error pulling from repository:", error);
      throw new Error(`Failed to pull from repository: ${error.message}`);
    }
  },
async gitLatestCommitInfo(gitLocalPath) {
  try {
    const simpleGit = require('simple-git');
    const git = simpleGit(gitLocalPath);
    
    const log = await git.log({ maxCount: 1 });
    
    if (log.latest) {
      return {
        commitHash: log.latest.hash,
        commitAuthor: log.latest.author_name,
        commitMessage: log.latest.message,
        commitTimestamp: log.latest.date
      };
    }
    
    return null;
    
  } catch (error) {
    console.error('Error getting latest commit info:', error);
    throw new Error(`Failed to get latest commit info: ${error.message}`);
  }
},

  // Push tag to repository with authentication
  async pushTag({pijulUsername,githubUsername, githubRepoName,  tagName,tagMessage = "",   localGitPath = null} ) {
    try {
      if(!pijulUsername && !githubUsername){
        throw new Error("At least one of pijulUsername or githubUsername must be provided");
      }
      githubUsername = githubUsername?githubUsername:await this.retrieveGithubUsername(pijulUsername);
      const userToken = await this.getActiveUserToken({pijulUsername,githubUsername});
      const authenticatedUrl = `https://${githubUsername}:${userToken}@github.com/${githubUsername}/${githubRepoName}.git`;

      let git;
      let tempDir = null;

      if (localGitPath && fs.existsSync(localGitPath)) {
        // Use existing local folder
        git = simpleGit(localGitPath);

        // Update remote URL with authentication
        try {
          const remotes = await git.getRemotes();
          const hasOrigin = remotes.some((remote) => remote.name === "origin");
          if (hasOrigin) {
            await git.removeRemote("origin");
          }
        } catch (e) {}

        await git.addRemote("origin", authenticatedUrl);
      } else {
        // Create temporary directory for tag operations
        tempDir = path.join(process.cwd(), "temp", `${githubRepoName}-${Date.now()}`);
        await fs.ensureDir(tempDir);

        git = simpleGit(tempDir);
        await git.clone(authenticatedUrl, tempDir);
        git.cwd(tempDir);
      }

      // Create tag
      if (tagMessage) {
        await git.addAnnotatedTag(tagName, tagMessage);
      } else {
        await git.addTag(tagName);
      }

      // Push tag to remote
      await git.pushTags("origin");

      // Cleanup temp directory if created
      if (tempDir) {
        await fs.remove(tempDir);
      }

      return {
        success: true,
        message: `Tag '${tagName}' pushed successfully`,
        tagUrl: `https://github.com/${githubUsername}/${githubRepoName}/releases/tag/${tagName}`,
      };
    } catch (error) {
      console.error("Error pushing tag:", error);
      throw new Error(`Failed to push tag: ${error.message}`);
    }
  },

  // Alternative: Push tag using Octokit API (no local repo needed)
  async pushTagViaAPI({pijulUsername,githubUsername, githubRepoName, tagName, commitSha, tagMessage = ""}) {
    try {
      const octokit = await this.getUserOctokit({pijulUsername,githubUsername});
      const githubUsername = githubUsername?githubUsername:await this.retrievegithubUsername(pijulUsername);
      // First, verify user has access to the repo
      try {
        await octokit.request("GET /repos/{owner}/{repo}", {
          owner: githubUsername,
          repo: githubRepoName,
        });
      } catch (error) {
        throw new Error(`Cannot access repository: ${error.message}`);
      }

      // Create tag object
      const tagResponse = await octokit.request(
        "POST /repos/{owner}/{repo}/git/tags",
        {
          owner: githubUsername,
          repo: githubRepoName,
          tag: tagName,
          message: tagMessage || `Release ${tagName}`,
          object: commitSha,
          type: "commit",
          headers: {
            "X-GitHub-Api-Version": "2022-11-28",
          },
        },
      );

      // Create reference (tag)
      await octokit.request("POST /repos/{owner}/{repo}/git/refs", {
        owner: githubUsername,
        repo: githubRepoName,
        ref: `refs/tags/${tagName}`,
        sha: tagResponse.data.sha,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return {
        success: true,
        message: `Tag '${tagName}' created and pushed successfully via API`,
        tagUrl: `https://github.com/${githubUsername}/${githubRepoName}/releases/tag/${tagName}`,
      };
    } catch (error) {
      console.error("Error pushing tag via API:", error);
      throw new Error(`Failed to push tag via API: ${error.message}`);
    }
  },

  // Get user's repositories (including private)
  async getUserRepos({pijulUsername=null,githubUsername=null}) {
    try {
      const octokit = await this.getUserOctokit({pijulUsername,githubUsername});
      const githubUsername = githubUsername?githubUsername:await this.retrieveGithubUsername(pijulUsername);

      const response = await octokit.request("GET /user/repos", {
        visibility: "all",
        per_page: 100,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return {
        success: true,
        repos: response.data.map((repo) => ({
          name: repo.name,
          fullName: repo.full_name,
          private: repo.private,
          url: repo.html_url,
          cloneUrl: repo.clone_url,
        })),
      };
    } catch (error) {
      console.error("Error fetching user repos:", error);
      throw new Error(`Failed to fetch user repositories: ${error.message}`);
    }
  },

  // Helper method to check if user has access to a repo
  async checkRepoAccess({pijulUsername=null,githubUsername=null, repoName}) {

    try {
      const octokit = await this.getUserOctokit({pijulUsername,githubUsername});
      const githubUsername = githubUsername?githubUsername:await this.retrieveGithubUsername(pijulUsername);

      await octokit.request("GET /repos/{owner}/{repo}", {
        owner: githubUsername,
        repo: repoName,
      });

      return { success: true, hasAccess: true };
    } catch (error) {
      if (error.status === 404) {
        return {
          success: false,
          hasAccess: false,
          message: "Repository not found",
        };
      }
      if (error.status === 403) {
        return {
          success: false,
          hasAccess: false,
          message: "Access denied to repository",
        };
      }
      throw error;
    }
  },
};

module.exports = { gitStore, encryptedToken:gitStore.encryptToken ,decryptToken:gitStore.decryptToken };    // ------ exports encryptToken and decryptToken as top-level names, but they're only methods on gitStore, so those exports will be undefined ------ guys

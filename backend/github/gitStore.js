const crypto = require("crypto");
const { Octokit } = require("@octokit/core");
const { createOAuthUserAuth } = require("@octokit/auth-oauth-user");
const { createAppAuth } = require("@octokit/auth-app");
const simpleGit = require("simple-git");
const fs = require("fs-extra");
const path = require("path");
const { pool } = require("../db");
const {ghApp}= require("./gittoken")
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
  async storeUserToken(
    username,
    {
      userToken = null,
      gitRefreshToken = null,
      installationId = null,
      expiryDate = null,
    },
  ) {
    try {
      // Encrypt tokens only if they are provided
      const encryptedUserToken = userToken ? userToken : null;
      const encryptedRefreshToken = gitRefreshToken
        ? this.encryptToken(gitRefreshToken)
        : null;

      // Check if user exists
      const userResult = await pool.query(
        `SELECT id FROM users WHERE username = $1`,
        [username],
      );

      if (userResult.rows.length === 0) {
        throw new Error(`User ${username} not found`);
      }

      const userId = userResult.rows[0].id;

      // Use provided expiry date or calculate default (30 days from now)
      const finalExpiryDate = expiryDate;

      // Insert or update - only update provided fields
      await pool.query(
        `
      INSERT INTO user_tokens (user_id, username, git_enc_token, git_refresh_token, installation_id, expired_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        git_enc_token = COALESCE(EXCLUDED.git_enc_token, user_tokens.git_enc_token),
        git_refresh_token = COALESCE(EXCLUDED.git_refresh_token, user_tokens.git_refresh_token),
        installation_id = COALESCE(EXCLUDED.installation_id, user_tokens.installation_id),
        expired_at = EXCLUDED.expired_at
    `,
        [
          userId,
          username,
          encryptedUserToken,
          encryptedRefreshToken,
          installationId,
          finalExpiryDate,
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
        },
      };
    } catch (error) {
      console.error("Error storing user tokens:", error);
      throw new Error(`Failed to store user tokens: ${error.message}`);
    }
  },
  // Retrieve and decrypt user token
  async retrieveUserToken(username) {
    try {
      const result = await pool.query(
        `
      SELECT git_enc_token, git_refresh_token, expired_at
      FROM user_tokens 
      WHERE username = $1 AND expired_at > NOW()
    `,
        [username],
      );

      if (result.rows.length === 0) {
        return null;
      }

      const tokens = result.rows[0];

      return {
        userToken: tokens.git_enc_token
          ? this.decryptToken(tokens.git_enc_token)
          : null,
        refreshToken: tokens.git_refresh_token
          ? this.decryptToken(tokens.git_refresh_token)
          : null,
        expiredAt: tokens.expired_at,
      };
    } catch (error) {
      console.error("Error retrieving user token:", error);
      throw new Error(`Failed to retrieve user token: ${error.message}`);
    }
  },

  // Retrieve installation ID
  async retrieveInstallationId(username) {
    try {
      const result = await pool.query(
        `
      SELECT installation_id FROM user_tokens WHERE username = $1
    `,
        [username],
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
  async getUserOctokit(username) {
    const { userToken, refreshToken, expiredAt } =
      await this.retrieveUserToken(username);

    const octokit = ghApp.oauth.getUserOctokit({
       token: userToken,
    refreshToken: refreshToken,
    expiresAt: expiredAt,
    });

    // ⚠️ CRITICAL: Bind the database update hook inside the constructor lifecycle
    octokit.hook.on("auth-refresh", async (options) => {
     try {
    // Extract the newly generated tokens and their expiration date directly from the event payload
    const { token, refreshToken, expiresAt } = newAuthData;

    console.log(`🔄 Tokens automatically refreshed for user: ${username}`);

    // Update your database immediately with the newly rotated values
    await this.storeUserToken(username, {
      userToken: token,
      refreshToken: refreshToken,
      expiredAt: expiresAt, // Stores the updated ISO string/date timestamp
    });
    
  } catch (error) {
    console.error(`❌ Failed to commit freshly rotated tokens to the database for ${username}:`, error);
  }

    });

    return octokit;
  },
  async getActiveUserToken(username) {
    // 1. Get the self-refreshing Octokit instance
    const octokit = await this.getUserOctokit(username);

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

  // Create repository (public or private)
  async createRepo(username, repoName, description = "", isPrivate = true) {
    try {
      const octokit = await this.getUserOctokit(username);

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
  async pushToRepo(username,repoName, {contributorUsername, localFolderPath, commitMessage = "Initial commit", branch = "main"}) {
    try {
      const octokit = await this.getUserOctokit(username);
      const octokitforcontributor=contributorUsername?await this.getUserOctokit(contributorUsername):octokit;
      const userInfo = await octokitforcontributor.request("GET /user");
      const userToken = await this.getActiveUserTokenbyoctKit(octokit);

      // Get user info for git config

      // Create authenticated URL for push
      const authenticatedUrl = `https://${username}:${userToken}@github.com/${username}/${repoName}.git`;

      // Initialize simple-git
      const git = simpleGit(localFolderPath);

      // Check if .git exists, if not initialize
      const gitPath = path.join(localFolderPath, ".git");
      if (!fs.existsSync(gitPath)) {
        await git.init();
      }

      // Set git user config
      await git.addConfig("user.name", userInfo.data.name || username);
      await git.addConfig(
        "user.email",
        userInfo.data.email || `${username}@users.noreply.github.com`,
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
        repoUrl: `https://github.com/${username}/${repoName}`,
      };
    } catch (error) {
      console.error("Error pushing to repository:", error);
      throw new Error(`Failed to push to repository: ${error.message}`);
    }
  },

  // Pull from repository to local folder with authentication
  async pullFromRepo(username, repoName, localFolderPath, branch = "main") {
    try {
      const userToken = await this.getActiveUserToken(username);

      // Create authenticated URL for clone/pull
      const authenticatedUrl = `https://${username}:${userToken}@github.com/${username}/${repoName}.git`;

      // Ensure directory exists
      await fs.ensureDir(localFolderPath);

      const git = simpleGit(localFolderPath);
      const gitPath = path.join(localFolderPath, ".git");

      // Check if the folder is already a git repository
      const isRepo = fs.existsSync(gitPath);

      if (!isRepo) {
        // Clone the repository with authentication
        await git.clone(authenticatedUrl, localFolderPath, [
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
        localPath: localFolderPath,
      };
    } catch (error) {
      console.error("Error pulling from repository:", error);
      throw new Error(`Failed to pull from repository: ${error.message}`);
    }
  },

  // Push tag to repository with authentication
  async pushTag(username,repoName, { tagName,tagMessage = "",  localFolderPath = null} ) {
    try {
      const userToken = await this.getActiveUserToken(username);
      const authenticatedUrl = `https://${username}:${userToken}@github.com/${username}/${repoName}.git`;

      let git;
      let tempDir = null;

      if (localFolderPath && fs.existsSync(localFolderPath)) {
        // Use existing local folder
        git = simpleGit(localFolderPath);

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
        tempDir = path.join(process.cwd(), "temp", `${repoName}-${Date.now()}`);
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
        tagUrl: `https://github.com/${username}/${repoName}/releases/tag/${tagName}`,
      };
    } catch (error) {
      console.error("Error pushing tag:", error);
      throw new Error(`Failed to push tag: ${error.message}`);
    }
  },

  // Alternative: Push tag using Octokit API (no local repo needed)
  async pushTagViaAPI(username, repoName, tagName, commitSha, tagMessage = "") {
    try {
      const octokit = await this.getUserOctokit(username);

      // First, verify user has access to the repo
      try {
        await octokit.request("GET /repos/{owner}/{repo}", {
          owner: username,
          repo: repoName,
        });
      } catch (error) {
        throw new Error(`Cannot access repository: ${error.message}`);
      }

      // Create tag object
      const tagResponse = await octokit.request(
        "POST /repos/{owner}/{repo}/git/tags",
        {
          owner: username,
          repo: repoName,
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
        owner: username,
        repo: repoName,
        ref: `refs/tags/${tagName}`,
        sha: tagResponse.data.sha,
        headers: {
          "X-GitHub-Api-Version": "2022-11-28",
        },
      });

      return {
        success: true,
        message: `Tag '${tagName}' created and pushed successfully via API`,
        tagUrl: `https://github.com/${username}/${repoName}/releases/tag/${tagName}`,
      };
    } catch (error) {
      console.error("Error pushing tag via API:", error);
      throw new Error(`Failed to push tag via API: ${error.message}`);
    }
  },

  // Get user's repositories (including private)
  async getUserRepos(username) {
    try {
      const octokit = await this.getUserOctokit(username);

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
  async checkRepoAccess(username, repoName) {

    try {
      const octokit = await this.getUserOctokit(username);

      await octokit.request("GET /repos/{owner}/{repo}", {
        owner: username,
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

module.exports = { gitStore, encryptToken, decryptToken };
